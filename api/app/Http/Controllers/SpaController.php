<?php

namespace App\Http\Controllers;

use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Serves the web app (Vite build copied into public/ by scripts/build-spa.sh).
 * Every path that is not a real file, the API, uploads or the health check gets
 * index.html and the router inside takes over. index.html is never cached, so a
 * new deploy reaches installed PWAs on their next open.
 */
class SpaController extends Controller
{
    public function __invoke(): BinaryFileResponse
    {
        $index = public_path('index.html');
        abort_unless(is_file($index), 404, 'Web app not built: run scripts/build-spa.sh');

        return response()->file($index, ['Cache-Control' => 'no-cache, no-store, must-revalidate']);
    }
}
