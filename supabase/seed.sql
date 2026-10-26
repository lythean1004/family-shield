-- 개발용 시드 데이터 (로컬 전용)
-- npx supabase db reset 시 자동 실행됨
-- 실제 번호·이름은 넣지 않는다.

-- official_cards: 근거 카드 초기값 (PRD 14-2)
-- status='active' 카드만 시드. needs_review는 앱 화면·AI 입력에서 제외.
INSERT INTO public.official_cards (id, type, org_name, title_parent, fact, source_url, source_org, verified_at, license_status, status, version)
VALUES
  ('EC_AGENCY_HANGUP',   'technique', '금융위원회', '전화 끊고 직접 걸기', '기관은 전화를 끊으라고 먼저 말하지 않습니다.', 'https://www.fsc.go.kr/no010101/86250', '금융위원회', '2026-10-15', 'unconfirmed', 'active', 1),
  ('EC_ISOLATION',       'technique', '금융위원회', '혼자 처리하라는 말',   '수사기관·금융기관은 절대 혼자 처리하라고 하지 않습니다.', 'https://www.fsc.go.kr/no010101/86250', '금융위원회', '2026-10-15', 'unconfirmed', 'active', 1),
  ('EC_FAMILY_VERIFY',   'technique', '금융위원회', '가족 사칭 새 번호',    '가족이 갑자기 새 번호로 돈을 요청하면 원래 번호로 직접 확인하세요.', 'https://www.fsc.go.kr/no010101/86250', '금융위원회', '2026-10-15', 'unconfirmed', 'active', 1),
  ('EC_LOAN_THIRD_PARTY','technique', '금융위원회', '제3자 계좌 이체',     '대출을 위해 다른 사람 계좌로 먼저 이체하라는 건 사기입니다.', 'https://www.fsc.go.kr/no010101/86250', '금융위원회', '2026-10-15', 'unconfirmed', 'active', 1),
  ('EC_LOAN_PREPAYMENT', 'technique', '금융위원회', '대출 전 수수료 요구',  '대출을 빌미로 수수료·보증금을 먼저 내라고 하면 사기입니다.', 'https://www.fsc.go.kr/no010101/86250', '금융위원회', '2026-10-15', 'unconfirmed', 'active', 1),
  ('EC_APP_DELETE',      'technique', '금융위원회', '앱 삭제·설치 요구',   '악성 앱은 통화를 가로채고 번호를 바꿀 수 있습니다. 출처 불명 앱은 절대 설치하지 마세요.', 'https://www.fsc.go.kr/no010101/86250', '금융위원회', '2026-10-15', 'unconfirmed', 'active', 1),
  ('EC_LINK_NO_CLICK',   'technique', '금융위원회', '링크 클릭 금지',      '문자 속 링크는 누르지 마세요. 직접 검색하거나 공식 앱을 이용하세요.', 'https://www.fsc.go.kr/no010101/86250', '금융위원회', '2026-10-15', 'unconfirmed', 'active', 1),
  ('EC_COURT_MAIL',      'technique', '금융위원회', '법원 우편 사칭',      '법원은 문자나 카카오톡으로 소환장을 보내지 않습니다.', 'https://www.fsc.go.kr/no010101/86250', '금융위원회', '2026-10-15', 'unconfirmed', 'active', 1),
  ('EC_CARD_DELIVERY',   'technique', '금융위원회', '택배 카드 수거',      '카드를 직접 수거하러 온다는 연락은 사기입니다.', 'https://www.fsc.go.kr/no010101/86250', '금융위원회', '2026-10-15', 'unconfirmed', 'active', 1),
  ('EC_SPOOFED_CALLER',  'technique', '금융위원회', '번호 변조 전화',      '112·1332로 걸어도 악성 앱이 깔려 있으면 사기범에게 연결될 수 있습니다.', 'https://www.fsc.go.kr/no010101/86250', '금융위원회', '2026-10-15', 'unconfirmed', 'active', 1),
  ('ACT_HANGUP_CALL_OFFICIAL','action','금융위원회','전화 끊고 공식 번호로','일단 전화를 끊고 공식 번호를 직접 찾아 거세요.', 'https://www.fsc.go.kr/no010101/86250', '금융위원회', '2026-10-15', 'unconfirmed', 'active', 1),
  ('ACT_ASK_FAMILY_DIRECT',   'action','금융위원회','가족에게 직접 확인',  '원래 번호나 직접 만나서 확인하세요.', 'https://www.fsc.go.kr/no010101/86250', '금융위원회', '2026-10-15', 'unconfirmed', 'active', 1),
  ('ACT_PREVENT_BLOCK',       'action','금융위원회','이미 보냈다면 지급정지','즉시 112 또는 해당 금융사에 전화해 지급정지를 요청하세요.', 'https://www.fsc.go.kr/no010101/86250', '금융위원회', '2026-10-15', 'unconfirmed', 'active', 1),
  ('AFTER_APP_INSTALLED','after_action','금융위원회','앱 설치 후 대응','비행기 모드 → 다른 기기로 112 또는 가족 연락 → 악성 앱 삭제 또는 공장 초기화.', 'https://www.fsc.go.kr/no010101/86250', '금융위원회', '2026-10-15', 'unconfirmed', 'active', 1),
  ('AFTER_INFO_LEAKED',  'after_action','KISA보호나라','개인정보 유출 후 대응','명의도용 방지 서비스(PASS, 명의도용방지서비스) 가입 및 금융사 비밀번호 변경.', 'https://www.boho.or.kr', 'KISA 보호나라', '2026-10-15', 'unconfirmed', 'active', 1)
ON CONFLICT (id) DO NOTHING;
