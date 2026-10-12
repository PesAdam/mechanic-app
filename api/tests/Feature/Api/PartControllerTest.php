<?php

namespace Tests\Feature\Api;

use App\Models\Part;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PartControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_adding_a_part_raises_the_parts_total(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $order = WorkOrder::factory()->open()->create();

        $response = $this->postJson("/api/v1/orders/{$order->id}/parts", [
            'name' => 'Brzdové kotúče ATE 312 mm',
            'meta' => '2 ks',
            'price' => 89.9,
        ]);

        $response->assertOk()
            ->assertJsonPath('data.parts.0.name', 'Brzdové kotúče ATE 312 mm')
            ->assertJsonPath('data.totals.parts', 89.9);
        $this->assertDatabaseHas('parts', ['work_order_id' => $order->id, 'price' => 89.9, 'used' => true]);
    }

    public function test_purchase_price_is_costed_separately_from_the_retail_price(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $order = WorkOrder::factory()->open()->create();

        $response = $this->postJson("/api/v1/orders/{$order->id}/parts", [
            'name' => 'Snímač EGR',
            'price' => 112,
            'purchase_price' => 84,
        ]);

        $response->assertOk()
            ->assertJsonPath('data.parts.0.price', 112)
            ->assertJsonPath('data.parts.0.purchase_price', 84)
            ->assertJsonPath('data.totals.parts', 112)
            ->assertJsonPath('data.totals.parts_cost', 84);
        $this->assertDatabaseHas('parts', ['work_order_id' => $order->id, 'price' => 112, 'purchase_price' => 84]);
    }

    public function test_part_without_purchase_price_is_costed_at_retail(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $order = WorkOrder::factory()->open()->create();
        Part::factory()->for($order)->create(['price' => 50, 'purchase_price' => null]);

        $response = $this->getJson("/api/v1/orders/{$order->id}");

        $response->assertOk()
            ->assertJsonPath('data.parts.0.purchase_price', null)
            ->assertJsonPath('data.totals.parts_cost', 50);
    }

    public function test_marking_a_part_unused_removes_it_from_the_totals(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $order = WorkOrder::factory()->open()->create();
        $part = Part::factory()->for($order)->create(['price' => 89.9]);

        $response = $this->patchJson("/api/v1/parts/{$part->id}", ['used' => false]);

        $response->assertOk()
            ->assertJsonPath('data.parts.0.used', false)
            ->assertJsonPath('data.totals.parts', 0);
        $this->assertDatabaseHas('parts', ['id' => $part->id, 'used' => false]);
    }
}
