#!/usr/bin/env bash
# Turns a finished `npm run build` into a self-contained release directory (Next.js standalone).
#   scripts/deploy/assemble.sh <out-dir>
set -euo pipefail
OUT="${1:?usage: assemble.sh <out-dir>}"
test -f .next/standalone/server.js || { echo "Run npm run build first (output: 'standalone')"; exit 1; }
rm -rf "$OUT" && mkdir -p "$OUT/.next" "$OUT/public"
cp -R .next/standalone/. "$OUT/"
cp -R .next/static "$OUT/.next/static"
# Merge, not copy: standalone may already hold a traced public/ (would nest as public/public).
# public/ is empty today (git does not keep empty folders), so it may be missing.
if [ -d public ]; then cp -R public/. "$OUT/public/"; fi
test ! -e "$OUT/public/public" || { echo "public/ was not assembled correctly"; exit 1; }
cp ecosystem.config.cjs scripts/deploy/activate.sh "$OUT/"
# Fonts read from disk at render time (OG image).
cp -R assets "$OUT/assets"
# Ops helper run on the server after deploy (sets the Telegram webhook); dependency-free.
mkdir -p "$OUT/scripts" && cp scripts/telegram-webhook.mjs "$OUT/scripts/" && cp -R scripts/ops "$OUT/scripts/ops"
git rev-parse HEAD > "$OUT/REVISION" 2>/dev/null || true
# Env files and local lead data never ship inside a release.
find "$OUT" -maxdepth 1 -name '.env*' -delete
rm -rf "$OUT/data"
echo "Release assembled in $OUT ($(du -sh "$OUT" | cut -f1))"
