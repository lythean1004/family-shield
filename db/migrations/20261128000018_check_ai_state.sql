-- 카카오 답 ↔ 웹 [자세히 보기] 일치 (docs/plan-kakao-web-consistency.md, 운영자 A안, 2026-11-28)
-- AI 문장은 저장하지 않는다. 어떤 경우였는지만 정해진 값으로 둔다. 이전 행은 null(웹은 기존 문구로 보여 줌).
alter table public.checks add column ai_state text
  check (ai_state is null or ai_state in ('explained','rules_only','declined','health','fallback'));
