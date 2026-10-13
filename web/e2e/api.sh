#!/usr/bin/env bash
# Starts the Laravel API for Playwright on a fresh, seeded SQLite (api/.env.e2e).
set -euo pipefail
cd "$(dirname "$0")/../../api"
: > database/e2e.sqlite
php artisan migrate:fresh --seed --force --env=e2e --no-interaction
exec php artisan serve --host 127.0.0.1 --port 8099 --env=e2e --no-reload
