#!/usr/bin/env bash
# Deploy from this Mac while there is no CI: builds a clean checkout of HEAD (no .env.local), the
# same way the GitHub workflow does, then uploads and activates it as `deploy`.
#   scripts/deploy/manual.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
test -z "$(git status --porcelain)" || { echo "Commit your changes first"; exit 1; }
HOST=deploy@68.183.177.183
SSH=(ssh -i "$HOME/.ssh/id_ed25519_firtech" -o IdentitiesOnly=yes -o BatchMode=yes)
SCP=(scp -q -i "$HOME/.ssh/id_ed25519_firtech" -o IdentitiesOnly=yes -o BatchMode=yes)
TG=$(grep -E '^NEXT_PUBLIC_TELEGRAM_USERNAME=' .env.local | cut -d= -f2- || true)
SHA=$(git rev-parse --short=7 HEAD)
RELEASE="$(date -u +%Y%m%d%H%M%S)-$SHA"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

git archive HEAD | tar -x -C "$WORK"
git rev-parse HEAD > "$WORK/REVISION.src"
(
  cd "$WORK"
  git init -q && git -c user.name=ci -c user.email=ci@local commit -q --allow-empty -m build
  npm ci --prefer-offline --no-audit --no-fund >/dev/null
  NEXT_PUBLIC_SITE_URL=https://firtech.pro NEXT_PUBLIC_TELEGRAM_USERNAME="$TG" \
    NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=firtech_bot NEXT_DEPLOYMENT_ID="$SHA" npm run build >/dev/null
  scripts/deploy/assemble.sh "release/$RELEASE"
  cp REVISION.src "release/$RELEASE/REVISION"
  # The VPS is linux x64: add sharp's Linux binaries next to the macOS ones.
  cd "release/$RELEASE/node_modules/@img"
  for pkg in sharp-linux-x64@0.35.5 sharp-libvips-linux-x64@1.3.4; do
    name=${pkg%@*}
    file=$(npm pack "@img/$pkg" --silent | tail -1)
    mkdir -p "$name" && tar -xzf "$file" -C "$name" --strip-components=1 && rm "$file"
  done
)
COPYFILE_DISABLE=1 tar --no-xattrs -czf "$WORK/release.tgz" -C "$WORK/release" "$RELEASE"

"${SSH[@]}" "$HOST" "install -d -m 700 /var/www/firtech/incoming"
"${SCP[@]}" "$WORK/release.tgz" "$HOST:/var/www/firtech/incoming/$RELEASE.tgz"
"${SSH[@]}" "$HOST" "set -e
  tar -xzf /var/www/firtech/incoming/$RELEASE.tgz -C /var/www/firtech/releases 2>/dev/null
  rm -f /var/www/firtech/incoming/$RELEASE.tgz
  /var/www/firtech/releases/$RELEASE/activate.sh $RELEASE"
curl -fsS --retry 5 --retry-delay 3 --retry-all-errors https://firtech.pro/api/health >/dev/null && echo "https://firtech.pro is up ($RELEASE)"
