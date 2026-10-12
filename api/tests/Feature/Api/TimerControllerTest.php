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
}
