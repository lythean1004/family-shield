#!/usr/bin/env bash
# Run on the VM as fsops. DB permission tests (supabase/tests/*.test.sql) against the VM PostgreSQL.
#   ssh fs-ncp 'bash /srv/family-shield/repo/deploy/remote/13-db-test.sh'
set -euo pipefail
ENV_FILE=/etc/family-shield/skill.env
get() { sudo -n cat "$ENV_FILE" | sed -n "s/^$1=//p" | head -n1; }
export DATABASE_HOST="$(get DATABASE_HOST)" DATABASE_PORT="$(get DATABASE_PORT)" \
       DATABASE_NAME="$(get DATABASE_NAME)" DATABASE_USER="$(get DATABASE_USER)"
cd /srv/family-shield/repo
node --no-deprecation db/test.mjs
