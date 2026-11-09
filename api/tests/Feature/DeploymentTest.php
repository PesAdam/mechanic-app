<?php

namespace Tests\Feature;

use App\Models\CarMake;
use App\Models\Operation;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

class DeploymentTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_app_install_seeds_an_empty_database_and_is_safe_to_repeat(): void
    {
        $this->artisan('app:install')->assertSuccessful();

        $operations = Operation::query()->count();
        $this->assertGreaterThan(30, $operations);
        $this->assertGreaterThan(30, CarMake::query()->count());
        $this->assertSame(30, (int) Setting::get('hourly_rate'));
        $this->assertSame('actual', Setting::get('labor_billing'));

        Setting::set('hourly_rate', 42);
        $this->artisan('app:install')->assertSuccessful();

        $this->assertSame($operations, Operation::query()->count());
        $this->assertSame(42, (int) Setting::get('hourly_rate'));
        $this->assertSame(0, User::query()->count(), 'production install creates no demo accounts');
    }

    public function test_app_owner_creates_and_then_resets_the_owner_account(): void
    {
        $this->artisan('app:owner', ['email' => 'majitel@dielna.sk', 'name' => 'Adam', '--password' => 'tajneheslo'])->assertSuccessful();

        $this->postJson('/api/v1/auth/login', ['email' => 'majitel@dielna.sk', 'password' => 'tajneheslo'])
            ->assertOk()->assertJsonPath('user.role', 'owner');

        $this->artisan('app:owner', ['email' => 'majitel@dielna.sk', 'name' => 'Adam B.', '--password' => 'noveheslo1'])->assertSuccessful();

        $this->assertSame(1, User::query()->count());
        $this->postJson('/api/v1/auth/login', ['email' => 'majitel@dielna.sk', 'password' => 'noveheslo1'])->assertOk();
        $this->artisan('app:owner', ['email' => 'x@dielna.sk', 'name' => 'X', '--password' => 'short'])->assertFailed();
    }

    public function test_portal_pages_name_the_portal_manifest_so_add_to_home_screen_starts_at_the_portal(): void
    {
        $index = public_path('index.html');
        $original = is_file($index) ? file_get_contents($index) : null;
        file_put_contents($index, '<!doctype html><meta name="apple-mobile-web-app-title" content="Dielňa"><title>Dielňa · správa autoopráv</title><link rel="manifest" href="/manifest.webmanifest">');

        try {
            foreach (['/portal', '/portal/prihlasenie', '/pozvanka/abc123'] as $path) {
                $this->get($path)->assertOk()
                    ->assertSee('href="/portal.webmanifest"', false)
                    ->assertSee('<title>Požiadavky do dielne</title>', false)
                    ->assertSee('content="Požiadavky"', false)
                    ->assertDontSee('/manifest.webmanifest', false);
            }
            foreach (['/m', '/admin', '/portaly'] as $path) {
                $this->get($path)->assertOk()->assertSee('href="/manifest.webmanifest"', false)->assertDontSee('portal.webmanifest', false);
            }
        } finally {
            $original === null ? unlink($index) : file_put_contents($index, $original);
        }
    }

    public function test_the_web_app_is_served_for_app_paths_but_never_for_the_api(): void
    {
        $index = public_path('index.html');
        $hadIndex = is_file($index);
        if (! $hadIndex) {
            file_put_contents($index, '<!doctype html><title>Dielňa test</title>');
        }

        try {
            foreach (['/', '/m', '/admin/ukony', '/r/abc'] as $path) {
                $response = $this->get($path)->assertOk();
                $this->assertStringContainsString('no-store', (string) $response->headers->get('Cache-Control'));
            }
            $this->getJson('/api/v1/nope')->assertNotFound();
            $this->getJson('/api/v1/settings')->assertUnauthorized();
            $this->get('/up')->assertOk();
        } finally {
            if (! $hadIndex) {
                unlink($index);
            }
        }
    }
}
