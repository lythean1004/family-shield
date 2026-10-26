// F7. 오늘의 퀴즈 — 고정 문항 데이터 (F7-4: AI 즉석 생성 없음, 검수 완료 문항만)
// 각 항목: id, message(마스킹), signals(정답), level(정답), explanation(놓친 신호 설명)
// is_practice: 항상 true (F7-2: 실제 알림·지표 제외)

export const QUIZ_ITEMS = [
  {
    id: 'q1',
    title: '상품권 부탁',
    message: '엄마 나야. 폰 액정 깨져서 임시 번호야. 지금 당장 문화상품권 30만원어치 필요해. 통화는 나중에.',
    signals: ['SIG_FAMILY_IMPERSONATION', 'SIG_NEW_NUMBER', 'SIG_GIFTCARD', 'SIG_AVOID_VOICE'],
    level: '위험',
    explanation: '새 번호로 연락하고, 통화를 피하면서 상품권을 요구하는 건 가족 사칭 사기의 전형적인 수법이에요.',
  },
  {
    id: 'q2',
    title: '검찰청 링크',
    message: '[검찰청] 귀하 명의 계좌 도용 사건 조회 바랍니다. [링크]',
    signals: ['SIG_AGENCY_IMPERSONATION', 'SIG_LINK'],
    level: '위험',
    explanation: '기관을 사칭하며 링크를 누르게 하는 건 개인정보를 훔치려는 수법이에요. 링크를 절대 누르지 마세요.',
  },
  {
    id: 'q3',
    title: '대출 선입금',
    message: '저금리 대출 가능합니다. 신청하시면 먼저 수수료 20만원 입금 후 대출 진행됩니다.',
    signals: ['SIG_PREPAYMENT', 'SIG_MONEY'],
    level: '위험',
    explanation: '대출을 빌미로 수수료나 보증금을 먼저 내라고 하면 반드시 사기예요.',
  },
  {
    id: 'q4',
    title: '앱 설치 요구',
    message: '[은행] 본인 인증을 위해 아래 링크에서 앱을 설치해 주세요. [링크]',
    // SIG_AGENCY_IMPERSONATION + SIG_APP_INSTALL → R6 위험
    signals: ['SIG_AGENCY_IMPERSONATION', 'SIG_APP_INSTALL', 'SIG_LINK'],
    level: '위험',
    explanation: '기관을 사칭하며 문자 링크로 앱을 설치하라고 하면 악성 앱일 수 있어요. 공식 앱 마켓에서만 설치하세요.',
  },
  {
    id: 'q5',
    title: '요금 안내',
    message: '고객님 이번 달 요금 안내드립니다. 자세한 내용은 고객센터 [번호]로 문의 바랍니다.',
    signals: [],
    level: '확인필요',
    explanation: '눈에 띄는 사기 신호는 없지만, 번호가 바뀌었거나 의심되면 공식 번호로 직접 전화해 확인하세요.',
  },
]
