<?php

namespace Tests\Feature\Api;

use App\Models\Setting;
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
}
