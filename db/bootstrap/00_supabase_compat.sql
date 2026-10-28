-- VM 호환 계층 (D36): Supabase가 기본 제공하던 것 중 마이그레이션·RLS가 쓰는 부분만 만든다.
-- db/migrate.mjs 가 이 파일을 먼저 적용한 뒤 supabase/migrations/*.sql 을 이름 순으로 그대로 적용한다.
--
--   역할 anon / authenticated / service_role : 10-install-postgres.sh 가 superuser로 만들었다(NOLOGIN).
--     앱 접속 계정 fs_app 은 NOINHERIT 멤버라 평소엔 권한이 없고, 요청마다 SET LOCAL ROLE 로 전환한다.
--   pgcrypto           : 설치 스크립트가 superuser로 만들었다.
--   auth.users          : 로그인 계정(초대 코드 방식, 이메일·비밀번호 없음)
--   auth.uid()          : 서버가 트랜잭션마다 넣는 request.jwt.claims.sub 를 읽는다(Supabase와 같은 방식)

create schema if not exists extensions;
create schema if not exists auth;

grant usage on schema public, auth, extensions to anon, authenticated, service_role;

-- Supabase처럼 앞으로 fs_app이 만들 public 객체에 기본 권한을 준다.
-- anon 권한은 마이그레이션 20261026000008 이 다시 회수한다. RLS가 행을 거른다.
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public grant usage, select on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

-- ── auth.users ───────────────────────────────────────────────────
-- 마이그레이션 트리거(handle_new_user)가 읽는 열: id, phone, phone_confirmed_at
-- 테스트 픽스처가 넣는 열: email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text,
  phone              text,
  phone_confirmed_at timestamptz,
  raw_app_meta_data  jsonb not null default '{}',
  raw_user_meta_data jsonb not null default '{}',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
revoke all on auth.users from anon, authenticated;
grant select, insert, update, delete on auth.users to service_role;

-- ── auth.uid() ───────────────────────────────────────────────────
-- 서버(Node)가 요청마다 트랜잭션 안에서
--   select set_config('request.jwt.claims', '{"sub":"<user id>","role":"authenticated"}', true);
--   set local role authenticated;
-- 를 실행한다. 값이 없거나 형식이 틀리면 null → RLS가 모두 거부한다.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    ),
    ''
  )::uuid;
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;

