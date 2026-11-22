#!/usr/bin/env bash
# Run by systemd as `deploy` (firtech-deploy.service, triggered by firtech-deploy.path when receive.sh
# drops a marker into /var/www/firtech/incoming/ready). Installed root-owned as
# /usr/local/bin/firtech-activate-incoming.sh; the activation script is the root-owned server copy
# /usr/local/bin/firtech-activate.sh (scripts/deploy/activate.sh), never the one inside the tarball.
# Security 2026-11-23 P1-5, setup in docs/ci-user.md.
set -euo pipefail
# FIRTECH_APP / FIRTECH_ACTIVATE exist for tests only; the systemd unit sets neither.
APP="${FIRTECH_APP:-/var/www/firtech}"
IN="$APP/incoming"
STATUS="$APP/ci-status"

# Explicit `|| return 1` on every step: `set -e` does not apply inside a function called from `||`.
activate_one() {
  local ID="$1" TGZ="$IN/$1.tgz"
  [[ -f "$TGZ" ]] || { echo "no tarball for $ID"; return 1; }
  # Every entry must sit inside "<id>/": no absolute paths, no "..", no links or devices.
  if tar -tzvf "$TGZ" | awk '{print substr($1,1,1)}' | grep -q '[lhbcp]'; then echo "refused: links or devices in the tarball"; return 1; fi
  if tar -tzf "$TGZ" | grep -Ev "^$ID(/|$)" | grep -q .; then echo "refused: entries outside $ID/"; return 1; fi
  if tar -tzf "$TGZ" | grep -Eq '(^|/)\.\.(/|$)'; then echo "refused: .. in the tarball"; return 1; fi
  mkdir -p "$APP/releases" || return 1
  tar -xzf "$TGZ" -C "$APP/releases" --no-same-owner --no-same-permissions || return 1
  rm -f "$TGZ"
  "${FIRTECH_ACTIVATE:-/usr/local/bin/firtech-activate.sh}" "$ID" || return 1
}

shopt -s nullglob
for marker in "$IN"/ready/*; do
  ID="$(basename "$marker")"
  rm -f "$marker"
  [[ "$ID" =~ ^[0-9]{14}-[0-9a-f]{7}$ ]] || continue
  LOG="$STATUS/$ID.log"
  if activate_one "$ID" > "$LOG" 2>&1; then mv -f "$LOG" "$STATUS/$ID.ok"; else mv -f "$LOG" "$STATUS/$ID.fail"; fi
done
find "$STATUS" -type f -mtime +14 -delete 2>/dev/null || true
