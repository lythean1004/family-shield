#!/usr/bin/env bash
# Operator only. Creates a private code file; never prints the code or key.
# Usage: bash deploy/remote/16-issue-demo-code.sh /home/fsops/demo-code.txt
set -euo pipefail
umask 077
output="${1:?An absolute owner-only output file is required}"
[[ "$output" = /* ]] || { echo 'Use an absolute output path'; exit 1; }
env_file=/etc/family-shield/skill.env
get() { sudo -n cat "$env_file" | sed -n "s/^$1=//p" | head -n1; }
export DATABASE_HOST="$(get DATABASE_HOST)" DATABASE_PORT="$(get DATABASE_PORT)" \
       DATABASE_NAME="$(get DATABASE_NAME)" DATABASE_USER="$(get DATABASE_USER)" \
       PHONE_HMAC_SECRET="$(get PHONE_HMAC_SECRET)"
# Issuance never calls AI or Kakao. Satisfy the shared config loader without copying their keys.
export SKILL_HEADER_TOKEN=operator-only AI_API_KEY=unused
node /srv/family-shield/repo/skill/scripts/issue-demo-code.mjs "$output"
