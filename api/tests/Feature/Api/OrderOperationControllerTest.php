<?php

namespace Tests\Feature\Api;

use App\Models\Operation;
use App\Models\Setting;
use App\Models\User;
use App\Models\WorkEntry;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OrderOperationControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_adding_a_catalogue_job_snapshots_its_norm_into_the_order(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $order = WorkOrder::factory()->open()->create();
        $job = Operation::factory()->create(['name' => 'Výmena kotúčov vpredu', 'norm_minutes' => 90]);

        $response = $this->postJson("/api/v1/orders/{$order->id}/operations", ['operation_id' => $job->id]);

        $response->assertOk()
            ->assertJsonPath('data.operations.0.name', 'Výmena kotúčov vpredu')
            ->assertJsonPath('data.operations.0.norm_minutes', 90)
            ->assertJsonPath('data.totals.norm_seconds', 5400)
            ->assertJsonPath('data.totals.delta_seconds', 5400);
        $this->assertDatabaseHas('order_operations', ['work_order_id' => $order->id, 'operation_id' => $job->id, 'norm_minutes' => 90]);
    }

    public function test_custom_job_needs_a_name_and_norm(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $order = WorkOrder::factory()->open()->create();

        $response = $this->postJson("/api/v1/orders/{$order->id}/operations", []);

        $response->assertUnprocessable()->assertJsonValidationErrors(['name', 'norm_minutes']);
        $this->assertDatabaseCount('order_operations', 0);
    }

    public function test_closing_splits_measured_time_across_jobs_and_feeds_the_catalogue_average(): void
    {
        $this->freezeTime();
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $order = WorkOrder::factory()->open()->create();
        $long = Operation::factory()->create(['norm_minutes' => 60]);
        $short = Operation::factory()->create(['norm_minutes' => 30]);
        $this->postJson("/api/v1/orders/{$order->id}/operations", ['operation_id' => $long->id]);
        $this->postJson("/api/v1/orders/{$order->id}/operations", ['operation_id' => $short->id]);
        WorkEntry::factory()->for($order)->for($user)->create(['started_at' => now()->subMinutes(90), 'ended_at' => now()]);

        $this->postJson("/api/v1/orders/{$order->id}/close")->assertOk();

        $this->assertDatabaseHas('operation_samples', ['operation_id' => $long->id, 'actual_seconds' => 3600, 'norm_minutes' => 60]);
        $this->assertDatabaseHas('operation_samples', ['operation_id' => $short->id, 'actual_seconds' => 1800, 'norm_minutes' => 30]);
        $this->getJson('/api/v1/operations')
            ->assertOk()
            ->assertJsonFragment(['id' => $long->id, 'avg_seconds' => 3600, 'samples_count' => 1]);
    }

    public function test_norm_billing_charges_norm_hours_instead_of_measured_time(): void
    {
        $this->freezeTime();
        Setting::set('hourly_rate', 28);
        Setting::set('labor_billing', 'norm');
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $order = WorkOrder::factory()->open()->create();
        $job = Operation::factory()->create(['norm_minutes' => 60]);
        $this->postJson("/api/v1/orders/{$order->id}/operations", ['operation_id' => $job->id]);
        WorkEntry::factory()->for($order)->for($user)->create(['started_at' => now()->subMinutes(30), 'ended_at' => now()]);

        $response = $this->getJson("/api/v1/orders/{$order->id}");

        $response->assertOk()
            ->assertJsonPath('data.totals.labor_billing', 'norm')
            ->assertJsonPath('data.totals.labor', 28)
            ->assertJsonPath('data.totals.labor_actual', 14)
            ->assertJsonPath('data.totals.delta_seconds', 1800);
    }

    public function test_ticking_a_job_done_stops_the_stint_clocked_against_it(): void
    {
        $this->travelTo('2026-10-19 10:00:00');
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $order = WorkOrder::factory()->open()->create();
        $job = $order->operations()->create(['name' => 'Brzdy', 'norm_minutes' => 60, 'sort' => 0]);
        $this->postJson("/api/v1/orders/{$order->id}/timer/start", ['order_operation_id' => $job->id])->assertOk();
        $this->travelTo('2026-10-19 10:20:00');

        $this->patchJson("/api/v1/order-operations/{$job->id}", ['done' => true])
            ->assertOk()
            ->assertJsonPath('data.operations.0.done', true)
            ->assertJsonPath('data.operations.0.seconds', 1200)
            ->assertJsonPath('data.work_entries.0.ended_at', '2026-10-19T08:20:00.000000Z')
            // The car is still on the lift: the stopwatch carries on, now as plain order time.
            ->assertJsonPath('data.work_entries.1.order_operation_id', null)
            ->assertJsonPath('data.work_entries.1.ended_at', null);
    }

    public function test_ticking_a_job_done_moves_the_stopwatch_to_the_next_open_job_and_leaves_colleagues_alone(): void
    {
        $this->travelTo('2026-10-19 10:00:00');
        $me = User::factory()->create();
        $colleague = User::factory()->create();
        Sanctum::actingAs($me);
        $order = WorkOrder::factory()->open()->create();
        $brakes = $order->operations()->create(['name' => 'Brzdy', 'norm_minutes' => 60, 'sort' => 0]);
        $oil = $order->operations()->create(['name' => 'Olej', 'norm_minutes' => 30, 'sort' => 1]);
        $this->postJson("/api/v1/orders/{$order->id}/timer/start", ['order_operation_id' => $brakes->id])->assertOk();
        $theirs = WorkEntry::factory()->for($order)->for($colleague)->running()->create(['order_operation_id' => $brakes->id]);

        $this->patchJson("/api/v1/order-operations/{$brakes->id}", ['done' => true])->assertOk();

        $mine = $order->workEntries()->where('user_id', $me->id)->whereNull('ended_at')->first();
        $this->assertSame($oil->id, $mine->order_operation_id);
        $this->assertNull($theirs->fresh()->ended_at);
    }

    public function test_closed_orders_freeze_their_jobs_and_a_job_with_time_cannot_be_deleted(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $closed = WorkOrder::factory()->unpaid()->create();
        $frozen = $closed->operations()->create(['name' => 'Brzdy', 'norm_minutes' => 60, 'sort' => 0]);
        $this->patchJson("/api/v1/order-operations/{$frozen->id}", ['norm_minutes' => 10])->assertConflict();
        $this->deleteJson("/api/v1/order-operations/{$frozen->id}")->assertConflict();

        $open = WorkOrder::factory()->open()->create();
        $clocked = $open->operations()->create(['name' => 'Olej', 'norm_minutes' => 30, 'sort' => 0]);
        WorkEntry::factory()->for($open)->for($user)->create(['order_operation_id' => $clocked->id]);
        $this->deleteJson("/api/v1/order-operations/{$clocked->id}")->assertConflict();
        $this->assertDatabaseHas('order_operations', ['id' => $clocked->id]);

        $empty = $open->operations()->create(['name' => 'Filter', 'norm_minutes' => 10, 'sort' => 1]);
        $this->deleteJson("/api/v1/order-operations/{$empty->id}")->assertOk();
    }

    public function test_jobs_carry_their_billed_share_and_amount(): void
    {
        $this->freezeTime();
        Setting::set('hourly_rate', 30);
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $order = WorkOrder::factory()->open()->create();
        $brakes = $order->operations()->create(['name' => 'Brzdy', 'norm_minutes' => 60, 'sort' => 0, 'done' => true]);
        $oil = $order->operations()->create(['name' => 'Olej', 'norm_minutes' => 30, 'sort' => 1]);
        // 30 min on the oil, 60 min forgotten: the forgotten hour goes to the ticked brakes job that has no time yet.
        WorkEntry::factory()->for($order)->for($user)->create(['order_operation_id' => $oil->id, 'started_at' => now()->subMinutes(90), 'ended_at' => now()->subMinutes(60)]);
        WorkEntry::factory()->for($order)->for($user)->create(['started_at' => now()->subMinutes(60), 'ended_at' => now()]);

        $this->getJson("/api/v1/orders/{$order->id}")
            ->assertOk()
            ->assertJsonPath('data.operations.0.billed_seconds', 3600)
            ->assertJsonPath('data.operations.0.amount', 30)
            ->assertJsonPath('data.operations.1.billed_seconds', 1800)
            ->assertJsonPath('data.operations.1.amount', 15)
            ->assertJsonPath('data.totals.labor', 45);
        $brakes->refresh();
        $oil->refresh();
    }

    public function test_closing_credits_assigned_time_to_its_job_and_splits_only_the_rest(): void
    {
        $this->freezeTime();
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $order = WorkOrder::factory()->open()->create();
        $long = Operation::factory()->create(['norm_minutes' => 60]);
        $short = Operation::factory()->create(['norm_minutes' => 30]);
        $this->postJson("/api/v1/orders/{$order->id}/operations", ['operation_id' => $long->id]);
        $this->postJson("/api/v1/orders/{$order->id}/operations", ['operation_id' => $short->id]);
        $ops = $order->operations()->get();
        // 50 min clocked against the short job; the 90 min without a job belong to the job that has no time of its own.
        WorkEntry::factory()->for($order)->for($user)->create(['order_operation_id' => $ops[1]->id, 'started_at' => now()->subMinutes(140), 'ended_at' => now()->subMinutes(90)]);
        WorkEntry::factory()->for($order)->for($user)->create(['started_at' => now()->subMinutes(90), 'ended_at' => now()]);

        $this->postJson("/api/v1/orders/{$order->id}/close")->assertOk();

        $this->assertDatabaseHas('operation_samples', ['operation_id' => $long->id, 'actual_seconds' => 5400]);
        $this->assertDatabaseHas('operation_samples', ['operation_id' => $short->id, 'actual_seconds' => 3000]);
    }
}
