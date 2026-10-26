// 공식 번호 — PRD 14-2 근거 카드 중 active만(U7: 화면 전화 버튼은 이 목록의 번호만).
// needs_review(118, 1566-1188)는 넣지 않는다. 112는 맨 위 고정(F2-4).
// 나중에 content/evidence/ 카드 파일에서 생성하도록 바꾼다.
export const CHECKED_AT = '2026-10-15'

// normalNote: F2-5 "진짜라면 이렇게 와요" — 기관이 실제로 연락하는 방식.
// 근거 카드 원문 확인 전까지 보수적으로 작성한다.
export const OFFICIAL_CONTACTS = [
  {
    id: 'police',
    name: '경찰',
    number: '112',
    normalNote: '경찰은 문자로 계좌 이체나 앱 설치를 요구하지 않아요. 의심되면 직접 112로 전화해 확인하세요.',
  },
  {
    id: 'fss',
    name: '금융감독원',
    number: '1332',
    normalNote: '금융감독원은 전화·문자로 계좌번호나 카드번호를 절대 묻지 않아요.',
  },
  {
    id: 'spo',
    name: '대검찰청',
    number: '02-3480-2000',
    normalNote: '검찰은 문자나 카카오톡으로 수사 안내를 하지 않아요. 출석 요구는 반드시 공문으로 와요.',
  },
]

export const POLICE = OFFICIAL_CONTACTS[0]
export const FSS = OFFICIAL_CONTACTS[1]

export function sourceText() {
  return `근거 카드 · 확인일 ${CHECKED_AT}`
}
