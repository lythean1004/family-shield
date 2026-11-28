-- D59 카카오 해외 AI 동의 기록(private.kakao_consents) 권한·형식 테스트
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

-- K. 형식: 원래 키 같은 값은 저장 거부, HMAC hex 64자만
select throws_ok($$insert into private.kakao_consents (user_hash, overseas_ai, text_version) values ('bot-user-key-plain', true, 'kakao-2026-11-28-v1')$$,
  '23514', null, 'K1: 해시 형식(hex 64자)이 아니면 저장 거부(사용자 키 원문 저장 방지)');
select lives_ok($$insert into private.kakao_consents (user_hash, overseas_ai, text_version) values (repeat('e', 64), true, 'kakao-2026-11-28-v1')$$,
  'K2: 해시 값과 동의 여부·문구 버전은 저장된다');

-- L. 접근 권한: 웹 사용자·익명은 읽지도 쓰지도 못한다
reset role;
set local role anon;
select throws_ok($$select * from private.kakao_consents$$, '42501', null, 'L1: anon은 kakao_consents 읽기 불가');
reset role;
set local role authenticated;
select throws_ok($$select * from private.kakao_consents$$, '42501', null, 'L2: authenticated는 kakao_consents 읽기 불가');
select throws_ok($$insert into private.kakao_consents (user_hash, overseas_ai, text_version) values (repeat('f', 64), true, 'x')$$,
  '42501', null, 'L3: authenticated는 kakao_consents 쓰기 불가');
reset role;
set local role service_role;
select is((select overseas_ai from private.kakao_consents where user_hash = repeat('e', 64)), true, 'L4: 스킬 서버(service_role)는 읽을 수 있다');

select * from finish();
rollback;
