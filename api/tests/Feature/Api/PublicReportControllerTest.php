<?php

namespace Tests\Feature\Api;

use App\Models\Part;
use App\Models\Setting;
use App\Models\User;
use App\Models\WorkEntry;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

class PublicReportControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_report_is_readable_by_its_token_without_authentication(): void
    {
        Setting::set('business.name', 'AutoBelo');
        $order = WorkOrder::factory()->unpaid()->create();

        $response = $this->getJson("/api/v1/public/reports/{$order->public_token}");

        $response->assertOk()
            ->assertJsonPath('order.number', $order->number)
            ->assertJsonPath('settings.business.name', 'AutoBelo');
    }

    public function test_unknown_token_returns_404(): void
    {
        $this->getJson('/api/v1/public/reports/neexistuje')->assertNotFound();
    }

    public function test_public_report_hides_the_hourly_rate_unless_the_owner_prints_it(): void
    {
        Setting::set('hourly_rate', 25);
        $order = WorkOrder::factory()->unpaid()->create();

        $this->getJson("/api/v1/public/reports/{$order->public_token}")
            ->assertOk()
            ->assertJsonPath('settings.report_labor', 'price')
            ->assertJsonPath('settings.hourly_rate', null)
            ->assertJsonMissingPath('settings.business.ico.missing');

        Setting::set('report_labor', 'time');
        $this->getJson("/api/v1/public/reports/{$order->public_token}")
            ->assertOk()
            ->assertJsonPath('settings.hourly_rate', 25);
    }

    public function test_public_report_carries_what_the_report_prints_and_nothing_that_gives_the_rate_away(): void
    {
        $this->freezeTime();
        Setting::set('hourly_rate', 28);
        $mechanic = User::factory()->create(['name' => 'Peter Mechanik']);
        $order = WorkOrder::factory()->unpaid()->create(['parts_pricing' => 'nc']);
        $job = $order->operations()->create(['name' => 'Výmena oleja', 'norm_minutes' => 30, 'sort' => 0, 'done' => true]);
        WorkEntry::factory()->for($order)->for($mechanic)->create(['order_operation_id' => $job->id, 'started_at' => now()->subMinutes(30), 'ended_at' => now(), 'note' => 'interná poznámka']);
        Part::factory()->for($order)->create(['name' => 'Olejový filter', 'price' => 20, 'purchase_price' => 12]);

        $order = $this->getJson("/api/v1/public/reports/{$order->public_token}")->assertOk()->json('order');

        $this->assertSame([['label' => 'Výmena oleja', 'seconds' => null, 'amount' => 14]], $order['report']['rows']);
        $this->assertSame([], $order['work_entries']);
        $this->assertSame(0, $order['operations'][0]['billed_seconds']);
        $this->assertSame(0, $order['operations'][0]['norm_minutes']);
        $this->assertNull($order['parts'][0]['purchase_price']);
        $this->assertEquals(12, $order['parts'][0]['price']); // billed at NC, so that is the customer's price
        $this->assertArrayNotHasKey('labor_actual', $order['totals']);
        $this->assertArrayNotHasKey('seconds', $order['totals']);
        $this->assertArrayNotHasKey('parts_cost', $order['totals']);
        $this->assertNull($order['mechanic']);
        $this->assertStringNotContainsString('Peter', json_encode($order));
        $this->assertStringNotContainsString('interná', json_encode($order));

        Setting::set('report_labor', 'time');
        $order = $this->getJson("/api/v1/public/reports/{$order['public_token']}")->assertOk()->json('order');
        $this->assertSame(1800, $order['report']['rows'][0]['seconds']);
        $this->assertSame(1800, $order['totals']['seconds']);
    }
}
