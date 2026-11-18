#!/usr/bin/env bash
# One-time runtime setup on a clean Ubuntu 24.04 VPS, run as root BEFORE server-setup.sh:
#   bash scripts/deploy/server-runtime.sh
# Installs Node (the major version from .nvmrc) system-wide from NodeSource, installs PM2 globally
# and registers PM2's systemd unit for the `deploy` user. Safe to re-run.
set -euo pipefail
cd "$(dirname "$0")/../.."
[ "$(id -u)" -eq 0 ] || { echo "Run as root"; exit 1; }
id deploy >/dev/null 2>&1 || { echo "User 'deploy' does not exist"; exit 1; }

# Wanted major version: from .nvmrc when it is in the copied folder, else 22.
WANT=22
if [ -f .nvmrc ]; then
  WANT=$(tr -dc '0-9.' < .nvmrc | cut -d. -f1)
fi
: "${WANT:=22}"
export DEBIAN_FRONTEND=noninteractive

# --- Node ---
CUR=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo none)
if [ "$CUR" != "$WANT" ]; then
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg
  install -d -m 755 /etc/apt/keyrings
  if curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
      | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg; then
    chmod 644 /etc/apt/keyrings/nodesource.gpg
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${WANT}.x nodistro main" \
      > /etc/apt/sources.list.d/nodesource.list
    apt-get update -y
    apt-get install -y nodejs
  fi
  CUR=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo none)
fi
if [ "$CUR" != "$WANT" ]; then
  # Fallback: official tarball (latest release of the wanted major) into /usr/local.
  echo "NodeSource did not give Node $WANT, falling back to the nodejs.org tarball"
  case "$(uname -m)" in x86_64) ARCH=x64 ;; aarch64) ARCH=arm64 ;; *) echo "Unknown arch"; exit 1 ;; esac
  BASE="https://nodejs.org/dist/latest-v${WANT}.x"
  FILE=$(curl -fsSL "$BASE/SHASUMS256.txt" | grep "linux-${ARCH}.tar.xz" | awk '{print $2}' | head -1)
  TMP=$(mktemp -d)
  curl -fsSL "$BASE/$FILE" -o "$TMP/$FILE"
  (cd "$TMP" && curl -fsSL "$BASE/SHASUMS256.txt" | grep " $FILE\$" | sha256sum -c -)
  tar -xJf "$TMP/$FILE" -C /usr/local --strip-components=1
  rm -rf "$TMP"
  hash -r
  CUR=$(node -p 'process.versions.node.split(".")[0]')
fi
[ "$CUR" = "$WANT" ] || { echo "Node $WANT is not installed (got: $CUR)"; exit 1; }

# --- PM2 ---
if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi

# --- PM2 systemd unit for deploy (starts saved processes on boot) ---
PM2_BIN=$(command -v pm2)
NODE_DIR=$(dirname "$(command -v node)")
env PATH="$PATH:$NODE_DIR" "$PM2_BIN" startup systemd -u deploy --hp /home/deploy
systemctl daemon-reload
systemctl enable pm2-deploy
# The unit runs `pm2 resurrect`; before the first deploy there is nothing saved and that is fine.
# Do not start it now: activate.sh starts the app and runs `pm2 save`.

echo
echo "node  $(node -v)"
echo "npm   $(npm -v)"
echo "pm2   $(pm2 -v)"
echo "unit  pm2-deploy: $(systemctl is-enabled pm2-deploy)"
