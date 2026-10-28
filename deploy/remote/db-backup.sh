#!/usr/bin/env bash
# Invoked by family-shield-backup.service. No secrets or message content in output.
set -euo pipefail
umask 077
export PGPASSWORD="$DATABASE_PASSWORD"
args=(-h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" -d "$DATABASE_NAME")
backup_dir=/srv/family-shield/backup
test -d "$backup_dir"
# A failed purge must prevent the dump. Expired rows must not enter a new backup.
/usr/bin/psql -X -q -A -t -v ON_ERROR_STOP=1 "${args[@]}" \
  -c 'begin; set local role service_role; select count(*) from private.purge_expired(); commit;' >/dev/null
temporary="$(mktemp "$backup_dir/.familyshield-XXXXXX")"
trap 'rm -f -- "$temporary"' EXIT
/usr/bin/pg_dump -Fc "${args[@]}" -f "$temporary"
test -s "$temporary"
output="$backup_dir/familyshield-$(date -u +%Y%m%d-%H%M%S).dump"
mv -- "$temporary" "$output"
find "$backup_dir" -maxdepth 1 -type f -name 'familyshield-*.dump' -mmin +10080 -delete
echo 'backup completed (7-day retention)'
