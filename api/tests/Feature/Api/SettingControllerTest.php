<?php

namespace Tests\Feature\Api;

use App\Models\Setting;
use App\Models\User;
use App\Models\WorkEntry;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SettingControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_mechanic_is_forbidden_to_update_settings(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'mechanic']));

        $response = $this->patchJson('/api/v1/settings', ['hourly_rate' => 30]);

        $response->assertForbidden();
        $this->assertDatabaseMissing('settings', ['key' => 'hourly_rate']);
    }

    public function test_owner_updates_the_hourly_rate_and_business_identity(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'owner']));

        $response = $this->patchJson('/api/v1/settings', [
            'hourly_rate' => 32,
            'business' => ['name' => 'AutoBelo', 'vat_payer' => true],
        ]);

        $response->assertOk()
            ->assertJsonPath('hourly_rate', 32)
            ->assertJsonPath('business.name', 'AutoBelo')
            ->assertJsonPath('business.vat_payer', true);
        $this->assertSame('32', Setting::get('hourly_rate'));
        $this->assertDatabaseHas('settings', ['key' => 'business.name', 'value' => 'AutoBelo']);
    }

    public function test_a_new_rate_prices_orders_taken_from_now_on_and_never_reprices_older_ones(): void
    {
        $this->travelTo('2026-11-01 12:00:00');
        Setting::set('hourly_rate', 25);
        Setting::set('report_labor', 'time');
        Sanctum::actingAs(User::factory()->create(['role' => 'owner']));
        $paidOrder = function (): WorkOrder {
            $order = WorkOrder::factory()->create(['status' => 'done', 'closed_at' => now(), 'paid_at' => now()]);
            WorkEntry::factory()->for($order)->create(['started_at' => now()->subHours(2), 'ended_at' => now()]);

            return $order;
        };
        $before = $paidOrder();

        $this->patchJson('/api/v1/settings', ['hourly_rate' => 30])->assertOk();
        $after = $paidOrder();

        $this->getJson("/api/v1/orders/{$before->id}")->assertJsonPath('data.hourly_rate', 25)->assertJsonPath('data.totals.labor', 50);
        $this->getJson("/api/v1/orders/{$after->id}")->assertJsonPath('data.hourly_rate', 30)->assertJsonPath('data.totals.labor', 60);
        $this->getJson('/api/v1/stats?period=month&date=2026-11-01')->assertJsonPath('current.labor', 110)->assertJsonPath('orders.0.labor', 50);
        $this->getJson('/api/v1/dashboard?period=week')->assertJsonPath('rate', 30)->assertJsonPath('kpi.labor', 110);
        $this->getJson("/api/v1/public/reports/{$before->public_token}")->assertJsonPath('settings.hourly_rate', 25)->assertJsonPath('order.totals.labor', 50);
    }

    public function test_report_prints_prices_per_job_by_default_and_the_owner_can_switch_to_time_and_rate(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'owner']));

        $this->getJson('/api/v1/settings')->assertOk()->assertJsonPath('report_labor', 'price');
        $this->patchJson('/api/v1/settings', ['report_labor' => 'time'])->assertOk()->assertJsonPath('report_labor', 'time');
        $this->getJson('/api/v1/settings')->assertOk()->assertJsonPath('report_labor', 'time');
        $this->patchJson('/api/v1/settings', ['report_labor' => 'hours'])->assertUnprocessable();
    }
}
