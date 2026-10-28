#!/usr/bin/env bash
# Run on the VM as fsops. Apply DB migrations (db/bootstrap → supabase/migrations → db/migrations).
# Uses ~/.pgpass written by 11-db-check.sh. Safe to re-run: only new files are applied.
#   ssh fs-ncp 'bash /srv/family-shield/repo/deploy/remote/12-migrate.sh [--status]'
set -euo pipefail
ENV_FILE=/etc/family-shield/skill.env
get() { sudo -n cat "$ENV_FILE" | sed -n "s/^$1=//p" | head -n1; }
export DATABASE_HOST="$(get DATABASE_HOST)" DATABASE_PORT="$(get DATABASE_PORT)" \
       DATABASE_NAME="$(get DATABASE_NAME)" DATABASE_USER="$(get DATABASE_USER)"
cd /srv/family-shield/repo
node db/migrate.mjs "$@"
