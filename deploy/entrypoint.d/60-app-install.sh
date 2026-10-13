#!/bin/sh
# Runs on every container start: waits for the database, migrates, seeds what is
# missing (operations, car catalogue), links uploads and warms the caches.
set -e
cd /var/www/html
# The uploads volume starts empty: make sure the disk and framework folders exist.
mkdir -p storage/app/public storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs
i=0
until php artisan db:monitor --databases="${DB_CONNECTION:-mysql}" --max=1 >/dev/null 2>&1; do
  i=$((i+1)); [ "$i" -gt 60 ] && { echo "database not reachable"; exit 1; }
  sleep 2
done
php artisan app:install --no-interaction
php artisan optimize --no-interaction
