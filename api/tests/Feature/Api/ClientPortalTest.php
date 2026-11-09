<?php

namespace Tests\Feature\Api;

use App\Models\Car;
use App\Models\CarMake;
use App\Models\Client;
use App\Models\ClientInvite;
use App\Models\ServiceRequest;
use App\Models\User;
use App\Models\WorkOrder;
use App\Services\CarCatalog;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ClientPortalTest extends TestCase
{
    use LazilyRefreshDatabase;

    private function owner(): User
    {
        return User::factory()->create(['role' => 'owner']);
    }

    /** A request with a bearer token, forgetting whoever the previous request in the test was signed in as. */
    private function asToken(string $token, string $method, string $uri, array $data = []): TestResponse
    {
        $this->app['auth']->forgetGuards();

        return $this->withToken($token)->json($method, $uri, $data);
    }

    private function register(string $token, string $email = 'peter@firma.sk'): TestResponse
    {
        return $this->postJson('/api/v1/portal/register', ['token' => $token, 'name' => 'Peter Malý', 'phone' => '+421 905 111 222', 'email' => $email, 'password' => 'tajneheslo']);
    }

    public function test_an_invite_link_registers_exactly_one_person(): void
    {
        Sanctum::actingAs($this->owner());
        $token = $this->postJson('/api/v1/invites', ['note' => 'Peter z autobazáru'])->assertCreated()->json('token');

        $this->getJson("/api/v1/portal/invites/{$token}")->assertOk()->assertJsonPath('valid', true);
        $this->register($token)->assertCreated()->assertJsonPath('client.name', 'Peter Malý');

        $this->getJson("/api/v1/portal/invites/{$token}")->assertJsonPath('valid', false);
        $this->register($token, 'iny@firma.sk')->assertUnprocessable()->assertJsonValidationErrors('token');
        $this->assertSame(1, Client::query()->count());
        $this->assertDatabaseHas('client_invites', ['note' => 'Peter z autobazáru', 'client_id' => Client::query()->value('id')]);
        $this->assertDatabaseMissing('client_invites', ['token_hash' => $token]);
    }

    public function test_an_expired_or_revoked_invite_registers_nobody(): void
    {
        Sanctum::actingAs($this->owner());
        $revoked = $this->postJson('/api/v1/invites')->json();
        $this->deleteJson("/api/v1/invites/{$revoked['invite']['id']}")->assertOk()->assertJsonPath('invite.state', 'revoked');
        $expired = $this->postJson('/api/v1/invites')->json('token');
        $this->travel(ClientInvite::DAYS_VALID + 1)->days();

        $this->register($revoked['token'])->assertUnprocessable()->assertJsonValidationErrors('token');
        $this->register($expired, 'druhy@firma.sk')->assertUnprocessable()->assertJsonValidationErrors('token');
        $this->register('vymysleny-token', 'treti@firma.sk')->assertUnprocessable()->assertJsonValidationErrors('token');
        $this->assertSame(0, Client::query()->count());
    }

    public function test_a_portal_token_opens_nothing_of_the_shop_and_a_staff_token_nothing_of_the_portal(): void
    {
        $clientToken = Client::factory()->create()->createToken('portal')->plainTextToken;
        $staffToken = User::factory()->create(['role' => 'owner'])->createToken('web')->plainTextToken;

        foreach (['/api/v1/orders', '/api/v1/dashboard', '/api/v1/auth/me', '/api/v1/requests', '/api/v1/invites', '/api/v1/settings'] as $uri) {
            $this->asToken($clientToken, 'GET', $uri)->assertForbidden();
        }
        $this->asToken($clientToken, 'POST', '/api/v1/orders', ['summary' => 'x'])->assertForbidden();
        $this->asToken($staffToken, 'GET', '/api/v1/portal/requests')->assertForbidden();
        $this->asToken($staffToken, 'GET', '/api/v1/orders')->assertOk();
        $this->asToken($clientToken, 'GET', '/api/v1/portal/me')->assertOk();
    }

    public function test_a_client_sends_a_request_with_photos_and_sees_only_their_own(): void
    {
        Storage::fake('public');
        $client = Client::factory()->create();
        $other = ServiceRequest::factory()->create();
        Sanctum::actingAs($client);

        $this->post('/api/v1/portal/requests', [
            'plate' => 'za 123 ab', 'make' => 'Škoda', 'model' => 'Fabia III', 'km' => '154000',
            'description' => 'Pískajú brzdy vpredu', 'preferred_date' => now()->addDay()->toDateString(),
            'photos' => [UploadedFile::fake()->image('brzdy.jpg')],
        ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('data.plate', 'ZA 123 AB')
            ->assertJsonPath('data.phase', 'sent')
            ->assertJsonCount(1, 'data.photos');

        $this->getJson('/api/v1/portal/requests')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.description', 'Pískajú brzdy vpredu');
        $this->deleteJson("/api/v1/portal/requests/{$other->id}")->assertNotFound();
        $this->assertSame(0, WorkOrder::query()->count());
    }

    public function test_accepting_makes_an_order_for_the_client_with_the_car_and_copies_of_the_photos(): void
    {
        Storage::fake('public');
        Storage::disk('public')->put('requests/1/a.jpg', 'x');
        $request = ServiceRequest::factory()->create(['plate' => 'ZA 555 XY', 'description' => "Výmena oleja\na filtrov", 'photos' => ['requests/1/a.jpg']]);
        Sanctum::actingAs($this->owner());

        $orderId = $this->postJson("/api/v1/requests/{$request->id}/accept")->assertOk()->assertJsonPath('data.status', 'accepted')->json('order_id');

        $order = WorkOrder::query()->with(['customer', 'car', 'photos'])->findOrFail($orderId);
        $this->assertSame($request->client->name, $order->customer->name);
        $this->assertSame($request->client->phone, $order->customer->phone);
        $this->assertSame('ZA 555 XY', $order->car->plate);
        $this->assertSame('Výmena oleja a filtrov', $order->summary);
        $this->assertSame('new', $order->status->value);
        $this->assertSame('Od zákazníka 1', $order->photos[0]->label);
        Storage::disk('public')->assertExists([$order->photos[0]->path, 'requests/1/a.jpg']);

        $this->postJson("/api/v1/requests/{$request->id}/accept")->assertUnprocessable();
        $this->postJson("/api/v1/requests/{$request->id}/reject")->assertUnprocessable();
    }

    public function test_a_make_typed_without_accents_is_filed_under_the_catalogue_one_instead_of_a_duplicate(): void
    {
        $catalogue = CarCatalog::resolve('Škoda', 'Octavia III', '2.0 TDI');
        $makes = CarMake::query()->count();
        $request = ServiceRequest::factory()->create(['make' => 'skoda', 'model' => 'OCTAVIA  III', 'engine' => '2.0 tdi']);
        Sanctum::actingAs($this->owner());

        $orderId = $this->postJson("/api/v1/requests/{$request->id}/accept")->assertOk()->json('order_id');

        $car = WorkOrder::query()->findOrFail($orderId)->car;
        $this->assertSame(['Škoda', 'Octavia III', '2.0 TDI'], [$car->make, $car->model, $car->engine]);
        $this->assertSame($catalogue['model']->id, $car->car_model_id);
        $this->assertSame($catalogue['engine']->id, $car->car_engine_id);
        $this->assertSame($makes, CarMake::query()->count(), 'the production unique index would refuse "Skoda" next to "Škoda"');
    }

    public function test_a_known_plate_keeps_its_car_and_the_client_keeps_one_customer_record(): void
    {
        $car = Car::factory()->create(['plate' => 'ZA-555XY', 'km' => 100000]);
        $client = Client::factory()->create();
        $first = ServiceRequest::factory()->for($client)->create(['plate' => 'za 555 xy', 'km' => 120000]);
        $second = ServiceRequest::factory()->for($client)->create(['plate' => 'BA 1 NEW']);
        Sanctum::actingAs($this->owner());

        $a = WorkOrder::query()->find($this->postJson("/api/v1/requests/{$first->id}/accept")->json('order_id'));
        $b = WorkOrder::query()->find($this->postJson("/api/v1/requests/{$second->id}/accept")->json('order_id'));

        $this->assertSame($car->id, $a->car_id);
        $this->assertSame(120000, $car->fresh()->km);
        $this->assertSame($a->customer_id, $b->customer_id);
        $this->assertSame($a->customer_id, $client->fresh()->customer_id);
    }

    public function test_the_client_follows_the_request_to_the_finished_report_or_reads_why_it_was_turned_down(): void
    {
        $client = Client::factory()->create();
        $accepted = ServiceRequest::factory()->for($client)->create();
        $rejected = ServiceRequest::factory()->for($client)->create();
        $owner = $this->owner();
        $staffToken = $owner->createToken('web')->plainTextToken;
        $clientToken = $client->createToken('portal')->plainTextToken;

        $orderId = $this->asToken($staffToken, 'POST', "/api/v1/requests/{$accepted->id}/accept")->json('order_id');
        $this->asToken($staffToken, 'POST', "/api/v1/requests/{$rejected->id}/reject", ['reason' => 'Na toto nemáme náradie.'])->assertOk();

        $this->asToken($clientToken, 'GET', '/api/v1/portal/requests')
            ->assertJsonPath('data.0.phase', 'rejected')
            ->assertJsonPath('data.0.reject_reason', 'Na toto nemáme náradie.')
            ->assertJsonPath('data.1.phase', 'accepted')
            ->assertJsonPath('data.1.order.report_token', null);

        $order = WorkOrder::query()->findOrFail($orderId);
        $order->update(['status' => 'unpaid', 'closed_at' => now()]);

        $this->asToken($clientToken, 'GET', '/api/v1/portal/requests')
            ->assertJsonPath('data.1.phase', 'done')
            ->assertJsonPath('data.1.order.number', $order->number)
            ->assertJsonPath('data.1.order.report_token', $order->public_token);
        $this->asToken($clientToken, 'DELETE', "/api/v1/portal/requests/{$accepted->id}")->assertUnprocessable();
    }

    public function test_only_the_owner_handles_requests_and_invites(): void
    {
        $request = ServiceRequest::factory()->create();
        Sanctum::actingAs(User::factory()->create(['role' => 'mechanic']));

        $this->getJson('/api/v1/requests')->assertForbidden();
        $this->postJson("/api/v1/requests/{$request->id}/accept")->assertForbidden();
        $this->postJson('/api/v1/invites')->assertForbidden();
    }

    public function test_blocking_a_client_signs_them_out_and_keeps_them_out(): void
    {
        $client = Client::factory()->create(['email' => 'peter@firma.sk']);
        $clientToken = $client->createToken('portal')->plainTextToken;
        $staffToken = $this->owner()->createToken('web')->plainTextToken;

        $this->asToken($staffToken, 'PATCH', "/api/v1/clients/{$client->id}", ['is_active' => false])->assertOk()->assertJsonPath('data.is_active', false);

        $this->asToken($clientToken, 'GET', '/api/v1/portal/me')->assertUnauthorized();
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/v1/portal/login', ['email' => 'peter@firma.sk', 'password' => 'heslo1234'])->assertUnprocessable();
    }
}
