#!/usr/bin/env bash
# One-time (idempotent) setup of the restricted CI user `firtech-ci` (security 2026-11-23, P1-5; docs/ci-user.md).
# Run as root on the VPS after copying receive.sh, activate-incoming.sh and activate.sh to /tmp:
#   sudo bash /tmp/ci-user-setup.sh 'ssh-ed25519 AAAA... github-actions-firtech-ci'
# Touches only: user firtech-ci, deploy's membership in group firtech-ci, /usr/local/bin/firtech-*.sh,
# /var/www/firtech/{incoming,incoming/ready,ci-status}, two systemd units. Never sudo or docker for firtech-ci.
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo "run as root" >&2; exit 1; }
CI_PUBKEY="${1:?usage: ci-user-setup.sh \"ssh-ed25519 AAAA... comment\"}"
[[ "$CI_PUBKEY" =~ ^ssh-ed25519\ [A-Za-z0-9+/=]+(\ [A-Za-z0-9._@-]+)?$ ]] || { echo "expected one ssh-ed25519 public key line" >&2; exit 1; }
SRC="${SRC:-/tmp}"
for f in receive.sh activate-incoming.sh activate.sh; do
  [[ -f "$SRC/$f" ]] || { echo "missing $SRC/$f" >&2; exit 1; }
done

id firtech-ci >/dev/null 2>&1 || useradd --create-home --home-dir /home/firtech-ci --shell /bin/bash --comment "Fir Tech CI upload" firtech-ci
passwd -l firtech-ci >/dev/null
gpasswd -d firtech-ci sudo 2>/dev/null || true
gpasswd -d firtech-ci docker 2>/dev/null || true
usermod -aG firtech-ci deploy

install -o root -g root -m 755 "$SRC/receive.sh" /usr/local/bin/firtech-receive.sh
install -o root -g root -m 755 "$SRC/activate-incoming.sh" /usr/local/bin/firtech-activate-incoming.sh
install -o root -g root -m 755 "$SRC/activate.sh" /usr/local/bin/firtech-activate.sh
rm -f "$SRC/receive.sh" "$SRC/activate-incoming.sh" "$SRC/activate.sh"

install -d -o deploy -g firtech-ci -m 2770 /var/www/firtech/incoming /var/www/firtech/incoming/ready /var/www/firtech/ci-status
chown deploy:firtech-ci /var/www/firtech/incoming && chmod 2770 /var/www/firtech/incoming

install -d -o root -g root -m 755 /home/firtech-ci/.ssh
printf 'command="/usr/local/bin/firtech-receive.sh",restrict %s\n' "$CI_PUBKEY" > /home/firtech-ci/.ssh/authorized_keys
chown root:root /home/firtech-ci/.ssh/authorized_keys
chmod 644 /home/firtech-ci/.ssh/authorized_keys

cat > /etc/systemd/system/firtech-deploy.service <<'UNIT'
[Unit]
Description=Fir Tech: activate a release handed over by CI (firtech-ci -> deploy)

[Service]
Type=oneshot
User=deploy
Group=deploy
SupplementaryGroups=firtech-ci
Environment=HOME=/home/deploy PM2_HOME=/home/deploy/.pm2
# pm2 talks to deploy's running PM2 daemon; never kill what activate.sh started.
KillMode=process
TimeoutStartSec=400
ExecStart=/usr/local/bin/firtech-activate-incoming.sh
UNIT

cat > /etc/systemd/system/firtech-deploy.path <<'UNIT'
[Unit]
Description=Fir Tech: watch for releases handed over by CI

[Path]
DirectoryNotEmpty=/var/www/firtech/incoming/ready
Unit=firtech-deploy.service

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now firtech-deploy.path
id firtech-ci
systemctl is-active firtech-deploy.path
echo "Done. Next: docs/ci-user.md step 4 (check), step 5 (GitHub secrets and DEPLOY_RECEIVE=1)."
