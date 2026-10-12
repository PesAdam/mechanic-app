<?php

namespace Tests\Feature\Api;

use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class WorkEntryControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_manual_entry_creates_a_finished_stint_with_its_author(): void
    {
        $this->freezeTime();
        $me = User::factory()->create();
        $colleague = User::factory()->create();
        Sanctum::actingAs($me);
        $order = WorkOrder::factory()->create();

        $response = $this->postJson("/api/v1/orders/{$order->id}/work-entries", [
            'minutes' => 45,
            'note' => 'Skúšobná jazda',
            'user_id' => $colleague->id,
        ]);

        $response->assertOk()
            ->assertJsonPath('data.status', 'open')
            ->assertJsonPath('data.mechanic.id', $colleague->id)
            ->assertJsonPath('data.work_entries.0.user.id', $colleague->id)
            ->assertJsonPath('data.work_entries.0.seconds', 2700)
            ->assertJsonPath('data.work_entries.0.manual', true)
            ->assertJsonPath('data.work_entries.0.note', 'Skúšobná jazda');
        $this->assertDatabaseHas('work_entries', ['work_order_id' => $order->id, 'user_id' => $colleague->id, 'manual' => true]);
    }

    public function test_manual_entry_rejects_zero_minutes(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $order = WorkOrder::factory()->create();

        $response = $this->postJson("/api/v1/orders/{$order->id}/work-entries", ['minutes' => 0]);

        $response->assertUnprocessable()->assertJsonValidationErrors(['minutes']);
        $this->assertDatabaseCount('work_entries', 0);
    }
}
