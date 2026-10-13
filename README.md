# mechanic-app

Aplikácia na správu autoopráv pre malú dielňu (1–3 mechanici): mobil pre prácu pri aute, web pre prehľad, report pre zákazníka. Dizajn vznikol v Claude Design (projekt *Aplikácia na správu autoopráv*, dizajnový systém **Industry**).

```
web/   PWA frontend · Vite + React + TypeScript · react-query
api/   backend · Laravel 13 · Sanctum tokeny · SQLite (dev) / MySQL (prod)
```

## Rýchly štart

```bash
# API
cd api
composer install
cp .env.example .env && php artisan key:generate
php artisan migrate --seed && php artisan storage:link
php artisan serve --port 8087

# Frontend (druhý terminál)
cd web
npm install
npm run dev            # http://localhost:5187, /api a /storage sa proxujú na API
```

Demo účty (heslo `heslo1234`): `adam@dielna.sk` (majiteľ), `marek@dielna.sk`, `tomas@dielna.sk`.

## Ako to drží pokope

- **Prihlásenie a účty:** e-mail + heslo → Sanctum token uložený v zariadení. Majiteľ spravuje účty kolegov v desktope (**Tím**, `/admin/tim`): pridanie, rola, reset hesla, deaktivácia. Každý si vie zmeniť vlastné heslo (`/m/ucet`). Každý záznam času má autora, stopky bežia na serveri (`work_entries.ended_at = NULL`), takže ich vidí každý telefón v dielni.
- **Dáta:** frontend číta cez react-query, nástenka sa obnovuje každých 15 s. Cache sa zrkadlí do localStorage, takže appka otvorí posledný známy stav aj bez signálu (zápisy offline sa neukladajú, zobrazí sa hláška).
- **Ceny dielov:** každý diel má MOC (predajná) a voliteľne NC (nákupná). Každá zákazka má zvolené, ktoré ceny idú zákazníkovi (`parts_pricing`), prepína sa v dieloch a potvrdzuje pri uzavretí; report a doklad ich použijú. Prehľad ráta nakúpené diely a maržu vždy v NC.
- **Normohodiny:** katalóg úkonov s normou (minúty) a kategóriou; úkony sa pridávajú na zákazku a ich normy sa sčítajú. Stopky svietia zeleno pod normou a červeno nad ňou, aj s rozdielom v € pri sadzbe. Pri uzavretí sa skutočný čas rozdelí medzi úkony pomerne podľa noriem a katalóg ukazuje „tvoj priemer“. V nastaveniach sa volí účtovanie práce podľa skutočného času alebo podľa normohodín (NH × sadzba), report sa prispôsobí. Normy môžu byť aj **podľa vozidla**: každý úkon má všeobecnú normu a voliteľné normy pre značku, model alebo motorizáciu (motorizácia → model → značka → všeobecná), priemery sa sledujú podľa vozidla. Katalóg vozidiel (32 značiek s logami, ~200 modelov, ~750 motorizácií pre náš trh) je zabalený v `api/app/Support/VehicleCatalog.php`; spravuje sa priamo v Úkonoch a nové vozidlo vznikne aj pri založení zákazky (výber značka → model → motorizácia s vyhľadávaním). Východiskový katalóg je orientačný, oficiálne normy (Autodata, TecRMI, katalógy distribútorov) sú platené.
- **Fotky a protokoly:** klient zmenší fotku a pošle ju ako multipart, API ju uloží na public disk.
- **Report pre zákazníka:** každá zákazka má `public_token`; `/r/<token>` zobrazí report bez prihlásenia.
- **Dve zóny v jednej appke:** `/m/…` je telefón pre mechanikov (PWA štartuje tu), `/admin/…` je desktop len pre majiteľa (prehľad, zákazky s detailom, reporty, tím, nastavenia). Koreň `/` presmeruje podľa roly a šírky obrazovky.
- **PWA:** manifest, ikony, service worker s offline shellom; na telefóne „Pridať na plochu“. Podrobnosti vo `web/README.md`.

## Nasadenie

1. API na PHP hosting alebo VPS s MySQL (`api/.env.example` má komentovaný blok), `APP_URL` = verejná adresa API, `php artisan migrate --force && php artisan storage:link`.
2. Frontend `cd web && VITE_API_URL=https://api.vasa-domena.sk npm run build` → statický `web/dist` na Vercel / Netlify / Cloudflare Pages (HTTPS je nutné pre inštaláciu PWA). Ak frontend beží na rovnakej doméne ako API (reverse proxy `/api` a `/storage`), `VITE_API_URL` nechaj prázdne.

## Ďalšie kroky

- Skutočný PAY by square kód na doklade (bysquare kódovanie IBAN + suma + VS).
- Offline fronta zápisov (stopky a diely bez signálu, odoslanie po pripojení).
- Sekcie Autá a Zákazníci, história áut podľa VIN/ŠPZ.
- Parsovanie chybových kódov priamo z PDF protokolu.
- Export reportu do PDF na serveri a odoslanie zákazníkovi.

## Testy a CI

- API: `cd api && php artisan test` (PHPUnit, SQLite v pamäti) a `vendor/bin/pint --test`.
- Web: `cd web && npm test` (Vitest) a `npm run e2e` (Playwright proti reálnemu API, pozri `web/README.md`).
- GitHub Actions (`.github/workflows/ci.yml`) spustí pri každom pushi na `main` a pri pull requeste tri joby: API (Pint + PHPUnit), Web (typecheck + Vitest + build) a E2E (Playwright, Chromium); pri páde E2E sa priloží HTML report.
