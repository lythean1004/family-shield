-- Keep the existing expiry policy and add short-lived authentication data.
alter function private.purge_expired() rename to purge_records;
create function private.purge_expired()
returns table(table_name text, deleted bigint)
language plpgsql volatile security definer set search_path=''
as $$
declare n bigint;
begin
  return query select * from private.purge_records();
  delete from private.sessions where expires_at<now();
  get diagnostics n=row_count; table_name:='sessions'; deleted:=n; return next;
  delete from private.demo_codes where expires_at<now();
  get diagnostics n=row_count; table_name:='demo_codes'; deleted:=n; return next;
  delete from private.parent_invites where expires_at<now();
  get diagnostics n=row_count; table_name:='parent_invites'; deleted:=n; return next;
  delete from private.auth_limits where window_start<now()-interval '1 day';
  get diagnostics n=row_count; table_name:='auth_limits'; deleted:=n; return next;
end;
$$;
revoke all on function private.purge_expired() from public,anon,authenticated;
grant execute on function private.purge_expired() to service_role;
