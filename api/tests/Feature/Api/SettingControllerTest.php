<?php

namespace Tests\Feature\Api;

use App\Models\Setting;
use App\Models\User;
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

    public function test_report_rate_visibility_is_off_by_default_and_can_be_switched_on(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'owner']));

        $this->getJson('/api/v1/settings')->assertOk()->assertJsonPath('report_show_rate', false);
        $this->patchJson('/api/v1/settings', ['report_show_rate' => true])->assertOk()->assertJsonPath('report_show_rate', true);
        $this->getJson('/api/v1/settings')->assertOk()->assertJsonPath('report_show_rate', true);
    }
}
