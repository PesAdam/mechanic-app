<?php

namespace Tests\Feature\Api;

use App\Models\Operation;
use App\Models\OperationSample;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OperationControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_creates_a_catalogue_job_with_its_norm(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $response = $this->postJson('/api/v1/operations', ['name' => 'Výmena spojky', 'category' => 'prevodovka', 'norm_minutes' => 300]);

        $response->assertCreated()
            ->assertJsonPath('data.name', 'Výmena spojky')
            ->assertJsonPath('data.norm_minutes', 300)
            ->assertJsonPath('data.avg_seconds', null);
        $this->assertDatabaseHas('operations', ['name' => 'Výmena spojky', 'category' => 'prevodovka', 'norm_minutes' => 300]);
    }

    public function test_rejects_a_duplicate_job_name(): void
    {
        Sanctum::actingAs(User::factory()->create());
        Operation::factory()->create(['name' => 'Výmena spojky']);

        $response = $this->postJson('/api/v1/operations', ['name' => 'Výmena spojky', 'norm_minutes' => 300]);

        $response->assertUnprocessable()->assertJsonValidationErrors(['name']);
        $this->assertDatabaseCount('operations', 1);
    }

    public function test_job_with_history_is_deactivated_instead_of_deleted(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $job = Operation::factory()->create();
        $order = WorkOrder::factory()->create();
        OperationSample::query()->create(['operation_id' => $job->id, 'work_order_id' => $order->id, 'actual_seconds' => 1200, 'norm_minutes' => 30, 'recorded_at' => now()]);

        $response = $this->deleteJson("/api/v1/operations/{$job->id}");

        $response->assertOk()->assertJsonPath('data.is_active', false);
        $this->assertDatabaseHas('operations', ['id' => $job->id, 'is_active' => false]);
    }

    public function test_job_without_history_is_deleted(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $job = Operation::factory()->create();

        $this->deleteJson("/api/v1/operations/{$job->id}")->assertNoContent();

        $this->assertDatabaseMissing('operations', ['id' => $job->id]);
    }
}
