-- RLS 테스트 (PRD 11-3: 부모님 / 보호자 / 다른 그룹 / 비로그인)
-- 실행: npx supabase start 후 npx supabase test db
-- 모든 작업은 트랜잭션 안에서 하고 마지막에 rollback 한다.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- 픽스처 (postgres 권한, RLS 우회). auth.users 삽입 → 트리거가 public.users 생성
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000001', 'pa@rls.test', '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000002', 'gd@rls.test', '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000003', 'pb@rls.test', '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000004', 'ot@rls.test', '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000005', 'rm@rls.test', '{}', '{}', now(), now());
insert into public.circles (id, protected_user_id) values ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0000-000000000003');
insert into public.circle_members (circle_id, user_id, status) values ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000002', 'active'), ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000005', 'removed');
insert into public.checks (id, circle_id, created_by, input_channel, level) values ('00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000001', 'kakao', 'danger'), ('00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0000-000000000003', 'web', 'caution');
insert into public.confirm_requests (id, check_id, target_member_id, kind, state) values ('00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0000-000000000002', 'family_check', 'pending');

-- A. 비로그인(anon)
reset role;
set local role anon;
select throws_ok($$select * from public.users$$, '42501', null, 'A1: anon은 users 권한 없음');
select throws_ok($$select * from public.circles$$, '42501', null, 'A2: anon은 circles 권한 없음');
select throws_ok($$select * from public.checks$$, '42501', null, 'A3: anon은 checks 권한 없음');
select throws_ok($$select * from public.confirm_requests$$, '42501', null, 'A4: anon은 confirm_requests 권한 없음');
select throws_ok($$select * from public.consents$$, '42501', null, 'A5: anon은 consents 권한 없음');

-- B. 부모님 A
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.circles)::int, 1, 'B1: 부모님 A는 자기 그룹만 본다');
select is((select count(*) from public.checks)::int, 1, 'B2: 부모님 A는 자기 판별 기록만 본다');
select is((select count(*) from public.confirm_requests)::int, 1, 'B3: 부모님 A는 자기 판별 건의 확인 요청을 본다');
select is((select count(*) from public.circle_members)::int, 2, 'B4: 부모님 A는 자기 그룹 보호자 목록을 본다(active+removed)');
select throws_ok($$insert into public.checks(circle_id, created_by, input_channel, level) values ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000001', 'web', 'check')$$, '42501', null, 'B5: 판별 기록 삽입은 service_role만(부모님도 불가)');

-- C. 보호자(active)
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.confirm_requests)::int, 1, 'C1: 보호자는 자기에게 온 확인 요청만 본다');
select is((select count(*) from public.checks)::int, 1, 'C2: 보호자는 확인 요청이 온 판별 건만 본다');
select is((select count(*) from public.checks where id = '00000000-0000-0000-0002-000000000002')::int, 0, 'C3: 보호자는 다른 그룹 판별 건을 못 본다');
select lives_ok($$update public.confirm_requests set state = 'responded', responded_at = now() where id = '00000000-0000-0000-0003-000000000001'$$, 'C4: 보호자는 자기 확인 요청에 응답할 수 있다');
select is((select state from public.confirm_requests where id = '00000000-0000-0000-0003-000000000001'), 'responded', 'C5: 응답이 반영됐다');

-- D. 다른 그룹 사용자/외부인
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.circles)::int, 0, 'D1: 외부인은 그룹을 못 본다');
select is((select count(*) from public.checks)::int, 0, 'D2: 외부인은 판별 기록을 못 본다');
select is((select count(*) from public.confirm_requests)::int, 0, 'D3: 외부인은 확인 요청을 못 본다');
select is((select count(*) from public.users where id = '00000000-0000-0000-0000-000000000001')::int, 0, 'D4: 외부인은 다른 사람 프로필을 못 본다');

-- E. 다른 그룹 부모님
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.checks where circle_id = '00000000-0000-0000-0001-000000000001')::int, 0, 'E1: 부모님 B는 A 그룹 판별 기록을 못 본다');
select is((select count(*) from public.confirm_requests where id = '00000000-0000-0000-0003-000000000001')::int, 0, 'E2: 부모님 B는 A 그룹 확인 요청을 못 본다');

-- F. 제거된 보호자(status=removed)
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.circles)::int, 0, 'F1: 제거된 보호자는 그룹을 못 본다');
select is((select count(*) from public.checks)::int, 0, 'F2: 제거된 보호자는 판별 기록을 못 본다');

-- G. service_role(스킬 서버·Cron)
reset role;
set local role service_role;
select is((select count(*) from public.checks)::int, 2, 'G1: service_role은 RLS를 우회한다');

reset role;
select * from finish();
rollback;
