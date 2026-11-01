<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** The shop's API is for staff accounts only: a portal client's token is turned away here. */
class EnsureStaff
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_unless($request->user() instanceof User, 403, 'Prístup len pre dielňu.');

        return $next($request);
    }
}
