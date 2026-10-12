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
}
