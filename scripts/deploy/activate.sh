#!/usr/bin/env bash
# Runs on the VPS as `deploy`: switches /var/www/firtech/current to a release, restarts the PM2
# process, health-checks it and rolls back automatically if the new release doesn't come up.
#   /var/www/firtech/releases/<id>/activate.sh <id>
# Simpler than Vibely's: one fork process, so a restart is a second or two without the site.
set -euo pipefail
APP=/var/www/firtech
NEW="$APP/releases/${1:?usage: activate.sh <release-id>}"
KEEP=5
PORT=3001
test -f "$NEW/server.js" || { echo "No server.js in $NEW"; exit 1; }
test -f "$APP/shared/.env.production" || { echo "Missing $APP/shared/.env.production"; exit 1; }
mkdir -p "$APP/shared/data" && chmod 700 "$APP/shared/data"

PREV=$(readlink -f "$APP/current" 2>/dev/null || true)

# Boot the new release once on a spare port before touching PM2: a release that crashes on boot
# is refused without any downtime. 3099 is Vibely's preflight port, so this uses 3098.
preflight() {
  local pid ok=1
  PORT=3098 HOSTNAME=127.0.0.1 NODE_ENV=production DATA_DIR="$APP/shared/data" \
    node --env-file="$APP/shared/.env.production" "$NEW/server.js" >/dev/null 2>&1 &
  pid=$!
  for _ in $(seq 1 30); do
    kill -0 "$pid" 2>/dev/null || break
    if curl -fsS --max-time 3 http://127.0.0.1:3098/api/health >/dev/null 2>&1; then
      ok=0
      break
    fi
    sleep 1
  done
  kill "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
  return "$ok"
}

switch_to() {
  ln -sfn "$1" "$APP/current.tmp" && mv -T "$APP/current.tmp" "$APP/current"
  pm2 delete firtech >/dev/null 2>&1 || true
  timeout 120 pm2 start "$APP/current/ecosystem.config.cjs" >/dev/null || echo "pm2 start failed or timed out"
}

healthy() {
  local ok=0 deadline=$((SECONDS + 60))
  while [ "$SECONDS" -lt "$deadline" ]; do
    if curl -fsS --max-time 3 "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
      ok=$((ok + 1))
      [ "$ok" -ge 3 ] && return 0
    else
      ok=0
    fi
    sleep 1
  done
  return 1
}

if ! preflight; then
  echo "Preflight failed: $(basename "$NEW") does not start or /api/health is not 200; nothing changed"
  exit 1
fi

switch_to "$NEW"
if healthy; then
  pm2 save >/dev/null
  echo "Live: $(basename "$NEW")"
else
  echo "Health check failed for $(basename "$NEW")"
  pm2 logs firtech --lines 30 --nostream || true
  if [ -n "$PREV" ] && [ -f "$PREV/server.js" ]; then
    echo "Rolling back to $(basename "$PREV")"
    switch_to "$PREV" && healthy && pm2 save >/dev/null
  fi
  exit 1
fi

find "$APP/incoming" -maxdepth 1 -name '*.tgz' -mmin +60 -delete 2>/dev/null || true
ls -1dt "$APP"/releases/*/ | tail -n +$((KEEP + 1)) | while read -r dir; do
  [ "$(readlink -f "$dir")" = "$(readlink -f "$APP/current")" ] || rm -rf "$dir"
done
