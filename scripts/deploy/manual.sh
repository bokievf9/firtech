#!/usr/bin/env bash
# Deploy from this Mac while there is no CI: builds a clean checkout of HEAD (no .env.local), the
# same way the GitHub workflow does, runs the checks, then uploads and activates it as `deploy`.
#   scripts/deploy/manual.sh
# Deploys main. A hotfix branch (for example cut from the live REVISION) must be named on purpose:
#   DEPLOY_BRANCH=fix-something scripts/deploy/manual.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
test -z "$(git status --porcelain)" || { echo "Commit your changes first"; exit 1; }
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != main ] && [ "${DEPLOY_BRANCH:-}" != "$BRANCH" ]; then
  echo "On '$BRANCH', not main. To deploy it anyway: DEPLOY_BRANCH=$BRANCH $0"
  exit 1
fi
HOST=deploy@201.79.122.133
SSH=(ssh -i "$HOME/.ssh/id_ed25519_firtech" -o IdentitiesOnly=yes -o BatchMode=yes)
SCP=(scp -q -i "$HOME/.ssh/id_ed25519_firtech" -o IdentitiesOnly=yes -o BatchMode=yes)
TG=$(grep -E '^NEXT_PUBLIC_TELEGRAM_USERNAME=' .env.local | cut -d= -f2- || true)
TG=${TG:-firtech_bot} # public client bot when .env.local has no value
# Yandex Metrika counter id (public, digits). Empty builds the site without the tag.
YM=$(grep -E '^NEXT_PUBLIC_YM_ID=' .env.local | cut -d= -f2- || true)
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
  # Same checks as CI; a failing one stops the deploy before anything is uploaded.
  npx next typegen >/dev/null && npm run typecheck >/dev/null && npm run lint >/dev/null &&
    npm test >/dev/null || { echo "Checks failed: run typecheck, lint and tests locally"; exit 1; }
  NEXT_PUBLIC_SITE_URL=https://firtech.pro NEXT_PUBLIC_TELEGRAM_USERNAME="$TG" \
    NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=firtech_bot NEXT_PUBLIC_YM_ID="$YM" NEXT_DEPLOYMENT_ID="$SHA" npm run build >/dev/null
  scripts/deploy/assemble.sh "release/$RELEASE"
  cp REVISION.src "release/$RELEASE/REVISION"
  # The VPS is linux x64: add sharp's Linux binaries next to the macOS ones, at the versions the
  # lockfile pins.
  SHARP=$(node -p "require('./package-lock.json').packages['node_modules/@img/sharp-linux-x64'].version")
  VIPS=$(node -p "require('./package-lock.json').packages['node_modules/@img/sharp-libvips-linux-x64'].version")
  cd "release/$RELEASE/node_modules/@img"
  for pkg in "sharp-linux-x64@$SHARP" "sharp-libvips-linux-x64@$VIPS"; do
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
