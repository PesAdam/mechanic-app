# mechanic-app

Aplikácia na správu autoopráv pre malú dielňu (1–3 mechanici): mobil pre prácu pri aute, web pre prehľad, report pre zákazníka.

Postavené podľa návrhu v Claude Design — projekt *Aplikácia na správu autoopráv*, súbor `Belo Hôrky.dc.html`, dizajnový systém **Industry** (oceľovo‑modrý wireframe, Barlow Condensed + Barlow, „blueprint“ rámčeky s registračnými značkami).

## Spustenie

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + produkčný build do dist/
```

## Obrazovky

| Cesta | Návrh | Čo je to |
| --- | --- | --- |
| `/` | 1c | **Dielňa dnes** — autá na zdvihákoch, kto na čom robí, bežiace stopky; prepínač Autá / Ľudia / Hotové; založenie novej zákazky |
| `/zakazky/:id` | 1a | **Zákazka** — stopky v strede (štart / pauza / ručný zápis s autorom), diely so začiarkávaním a pridávaním, fotky pred · počas · po, import diagnostiky + ručné kódy, uzavretie → report |
| `/zakazky/:id/dennik` | 1b | **Denník** — tá istá zákazka ako časová os: príjem, diagnostika, fotky, práca, diely, bežiace stopky |
| `/prehlad` | 1d | **Web · Prehľad** — KPI za týždeň / mesiac / rok, práca vs. diely, vyťaženie mechanikov, otvorené zákazky |
| `/report/:id` | 1e | **Report pre zákazníka** — fotodokumentácia, výpis diagnostiky, práca, diely, doklad bez DPH + PAY by square; tlač do PDF cez prehliadač |

Mobilné obrazovky sa na širokom displeji renderujú v stĺpci širokom ako telefón; dashboard a report sú webové. Na desktope je nad obrazovkami úzka lišta na prepínanie Dielňa / Prehľad.

## Mobilná appka (PWA)

Aplikácia je progresívna webová appka: na telefóne sa dá pridať na plochu a potom beží na celú obrazovku bez adresného riadka, s vlastnou ikonou a aj bez signálu (všetky dáta sú v zariadení).

- **iPhone (Safari):** otvor adresu appky → Zdieľať → **Pridať na plochu**. Dielňa sama ukáže návod v banneri.
- **Android (Chrome):** v Dielni sa ukáže banner **Nainštalovať**, alebo menu ⋮ → *Pridať na plochu / Inštalovať aplikáciu*.
- **Offline:** service worker (`vite-plugin-pwa`, Workbox) predcachuje celý build aj písma. Nová verzia sa stiahne na pozadí a aktivuje pri ďalšom otvorení.
- **Ikony a manifest:** zdroj je `public/icon.svg`; PNG varianty generuje `npx pwa-assets-generator` (konfigurácia v `pwa-assets.config.ts`). Manifest a cache pravidlá sú vo `vite.config.ts`.

Service worker beží len v produkčnom builde: lokálne ho vyskúšaš cez `npm run build && npm run preview`. Na skutočnom telefóne treba appku servírovať cez **HTTPS** (localhost je výnimka), teda nasadiť napr. na Vercel, Netlify, Cloudflare Pages alebo GitHub Pages. Pri GitHub Pages bez vlastnej domény treba nastaviť `base` vo Vite a `basename` v routeri na `/mechanic-app/`.

## Dáta a stav

- Bez backendu. Stav (zákazky, stopky, diely, fotky, sadzba) drží `src/store/workshop.tsx` a ukladá sa do `localStorage` pod kľúčom `mechanic-app:v1`. Bežiace stopky prežijú reload.
- Ukážkové dáta sú v `src/data/mock.ts` (zákazky #0231–#0233 a #0229, mechanici, súhrny za obdobia pre dashboard). V dashboarde dole je „Obnoviť ukážkové dáta“.
- Fotky sa pri výbere zmenšia na max. 1200 px a uložia ako JPEG data URL.
- Údaje firmy na reporte sú v `src/data/business.ts` (názov je zatiaľ placeholder **NÁZOV**).
- Hodinová sadzba (predvolene 28 €/h) sa dá zmeniť v dashboarde.

## Štruktúra

```
src/
  styles/industry.css   dizajnový systém (tokeny + komponenty), 1:1 z Claude Design
  styles/app.css        rozloženia obrazoviek, časová os, graf, tlač
  lib/                  typy, formátovanie (€, h min, dátumy), časová os, zmenšovanie fotiek
  data/                 ukážkové zákazky, mechanici, obdobia, údaje firmy
  store/workshop.tsx    reducer + context, stopky, výpočty súm
  components/           Blueprint (rámček s rohmi), ImageSlot, Dialog, dialógy zákazky, StatusTag, PAY by square
  screens/              WorkshopToday (1c), JobDetail (1a), JobDiary (1b), Dashboard (1d), Report (1e)
```

## Ďalšie kroky

- Skutočný **PAY by square** kód (bysquare kódovanie IBAN + suma + VS) namiesto statického QR.
- Backend a prihlásenie mechanikov; súhrny v dashboarde počítať z reálnych zákaziek namiesto ukážkových období.
- Nasadenie na HTTPS hosting, aby sa dala appka nainštalovať na telefón.
- Sekcie **Autá** a **Zákazníci** v dashboarde.
- Online verzia reportu na zdieľateľnom odkaze a export PDF na serveri.
- Parsovanie chybových kódov priamo z importovaného PDF protokolu.
