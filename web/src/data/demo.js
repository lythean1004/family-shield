// 공개 데모 고정 예시 SC1~SC4 (PRD 6장 표, 12-5: AI 호출 없음, DB 읽지 않음)
// 원문은 마스킹 형태로만([링크], [번호]). 결과는 core pipeline 출력 모양.
export const DEMO_SCENARIOS = [
  {
    id: 'sc1',
    title: '딸이라고 하는 문자',
    message: '엄마 나 폰 액정 깨져서 이 번호로 연락해. 급하게 상품권 좀 사 줄 수 있어? 지금 통화는 안 돼.',
    result: {
      level: '위험',
      fired_rules: ['R3', 'R4', 'R7'],
      signals_final: ['SIG_FAMILY_IMPERSONATION', 'SIG_NEW_NUMBER', 'SIG_GIFTCARD', 'SIG_AVOID_VOICE'],
      impersonation_type: 'family',
      impersonated_relation: '딸',
      explanation_for_parent: ['휴대폰이 고장 났다며 새 번호로 연락하고, 통화 없이 상품권을 사 달라고 해요.'],
      fallback_used: false,
    },
  },
  {
    id: 'sc2',
    title: '기관 전화를 받은 뒤 온 링크',
    message: '[검찰청] 사건 조회 확인 바랍니다. [링크]',
    callContext: '이 문자 받기 전에 전화를 받았어요',
    result: {
      level: '위험',
      fired_rules: ['R2', 'R6', 'R7'],
      signals_final: ['SIG_AGENCY_IMPERSONATION', 'SIG_LINK'],
      impersonation_type: 'agency',
      impersonated_relation: null,
      explanation_for_parent: ['기관이라며 전화한 뒤 링크를 보내는 것은 사기에서 자주 쓰는 순서예요.'],
      fallback_used: false,
    },
  },
  {
    id: 'sc3',
    title: '이미 링크를 눌렀어요',
    message: '[택배] 주소지 확인이 필요합니다. [링크]',
    afterAction: 'link',
  },
  {
    id: 'sc4',
    title: '신호가 약한 문자',
    message: '고객님, 이번 달 요금 안내드립니다. 자세한 내용은 [번호]로 문의 주세요.',
    result: {
      level: '확인필요',
      fired_rules: ['R8'],
      signals_final: [],
      impersonation_type: 'none',
      impersonated_relation: null,
      explanation_for_parent: [],
      fallback_used: false,
    },
  },
]
