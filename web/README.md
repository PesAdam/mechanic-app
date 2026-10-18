# mechanic-app · web

PWA frontend aplikácie Dielňa: Vite + React + TypeScript, react-router, react-query. Dizajnový systém Industry je 1:1 v `src/styles/industry.css`.

## Spustenie

```bash
npm install
npm run dev        # http://localhost:5187 · /api a /storage sa proxujú na API (API_PROXY_TARGET v .env)
npm run build      # typecheck + produkčný build do dist/ vrátane service workera
npm run preview    # otestovanie PWA buildu lokálne
```

Premenné prostredia sú v `.env.example`: `VITE_API_URL` (prázdne = rovnaký origin / dev proxy), `API_PROXY_TARGET` (kam dev server proxuje, predvolene `http://127.0.0.1:8087`).

## Obrazovky

| Cesta | Návrh | Čo je to |
| --- | --- | --- |
| `/login` | — | prihlásenie (spoločné) |
| `/` | — | presmerovanie: majiteľ na širokej obrazovke → `/admin`, inak → `/m` |
| **Mobil `/m`** | | zóna pre mechanikov, PWA štartuje tu (`src/mobile/`) |
| `/m` | 1c | **Dielňa dnes** — autá na zdvihákoch, kto na čom robí, bežiace stopky; Autá / Ľudia / Hotové; nová zákazka |
| `/m/zakazky/:id` | 1a | **Zákazka** — stopky (štart / pauza / ručný zápis s autorom), ▶ pri úkone spustí alebo prepne stopky na konkrétny úkon, bežiaci čas bez úkonu sa dá priradiť dodatočne; diely, fotky, diagnostika, uzavretie; po uzavretí zdieľanie odkazu na report |
| `/m/zakazky/:id/dennik` | 1b | **Denník** — tá istá zákazka ako časová os |
| `/m/ucet` | — | **Môj účet** — zmena hesla, odhlásenie |
| **Desktop `/admin`** | | zóna len pre majiteľa, bočné menu (`src/admin/`) |
| `/admin` | 1d | **Prehľad** — KPI za týždeň / mesiac / rok, práca vs. diely, mechanici, otvorené zákazky |
| `/admin/zakazky` | — | **Zákazky** — tabuľka s filtrom a hľadaním |
| `/admin/zakazky/:id` | — | **Detail zákazky** (desktop) — čas (každý zápis s úkonom), diely, fotky, diagnostika, súčet, mechanik, plán (dátum, čas, trvanie), uzavretie, uhradenie, odkaz na report |
| `/admin/kalendar` | — | **Kalendár** — týždenný rozvrh naplánovaných zákaziek (Po–Ne, 7:00–18:00), kliknutím do voľného miesta naplánovanie, bočný zoznam nenaplánovaných |
| `/admin/reporty`, `/admin/reporty/:id` | 1e | **Reporty** — zoznam, náhľad, tlač do PDF, kopírovanie odkazu, označenie ako uhradené |
| `/admin/ukony` | — | **Úkony** — katalóg normohodín, normy podľa značky / modelu / motorizácie (modely sú generácie s rokmi), vozidlo sa dá nájsť aj podľa ŠPZ / VIN v tom istom políčku ako značka, tvoj priemer z histórie, doplnenie katalógu vozidiel |
| `/admin/tim` | — | **Tím** — účty kolegov |
| `/admin/nastavenia` | — | **Nastavenia** — údaje firmy na doklade, sadzba, účtovanie práce, či report ukazuje hodinovú sadzbu (predvolene nie) |
| `/r/:token` | 1e | verejná online verzia reportu bez prihlásenia |

Hľadanie vozidla (`components/VehicleLookup.tsx`, používa ho dialóg novej zákazky aj výber vozidla v Úkonoch): po zadaní ŠPZ alebo VIN sa cez `GET vehicles/lookup` ponúkne auto z histórie (jedným klikom predvyplní vozidlo, zákazníka aj km a zákazka sa pripojí k existujúcemu autu) a pri VIN aj to, čo sa dá z neho prečítať offline: značka, modelový rok a generácia (`VinHint`); pri zdieľanom kóde modelu sa ponúknu kandidáti. Výber vozidla potom pokračuje rovno na motorizácii.

## Štruktúra

```
src/
  styles/industry.css   dizajnový systém (tokeny + komponenty)
  styles/app.css        rozloženia obrazoviek, časová os, graf, tlač
  lib/api.ts            fetch klient: Bearer token, JSON/multipart, ApiError, 401 → odhlásenie
  lib/types.ts          typy z API
  lib/calc.ts           bežiace stopky, sumy, dnešný čas mechanika
  lib/timeline.ts       udalosti denníka zo zákazky
  auth/AuthContext.tsx  prihlásenie, RequireAuth, RequireOwner, zapamätaný používateľ
  data/queries.ts       react-query hooky a akcie (každý zápis vráti čerstvú zákazku)
  components/           Blueprint, ImageSlot, Dialog, dialógy zákazky, StatusTag, InstallBanner, TeamPanel, ShareReport, PAY by square
  mobile/               zóna telefónu: WorkshopToday, JobDetail, JobDiary, Account
  admin/                zóna desktopu: AdminLayout, Dashboard, Orders, OrderDetail, CalendarPage, Reports, ReportPage, TeamPage, SettingsPage, OperationsPage
  screens/              spoločné: Login, ReportView, PublicReport
```

## Mobilná appka (PWA)

- **iPhone (Safari):** Zdieľať → **Pridať na plochu**; Dielňa ukáže návod v banneri.
- **Android (Chrome):** banner **Nainštalovať** alebo menu ⋮ → *Inštalovať aplikáciu*.
- **Offline:** service worker (`vite-plugin-pwa`) predcachuje shell a písma; posledné dáta z API sú v localStorage cache react-query. Zápisy bez signálu sa neuložia (zobrazí sa hláška).
- **Ikony:** zdroj `public/icon.svg`, PNG generuje `npx pwa-assets-generator` podľa `pwa-assets.config.ts`.

Service worker beží len v builde (`npm run build && npm run preview`). Na telefóne treba HTTPS.

## Testy

| Príkaz | Čo beží |
|---|---|
| `npm test` | Vitest + Testing Library (jsdom): výpočty (`lib/calc`), formátovanie, slovenské plurály, `VehiclePicker`, `VehicleLookup`, `NewJobDialog`, `NormBadge`. API je namockované cez `vi.mock('../data/queries')`, fixtúry sú v `src/test/fixtures.ts`. |
| `npm run test:watch` | to isté v režime sledovania |
| `npm run e2e` | Playwright proti reálnemu API: `e2e/api.sh` nahrá čerstvú SQLite so seedom (`api/.env.e2e`, port 8099) a `vite preview` servíruje produkčný build na 5199. Scenáre: prihlásenie a zóny (`auth`), deň mechanika od ŠPZ cez stopky, diel a uzavretie po verejný report (`workshop`), Úkony s VIN a normou, Reporty, Tím (`admin`). |
| `npm run e2e:ui` | Playwright v interaktívnom režime |

Prvýkrát treba `npx playwright install chromium`. E2E beží v jednom workeri, lebo scenáre zdieľajú databázu; lokálne sa bežiaci E2E server znovu použije (databáza sa neresetuje medzi behmi), v CI sa vždy štartuje nanovo. Testy mimo `auth` sa prihlasujú cez API (`loginViaApi`), aby nenarazili na limit pokusov o prihlásenie.
