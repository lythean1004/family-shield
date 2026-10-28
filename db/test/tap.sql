-- 최소 pgTAP 호환 함수 (테스트 전용, D36)
-- Rocky 8 AppStream에 pgtap 패키지가 없어서, supabase/tests/*.test.sql 이 쓰는 함수만 같은 동작으로 만든다.
--   plan(n), is(got, want, desc), throws_ok(sql, errcode, errmsg, desc), lives_ok(sql, desc), ok(bool, desc), finish()
-- 결과는 TAP 형식("ok 1 - ...", "not ok 2 - ...")으로 돌려준다.
--
-- PostgreSQL은 이름만으로 부르는 함수를 pg_temp에서 찾지 않는다. 그래서 전용 스키마 tap 에 만들고,
-- db/test.mjs 가 search_path 맨 앞에 tap 을 둔다. 테스트 파일은 begin … rollback 이라
-- 이 스키마도 같은 트랜잭션 안에서 만들어졌다가 함께 사라진다(DB에 아무것도 남지 않음).
-- 결과 기록 테이블은 트랜잭션 안에서 테스트 역할(anon/authenticated/service_role)이 모두 써야 하므로
-- tap 스키마 안 일반 테이블 + public 권한. 역할을 바꿔도 결과가 이어진다.

create schema tap;
grant usage on schema tap to public;
create table tap.results (n serial primary key, ok boolean not null, line text not null default '');
create table tap.plan (planned int);
grant all on tap.results, tap.plan to public;
grant usage, select on sequence tap.results_n_seq to public;

create function tap._add(p_ok boolean, p_desc text, p_diag text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare v_n int; v_line text;
begin
  insert into tap.results(ok) values (p_ok) returning n into v_n;
  v_line := (case when p_ok then 'ok ' else 'not ok ' end) || v_n || ' - ' || coalesce(p_desc, '')
            || case when p_ok or p_diag is null then '' else ' # ' || p_diag end;
  update tap.results set line = v_line where n = v_n;
  return v_line;
end $$;

create function tap.plan(p int) returns text language plpgsql security definer set search_path = '' as $$
begin insert into tap.plan values (p); return '1..' || p; end $$;

create function tap.ok(p boolean, p_desc text default null) returns text language sql as $$
  select tap._add(coalesce(p, false), p_desc);
$$;

-- is(): pgTAP처럼 같은 타입 두 값을 비교. NULL 비교도 지원(is not distinct from).
create function tap.is(got anyelement, want anyelement, p_desc text default null) returns text language sql as $$
  select tap._add(got is not distinct from want, p_desc,
         'have ' || coalesce(got::text, 'NULL') || ', want ' || coalesce(want::text, 'NULL'));
$$;
-- 테스트가 is(<uuid>, null, ...) 처럼 두 번째 인자에 타입 없는 null을 넘기는 경우
create function tap.is(got uuid, want text, p_desc text default null) returns text language sql as $$
  select tap._add(got::text is not distinct from want, p_desc,
         'have ' || coalesce(got::text, 'NULL') || ', want ' || coalesce(want, 'NULL'));
$$;
create function tap.is(got text, want text, p_desc text default null) returns text language sql as $$
  select tap._add(got is not distinct from want, p_desc,
         'have ' || coalesce(got, 'NULL') || ', want ' || coalesce(want, 'NULL'));
$$;

-- throws_ok / lives_ok 는 호출한 역할 권한으로 SQL을 실행해야 한다(security invoker = 기본값).
create function tap.throws_ok(p_sql text, p_errcode text, p_errmsg text default null, p_desc text default null)
returns text language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if p_errcode is null or sqlstate = p_errcode then
      return tap._add(true, p_desc);
    end if;
    return tap._add(false, p_desc, 'want ' || p_errcode || ', got ' || sqlstate || ': ' || sqlerrm);
  end;
  return tap._add(false, p_desc, 'no error raised');
end $$;

create function tap.lives_ok(p_sql text, p_desc text default null) returns text language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    return tap._add(false, p_desc, sqlstate || ': ' || sqlerrm);
  end;
  return tap._add(true, p_desc);
end $$;

create function tap.finish() returns setof text language sql security definer set search_path = '' as $$
  select case when (select count(*) from tap.results) = (select planned from tap.plan limit 1)
              then '# planned ' || (select planned from tap.plan limit 1) || ', ran ' || (select count(*) from tap.results)
              else '# PLAN MISMATCH: planned ' || coalesce((select planned from tap.plan limit 1)::text, '?')
                   || ', ran ' || (select count(*) from tap.results) end;
$$;

grant execute on all functions in schema tap to public;

