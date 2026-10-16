#!/usr/bin/env bash
# One-time setup of firtech.pro on the shared VPS, run as root from the repo checkout copied to the
# server:  bash scripts/deploy/server-setup.sh
# Adds only firtech files (its own nginx site and snippet, /var/www/firtech); Vibely's config is
# left alone, and nginx is reloaded only if `nginx -t` passes.
set -euo pipefail
cd "$(dirname "$0")/../.."
APP=/var/www/firtech

install -d -o deploy -g deploy -m 755 "$APP" "$APP/releases"
install -d -o deploy -g deploy -m 700 "$APP/shared" "$APP/shared/data" "$APP/incoming"

install -m 644 infra/nginx/firtech-proxy.conf /etc/nginx/snippets/firtech-proxy.conf
# Keep Certbot's additions if the site was already set up once.
if [ ! -f /etc/nginx/sites-available/firtech.conf ]; then
  install -m 644 infra/nginx/firtech.conf /etc/nginx/sites-available/firtech.conf
fi
ln -sfn /etc/nginx/sites-available/firtech.conf /etc/nginx/sites-enabled/firtech.conf
nginx -t
systemctl reload nginx
echo "nginx: firtech.pro enabled"
