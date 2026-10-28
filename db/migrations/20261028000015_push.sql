alter table public.push_subscriptions add column test_confirmed_at timestamptz;
create table private.push_tests (
  token_hash text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  expires_at timestamptz not null default(now()+interval '10 minutes')
);
alter table private.push_tests enable row level security;
revoke all on private.push_tests from public,anon,authenticated;
grant select,insert,update,delete on private.push_tests to service_role;
alter function private.purge_expired() rename to purge_auth_records;
create function private.purge_expired() returns table(table_name text,deleted bigint)
language plpgsql volatile security definer set search_path='' as $$
declare n bigint;
begin
  return query select * from private.purge_auth_records();
  delete from private.push_tests where expires_at<now();
  get diagnostics n=row_count;table_name:='push_tests';deleted:=n;return next;
end;
$$;
revoke all on function private.purge_expired() from public,anon,authenticated;
grant execute on function private.purge_expired() to service_role;
