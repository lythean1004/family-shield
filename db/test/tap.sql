-- 최소 pgTAP 호환 함수 (테스트 전용, D36)
-- Rocky 8 AppStream에 pgtap 패키지가 없어서, supabase/tests/*.test.sql 이 쓰는 함수만 같은 동작으로 만든다.
--   plan(n), is(got, want, desc), throws_ok(sql, errcode, errmsg, desc), lives_ok(sql, desc), ok(bool, desc), finish()
-- 결과는 TAP 형식("ok 1 - ...", "not ok 2 - ...")으로 돌려준다. 실제 pgTAP이 있으면 그것을 쓴다.
-- db/test.mjs 가 테스트 파일마다 이 파일을 먼저 같은 트랜잭션에서 실행하고, 끝나면 rollback 한다(아무것도 남지 않음).

create schema if not exists extensions;
create temp table if not exists _tap (n serial, ok boolean, line text) on commit drop;
create temp table if not exists _tap_plan (planned int) on commit drop;
grant all on _tap, _tap_plan to public;
grant usage, select on sequence _tap_n_seq to public;

create or replace function pg_temp._tap_add(p_ok boolean, p_desc text, p_diag text default null)
returns text language plpgsql as $$
declare v_n int;
begin
  insert into _tap(ok, line) values (p_ok, '') returning n into v_n;
  update _tap set line = (case when p_ok then 'ok ' else 'not ok ' end) || v_n || ' - ' || coalesce(p_desc, '')
                       || case when p_ok or p_diag is null then '' else E'\n# ' || p_diag end
   where n = v_n;
  return (select line from _tap where n = v_n);
end $$;

create or replace function pg_temp.plan(p int) returns text language sql as $$
  insert into _tap_plan values (p); select '1..' || p;
$$;

create or replace function pg_temp.ok(p boolean, p_desc text default null) returns text language sql as $$
  select pg_temp._tap_add(coalesce(p, false), p_desc);
$$;

create or replace function pg_temp.is(got anyelement, want anyelement, p_desc text default null) returns text language sql as $$
  select pg_temp._tap_add(got is not distinct from want, p_desc,
         'have: ' || coalesce(got::text, 'NULL') || ', want: ' || coalesce(want::text, 'NULL'));
$$;

create or replace function pg_temp.throws_ok(p_sql text, p_errcode text, p_errmsg text default null, p_desc text default null)
returns text language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if p_errcode is null or sqlstate = p_errcode then
      return pg_temp._tap_add(true, p_desc);
    end if;
    return pg_temp._tap_add(false, p_desc, 'want ' || p_errcode || ', got ' || sqlstate || ': ' || sqlerrm);
  end;
  return pg_temp._tap_add(false, p_desc, 'no error raised');
end $$;

create or replace function pg_temp.lives_ok(p_sql text, p_desc text default null) returns text language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    return pg_temp._tap_add(false, p_desc, sqlstate || ': ' || sqlerrm);
  end;
  return pg_temp._tap_add(true, p_desc);
end $$;

create or replace function pg_temp.finish() returns setof text language sql as $$
  select case when (select count(*) from _tap) = (select planned from _tap_plan limit 1)
              then '# planned ' || (select planned from _tap_plan limit 1) || ', ran ' || (select count(*) from _tap)
              else '# PLAN MISMATCH: planned ' || coalesce((select planned from _tap_plan limit 1)::text, '?') || ', ran ' || (select count(*) from _tap) end;
$$;

grant execute on all functions in schema pg_temp to public;
