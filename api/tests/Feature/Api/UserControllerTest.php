<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class UserControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_mechanic_is_forbidden_to_create_accounts(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'mechanic']));

        $response = $this->postJson('/api/v1/users', ['name' => 'Nový', 'email' => 'novy@dielna.sk', 'password' => 'heslo1234']);

        $response->assertForbidden();
        $this->assertDatabaseCount('users', 1);
    }

    public function test_owner_creates_a_mechanic_who_can_log_in(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'owner']));

        $response = $this->postJson('/api/v1/users', ['name' => 'Jozef Nový', 'email' => 'jozef@dielna.sk', 'password' => 'heslo1234']);

        $response->assertCreated()
            ->assertJsonPath('data.name', 'Jozef Nový')
            ->assertJsonPath('data.role', 'mechanic')
            ->assertJsonPath('data.is_active', true);
        $this->assertDatabaseHas('users', ['email' => 'jozef@dielna.sk', 'role' => 'mechanic']);
        $this->postJson('/api/v1/auth/login', ['email' => 'jozef@dielna.sk', 'password' => 'heslo1234'])->assertOk();
    }

    public function test_store_rejects_a_duplicate_email(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'owner']));
        User::factory()->create(['email' => 'marek@dielna.sk']);

        $response = $this->postJson('/api/v1/users', ['name' => 'Marek 2', 'email' => 'marek@dielna.sk', 'password' => 'heslo1234']);

        $response->assertUnprocessable()->assertJsonValidationErrors(['email']);
        $this->assertDatabaseCount('users', 2);
    }

    public function test_owner_deactivates_a_colleague_and_revokes_their_tokens(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'owner']));
        $colleague = User::factory()->create(['password' => 'heslo1234']);
        $colleague->createToken('phone');

        $response = $this->patchJson("/api/v1/users/{$colleague->id}", ['is_active' => false]);

        $response->assertOk()->assertJsonPath('data.is_active', false);
        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->postJson('/api/v1/auth/login', ['email' => $colleague->email, 'password' => 'heslo1234'])->assertUnprocessable();
    }

    public function test_owner_cannot_deactivate_their_own_account(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        Sanctum::actingAs($owner);

        $response = $this->patchJson("/api/v1/users/{$owner->id}", ['is_active' => false]);

        $response->assertUnprocessable()->assertJsonValidationErrors(['is_active' => 'Vlastný účet nemôžete deaktivovať.']);
        $this->assertDatabaseHas('users', ['id' => $owner->id, 'is_active' => true]);
    }

    public function test_owner_resets_a_colleague_password(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'owner']));
        $colleague = User::factory()->create(['password' => 'stareheslo']);

        $response = $this->patchJson("/api/v1/users/{$colleague->id}", ['password' => 'noveheslo1']);

        $response->assertOk();
        $this->postJson('/api/v1/auth/login', ['email' => $colleague->email, 'password' => 'noveheslo1'])->assertOk();
    }
}
