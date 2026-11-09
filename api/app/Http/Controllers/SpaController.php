<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Serves the web app (Vite build copied into public/ by scripts/build-spa.sh).
 * Every path that is not a real file, the API, uploads or the health check gets
 * index.html and the router inside takes over. index.html is never cached, so a
 * new deploy reaches installed PWAs on their next open.
 */
class SpaController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $index = public_path('index.html');
        abort_unless(is_file($index), 404, 'Web app not built: run scripts/build-spa.sh');

        $html = (string) file_get_contents($index);
        if ($request->is('portal', 'portal/*', 'pozvanka/*')) {
            $html = self::asPortal($html);
        }

        return response($html, 200, ['Content-Type' => 'text/html; charset=UTF-8', 'Cache-Control' => 'no-cache, no-store, must-revalidate']);
    }

    /**
     * The portal installs as its own app: "Pridať na plochu" takes the start page from the manifest named in the
     * page as loaded (Safari does not notice the swap the app makes later), and the shop's manifest starts at /m.
     */
    private static function asPortal(string $html): string
    {
        return (string) preg_replace(
            ['~href="/manifest\.webmanifest"~', '~<title>[^<]*</title>~', '~(name="apple-mobile-web-app-title" content=")[^"]*"~'],
            ['href="/portal.webmanifest"', '<title>Požiadavky do dielne</title>', '${1}Požiadavky"'],
            $html,
        );
    }
}
