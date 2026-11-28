-- D59: 카카오 해외 AI 분석(국외 이전) 동의 기록 (docs/compliance-plan-2026-11.md 2단계, A안)
-- 카카오 사용자 키 원문은 저장하지 않는다. 서버 비밀키 HMAC-SHA256 값, 동의 여부, 문구 버전, 시각만 둔다.
-- 철회하면 같은 행을 false로 갱신한다. 운영 종료 시 전체 파기한다(shutdown-plan.md).
create table private.kakao_consents (
  user_hash text primary key check (user_hash ~ '^[0-9a-f]{64}$'),
  overseas_ai boolean not null,
  text_version text not null,
  updated_at timestamptz not null default now()
);
alter table private.kakao_consents enable row level security;
revoke all on private.kakao_consents from public, anon, authenticated;
grant select, insert, update, delete on private.kakao_consents to service_role;
