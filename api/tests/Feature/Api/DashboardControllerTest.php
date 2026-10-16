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

class DashboardControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_week_summary_counts_hours_parts_billing_and_dues_inside_the_week(): void
    {
        $this->travelTo('2026-10-14 12:00:00'); // streda, týždeň 42
        Setting::set('hourly_rate', 28);
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $open = WorkOrder::factory()->open()->create();
        WorkEntry::factory()->for($open)->for($user)->create(['started_at' => '2026-10-12 09:00:00', 'ended_at' => '2026-10-12 11:00:00']);
        WorkEntry::factory()->for($open)->for($user)->create(['started_at' => '2026-10-14 10:00:00', 'ended_at' => '2026-10-14 10:30:00']);
        WorkEntry::factory()->for($open)->for($user)->create(['started_at' => '2026-10-05 09:00:00', 'ended_at' => '2026-10-05 10:00:00']);
        Part::factory()->for($open)->create(['price' => 100, 'purchase_price' => 70, 'added_at' => '2026-10-13 09:00:00']);
        Part::factory()->for($open)->create(['price' => 50, 'added_at' => '2026-09-30 09:00:00']);
        $unpaid = WorkOrder::factory()->unpaid()->create(['closed_at' => '2026-10-12 12:00:00']);
        WorkEntry::factory()->for($unpaid)->for($user)->create(['started_at' => '2026-10-12 08:00:00', 'ended_at' => '2026-10-12 09:00:00']);
        Part::factory()->for($unpaid)->create(['price' => 20, 'purchase_price' => 15, 'added_at' => '2026-10-12 08:30:00']);

        $response = $this->getJson('/api/v1/dashboard?period=week');

        $response->assertOk()
            ->assertJsonPath('label', 'Týždeň 42 · 12.–18. 10. 2026')
            ->assertJsonPath('kpi.hours', 3.5)
            ->assertJsonPath('kpi.labor', 98)
            ->assertJsonPath('kpi.parts', 85)
            ->assertJsonPath('kpi.parts_retail', 120)
            ->assertJsonPath('kpi.active_days', 2)
            ->assertJsonPath('kpi.billed', 48)
            ->assertJsonPath('kpi.due', 48)
            ->assertJsonPath('kpi.due_count', 1)
            ->assertJsonPath('bars.0.label', 'Po')
            ->assertJsonPath('bars.0.labor', 84)
            ->assertJsonPath('bars.0.parts', 15)
            ->assertJsonPath('bars.1.parts', 70)
            ->assertJsonPath('bars.2.labor', 14)
            ->assertJsonPath('mechanics.0.hours', 3.5)
            ->assertJsonPath('avg_hours_per_order', 1.8);
    }

    public function test_paid_counts_settled_orders_closed_inside_the_period_at_their_billed_total(): void
    {
        $this->travelTo('2026-10-14 12:00:00');
        Sanctum::actingAs(User::factory()->create());
        WorkOrder::factory()->create(['status' => 'done', 'closed_at' => '2026-10-13 12:00:00', 'total_original' => 40, 'total_override' => 30]);
        WorkOrder::factory()->create(['status' => 'done', 'closed_at' => '2026-10-01 12:00:00', 'total_override' => 99]);
        WorkOrder::factory()->unpaid()->create(['closed_at' => '2026-10-12 12:00:00', 'total_override' => 20]);

        $this->getJson('/api/v1/dashboard?period=week')
            ->assertOk()
            ->assertJsonPath('kpi.billed', 50)
            ->assertJsonPath('kpi.paid', 30)
            ->assertJsonPath('kpi.paid_count', 1)
            ->assertJsonPath('kpi.due', 20);
    }

    public function test_unknown_period_returns_422(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/v1/dashboard?period=decade')->assertUnprocessable();
    }
}
