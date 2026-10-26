-- Row Level Security: 기본 거부에서 시작 (PRD 11-3)
--
-- 설계 원칙
--  1. 모든 테이블에 RLS를 켜고 정책이 없으면 아무것도 못 한다.
--  2. 정책 안에서 같은 테이블을 다시 조회하면 무한 재귀가 나므로,
--     멤버십 확인은 private 스키마의 SECURITY DEFINER 함수로 뺀다.
--     private 스키마는 API에 노출되지 않으므로 REST RPC로 호출할 수 없다.
--  3. anon(비로그인)에게는 어떤 테이블 권한도 주지 않는다.
--  4. service_role은 RLS를 우회한다. 스킬 서버·Cron만 이 키를 쓴다.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 멤버십 헬퍼
-- ─────────────────────────────────────────────────────────────

-- 이 그룹의 보호받는 사람(부모님)인가
create or replace function private.is_circle_protected(p_circle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.circles c
    where c.id = p_circle_id
      and c.protected_user_id = (select auth.uid())
  );
$$;

-- 이 그룹의 활성 보호자인가
create or replace function private.is_circle_member(p_circle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.circle_members m
    where m.circle_id = p_circle_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

-- 부모님이거나 보호자 (그룹 참여자)
create or replace function private.is_circle_participant(p_circle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_circle_protected(p_circle_id)
      or private.is_circle_member(p_circle_id);
$$;

-- 같은 그룹에 속한 사람인가 (users 조회 범위)
create or replace function private.shares_circle_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with my_circles as (
    select c.id from public.circles c
    where c.protected_user_id = (select auth.uid())
    union
    select m.circle_id from public.circle_members m
    where m.user_id = (select auth.uid()) and m.status = 'active'
  )
  select exists (
    select 1
    from public.circles c2
    join my_circles mc on mc.id = c2.id
    where c2.protected_user_id = p_user_id
  ) or exists (
    select 1
    from public.circle_members m2
    join my_circles mc on mc.id = m2.circle_id
    where m2.user_id = p_user_id and m2.status = 'active'
  );
$$;

-- 나에게 확인 요청이 온 판별 건인가 (보호자 조회 범위, PRD 11-3)
create or replace function private.is_my_confirm_target(p_check_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.confirm_requests cr
    where cr.check_id = p_check_id
      and cr.target_member_id = (select auth.uid())
  );
$$;

-- 판별 건이 속한 그룹의 부모님인가 (confirm_requests·notification_attempts용)
create or replace function private.owns_check(p_check_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.checks ch
    join public.circles c on c.id = ch.circle_id
    where ch.id = p_check_id
      and c.protected_user_id = (select auth.uid())
  );
$$;

revoke all on all functions in schema private from public;
grant execute on all functions in schema private to authenticated;
