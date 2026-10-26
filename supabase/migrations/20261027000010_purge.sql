-- 보관 기한이 지난 행 삭제 (PRD 11-2)
--
--   checks(24시간)        → confirm_requests·notification_attempts·after_actions·result_tokens는 cascade
--   result_tokens          → 만료·사용 뒤 1시간 지나면 먼저 지움(조회 기록이 남지 않도록)
--   auth_events·misjudge_reports → 각 purge_at(90일 [임시])
--
-- pg_cron 등록은 클라우드 Supabase(4주차)에서 한다:
--   select cron.schedule('purge-expired', '*/10 * * * *', $$select private.purge_expired()$$);
-- 로컬·테스트에서는 함수만 직접 부른다.

create or replace function private.purge_expired()
returns table (table_name text, deleted bigint)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare n bigint;
begin
  delete from public.result_tokens
   where expires_at < now() - interval '1 hour'
      or used_at    < now() - interval '1 hour';
  get diagnostics n = row_count;
  table_name := 'result_tokens'; deleted := n; return next;

  delete from public.checks where purge_at < now();
  get diagnostics n = row_count;
  table_name := 'checks'; deleted := n; return next;

  delete from public.auth_events where purge_at < now();
  get diagnostics n = row_count;
  table_name := 'auth_events'; deleted := n; return next;

  delete from public.misjudge_reports where purge_at < now();
  get diagnostics n = row_count;
  table_name := 'misjudge_reports'; deleted := n; return next;
end;
$$;

revoke all on function private.purge_expired() from public, anon, authenticated;
grant execute on function private.purge_expired() to service_role;
