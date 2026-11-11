-- 동의 화면 재설계 v3 (작업 ⑤, docs/consent-redesign.md)
-- overseas_ai: 가린 문장을 해외 AI로 보내는 국외 이전 동의(가족 제공 동의와 분리)
-- comprehension: 부모님 이해 확인 결과(맞게 답함 = granted true). 답 자체는 저장하지 않는다
alter table public.consents drop constraint if exists consents_item_check;
alter table public.consents add constraint consents_item_check check (item in (
  'family_alert', 'impersonation_check', 'check_log', 'misjudge_share', 'overseas_ai', 'comprehension'));
