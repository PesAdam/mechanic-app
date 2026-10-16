<?php

namespace Tests\Feature\Api;

use App\Models\Part;
use App\Models\Setting;
use App\Models\User;
use App\Models\WorkEntry;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class WorkOrderControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_index_returns_401_without_token(): void
    {
        $this->getJson('/api/v1/orders')->assertUnauthorized();
    }

    public function test_index_returns_orders_with_relations_and_totals(): void
    {
        $this->freezeTime();
        $mechanic = User::factory()->create();
        Sanctum::actingAs($mechanic);
        Setting::set('hourly_rate', 28);
        $order = WorkOrder::factory()->open()->create(['mechanic_id' => $mechanic->id]);
        Part::factory()->for($order)->create(['price' => 50]);
        Part::factory()->for($order)->unused()->create(['price' => 999]);
        WorkEntry::factory()->for($order)->for($mechanic)->create(['started_at' => now()->subMinutes(30), 'ended_at' => now()]);

        $response = $this->getJson('/api/v1/orders');

        $response->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.number', $order->number)
            ->assertJsonPath('data.0.mechanic.id', $mechanic->id)
            ->assertJsonPath('data.0.totals.seconds', 1800)
            ->assertJsonPath('data.0.totals.parts', 50)
            ->assertJsonPath('data.0.totals.labor', 14)
            ->assertJsonPath('data.0.totals.grand', 64);
    }

    public function test_store_creates_customer_car_and_order_with_the_next_number(): void
    {
        Sanctum::actingAs(User::factory()->create());
        WorkOrder::factory()->create(['number' => '0231']);

        $response = $this->postJson('/api/v1/orders', [
            'customer' => ['name' => 'Ján Kováč', 'phone' => '+421 905 123 456'],
            'car' => ['make' => 'Škoda', 'model' => 'Octavia III', 'plate' => 'za 412 kl', 'km' => 184230],
            'summary' => 'Brzdy vpredu',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.number', '0232')
            ->assertJsonPath('data.status', 'new')
            ->assertJsonPath('data.car.plate', 'ZA 412 KL')
            ->assertJsonPath('data.customer.name', 'Ján Kováč');
        $this->assertDatabaseHas('work_orders', ['number' => '0232', 'summary' => 'Brzdy vpredu']);
        $this->assertDatabaseHas('cars', ['plate' => 'ZA 412 KL', 'km' => 184230]);
        $this->assertDatabaseHas('customers', ['name' => 'Ján Kováč']);
    }

    public function test_store_rejects_an_empty_payload(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $response = $this->postJson('/api/v1/orders', []);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['customer.name', 'car.make', 'car.model', 'car.plate', 'summary']);
        $this->assertDatabaseCount('work_orders', 0);
    }

    public function test_close_with_purchase_pricing_bills_parts_at_nc(): void
    {
        $this->freezeTime();
        Setting::set('hourly_rate', 28);
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $order = WorkOrder::factory()->open()->create();
        Part::factory()->for($order)->create(['price' => 100, 'purchase_price' => 70]);
        WorkEntry::factory()->for($order)->for($user)->create(['started_at' => now()->subHour(), 'ended_at' => now()]);

        $response = $this->postJson("/api/v1/orders/{$order->id}/close", ['parts_pricing' => 'nc']);

        $response->assertOk()
            ->assertJsonPath('data.parts_pricing', 'nc')
            ->assertJsonPath('data.totals.parts', 70)
            ->assertJsonPath('data.totals.parts_retail', 100)
            ->assertJsonPath('data.totals.parts_cost', 70)
            ->assertJsonPath('data.totals.grand', 98);
        $this->assertDatabaseHas('work_orders', ['id' => $order->id, 'parts_pricing' => 'nc', 'status' => 'unpaid']);
    }

    public function test_parts_pricing_can_be_switched_back_to_retail(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $order = WorkOrder::factory()->create(['parts_pricing' => 'nc']);
        Part::factory()->for($order)->create(['price' => 100, 'purchase_price' => 70]);

        $response = $this->patchJson("/api/v1/orders/{$order->id}", ['parts_pricing' => 'moc']);

        $response->assertOk()
            ->assertJsonPath('data.parts_pricing', 'moc')
            ->assertJsonPath('data.totals.parts', 100);
    }

    public function test_total_can_be_overridden_and_keeps_the_original(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $order = WorkOrder::factory()->create(['parts_pricing' => 'moc']);
        Part::factory()->for($order)->create(['price' => 100, 'purchase_price' => 70]);

        $this->patchJson("/api/v1/orders/{$order->id}", ['total_override' => 80])
            ->assertOk()
            ->assertJsonPath('data.total_override', 80)
            ->assertJsonPath('data.total_original', 100)
            ->assertJsonPath('data.totals.grand', 80)
            ->assertJsonPath('data.totals.grand_computed', 100);
        $this->assertDatabaseHas('work_orders', ['id' => $order->id, 'total_override' => 80, 'total_original' => 100]);

        $this->patchJson("/api/v1/orders/{$order->id}", ['total_override' => null])
            ->assertOk()
            ->assertJsonPath('data.total_override', null)
            ->assertJsonPath('data.total_original', null)
            ->assertJsonPath('data.totals.grand', 100);
    }

    public function test_total_override_rejects_a_negative_amount(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $order = WorkOrder::factory()->create();

        $this->patchJson("/api/v1/orders/{$order->id}", ['total_override' => -5])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('total_override');
    }

    public function test_close_stops_running_stints_and_marks_the_order_unpaid(): void
    {
        $this->freezeTime();
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $order = WorkOrder::factory()->open()->create();
        $entry = WorkEntry::factory()->for($order)->for($user)->running()->create(['started_at' => now()->subHour()]);

        $response = $this->postJson("/api/v1/orders/{$order->id}/close");

        $response->assertOk()
            ->assertJsonPath('data.status', 'unpaid')
            ->assertJsonPath('data.totals.seconds', 3600);
        $this->assertSame(now()->toDateTimeString(), $entry->fresh()->ended_at->toDateTimeString());
        $this->assertDatabaseHas('work_orders', ['id' => $order->id, 'status' => 'unpaid']);
    }

    public function test_update_saves_mileage_and_customer_details(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $order = WorkOrder::factory()->create();

        $response = $this->patchJson("/api/v1/orders/{$order->id}", [
            'km' => 184500,
            'customer' => ['name' => 'Jakub Jakubík', 'phone' => '+421 900 123 456', 'email' => 'jakub@example.sk'],
        ]);

        $response->assertOk()
            ->assertJsonPath('data.car.km', 184500)
            ->assertJsonPath('data.customer.phone', '+421 900 123 456')
            ->assertJsonPath('data.customer.email', 'jakub@example.sk');
        $this->assertDatabaseHas('cars', ['id' => $order->car_id, 'km' => 184500]);
        $this->assertDatabaseHas('customers', ['id' => $order->customer_id, 'name' => 'Jakub Jakubík']);
    }

    public function test_update_rejects_negative_mileage_and_invalid_email(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $order = WorkOrder::factory()->create();

        $this->patchJson("/api/v1/orders/{$order->id}", ['km' => -5, 'customer' => ['email' => 'nie-je-email']])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['km', 'customer.email']);
    }
}
