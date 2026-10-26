// 공식 번호 — PRD 14-2 근거 카드 중 active만(U7: 화면 전화 버튼은 이 목록의 번호만).
// needs_review(118, 1566-1188)는 넣지 않는다. 112는 맨 위 고정(F2-4).
// 나중에 content/evidence/ 카드 파일에서 생성하도록 바꾼다.
export const CHECKED_AT = '2026-10-15'

export const OFFICIAL_CONTACTS = [
  { id: 'police',  name: '경찰',              number: '112' },
  { id: 'fss',     name: '금융감독원',        number: '1332' },
  { id: 'spo',     name: '대검찰청',          number: '02-3480-2000' },
]

export const POLICE = OFFICIAL_CONTACTS[0]
export const FSS = OFFICIAL_CONTACTS[1]

export function sourceText() {
  return `근거 카드 · 확인일 ${CHECKED_AT}`
}
