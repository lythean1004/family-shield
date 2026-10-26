-- 1회용 결과 토큰(PRD 13-4, D34)과 보관 기한 삭제(11-2) 테스트
-- 실행: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000011', 'tk@rls.test', '{}', '{}', now(), now());
insert into public.circles (id, protected_user_id) values
  ('00000000-0000-0000-0001-000000000011', '00000000-0000-0000-0000-000000000011');
insert into public.checks (id, circle_id, created_by, input_channel, level, purge_at) values
  ('00000000-0000-0000-0002-000000000011', '00000000-0000-0000-0001-000000000011', '00000000-0000-0000-0000-000000000011', 'kakao', 'danger', now() + interval '24 hours'),
  ('00000000-0000-0000-0002-000000000012', '00000000-0000-0000-0001-000000000011', '00000000-0000-0000-0000-000000000011', 'kakao', 'caution', now() - interval '1 minute');
insert into public.result_tokens (token_hash, check_id, expires_at) values
  (repeat('a', 64), '00000000-0000-0000-0002-000000000011', now() + interval '10 minutes'),
  (repeat('b', 64), '00000000-0000-0000-0002-000000000011', now() - interval '1 second'),
  (repeat('c', 64), '00000000-0000-0000-0002-000000000012', now() + interval '10 minutes'),
  (repeat('d', 64), '00000000-0000-0000-0002-000000000011', now() - interval '2 hours');

-- T. 형식
select throws_ok($$insert into public.result_tokens (token_hash, check_id) values ('plain-token', '00000000-0000-0000-0002-000000000011')$$,
  '23514', null, 'T1: 해시 형식(hex 64자)이 아니면 저장 거부(원문 저장 방지)');
select is((select expires_at - created_at from public.result_tokens where token_hash = repeat('a', 64)) <= interval '10 minutes', true,
  'T2: 수명은 10분 이하');

-- U. 접근 권한
reset role;
set local role anon;
select throws_ok($$select * from public.result_tokens$$, '42501', null, 'U1: anon은 result_tokens 권한 없음');
select throws_ok($$select public.redeem_result_token('x')$$, '42501', null, 'U2: anon은 토큰 조회 함수 실행 불가');

reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000011","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select * from public.result_tokens$$, '42501', null, 'U3: 부모님 본인도 result_tokens 직접 조회 불가');
select throws_ok($$select public.redeem_result_token('x')$$, '42501', null, 'U4: authenticated는 토큰 조회 함수 실행 불가');

-- V. 1회 조회 (service_role = 스킬 서버)
reset role;
set local role service_role;
select is(public.redeem_result_token(repeat('a', 64)), '00000000-0000-0000-0002-000000000011'::uuid, 'V1: 유효한 토큰은 판별 건 ID를 돌려준다');
select is(public.redeem_result_token(repeat('a', 64)), null, 'V2: 같은 토큰 두 번째 조회는 null(1회용)');
select is(public.redeem_result_token(repeat('b', 64)), null, 'V3: 만료된 토큰은 null');
select is(public.redeem_result_token(repeat('e', 64)), null, 'V4: 없는 토큰은 null');

-- W. 보관 기한 삭제 (postgres로 실행: 운영에서는 pg_cron)
reset role;
select lives_ok($$select * from private.purge_expired()$$, 'W1: purge_expired 실행');
select is((select count(*) from public.checks where id = '00000000-0000-0000-0002-000000000012')::int, 0, 'W2: purge_at 지난 판별 건 삭제');
select is((select count(*) from public.result_tokens where token_hash = repeat('c', 64))::int, 0, 'W3: 판별 건이 지워지면 토큰도 함께 삭제(cascade)');
select is((select count(*) from public.result_tokens where token_hash = repeat('d', 64))::int, 0, 'W4: 만료 뒤 1시간 지난 토큰 삭제');

select * from finish();
rollback;
