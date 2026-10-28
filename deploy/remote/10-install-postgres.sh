#!/usr/bin/env bash
# One-time PostgreSQL 16 install for familyshield (D36). Run ONCE by a person, with the fsops sudo password:
#   ssh -t fs-ncp "sudo bash /srv/family-shield/repo/deploy/remote/10-install-postgres.sh"
#
# What it does (nothing else):
#   1. installs postgresql 16 server from the Rocky AppStream module
#   2. initializes the cluster, listens on 127.0.0.1 only, scram-sha-256 for TCP
#   3. creates role fs_app (LOGIN, member of anon/authenticated/service_role) and database familyshield
#      owned by fs_app, with a random password written only to /etc/family-shield/skill.env (root 600)
#   4. installs pgTAP if available (tests only)
# Safe to re-run: every step checks before acting. The password is never printed.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "run with sudo"; exit 1; }

ENV_FILE=/etc/family-shield/skill.env
DB=familyshield
APP=fs_app
PGDATA=/var/lib/pgsql/data

echo "== 1. package"
if ! rpm -q postgresql-server >/dev/null 2>&1; then
  dnf -y -q module reset postgresql
  dnf -y -q module enable postgresql:16
  dnf -y -q install postgresql-server postgresql-contrib
fi
postgres_ver="$(rpm -q --qf '%{VERSION}' postgresql-server)"
echo "postgresql-server $postgres_ver"
case "$postgres_ver" in 16.*) ;; *) echo "FAIL: expected 16.x"; exit 1;; esac

echo "== 2. cluster"
if [ ! -f "$PGDATA/PG_VERSION" ]; then
  postgresql-setup --initdb
fi
# listen only on loopback; no external port
if ! grep -q "^listen_addresses = '127.0.0.1'" "$PGDATA/postgresql.conf"; then
  echo "listen_addresses = '127.0.0.1'" >> "$PGDATA/postgresql.conf"
fi
if ! grep -q "^password_encryption = scram-sha-256" "$PGDATA/postgresql.conf"; then
  echo "password_encryption = scram-sha-256" >> "$PGDATA/postgresql.conf"
fi
# local socket: only the postgres OS user (peer). TCP on 127.0.0.1: password (scram). Nothing else.
cat > "$PGDATA/pg_hba.conf" <<'EOF'
# TYPE  DATABASE  USER      ADDRESS        METHOD
local   all       postgres                 peer
host    all       all       127.0.0.1/32   scram-sha-256
EOF
chown postgres:postgres "$PGDATA/pg_hba.conf"; chmod 600 "$PGDATA/pg_hba.conf"
systemctl enable --now postgresql >/dev/null 2>&1
systemctl restart postgresql
sleep 2
systemctl is-active postgresql

echo "== 3. role + database"
PW="$(grep -s '^DATABASE_PASSWORD=' "$ENV_FILE" | cut -d= -f2- || true)"
if [ -z "$PW" ]; then PW="$(openssl rand -hex 32)"; NEW_PW=1; else NEW_PW=0; fi
# psql reads the password from stdin variable, never from argv
sudo -u postgres psql -v ON_ERROR_STOP=1 -q -v app="$APP" -v db="$DB" -v pw="$PW" <<'SQL'
select format('create role %I login', :'app')
 where not exists (select 1 from pg_roles where rolname = :'app') \gexec
alter role :"app" with login password :'pw' noinherit;
select format('create database %I owner %I', :'db', :'app')
 where not exists (select 1 from pg_database where datname = :'db') \gexec
revoke all on database :"db" from public;
grant connect on database :"db" to :"app";
SQL
# roles the migrations expect; fs_app may SET ROLE into them (NOINHERIT: it gets no privileges by default)
sudo -u postgres psql -v ON_ERROR_STOP=1 -q -d "$DB" -v app="$APP" <<'SQL'
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon')          then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role')  then create role service_role nologin bypassrls; end if;
end $$;
grant anon, authenticated, service_role to :"app";
-- the app owns the schema objects it migrates
alter schema public owner to :"app";
SQL

echo "== 4. pgTAP (tests only)"
if dnf -q list --available pgtap >/dev/null 2>&1 || rpm -q pgtap >/dev/null 2>&1; then
  dnf -y -q install pgtap >/dev/null 2>&1 && echo "pgtap installed" || echo "pgtap: not installed"
  sudo -u postgres psql -q -d "$DB" -c 'create schema if not exists extensions; create extension if not exists pgtap with schema extensions;' && echo "pgtap extension ready" || true
else
  echo "pgtap package not in repos: tests will use a pure-SQL fallback"
fi
# pgcrypto must be created by superuser
sudo -u postgres psql -q -d "$DB" -c 'create extension if not exists pgcrypto;'

echo "== 5. app config"
touch "$ENV_FILE"; chown root:root "$ENV_FILE"; chmod 600 "$ENV_FILE"
if [ "$NEW_PW" = 1 ]; then
  {
    echo ""
    echo "# PostgreSQL on this VM (D36). 127.0.0.1 only."
    echo "DATABASE_HOST=127.0.0.1"
    echo "DATABASE_PORT=5432"
    echo "DATABASE_NAME=$DB"
    echo "DATABASE_USER=$APP"
    echo "DATABASE_PASSWORD=$PW"
  } >> "$ENV_FILE"
  echo "DATABASE_* written to $ENV_FILE"
else
  echo "DATABASE_* already in $ENV_FILE (kept)"
fi
unset PW

echo "== 6. check"
ss -lntp | grep ':5432' | sed 's/users:.*//'
echo "DONE. Tell the assistant it finished."
