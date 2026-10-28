#!/usr/bin/env bash
# Run on the VM as fsops. Install purge (every 10 min) and backup (nightly) timers, run each once.
#   ssh fs-ncp 'bash /srv/family-shield/repo/deploy/remote/14-db-timers.sh'
set -euo pipefail
REPO=/srv/family-shield/repo
mkdir -p /srv/family-shield/backup
chmod 700 /srv/family-shield/backup

for u in family-shield-purge.service family-shield-purge.timer family-shield-backup.service family-shield-backup.timer; do
  sudo -n install -m 644 "$REPO/deploy/systemd/$u" "/etc/systemd/system/$u"
done
sudo -n systemctl daemon-reload
sudo -n systemctl enable --now family-shield-purge.timer family-shield-backup.timer >/dev/null 2>&1

echo "== purge once"
sudo -n systemctl start family-shield-purge.service
sudo -n journalctl -u family-shield-purge.service -n 6 --no-pager -o cat | grep -E '=|Finished|Failed' || true
echo "== backup once"
sudo -n systemctl start family-shield-backup.service
sudo -n journalctl -u family-shield-backup.service -n 4 --no-pager -o cat | grep -E 'dump|Finished|Failed' || true
echo "== timers"
systemctl list-timers --no-pager | grep -E 'family-shield' | awk '{print $1, $2, $3, "->", $(NF-1)}'
