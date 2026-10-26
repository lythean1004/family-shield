-- RLS 정책 파트 2: checks ~ metrics (PRD 11-3)

-- ── checks ─────────────────────────────────────────────
alter table public.checks enable row level security;

-- 부모님: 자기 그룹 판별 기록 전체 (11-3)
create policy "checks: 부모님 읽기" on public.checks
  for select to authenticated
  using (private.is_circle_protected(circle_id));

-- 보호자: 자신에게 확인 요청이 온 건만 (11-3)
create policy "checks: 보호자 제한 읽기" on public.checks
  for select to authenticated
  using (private.is_my_confirm_target(id));

-- 삽입은 service_role(스킬 서버)에서만

-- ── confirm_requests ───────────────────────────────────
alter table public.confirm_requests enable row level security;

create policy "confirm_requests: 부모님 읽기" on public.confirm_requests
  for select to authenticated
  using (private.owns_check(check_id));

create policy "confirm_requests: 보호자 읽기" on public.confirm_requests
  for select to authenticated
  using (target_member_id = (select auth.uid()));

create policy "confirm_requests: 보호자 응답" on public.confirm_requests
  for update to authenticated
  using (
    target_member_id = (select auth.uid())
    and state = 'pending'
  )
  with check (target_member_id = (select auth.uid()));

-- ── notification_attempts ──────────────────────────────
alter table public.notification_attempts enable row level security;

create policy "notification_attempts: 부모님 읽기" on public.notification_attempts
  for select to authenticated
  using (
    exists (
      select 1
      from public.confirm_requests cr
      where cr.id = request_id
        and private.owns_check(cr.check_id)
    )
  );

-- ── after_actions ──────────────────────────────────────
alter table public.after_actions enable row level security;

create policy "after_actions: 부모님 관리" on public.after_actions
  for all to authenticated
  using (
    exists (
      select 1
      from public.checks ch
      where ch.id = check_id
        and private.is_circle_protected(ch.circle_id)
    )
  )
  with check (
    exists (
      select 1
      from public.checks ch
      where ch.id = check_id
        and private.is_circle_protected(ch.circle_id)
    )
  );

-- ── auth_events ────────────────────────────────────────
alter table public.auth_events enable row level security;

create policy "auth_events: 본인 읽기" on public.auth_events
  for select to authenticated
  using (user_id = (select auth.uid()));

-- ── rate_limits ────────────────────────────────────────
alter table public.rate_limits enable row level security;
-- authenticated 정책 없음 — service_role만 접근

-- ── misjudge_reports ───────────────────────────────────
alter table public.misjudge_reports enable row level security;

create policy "misjudge_reports: 부모님 관리" on public.misjudge_reports
  for all to authenticated
  using  (private.is_circle_protected(circle_id))
  with check (private.is_circle_protected(circle_id));

-- ── metrics ────────────────────────────────────────────
alter table public.metrics enable row level security;
-- service_role(Cron·스킬 서버)만 삽입. authenticated 읽기 없음.
