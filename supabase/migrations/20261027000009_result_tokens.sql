-- result_tokens: 챗봇 [자세히 보기] → 웹 P4 1회용 토큰 (PRD 13-4, D34)
--
-- 토큰 원문은 저장하지 않고 SHA-256 해시(hex 64자)만 둔다.
-- 수명 10분, 한 번 조회하면 used_at을 채워 무효. 판별 건이 지워지면(24시간) 함께 지워진다.
-- authenticated·anon 정책 없음 → service_role(스킬 서버)만 접근한다.

create table public.result_tokens (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  check_id   uuid not null references public.checks(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index result_tokens_expires_idx on public.result_tokens(expires_at);

alter table public.result_tokens enable row level security;
revoke all on public.result_tokens from anon, authenticated;

-- 1회 조회: 유효하면 used_at을 채우고 check_id를 돌려준다. 만료·사용됨·없음이면 null.
-- 한 문장 UPDATE ... RETURNING이라 동시에 두 번 불러도 한 번만 성공한다.
create or replace function private.redeem_result_token(p_token_hash text)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$
  update public.result_tokens
     set used_at = now()
   where token_hash = p_token_hash
     and used_at is null
     and expires_at > now()
  returning check_id;
$$;

grant usage on schema private to service_role;
revoke all on function private.redeem_result_token(text) from public, anon, authenticated;
grant execute on function private.redeem_result_token(text) to service_role;

-- 스킬 서버는 REST(PostgREST)로 부르므로 public 쪽 얇은 진입점을 둔다.
-- 실행 권한은 service_role만. anon·authenticated는 부를 수 없다.
create or replace function public.redeem_result_token(p_token_hash text)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.redeem_result_token(p_token_hash);
$$;

revoke all on function public.redeem_result_token(text) from public, anon, authenticated;
grant execute on function public.redeem_result_token(text) to service_role;
