#!/usr/bin/env bash
# Forced command of the CI key (user `firtech-ci`, security 2026-11-23 P1-5; setup in docs/ci-user.md).
# Installed root-owned as /usr/local/bin/firtech-receive.sh and named in authorized_keys:
#   command="/usr/local/bin/firtech-receive.sh",restrict ssh-ed25519 AAAA... github-actions-firtech-ci
# The only thing the key can do: hand over one release tarball. The client's command line is used only
# as the release id (validated), stdin is the .tgz (size-capped). firtech-ci has no sudo, no docker and
# no shell access; the tarball is unpacked and activated by `deploy` through the systemd path unit
# firtech-deploy.path (scripts/deploy/activate-incoming.sh, root-owned copy), whose result this script
# waits for and prints, so the CI job still fails when the release does not come up.
set -euo pipefail
umask 007

ID="${SSH_ORIGINAL_COMMAND:-}"
[[ "$ID" =~ ^[0-9]{14}-[0-9a-f]{7}$ ]] || { echo "refused: expected a release id like 20261123101500-abcdef0" >&2; exit 2; }

APP=/var/www/firtech
IN="$APP/incoming"
STATUS="$APP/ci-status"
MAX_BYTES=$((400 * 1024 * 1024))

tmp="$IN/.$ID.part"
trap 'rm -f "$tmp"' EXIT
head -c $((MAX_BYTES + 1)) > "$tmp"
size=$(stat -c %s "$tmp")
if (( size == 0 || size > MAX_BYTES )); then
  echo "refused: tarball is empty or larger than $MAX_BYTES bytes" >&2
  exit 3
fi
gzip -t "$tmp" 2>/dev/null || { echo "refused: not a gzip file" >&2; exit 3; }
mv -f "$tmp" "$IN/$ID.tgz"
trap - EXIT
rm -f "$STATUS/$ID.ok" "$STATUS/$ID.fail"
: > "$IN/ready/$ID"

# activate.sh needs up to ~3 minutes (preflight, PM2 restart, health checks, a rollback).
for _ in $(seq 1 300); do
  if [[ -f "$STATUS/$ID.ok" ]]; then cat "$STATUS/$ID.ok"; exit 0; fi
  if [[ -f "$STATUS/$ID.fail" ]]; then cat "$STATUS/$ID.fail" >&2; exit 1; fi
  sleep 1
done
echo "timeout: no activation result for $ID after 300 s" >&2
exit 1
