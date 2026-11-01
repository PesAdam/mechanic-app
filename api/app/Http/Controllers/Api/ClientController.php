<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ClientResource;
use App\Models\Client;
use Illuminate\Http\Request;

class ClientController extends Controller
{
    /** Blocking a client signs them out everywhere at once; their requests stay. */
    public function update(Request $request, Client $client): ClientResource
    {
        abort_unless($request->user()->isOwner(), 403, 'Prístup ľudí spravuje majiteľ.');
        $data = $request->validate(['is_active' => ['required', 'boolean']]);

        $client->update($data);
        if (! $client->is_active) {
            $client->tokens()->delete();
        }

        return new ClientResource($client->loadCount('requests'));
    }
}
