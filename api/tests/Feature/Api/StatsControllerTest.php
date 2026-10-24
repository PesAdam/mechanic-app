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

class StatsControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    /** A closed order with 2 h of work at 25 €/h and one part bought for 30 € and billed at 45 € (MOC). */
    private function closedOrder(string $closedAt, array $attributes = []): WorkOrder
    {
        $order = WorkOrder::factory()->create(['status' => 'done', 'closed_at' => $closedAt] + $attributes);
        WorkEntry::factory()->for($order)->create(['started_at' => "$closedAt -2 hours", 'ended_at' => $closedAt]);
        Part::factory()->for($order)->create(['price' => 45, 'purchase_price' => 30]);

        return $order;
    }

    public function test_month_shows_earnings_without_parts_next_to_the_previous_month_and_a_year_earlier(): void
    {
        $this->travelTo('2026-10-24 12:00:00');
        Setting::set('hourly_rate', 25);
        Sanctum::actingAs(User::factory()->create());
        $this->closedOrder('2026-10-05 16:00:00');
        $this->closedOrder('2026-10-20 16:00:00', ['total_override' => 85, 'total_original' => 95]);
        $this->closedOrder('2026-09-10 16:00:00');
        $this->closedOrder('2025-10-15 16:00:00');
        WorkOrder::factory()->open()->create();

        $response = $this->getJson('/api/v1/stats?period=month&date=2026-10-24');

        $response->assertOk()
            ->assertJsonPath('label', 'Október 2026')
            ->assertJsonPath('previous_date', '2026-09-01')
            ->assertJsonPath('next_date', null)
            ->assertJsonPath('current.orders', 2)
            ->assertJsonPath('current.billed', 180)
            ->assertJsonPath('current.labor', 100)
            ->assertJsonPath('current.parts_billed', 90)
            ->assertJsonPath('current.parts_cost', 60)
            ->assertJsonPath('current.parts_margin', 30)
            ->assertJsonPath('current.discount', 10)
            ->assertJsonPath('current.earnings', 120)
            ->assertJsonPath('current.hours', 4)
            ->assertJsonPath('current.per_hour', 30)
            ->assertJsonPath('previous.label', 'September 2026')
            ->assertJsonPath('previous.earnings', 65)
            ->assertJsonPath('year_earlier.label', 'Október 2025')
            ->assertJsonPath('year_earlier.earnings', 65)
            ->assertJsonCount(12, 'trend')
            ->assertJsonPath('trend.11.label', 'okt')
            ->assertJsonPath('trend.11.earnings', 120)
            ->assertJsonPath('trend.10.earnings', 65)
            ->assertJsonPath('trend.0.date', '2025-11-01')
            ->assertJsonCount(2, 'orders')
            ->assertJsonPath('orders.1.billed', 85)
            ->assertJsonPath('orders.1.earnings', 55);
    }

    public function test_weeks_compare_with_the_same_iso_week_a_year_earlier_and_can_be_paged(): void
    {
        $this->travelTo('2026-10-24 12:00:00');
        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/v1/stats?period=week&date=2026-10-14')
            ->assertOk()
            ->assertJsonPath('label', 'Týždeň 42 · 12.–18. 10. 2026')
            ->assertJsonPath('previous_date', '2026-10-05')
            ->assertJsonPath('next_date', '2026-10-19')
            ->assertJsonPath('year_earlier.label', 'Týždeň 42 · 13.–19. 10. 2025')
            ->assertJsonPath('current.per_hour', null);

        $this->getJson('/api/v1/stats?period=year')
            ->assertOk()
            ->assertJsonPath('label', 'Rok 2026')
            ->assertJsonPath('year_earlier', null)
            ->assertJsonCount(5, 'trend')
            ->assertJsonPath('trend.0.label', '2022');
    }

    public function test_unknown_period_is_rejected(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/v1/stats?period=decade')->assertUnprocessable();
    }
}
