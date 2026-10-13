# Nasadenie online

Appka je jeden celok: Laravel API servíruje aj webovú aplikáciu (PWA), takže
stačí jedna doména a jedna služba. Odporúčaná cesta je vlastný malý server
s Dockerom, ktorá dá HTTPS (nutné pre inštaláciu PWA na telefón) bez ručnej práce.

## Čo kúpiť

| Položka | Odporúčanie | Cena (orientačne) |
|---|---|---|
| Doména | `.sk` u slovenského registrátora (Websupport, Webglobe) alebo `.eu`/`.com` | 12–20 € / rok |
| Server | Hetzner Cloud **CX22** (2 vCPU, 4 GB RAM, 40 GB, lokalita Norimberg alebo Falkenstein), Ubuntu 24.04 | ~4,5 € / mesiac |

Alternatívy: akýkoľvek VPS s Ubuntu (DigitalOcean, Websupport VPS, Contabo). Zdieľaný
webhosting ide tiež (PHP 8.3+, MySQL, document root na `api/public`, build webu
nahraný cez SSH), ale bez Dockeru a s ručnými krokmi; návod nižšie je pre VPS.

## Prvé nasadenie (asi 20 minút)

1. **DNS**: u registrátora nastav záznam `A` pre doménu (napr. `dielna.tvojafirma.sk`)
   na IP adresu servera. Počkaj, kým `ping dielna.tvojafirma.sk` odpovie z tej IP.

2. **Server**: prihlás sa cez SSH ako root a nainštaluj Docker a git:
   ```bash
   apt-get update && apt-get install -y git ca-certificates curl
   curl -fsSL https://get.docker.com | sh
   ```

3. **Kód a nastavenie**:
   ```bash
   git clone https://github.com/PesAdam/mechanic-app.git /opt/dielna
   cd /opt/dielna
   cp api/.env.production.example .env
   nano .env
   ```
   V `.env` vyplň:
   - `APP_KEY` – výstup príkazu `openssl rand -base64 32` zapísaný ako `base64:…`,
   - `APP_URL` (`https://dielna.tvojafirma.sk`) a `APP_DOMAIN` (`dielna.tvojafirma.sk`),
   - `DB_PASSWORD` a `DB_ROOT_PASSWORD` – dve silné heslá (`openssl rand -hex 16`).

4. **Spustenie**:
   ```bash
   docker compose up -d --build
   docker compose logs -f app      # počkaj na „Aplikácia je pripravená.“, Ctrl+C
   ```
   Pri štarte sa spustia migrácie, nahrá sa katalóg úkonov a vozidiel a Caddy si
   vybaví HTTPS certifikát pre doménu (Let's Encrypt, obnovuje sa sám).

5. **Účet majiteľa** (demo účty v produkcii nie sú):
   ```bash
   docker compose exec app php artisan app:owner adam@tvojafirma.sk "Adam Belko"
   ```
   Príkaz sa opýta na heslo. Potom otvor `https://dielna.tvojafirma.sk/login`.
   Kolegov založíš v appke na Tím.

6. **Telefóny mechanikov**: otvor `https://dielna.tvojafirma.sk/m` v Chrome (Android)
   alebo Safari (iPhone) a „Pridať na plochu“. Appka sa potom spúšťa ako natívna.

## Aktualizácia na novú verziu

```bash
cd /opt/dielna && git pull && docker compose up -d --build
```
Migrácie aj nové položky katalógu sa doplnia pri štarte. Nainštalované PWA
si novú verziu stiahnu pri ďalšom otvorení.

## Zálohy

Dáta sú v dvoch Docker volume: `db` (MySQL) a `uploads` (fotky, protokoly).
Denná záloha do `/opt/backups` (pridaj do `crontab -e`, napr. `0 3 * * *`):
```bash
cd /opt/dielna && mkdir -p /opt/backups && D=$(date +%F) \
 && docker compose exec -T db sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction "$MYSQL_DATABASE"' | gzip > /opt/backups/db-$D.sql.gz \
 && docker run --rm -v dielna_uploads:/data -v /opt/backups:/backup alpine tar czf /backup/uploads-$D.tgz -C /data . \
 && find /opt/backups -mtime +30 -delete
```
Obnova: `gunzip < db-….sql.gz | docker compose exec -T db sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"'`.

## Ako to funguje

- `Dockerfile` postaví web (`web/`) a skopíruje ho do `api/public`; nginx + php-fpm
  (obraz `serversideup/php`) beží ako neprivilegovaný používateľ na porte 8080.
- `docker-compose.yml`: služby `app`, `db` (MySQL 8.4) a `caddy` (porty 80/443, HTTPS).
- `deploy/entrypoint.d/60-app-install.sh` pri každom štarte počká na databázu
  a spustí `php artisan app:install` (migrácie, seed na prázdnej DB, odkaz na uploady)
  a `php artisan optimize`.
- Bez Dockeru (zdieľaný hosting): `scripts/build-spa.sh` vloží web do `api/public`,
  nahraj `api/` na server, document root nasmeruj na `api/public`, vyplň `.env`
  podľa `.env.production.example` (DB podľa hostingu), spusti `php artisan app:install`
  a `php artisan app:owner …`.
