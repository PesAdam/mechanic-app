# syntax=docker/dockerfile:1
# One image = API + PWA. nginx + php-fpm from serversideup/php (runs as www-data on 8080).

# 1) Web app build
FROM node:22-alpine AS web
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

# 2) PHP dependencies
FROM serversideup/php:8.4-cli AS vendor
WORKDIR /app
COPY --chown=www-data:www-data api/ ./
RUN composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader --no-progress

# 3) Runtime
FROM serversideup/php:8.4-fpm-nginx
ENV AUTORUN_ENABLED=false \
    PHP_OPCACHE_ENABLE=1 \
    SSL_MODE=off
USER root
COPY --chown=www-data:www-data --from=vendor /app /var/www/html
COPY --chown=www-data:www-data --from=web /src/web/dist/ /var/www/html/public/
COPY deploy/entrypoint.d/ /etc/entrypoint.d/
RUN chmod +x /etc/entrypoint.d/*.sh
USER www-data
