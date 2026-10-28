#!/usr/bin/env bash
# Run only after approval. Uses existing sudo allowlist; no sudoers changes.
set -euo pipefail
umask 077
env_file=/etc/family-shield/skill.env
work="$(mktemp -d /tmp/fs-push.XXXXXX)"
trap 'rm -f -- "$work/skill.env"; rmdir -- "$work"' EXIT
sudo -n cat "$env_file" | node /srv/family-shield/repo/skill/scripts/configure-push.mjs --from-stdin "$work/skill.env"
sudo -n cp -n "$env_file" "$env_file.before-push"
sudo -n install -o root -g root -m 600 "$work/skill.env" "$env_file"
echo 'VAPID configured; AI key preserved; service not restarted yet.'
