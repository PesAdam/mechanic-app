<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ClientResource;
use App\Models\Client;
use App\Models\ClientInvite;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/** One-time invite links for the portal and the people who registered through them. */
class ClientInviteController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        self::ownerOnly($request);

        return response()->json([
            'invites' => ClientInvite::query()->with('client')->latest('id')->limit(50)->get()->map(fn (ClientInvite $i) => self::invite($i)),
            'clients' => ClientResource::collection(Client::query()->withCount('requests')->orderBy('name')->get()),
        ]);
    }

    /** The plain token is in this answer only; afterwards just its hash exists. */
    public function store(Request $request): JsonResponse
    {
        self::ownerOnly($request);
        $data = $request->validate(['note' => ['nullable', 'string', 'max:120']]);
        [$invite, $token] = ClientInvite::issue($request->user(), $data['note'] ?? null);

        return response()->json(['invite' => self::invite($invite), 'token' => $token], 201);
    }

    public function destroy(Request $request, ClientInvite $invite): JsonResponse
    {
        self::ownerOnly($request);
        if ($invite->used_at !== null) {
            throw ValidationException::withMessages(['invite' => 'Pozvánka už bola použitá. Prístup sa vypína pri človeku.']);
        }
        $invite->update(['revoked_at' => $invite->revoked_at ?? now()]);

        return response()->json(['invite' => self::invite($invite->fresh('client'))]);
    }

    /** @return array<string, mixed> */
    private static function invite(ClientInvite $invite): array
    {
        return [
            'id' => $invite->id,
            'note' => $invite->note,
            'state' => $invite->state(),
            'expires_at' => $invite->expires_at->toISOString(),
            'created_at' => $invite->created_at->toISOString(),
            'client' => $invite->client ? ['id' => $invite->client->id, 'name' => $invite->client->name] : null,
        ];
    }

    private static function ownerOnly(Request $request): void
    {
        abort_unless($request->user()->isOwner(), 403, 'Pozvánky spravuje majiteľ.');
    }
}
