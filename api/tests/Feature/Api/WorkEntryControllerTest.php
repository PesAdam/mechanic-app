<?php

namespace Tests\Feature\Api;

use App\Models\User;
use App\Models\WorkEntry;
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

    public function test_manual_entry_can_be_filed_under_a_job_and_reassigned_later(): void
    {
        $this->freezeTime();
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $order = WorkOrder::factory()->open()->create();
        $brakes = $order->operations()->create(['name' => 'Brzdy', 'norm_minutes' => 60, 'sort' => 0]);
        $oil = $order->operations()->create(['name' => 'Olej', 'norm_minutes' => 30, 'sort' => 1]);

        $this->postJson("/api/v1/orders/{$order->id}/work-entries", ['minutes' => 30, 'order_operation_id' => $brakes->id])
            ->assertOk()
            ->assertJsonPath('data.work_entries.0.order_operation_id', $brakes->id)
            ->assertJsonPath('data.operations.0.seconds', 1800);
        $entry = WorkEntry::query()->firstOrFail();

        $this->patchJson("/api/v1/work-entries/{$entry->id}", ['order_operation_id' => $oil->id, 'note' => 'Olej a filter'])
            ->assertOk()
            ->assertJsonPath('data.work_entries.0.order_operation_id', $oil->id)
            ->assertJsonPath('data.work_entries.0.note', 'Olej a filter')
            ->assertJsonPath('data.operations.0.seconds', 0)
            ->assertJsonPath('data.operations.1.seconds', 1800);

        $this->patchJson("/api/v1/work-entries/{$entry->id}", ['order_operation_id' => null])
            ->assertOk()
            ->assertJsonPath('data.work_entries.0.order_operation_id', null);
    }

    public function test_reassigning_is_refused_on_a_closed_order_and_for_a_foreign_job(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $closed = WorkOrder::factory()->unpaid()->create();
        $entry = WorkEntry::factory()->for($closed)->create();
        $this->patchJson("/api/v1/work-entries/{$entry->id}", ['note' => 'x'])->assertConflict();

        $open = WorkOrder::factory()->open()->create();
        $mine = WorkEntry::factory()->for($open)->create();
        $foreign = $closed->operations()->create(['name' => 'Brzdy', 'norm_minutes' => 60, 'sort' => 0]);
        $this->patchJson("/api/v1/work-entries/{$mine->id}", ['order_operation_id' => $foreign->id])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('order_operation_id');
    }

    public function test_a_stint_of_a_closed_order_cannot_be_deleted(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $closed = WorkOrder::factory()->unpaid()->create();
        $entry = WorkEntry::factory()->for($closed)->create();

        $this->deleteJson("/api/v1/work-entries/{$entry->id}")->assertConflict();
        $this->assertDatabaseHas('work_entries', ['id' => $entry->id]);
    }
}
