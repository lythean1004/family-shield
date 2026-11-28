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
  // 2026-11-26 멘토링: 문항 보강(주의·확인 필요 단계, 기관 번호 유도, 중고거래 선입금)
  {
    id: 'q6',
    title: '월세 부탁',
    message: '엄마 이번 달 월세 50만원만 보내줄 수 있어? 저녁에 전화할게.',
    signals: ['SIG_FAMILY_IMPERSONATION', 'SIG_MONEY'],
    level: '주의',
    explanation: '진짜 가족일 수도 있지만 돈 이야기가 있어요. 보내기 전에 늘 쓰던 번호로 직접 전화해 확인하세요.',
  },
  {
    id: 'q7',
    title: '환급금 안내 번호',
    message: '[국민건강보험] 환급금이 미수령 상태입니다. 안내 [번호]',
    signals: ['SIG_AGENCY_IMPERSONATION', 'SIG_CALL_THIS_NUMBER'],
    level: '위험',
    explanation: '기관이라며 문자 속 번호로 전화하게 하는 것은 사기 수법이에요. 직접 찾은 공식 번호로만 확인하세요.',
  },
  {
    id: 'q8',
    title: '중고거래 입금',
    message: '물건 바로 보내드릴게요. 먼저 계약금 10만원 입금해 주시면 오늘 발송합니다.',
    signals: ['SIG_PREPAYMENT', 'SIG_MONEY'],
    level: '위험',
    explanation: '물건을 받기 전에 돈을 먼저 보내라고 하면 사기일 수 있어요. 보내기 전에 가족과 같이 확인하세요.',
  },
  {
    id: 'q9',
    title: '공식 택배 주소',
    message: '[CJ대한통운] 고객님의 상품이 배송 완료되었습니다. 조회 cjlogistics.com',
    signals: ['SIG_LINK', 'SIG_OFFICIAL_LINK'],
    level: '확인필요',
    explanation: '공식 주소로 보이지만 그것만으로 안전하다고 할 수는 없어요. 주문한 적이 없다면 택배 앱이나 공식 번호로 확인하세요.',
  },
  // 시즌 문항: months(보여 줄 달)와 공식 출처(source)가 있어야 한다. 월 1회 공식 경고문(금융위·금감원·경찰청·KISA)을 확인해 갱신
  {
    id: 'q10',
    title: '개인정보 유출 보상 안내',
    message: '[○○카드] 개인정보 유출 피해 고객 보상 대상입니다. 보상 신청 [링크]',
    signals: ['SIG_AGENCY_IMPERSONATION', 'SIG_LINK'],
    level: '위험',
    explanation: '개인정보 유출 사고 뒤에는 피해 확인·보상을 미끼로 한 문자가 늘어요. 문자 속 링크 말고, 카드사 공식 앱이나 직접 찾은 공식 번호로 확인하세요.',
    months: [10, 11, 12],
    source: {
      title: '금융위원회·금융감독원 소비자경보(주의): 개인정보 유출 2차 피해(보이스피싱·스미싱) 주의, 특별대응기간 12월 말까지 연장',
      url: 'https://www.fsc.go.kr/no010101/86271',
      checked_at: '2026-11-26',
    },
  },
  {
    id: 'q11',
    title: '주민센터 명의도용 연락',
    message: '[○○주민센터] 선생님 신분증과 위임장을 가진 분이 서류를 떼러 왔습니다. 본인이 아니시면 명의도용 신고 [번호]로 바로 전화 주세요.',
    signals: ['SIG_AGENCY_IMPERSONATION', 'SIG_CALL_THIS_NUMBER'],
    level: '위험',
    explanation: '주민센터 직원이라며 명의도용을 알리고 번호를 불러 주는 수법이에요(전화로도 와요). 그 번호로 걸면 상대는 모두 사기범일 수 있어요. 직접 찾은 대표번호로 확인하거나 가까운 주민센터에 직접 가 보세요.',
    months: [11, 12],
    source: {
      title: '금융감독원 소비자경보 2026-28호: 주민센터 직원 사칭(신분증·위임장) 보이스피싱 주의',
      url: 'https://www.fss.or.kr/fss/bbs/B0000175/view.do?nttId=249833&menuNo=200204',
      checked_at: '2026-11-28',
    },
  },
]

/** 하루에 푸는 문항 수 */
export const QUIZ_DAILY_COUNT = 5

/** 한국 날짜(YYYY-MM-DD 기준 일 번호)와 달 */
function koreaDay(date) {
  const kst = new Date(date.getTime() + 9 * 3600 * 1000)
  return { dayNo: Math.floor(kst.getTime() / 86400000), month: kst.getUTCMonth() + 1 }
}

/**
 * 오늘의 퀴즈(멘토링 2026-11-26: 최신 내용으로 바뀌게).
 * - 이번 달 시즌 문항(months)이 먼저, 시즌이 아닌 시즌 문항은 빼고, 나머지는 날마다 시작점이 바뀌며 돌아간다.
 * - 같은 날에는 언제 열어도 같은 문항(AI·서버 없이 결정적).
 */
export function quizForDate(items, date = new Date(), count = QUIZ_DAILY_COUNT) {
  const { dayNo, month } = koreaDay(date)
  const seasonal = items.filter((q) => q.months?.includes(month))
  // 시즌이 지난 문항은 뺀다(지난 경고를 최신처럼 보여 주지 않는다)
  const rest = items.filter((q) => !q.months?.length)
  const start = rest.length ? dayNo % rest.length : 0
  const rotated = [...rest.slice(start), ...rest.slice(0, start)]
  return [...seasonal, ...rotated].slice(0, Math.min(count, items.length))
}
