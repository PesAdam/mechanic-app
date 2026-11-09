<?php

namespace Tests\Feature\Api;

use App\Enums\RequestStatus;
use App\Models\Car;
use App\Models\Customer;
use App\Models\Operation;
use App\Models\Part;
use App\Models\ServiceRequest;
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

    /** An order closed and paid on the same day, with 2 h of work at 25 €/h and one part bought for 30 € and billed at 45 € (MOC). */
    private function paidOrder(string $paidAt, array $attributes = []): WorkOrder
    {
        $order = WorkOrder::factory()->create($attributes + ['status' => 'done', 'closed_at' => $paidAt, 'paid_at' => $paidAt]);
        WorkEntry::factory()->for($order)->create(['started_at' => "$paidAt -2 hours", 'ended_at' => $paidAt]);
        Part::factory()->for($order)->create(['price' => 45, 'purchase_price' => 30]);

        return $order;
    }

    public function test_month_shows_earnings_without_parts_next_to_the_previous_month_and_a_year_earlier(): void
    {
        $this->travelTo('2026-10-24 12:00:00');
        Setting::set('hourly_rate', 25);
        Sanctum::actingAs(User::factory()->create());
        $this->paidOrder('2026-10-05 16:00:00');
        $this->paidOrder('2026-10-20 16:00:00', ['total_override' => 85, 'total_original' => 95]);
        $this->paidOrder('2026-09-10 16:00:00');
        $this->paidOrder('2025-10-15 16:00:00');
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
            ->assertJsonPath('orders.1.earnings', 55)
            ->assertJsonPath('pending.orders', 0);
    }

    public function test_an_order_counts_in_the_month_it_was_paid_and_waits_in_the_month_it_was_closed_until_then(): void
    {
        $this->travelTo('2026-10-24 12:00:00');
        Setting::set('hourly_rate', 25);
        Sanctum::actingAs(User::factory()->create());
        $this->paidOrder('2026-09-28 16:00:00', ['paid_at' => '2026-10-02 09:00:00']);
        $this->paidOrder('2026-10-22 16:00:00', ['status' => 'unpaid']);

        $this->getJson('/api/v1/stats?period=month&date=2026-10-24')
            ->assertOk()
            ->assertJsonPath('current.orders', 1)
            ->assertJsonPath('current.earnings', 65)
            ->assertJsonPath('orders.0.paid_at', '2026-10-02T09:00:00+02:00')
            ->assertJsonPath('pending.orders', 1)
            ->assertJsonPath('pending.labor', 50)
            ->assertJsonPath('pending.earnings', 65);

        $this->getJson('/api/v1/stats?period=month&date=2026-09-15')
            ->assertOk()
            ->assertJsonPath('current.orders', 0)
            ->assertJsonPath('pending.orders', 0);
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

    public function test_insights_break_the_month_down_by_day_job_car_customer_size_payment_and_working_hours(): void
    {
        $this->travelTo('2026-08-01 10:00:00');
        Setting::set('hourly_rate', 25);
        $regular = Customer::factory()->create(['name' => 'Kubišta']);
        WorkOrder::factory()->create(['customer_id' => $regular->id]);
        $this->travelTo('2026-10-24 12:00:00');
        Sanctum::actingAs(User::factory()->create(['role' => 'owner']));
        $peter = User::factory()->create(['name' => 'Peter']);
        $jano = User::factory()->create(['name' => 'Jano']);

        // Paid two days after closing: an oil change (norm 1 h, clocked 2 h on Monday morning) and a part with 15 € margin.
        $oil = WorkOrder::factory()->create(['customer_id' => $regular->id, 'status' => 'done', 'received_at' => '2026-10-01 08:00:00', 'closed_at' => '2026-10-03 16:00:00', 'paid_at' => '2026-10-05 17:00:00']);
        $job = $oil->operations()->create(['operation_id' => Operation::factory()->create(['name' => 'Výmena oleja', 'category' => 'servis'])->id, 'name' => 'Výmena oleja', 'norm_minutes' => 60, 'sort' => 0, 'done' => true]);
        WorkEntry::factory()->for($oil)->for($peter)->create(['order_operation_id' => $job->id, 'started_at' => '2026-10-05 08:00:00', 'ended_at' => '2026-10-05 10:00:00']);
        Part::factory()->for($oil)->create(['price' => 45, 'purchase_price' => 30]);

        // A new customer's BMW, paid on the spot: one hour on Tuesday afternoon, no jobs.
        $newcomer = Customer::factory()->create();
        $bmw = WorkOrder::factory()->create(['customer_id' => $newcomer->id, 'car_id' => Car::factory()->create(['customer_id' => $newcomer->id, 'make' => 'BMW'])->id, 'status' => 'done', 'received_at' => '2026-10-20 15:30:00', 'closed_at' => '2026-10-20 15:30:00', 'paid_at' => '2026-10-20 15:30:00']);
        WorkEntry::factory()->for($bmw)->for($jano)->create(['started_at' => '2026-10-20 14:00:00', 'ended_at' => '2026-10-20 15:00:00']);

        WorkOrder::factory()->create(['status' => 'unpaid', 'closed_at' => '2026-10-10 12:00:00']);
        ServiceRequest::factory()->create(['status' => RequestStatus::Accepted, 'created_at' => '2026-10-12 09:00:00']);

        $this->getJson('/api/v1/stats?period=month&date=2026-10-24')->assertOk()
            ->assertJsonPath('insights.averages.order_billed', 60)
            ->assertJsonPath('insights.averages.order_earnings', 45)
            ->assertJsonPath('insights.averages.biggest.number', $oil->number)
            ->assertJsonCount(31, 'insights.breakdown')
            ->assertJsonPath('insights.breakdown.4.labor', 50)
            ->assertJsonPath('insights.breakdown.4.parts_margin', 15)
            ->assertJsonPath('insights.breakdown.19.earnings', 25)
            ->assertJsonPath('insights.jobs.categories.0', ['key' => 'servis', 'labor' => 50, 'jobs' => 1])
            ->assertJsonPath('insights.jobs.categories.1', ['key' => 'bez', 'labor' => 25, 'jobs' => 1])
            ->assertJsonPath('insights.jobs.top.0', ['name' => 'Výmena oleja', 'count' => 1, 'labor' => 50, 'avg_minutes' => 120, 'norm_minutes' => 60])
            ->assertJsonPath('insights.jobs.efficiency', 50)
            ->assertJsonPath('insights.makes.0', ['make' => 'Škoda', 'orders' => 1, 'earnings' => 65])
            ->assertJsonPath('insights.makes.1.make', 'BMW')
            ->assertJsonPath('insights.customers.count', 2)
            ->assertJsonPath('insights.customers.new', 1)
            ->assertJsonPath('insights.customers.returning', 1)
            ->assertJsonPath('insights.customers.top.0.name', 'Kubišta')
            ->assertJsonPath('insights.sizes.0.count', 1)
            ->assertJsonPath('insights.sizes.1.count', 1)
            ->assertJsonPath('insights.payment.avg_days', 1)
            ->assertJsonPath('insights.payment.bands.0.count', 1)
            ->assertJsonPath('insights.payment.bands.1.count', 1)
            ->assertJsonPath('insights.work.hours', 3)
            ->assertJsonPath('insights.work.mechanics.0', ['id' => $peter->id, 'name' => 'Peter', 'hours' => 2, 'orders' => 1])
            ->assertJsonPath('insights.work.weekdays.0.hours', 2)
            ->assertJsonPath('insights.work.weekdays.1.hours', 1)
            ->assertJsonPath('insights.work.heatmap.rows.0.cells.2', 1)
            ->assertJsonPath('insights.work.heatmap.rows.0.cells.3', 1)
            ->assertJsonPath('insights.work.heatmap.rows.1.cells.8', 1)
            ->assertJsonPath('insights.owed.count', 1)
            ->assertJsonPath('insights.owed.oldest_days', 14)
            ->assertJsonPath('insights.owed.bands.1.count', 1)
            ->assertJsonPath('insights.year.current.9', 90)
            ->assertJsonPath('insights.year.current.10', null)
            ->assertJsonPath('insights.year.previous.11', 0)
            ->assertJsonPath('insights.requests', ['count' => 1, 'accepted' => 1, 'rejected' => 0, 'waiting' => 0]);
    }

    public function test_unknown_period_is_rejected(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/v1/stats?period=decade')->assertUnprocessable();
    }
}
