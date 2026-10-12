<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AuthControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_valid_credentials_return_token_and_user(): void
    {
        $user = User::factory()->create(['email' => 'adam@dielna.sk', 'password' => 'heslo1234', 'role' => 'owner']);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'adam@dielna.sk',
            'password' => 'heslo1234',
            'device_name' => 'test',
        ]);

        $response->assertOk()
            ->assertJsonStructure(['token'])
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonPath('user.role', 'owner');
        $this->assertDatabaseCount('personal_access_tokens', 1);
    }

    public function test_wrong_password_returns_422_with_slovak_message(): void
    {
        User::factory()->create(['email' => 'adam@dielna.sk', 'password' => 'heslo1234']);

        $response = $this->postJson('/api/v1/auth/login', ['email' => 'adam@dielna.sk', 'password' => 'nespravne']);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['email' => 'Nesprávny e-mail alebo heslo.']);
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_inactive_user_is_rejected_with_422(): void
    {
        User::factory()->create(['email' => 'byvaly@dielna.sk', 'password' => 'heslo1234', 'is_active' => false]);

        $response = $this->postJson('/api/v1/auth/login', ['email' => 'byvaly@dielna.sk', 'password' => 'heslo1234']);

        $response->assertUnprocessable()->assertJsonValidationErrors(['email']);
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_me_returns_401_without_token(): void
    {
        $this->getJson('/api/v1/auth/me')->assertUnauthorized();
    }

    public function test_logout_revokes_the_current_token(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('test')->plainTextToken;

        $response = $this->withToken($token)->postJson('/api/v1/auth/logout');

        $response->assertNoContent();
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_password_change_requires_the_current_password(): void
    {
        $user = User::factory()->create(['password' => 'heslo1234']);
        Sanctum::actingAs($user);

        $response = $this->patchJson('/api/v1/auth/password', ['current_password' => 'nespravne', 'password' => 'noveheslo1']);

        $response->assertUnprocessable()->assertJsonValidationErrors(['current_password']);
        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'heslo1234'])->assertOk();
    }

    public function test_password_change_lets_the_user_log_in_with_the_new_password(): void
    {
        $user = User::factory()->create(['password' => 'heslo1234']);
        Sanctum::actingAs($user);

        $response = $this->patchJson('/api/v1/auth/password', ['current_password' => 'heslo1234', 'password' => 'noveheslo1']);

        $response->assertOk();
        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'noveheslo1'])->assertOk();
    }
}
