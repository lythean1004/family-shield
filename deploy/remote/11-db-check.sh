#!/usr/bin/env bash
# Run on the VM as fsops (no sudo password needed). Verifies the PostgreSQL install and
# writes ~/.pgpass (600) from skill.env so psql/node can connect as fs_app without the password on argv.
set -euo pipefail
ENV_FILE=/etc/family-shield/skill.env
get() { sudo -n cat "$ENV_FILE" | sed -n "s/^$1=//p" | head -n1; }

echo "== service";  systemctl is-active postgresql
echo "== listen";   sudo -n ss -lntp | grep ':5432' | awk '{print $4}'
echo "== env keys"; sudo -n cat "$ENV_FILE" | grep -oE '^DATABASE_[A-Z]+' | tr '\n' ' '; echo

HOST="$(get DATABASE_HOST)"; PORT="$(get DATABASE_PORT)"; DB="$(get DATABASE_NAME)"; USER_="$(get DATABASE_USER)"
umask 077
printf '%s:%s:%s:%s:%s\n' "$HOST" "$PORT" "$DB" "$USER_" "$(get DATABASE_PASSWORD)" > ~/.pgpass
chmod 600 ~/.pgpass

echo "== connect as $USER_"
psql -h "$HOST" -p "$PORT" -U "$USER_" -d "$DB" -X -A -t -v ON_ERROR_STOP=1 <<'SQL'
select 'version: ' || current_setting('server_version');
select 'user: ' || current_user || ', db: ' || current_database();
select 'roles: ' || string_agg(b.rolname, ',' order by b.rolname)
  from pg_auth_members m join pg_roles b on b.oid = m.roleid join pg_roles u on u.oid = m.member
 where u.rolname = current_user;
select 'extensions: ' || coalesce(string_agg(extname || ' ' || extversion, ', '), '(none)') from pg_extension where extname <> 'plpgsql';
select 'public tables: ' || count(*) from information_schema.tables where table_schema = 'public';
SQL
echo "== external reachability: only 127.0.0.1 above means no public port"
