-- Only for the disposable local test container, never run against the VM.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role fs_app login noinherit;
grant anon, authenticated, service_role to fs_app;
alter database familyshield owner to fs_app;
alter schema public owner to fs_app;
create extension if not exists pgcrypto;
