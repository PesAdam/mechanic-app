<?php

namespace App\Http\Middleware;

use App\Models\Client;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** The portal is for invited clients only, and only while the shop keeps their account active. */
class EnsureClient
{
    public function handle(Request $request, Closure $next): Response
    {
        $client = $request->user();
        abort_unless($client instanceof Client && $client->is_active, 403, 'Účet nie je aktívny.');

        return $next($request);
    }
}
