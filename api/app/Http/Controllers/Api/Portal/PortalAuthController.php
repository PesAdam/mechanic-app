<?php

namespace App\Http\Controllers\Api\Portal;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\ClientInvite;
use App\Services\Settings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/** Portal accounts: registration only through a one-time invite, then e-mail and password. */
class PortalAuthController extends Controller
{
    /** The invite page asks first, so a used or expired link says so before anyone fills in the form. */
    public function invite(string $token): JsonResponse
    {
        return response()->json(['valid' => (bool) ClientInvite::findByToken($token)?->isOpen(), 'shop' => self::shop()]);
    }

    public function register(Request $request): JsonResponse
    {
        $request->merge(['email' => mb_strtolower(trim((string) $request->input('email')))]);
        $data = $request->validate([
            'token' => ['required', 'string', 'max:100'],
            'name' => ['required', 'string', 'max:120'],
            'phone' => ['required', 'string', 'max:32'],
            'email' => ['required', 'email', 'max:120', 'unique:clients,email'],
            'password' => ['required', 'string', 'min:8', 'max:200'],
        ]);

        // The invite row is locked so the same link can never register two accounts.
        $client = DB::transaction(function () use ($data): Client {
            $invite = ClientInvite::query()->where('token_hash', ClientInvite::hash($data['token']))->lockForUpdate()->first();
            if (! $invite?->isOpen()) {
                throw ValidationException::withMessages(['token' => 'Pozvánka už neplatí. Požiadajte dielňu o novú.']);
            }
            $client = Client::query()->create(Arr::except($data, ['token']));
            $invite->update(['used_at' => now(), 'client_id' => $client->id]);

            return $client;
        });

        return response()->json(['token' => $client->createToken('portal')->plainTextToken, 'client' => self::profile($client)], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => ['required', 'email'], 'password' => ['required', 'string']]);

        $client = Client::query()->where('email', mb_strtolower(trim($data['email'])))->first();
        if (! $client || ! $client->is_active || ! Hash::check($data['password'], $client->password)) {
            throw ValidationException::withMessages(['email' => ['Nesprávny e-mail alebo heslo.']]);
        }

        return response()->json(['token' => $client->createToken('portal')->plainTextToken, 'client' => self::profile($client)]);
    }

    public function logout(Request $request): Response
    {
        $request->user()->currentAccessToken()->delete();

        return response()->noContent();
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['client' => self::profile($request->user())]);
    }

    /** @return array{id: int, name: string, email: string, phone: string, shop: array<string, mixed>} */
    private static function profile(Client $client): array
    {
        return ['id' => $client->id, 'name' => $client->name, 'email' => $client->email, 'phone' => $client->phone, 'shop' => self::shop()];
    }

    /**
     * How to reach the shop; nothing else from its settings.
     *
     * @return array<string, mixed>
     */
    private static function shop(): array
    {
        return Arr::only(Settings::payload()['business'], ['name', 'phone', 'email', 'street', 'city']);
    }
}
