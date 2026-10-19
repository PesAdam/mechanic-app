<?php

namespace Tests\Feature\Api;

use App\Models\User;
use App\Models\WorkEntry;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TimerControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_start_opens_a_running_stint_and_assigns_the_mechanic(): void
    {
        $this->freezeTime();
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $order = WorkOrder::factory()->create();

        $response = $this->postJson("/api/v1/orders/{$order->id}/timer/start");

        $response->assertOk()
            ->assertJsonPath('data.status', 'open')
            ->assertJsonPath('data.mechanic.id', $user->id)
            ->assertJsonPath('data.work_entries.0.ended_at', null);
        $this->assertDatabaseHas('work_entries', ['work_order_id' => $order->id, 'user_id' => $user->id, 'ended_at' => null]);
    }

    public function test_start_twice_keeps_a_single_running_stint(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $order = WorkOrder::factory()->open()->create();

        $this->postJson("/api/v1/orders/{$order->id}/timer/start");
        $this->postJson("/api/v1/orders/{$order->id}/timer/start");

        $this->assertDatabaseCount('work_entries', 1);
    }

    public function test_start_on_another_order_stops_the_previous_stint(): void
    {
        $this->freezeTime();
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $first = WorkOrder::factory()->open()->create();
        $second = WorkOrder::factory()->open()->create();
        $previous = WorkEntry::factory()->for($first)->for($user)->running()->create(['started_at' => now()->subMinutes(20)]);

        $response = $this->postJson("/api/v1/orders/{$second->id}/timer/start");

        $response->assertOk();
        $this->assertSame(now()->toDateTimeString(), $previous->fresh()->ended_at->toDateTimeString());
        $this->assertDatabaseHas('work_entries', ['work_order_id' => $second->id, 'user_id' => $user->id, 'ended_at' => null]);
    }

    public function test_start_returns_409_when_the_order_is_closed(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $order = WorkOrder::factory()->unpaid()->create();

        $response = $this->postJson("/api/v1/orders/{$order->id}/timer/start");

        $response->assertConflict();
        $this->assertDatabaseCount('work_entries', 0);
    }

    public function test_stop_ends_the_stint_and_totals_count_its_seconds(): void
    {
        $this->travelTo('2026-10-12 10:00:00');
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $order = WorkOrder::factory()->open()->create();
        $this->postJson("/api/v1/orders/{$order->id}/timer/start");
        $this->travelTo('2026-10-12 11:30:00');

        $response = $this->postJson("/api/v1/orders/{$order->id}/timer/stop");

        $response->assertOk()
            ->assertJsonPath('data.work_entries.0.ended_at', '2026-10-12T09:30:00.000000Z')
            ->assertJsonPath('data.totals.seconds', 5400)
            ->assertJsonPath('data.totals.labor', 42);
    }

    public function test_start_against_a_job_and_switching_to_another_closes_the_first_stint(): void
    {
        $this->travelTo('2026-10-19 08:00:00');
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $order = WorkOrder::factory()->open()->create();
        $brakes = $order->operations()->create(['name' => 'Brzdy', 'norm_minutes' => 60, 'sort' => 0]);
        $oil = $order->operations()->create(['name' => 'Olej', 'norm_minutes' => 30, 'sort' => 1]);

        $this->postJson("/api/v1/orders/{$order->id}/timer/start", ['order_operation_id' => $brakes->id])
            ->assertOk()
            ->assertJsonPath('data.work_entries.0.order_operation_id', $brakes->id);
        // The same job again changes nothing.
        $this->postJson("/api/v1/orders/{$order->id}/timer/start", ['order_operation_id' => $brakes->id])->assertOk();
        $this->assertDatabaseCount('work_entries', 1);

        $this->travelTo('2026-10-19 08:40:00');
        $response = $this->postJson("/api/v1/orders/{$order->id}/timer/start", ['order_operation_id' => $oil->id]);

        $response->assertOk()
            ->assertJsonPath('data.work_entries.0.ended_at', '2026-10-19T06:40:00.000000Z')
            ->assertJsonPath('data.work_entries.1.order_operation_id', $oil->id)
            ->assertJsonPath('data.work_entries.1.ended_at', null)
            ->assertJsonPath('data.operations.0.seconds', 2400)
            ->assertJsonPath('data.operations.1.seconds', 0)
            ->assertJsonPath('data.totals.seconds', 2400);
    }

    public function test_start_rejects_a_job_from_another_order(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $order = WorkOrder::factory()->open()->create();
        $foreign = WorkOrder::factory()->open()->create()->operations()->create(['name' => 'Brzdy', 'norm_minutes' => 60, 'sort' => 0]);

        $this->postJson("/api/v1/orders/{$order->id}/timer/start", ['order_operation_id' => $foreign->id])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('order_operation_id');
        $this->assertDatabaseCount('work_entries', 0);
    }

    public function test_stop_files_a_jobless_stint_under_the_job_named_on_the_way_out(): void
    {
        $this->travelTo('2026-10-19 10:00:00');
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $order = WorkOrder::factory()->open()->create();
        $job = $order->operations()->create(['name' => 'Brzdy', 'norm_minutes' => 60, 'sort' => 0]);
        $this->postJson("/api/v1/orders/{$order->id}/timer/start")->assertOk()->assertJsonPath('data.work_entries.0.order_operation_id', null);
        $this->travelTo('2026-10-19 10:30:00');

        $this->postJson("/api/v1/orders/{$order->id}/timer/stop", ['order_operation_id' => $job->id])
            ->assertOk()
            ->assertJsonPath('data.work_entries.0.order_operation_id', $job->id)
            ->assertJsonPath('data.work_entries.0.ended_at', '2026-10-19T08:30:00.000000Z')
            ->assertJsonPath('data.operations.0.seconds', 1800);
    }

    public function test_a_bare_start_does_not_demote_a_running_job_stint(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $order = WorkOrder::factory()->open()->create();
        $job = $order->operations()->create(['name' => 'Brzdy', 'norm_minutes' => 60, 'sort' => 0]);
        $this->postJson("/api/v1/orders/{$order->id}/timer/start", ['order_operation_id' => $job->id])->assertOk();

        // A stale screen's big Štart: nothing changes.
        $this->postJson("/api/v1/orders/{$order->id}/timer/start")->assertOk()->assertJsonPath('data.work_entries.0.order_operation_id', $job->id);
        $this->assertDatabaseCount('work_entries', 1);

        // An explicit "bez úkonu" does switch.
        $this->postJson("/api/v1/orders/{$order->id}/timer/start", ['order_operation_id' => null])->assertOk()->assertJsonPath('data.work_entries.1.order_operation_id', null);
        $this->assertDatabaseCount('work_entries', 2);
    }

    public function test_a_forgotten_stopwatch_is_closed_at_the_cap_and_flagged(): void
    {
        $this->travelTo('2026-10-20 08:00:00');
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $order = WorkOrder::factory()->open()->create();
        $forgotten = WorkEntry::factory()->for($order)->for($user)->running()->create(['started_at' => '2026-10-19 17:02:00']);
        $fresh = WorkEntry::factory()->for($order)->for($user)->running()->create(['started_at' => '2026-10-20 07:30:00']);

        $this->getJson('/api/v1/orders')->assertOk();

        $this->assertSame('2026-10-20 03:02:00', $forgotten->fresh()->ended_at->toDateTimeString());
        $this->assertStringContainsString('auto-ukončené', $forgotten->fresh()->note);
        $this->assertNull($fresh->fresh()->ended_at);
    }
}
