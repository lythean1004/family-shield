-- Anonymous Kakao result tokens contain no account identity and expire in ten minutes.
alter table public.checks alter column circle_id drop not null;
alter table public.checks alter column created_by drop not null;
alter table public.checks add constraint check_identity_pair check ((circle_id is null) = (created_by is null));
alter table public.confirm_requests add column device_suspect boolean not null default false;
alter table public.confirm_requests add column processing_consent_version text;
alter table public.confirm_requests add column processing_consent_at timestamptz;
alter table public.confirm_requests alter column deadline_at set default (now()+interval '5 minutes');
alter table public.checks add column receipt_hash text unique;

create policy "checks: 부모님 생성" on public.checks for insert to authenticated
  with check (created_by=(select auth.uid()) and private.is_circle_protected(circle_id));
create policy "checks: 부모님 판정 갱신" on public.checks for update to authenticated
  using (private.is_circle_protected(circle_id)) with check (private.is_circle_protected(circle_id));
create policy "confirm_requests: 부모님 생성" on public.confirm_requests for insert to authenticated
  with check (private.owns_check(check_id) and state='pending' and response is null
    and exists (select 1 from public.checks ch join public.circle_members m on m.circle_id=ch.circle_id
      where ch.id=check_id and m.user_id=target_member_id and m.status='active'));
create policy "confirm_requests: 부모님 취소" on public.confirm_requests for update to authenticated
  using (private.owns_check(check_id)) with check (private.owns_check(check_id));

-- Revoking consent cancels outstanding requests in the same transaction.
create function private.cancel_requests_on_consent() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if not new.granted and new.item in ('family_alert','impersonation_check') then
    update public.confirm_requests set state='cancelled'
    where state='pending' and check_id in (select id from public.checks where circle_id=new.circle_id);
  end if;
  return new;
end;
$$;
revoke all on function private.cancel_requests_on_consent() from public,anon,authenticated;
create trigger cancel_requests_on_consent after insert on public.consents
  for each row execute function private.cancel_requests_on_consent();

-- A revoked family connection must stop reads as well as responses.
create or replace function private.is_my_confirm_target(p_check_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists (select 1 from public.confirm_requests cr
    join public.checks ch on ch.id=cr.check_id
    join public.circle_members m on m.circle_id=ch.circle_id and m.user_id=cr.target_member_id
    where cr.check_id=p_check_id and cr.target_member_id=(select auth.uid())
      and m.status='active' and cr.state<>'cancelled' and ch.purge_at>now());
$$;
drop policy "confirm_requests: 보호자 읽기" on public.confirm_requests;
create policy "confirm_requests: 보호자 읽기" on public.confirm_requests for select to authenticated
  using (target_member_id=(select auth.uid()) and exists (
    select 1 from public.checks ch join public.circle_members m on m.circle_id=ch.circle_id
    where ch.id=check_id and m.user_id=(select auth.uid()) and m.status='active'));
drop policy "confirm_requests: 보호자 응답" on public.confirm_requests;
create policy "confirm_requests: 보호자 응답" on public.confirm_requests for update to authenticated
  using (target_member_id=(select auth.uid()) and state='pending' and deadline_at>now()
    and exists (select 1 from public.checks ch join public.circle_members m on m.circle_id=ch.circle_id
      where ch.id=check_id and m.user_id=(select auth.uid()) and m.status='active'))
  with check (target_member_id=(select auth.uid()));

alter table public.misjudge_reports drop constraint misjudge_reports_reason_check;
alter table public.misjudge_reports add constraint misjudge_reports_reason_check
  check (reason in ('false_alarm','missed_threat','other'));
