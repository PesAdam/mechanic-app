<?php

namespace Tests\Feature\Api;

use App\Models\Customer;
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

    public function test_lowering_the_parts_margin_moves_zarobok_and_never_what_the_customer_pays(): void
    {
        $this->travelTo('2026-11-02 12:00:00');
        Sanctum::actingAs(User::factory()->create(['role' => 'owner']));
        $order = WorkOrder::factory()->create(['status' => 'done', 'closed_at' => now(), 'paid_at' => now()]);
        Part::factory()->for($order)->create(['price' => 553.68, 'purchase_price' => 442.68]);

        $this->patchJson("/api/v1/orders/{$order->id}", ['parts_margin_adjustment' => -50])
            ->assertOk()
            ->assertJsonPath('data.parts_margin_adjustment', -50)
            ->assertJsonPath('data.totals.parts_margin', 61)
            ->assertJsonPath('data.totals.grand', 553.68);

        $this->getJson('/api/v1/stats?period=month&date=2026-11-02')
            ->assertJsonPath('current.billed', 553.68)
            ->assertJsonPath('current.parts_adjustment', -50)
            ->assertJsonPath('current.parts_margin', 61)
            ->assertJsonPath('current.earnings', 61)
            ->assertJsonPath('orders.0.earnings', 61);
        $this->getJson('/api/v1/dashboard?period=week')->assertJsonPath('kpi.parts_margin', 61)->assertJsonPath('kpi.earnings', 61);
        $this->getJson("/api/v1/public/reports/{$order->public_token}")
            ->assertJsonPath('order.parts_margin_adjustment', null)
            ->assertJsonPath('order.totals.grand', 553.68)
            ->assertJsonMissingPath('order.totals.parts_margin');

        $this->patchJson("/api/v1/orders/{$order->id}", ['parts_margin_adjustment' => null])->assertOk()->assertJsonPath('data.totals.parts_margin', 111);
    }

    public function test_stred_bills_each_part_halfway_between_moc_and_nc_on_the_order_and_the_report(): void
    {
        $this->freezeTime();
        Sanctum::actingAs(User::factory()->create(['role' => 'owner']));
        $order = WorkOrder::factory()->unpaid()->create();
        Part::factory()->for($order)->create(['price' => 553.68, 'purchase_price' => 442.68]);
        Part::factory()->for($order)->create(['price' => 10.01, 'purchase_price' => 10.00]);
        Part::factory()->for($order)->create(['price' => 20, 'purchase_price' => null]);

        $this->patchJson("/api/v1/orders/{$order->id}", ['parts_pricing' => 'mid'])
            ->assertOk()
            ->assertJsonPath('data.parts_pricing', 'mid')
            ->assertJsonPath('data.totals.parts', 528.19)
            ->assertJsonPath('data.totals.parts_margin', 55.51)
            ->assertJsonPath('data.totals.grand', 528.19);

        // The half cent rounds up and a part without an NC keeps its MOC, exactly as the web app prices them.
        $this->getJson("/api/v1/public/reports/{$order->public_token}")
            ->assertJsonPath('order.parts.0.price', 498.18)
            ->assertJsonPath('order.parts.1.price', 10.01)
            ->assertJsonPath('order.parts.2.price', 20)
            ->assertJsonPath('order.totals.parts', 528.19);
    }

    public function test_nc_plus_10_bills_each_part_a_tenth_above_its_nc_on_the_order_and_the_report(): void
    {
        $this->freezeTime();
        Sanctum::actingAs(User::factory()->create(['role' => 'owner']));
        $order = WorkOrder::factory()->unpaid()->create();
        Part::factory()->for($order)->create(['price' => 553.68, 'purchase_price' => 442.68]);
        Part::factory()->for($order)->create(['price' => 10.01, 'purchase_price' => 4.45]);
        Part::factory()->for($order)->create(['price' => 20, 'purchase_price' => null]);

        $this->patchJson("/api/v1/orders/{$order->id}", ['parts_pricing' => 'n10'])
            ->assertOk()
            ->assertJsonPath('data.parts_pricing', 'n10')
            ->assertJsonPath('data.totals.parts', 511.85)
            ->assertJsonPath('data.totals.parts_margin', 44.72)
            ->assertJsonPath('data.totals.grand', 511.85);
        $this->assertSame('n10', $order->fresh()->parts_pricing->value);

        // 4.45 + 10 % is 4.895: the half cent rounds up, and a part without an NC keeps its MOC.
        $this->getJson("/api/v1/public/reports/{$order->public_token}")
            ->assertJsonPath('order.parts.0.price', 486.95)
            ->assertJsonPath('order.parts.1.price', 4.9)
            ->assertJsonPath('order.parts.2.price', 20)
            ->assertJsonPath('order.totals.parts', 511.85);
    }

    public function test_the_report_note_reaches_the_customer_report_and_an_emptied_one_is_gone(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'owner']));
        $order = WorkOrder::factory()->unpaid()->create();

        $this->patchJson("/api/v1/orders/{$order->id}", ['report_note' => "  Vymenený olej a filter.\nNabudúce skontrolovať brzdy.  "])
            ->assertOk()
            ->assertJsonPath('data.report_note', "Vymenený olej a filter.\nNabudúce skontrolovať brzdy.");
        $this->getJson("/api/v1/public/reports/{$order->public_token}")
            ->assertJsonPath('order.report_note', "Vymenený olej a filter.\nNabudúce skontrolovať brzdy.");

        $this->patchJson("/api/v1/orders/{$order->id}", ['report_note' => '   '])
            ->assertOk()
            ->assertJsonPath('data.report_note', null);
        $this->assertNull($order->fresh()->report_note);
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

    public function test_total_edited_on_an_open_order_is_compared_with_the_final_sum_at_closing(): void
    {
        Sanctum::actingAs(User::factory()->create());
        Setting::set('hourly_rate', 28);
        $order = WorkOrder::factory()->open()->create();
        Part::factory()->for($order)->create(['price' => 100]);

        $this->patchJson("/api/v1/orders/{$order->id}", ['total_override' => 90])->assertOk()->assertJsonPath('data.total_original', 100);
        Part::factory()->for($order)->create(['price' => 20]);

        $this->postJson("/api/v1/orders/{$order->id}/close")
            ->assertOk()
            ->assertJsonPath('data.totals.grand', 90)
            ->assertJsonPath('data.total_original', 120);
    }

    public function test_marking_paid_measures_the_edited_total_against_the_corrected_sum(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $order = WorkOrder::factory()->unpaid()->create(['total_override' => 90, 'total_original' => 100]);
        Part::factory()->for($order)->create(['price' => 120]);

        $this->patchJson("/api/v1/orders/{$order->id}", ['status' => 'done'])
            ->assertOk()
            ->assertJsonPath('data.totals.grand', 90)
            ->assertJsonPath('data.total_original', 120);
    }

    public function test_marking_paid_stamps_the_day_of_payment_and_taking_it_back_clears_it(): void
    {
        $this->travelTo('2026-10-29 16:40:00');
        Sanctum::actingAs(User::factory()->create());
        $order = WorkOrder::factory()->unpaid()->create(['closed_at' => '2026-10-27 12:00:00']);

        // Bratislava is UTC+1 after the clocks went back on 25. 10.
        $this->patchJson("/api/v1/orders/{$order->id}", ['status' => 'done'])
            ->assertOk()
            ->assertJsonPath('data.paid_at', '2026-10-29T15:40:00.000000Z')
            ->assertJsonPath('data.closed_at', '2026-10-27T11:00:00.000000Z');

        $this->patchJson("/api/v1/orders/{$order->id}", ['summary' => 'Brzdy vzadu'])->assertJsonPath('data.paid_at', '2026-10-29T15:40:00.000000Z');
        $this->patchJson("/api/v1/orders/{$order->id}", ['status' => 'unpaid'])->assertJsonPath('data.paid_at', null);
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

    public function test_renaming_the_customer_on_the_latest_order_leaves_the_car_s_finished_reports_in_the_old_name(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $paid = WorkOrder::factory()->paid()->create(['customer_id' => Customer::factory()->create(['name' => 'Peter Kubišta'])->id]);
        $open = WorkOrder::factory()->open()->create(['customer_id' => $paid->customer_id, 'car_id' => $paid->car_id]);

        $this->patchJson("/api/v1/orders/{$open->id}", ['customer' => ['name' => 'Dominik Šalát']])
            ->assertOk()
            ->assertJsonPath('data.customer.name', 'Dominik Šalát');

        // The paid order and its report still belong to Peter; the open order got a customer row of its own.
        $this->assertSame($paid->customer_id, $paid->fresh()->customer_id);
        $this->assertDatabaseHas('customers', ['id' => $paid->customer_id, 'name' => 'Peter Kubišta']);
        $this->assertNotSame($paid->customer_id, $open->fresh()->customer_id);
        $this->getJson("/api/v1/public/reports/{$paid->public_token}")->assertOk()->assertJsonPath('order.customer.name', 'Peter Kubišta');
        // The car goes with its latest order, so the next visit prefills Dominik.
        $this->assertSame($open->fresh()->customer_id, $paid->car->fresh()->customer_id);
    }

    public function test_fixing_the_name_on_an_old_order_does_not_hand_the_car_to_that_person(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $old = WorkOrder::factory()->paid()->create(['customer_id' => Customer::factory()->create(['name' => 'Dominik Šalát'])->id]);
        $latest = WorkOrder::factory()->open()->create(['customer_id' => $old->customer_id, 'car_id' => $old->car_id]);

        $this->patchJson("/api/v1/orders/{$old->id}", ['customer' => ['name' => 'Peter Kubišta']])
            ->assertOk()
            ->assertJsonPath('data.customer.name', 'Peter Kubišta');

        $this->assertDatabaseHas('customers', ['id' => $old->fresh()->customer_id, 'name' => 'Peter Kubišta']);
        $this->assertSame($latest->customer_id, $latest->fresh()->customer_id);
        $this->assertDatabaseHas('customers', ['id' => $latest->customer_id, 'name' => 'Dominik Šalát']);
        $this->assertSame($latest->customer_id, $old->car->fresh()->customer_id);
    }

    public function test_a_returning_car_with_a_new_owner_keeps_the_old_orders_in_the_old_name(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $old = WorkOrder::factory()->paid()->create(['customer_id' => Customer::factory()->create(['name' => 'Peter Kubišta', 'phone' => '+421 900 000 001'])->id]);

        $response = $this->postJson('/api/v1/orders', [
            'customer' => ['name' => 'Dominik Šalát'],
            'car' => ['id' => $old->car_id, 'make' => 'Škoda', 'model' => 'Octavia III 2.0 TDI', 'plate' => $old->car->plate],
            'summary' => 'Olej a filtre',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.customer.name', 'Dominik Šalát')
            ->assertJsonPath('data.car.id', $old->car_id);
        $this->assertSame($old->customer_id, $old->fresh()->customer_id);
        $this->assertDatabaseHas('customers', ['id' => $old->customer_id, 'name' => 'Peter Kubišta', 'phone' => '+421 900 000 001']);
        $this->assertSame($response->json('data.customer.id'), $old->car->fresh()->customer_id);
    }

    public function test_update_rejects_negative_mileage_and_invalid_email(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $order = WorkOrder::factory()->create();

        $this->patchJson("/api/v1/orders/{$order->id}", ['km' => -5, 'customer' => ['email' => 'nie-je-email']])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['km', 'customer.email']);
    }

    public function test_update_fixes_plate_and_vin_of_the_car(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $order = WorkOrder::factory()->create();

        $this->patchJson("/api/v1/orders/{$order->id}", ['car' => ['plate' => 'pb 066 dk', 'vin' => 'vf38bwjyf80188442']])
            ->assertOk()
            ->assertJsonPath('data.car.plate', 'PB 066 DK')
            ->assertJsonPath('data.car.vin', 'VF38BWJYF80188442');

        $this->patchJson("/api/v1/orders/{$order->id}", ['car' => ['vin' => null]])->assertOk()->assertJsonPath('data.car.vin', null);
    }

    public function test_update_needs_make_and_model_together(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $order = WorkOrder::factory()->create();

        $this->patchJson("/api/v1/orders/{$order->id}", ['car' => ['model' => '406']])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['car.make']);
    }

    public function test_order_can_be_planned_and_the_plan_round_trips_as_utc(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $order = WorkOrder::factory()->create();

        $this->patchJson("/api/v1/orders/{$order->id}", ['planned_at' => '2026-10-20T06:30:00.000Z', 'planned_minutes' => 90])
            ->assertOk()
            ->assertJsonPath('data.planned_at', '2026-10-20T06:30:00.000000Z')
            ->assertJsonPath('data.planned_minutes', 90);
        // Stored as wall-clock time in the app timezone (CEST), like every other timestamp.
        $this->assertDatabaseHas('work_orders', ['id' => $order->id, 'planned_at' => '2026-10-20 08:30:00', 'planned_minutes' => 90]);

        $this->patchJson("/api/v1/orders/{$order->id}", ['planned_at' => null, 'planned_minutes' => null])
            ->assertOk()
            ->assertJsonPath('data.planned_at', null)
            ->assertJsonPath('data.planned_minutes', null);
        $this->patchJson("/api/v1/orders/{$order->id}", ['planned_minutes' => 2])->assertUnprocessable()->assertJsonValidationErrors('planned_minutes');
    }

    public function test_store_accepts_a_plan(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/v1/orders', [
            'customer' => ['name' => 'Ján Kováč'],
            'car' => ['make' => 'Škoda', 'model' => 'Fabia III', 'plate' => 'ZA 1 AA'],
            'summary' => 'Olej',
            'planned_at' => '2026-10-21T07:00:00Z',
            'planned_minutes' => 45,
        ])->assertCreated()
            ->assertJsonPath('data.planned_at', '2026-10-21T07:00:00.000000Z')
            ->assertJsonPath('data.planned_minutes', 45);
    }
}
