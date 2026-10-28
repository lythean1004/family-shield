// 판별 결과 표시용 변환 — 입력은 core pipeline analyze() 출력 모양 그대로 받는다.
// level: '위험' | '주의' | '확인필요'  →  화면 키 danger | caution | check
export const LEVEL_KEY = { 위험: 'danger', 주의: 'caution', 확인필요: 'check' }

export function levelKey(level) {
  return LEVEL_KEY[level] ?? 'check'
}

// P4 한 줄 설명 (screen-spec 5장 P4 표)
export function verdictDescription(level, impersonationType) {
  const key = levelKey(level)
  if (key === 'danger') {
    if (impersonationType === 'family') return '가족인 척하는 사기에서 자주 보이는 말이 있어요.'
    if (impersonationType === 'agency') return '기관인 척하는 사기에서 자주 보이는 말이 있어요.'
    return '사기에서 자주 보이는 말이 있어요.'
  }
  if (key === 'caution') return '사기에서 쓰는 말이 섞여 있어요. 확인하고 움직이세요.'
  return '눈에 띄는 사기 신호는 없었어요. 그래도 공식 번호로 확인하면 확실해요.'
}

// AI 실패·시간 초과(F4-6) 때 이유 칸 문구
export const AI_FALLBACK_TEXT = '자세한 설명을 만들지 못했어요. 판정은 그대로예요.'

// 개발용 가짜 결과(SC1). VM API·토큰(D34) 연결 전까지 /check/result에서 쓴다.
export const DEV_RESULT = {
  level: '위험',
  fired_rules: ['R3', 'R4', 'R7'],
  signals_final: ['SIG_FAMILY_IMPERSONATION', 'SIG_NEW_NUMBER', 'SIG_GIFTCARD', 'SIG_AVOID_VOICE'],
  impersonation_type: 'family',
  impersonated_relation: '딸',
  explanation_for_parent: ['휴대폰이 고장 났다며 새 번호로 연락하고, 통화 없이 상품권을 사 달라고 해요.'],
  fallback_used: false,
}
