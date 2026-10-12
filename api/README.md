# mechanic-app · API

Laravel 13 backend pre aplikáciu Dielňa. Token autentifikácia cez Sanctum, JSON API pod `/api/v1`.

## Spustenie (lokálne)

```bash
composer install
cp .env.example .env && php artisan key:generate
php artisan migrate --seed          # SQLite v database/database.sqlite, demo dáta
php artisan storage:link            # fotky a protokoly v storage/app/public
php artisan serve --port 8087       # frontend v ../web proxuje /api a /storage sem
```

Demo účty (heslo `heslo1234`): `adam@dielna.sk` (majiteľ), `marek@dielna.sk`, `tomas@dielna.sk`.

Testy: `php artisan test`. Formátovanie: `vendor/bin/pint --dirty`.

## Model

| Tabuľka | Čo je to |
| --- | --- |
| `users` | mechanici; `role` owner / mechanic, `is_active` |
| `customers`, `cars` | zákazník a jeho auto (ŠPZ, VIN, km) |
| `work_orders` | zákazka (`jobs` patrí fronte): číslo, stav new / waiting / open / unpaid / done, mechanik, zdvihák, `public_token` pre online report |
| `work_entries` | jeden úsek práce pri aute s autorom; `ended_at = NULL` znamená bežiace stopky |
| `parts` | diely so značkou „účtovať“; `price` = MOC (predajná, na doklade), `purchase_price` = NC (nákupná, voliteľná) |
| `photos` | fotky pred / počas / po, súbor na public disku |
| `diagnostics`, `diag_codes` | importovaný protokol a chybové kódy |
| `operations`, `order_operations`, `operation_samples` | katalóg úkonov s normou, úkony na zákazke (snapshot názvu a normy), namerané časy z uzavretých zákaziek pre „tvoj priemer“ |
| `settings` | hodinová sadzba, účtovanie práce (`labor_billing`: actual / norm) a údaje firmy na doklade |

Čas práce sa nikdy neukladá ako číslo: vždy je to `started_at`/`ended_at`, takže sumy (`totals` v každej zákazke) sa rátajú zo záznamov. Zákazka má `parts_pricing` (`moc` alebo `nc`): v `totals` je `parts` súčet dielov v zvolených cenách (to platí zákazník), `parts_retail` v MOC a `parts_cost` v NC (diel bez NC sa počíta v MOC). `POST orders/{id}/close` prijíma voliteľné `parts_pricing` a po uzavretí zapíše vzorky časov k úkonom. V `totals` je aj `norm_seconds`, `delta_seconds`, `labor_actual`, `labor_norm` a `labor_billing`. Prehľad (`GET dashboard`) ráta nákup dielov v NC a vracia aj `parts_retail`.

## Endpointy

Všetko okrem prihlásenia a verejného reportu vyžaduje hlavičku `Authorization: Bearer <token>`.

| Metóda a cesta | Účel |
| --- | --- |
| `POST auth/login` · `POST auth/logout` · `GET auth/me` | prihlásenie (vracia token + používateľa) |
| `PATCH auth/password` | zmena vlastného hesla (vyžaduje súčasné heslo) |
| `GET users` · `POST users` · `PATCH users/{id}` | účty mechanikov; vytvárať a upravovať (meno, e-mail, rola, heslo, aktívny) môže len majiteľ, deaktivácia odhlási kolegu zo všetkých zariadení |
| `GET orders` · `POST orders` · `GET orders/{id}` · `PATCH orders/{id}` | zákazky s vnorenými dielmi, fotkami, diagnostikou a prácou |
| `POST orders/{id}/close` | uzavrieť: zastaví stopky, stav „čaká na platbu“ |
| `POST orders/{id}/timer/start` · `…/timer/stop` | stopky prihláseného mechanika (jeden mechanik je naraz pri jednom aute) |
| `POST orders/{id}/work-entries` · `DELETE work-entries/{id}` | ručný zápis času s autorom |
| `POST orders/{id}/parts` · `PATCH parts/{id}` · `DELETE parts/{id}` | diely |
| `POST orders/{id}/photos` (multipart) · `DELETE photos/{id}` | fotky; `photo_id` naplní existujúci prázdny slot |
| `POST orders/{id}/diagnostic` (multipart) · `POST …/diagnostic/codes` · `PATCH/DELETE diag-codes/{id}` | protokol a kódy |
| `GET operations` · `POST operations` · `PATCH/DELETE operations/{id}` | katalóg úkonov; úkon s históriou sa deaktivuje namiesto zmazania |
| `POST orders/{id}/operations` · `PATCH/DELETE order-operations/{id}` | úkony na zákazke (z katalógu alebo vlastný s normou) |
| `GET settings` · `PATCH settings` (len majiteľ) | sadzba, účtovanie práce a údaje firmy |
| `GET dashboard?period=week|month|year` | súhrny pre Prehľad |
| `GET public/reports/{token}` | report pre zákazníka bez prihlásenia |

## Produkcia

- Databáza: MySQL podľa komentovaného bloku v `.env.example`; migrácie sú DB-agnostické.
- `APP_URL` musí byť verejná adresa API, fotky sa servírujú z `APP_URL/storage/...`.
- Frontend môže bežať na inej doméne: API používa Bearer tokeny, takže CORS stačí predvolený (`api/*`, `*`).
- Časová zóna `Europe/Bratislava` (`APP_TIMEZONE`); API vracia ISO 8601 v UTC, klient zobrazuje lokálny čas.
