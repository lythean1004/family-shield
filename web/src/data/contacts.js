// 공식 번호 — PRD 14-2 근거 카드 중 active만(U7: 화면 전화 버튼은 이 목록의 번호만).
// needs_review(118, 1566-1188)는 넣지 않는다. 112는 맨 위 고정(F2-4).
// 나중에 content/evidence/ 카드 파일에서 생성하도록 바꾼다.
export const CHECKED_AT = '2026-10-15'

// normalNote: F2-5 "진짜라면 이렇게 와요" — 기관이 실제로 연락하는 방식.
// 상태: needs_review(원문 미대조). 2026-10-27 자동 수집 시도 결과
//   - fss.or.kr / police.go.kr: 접속 실패(fetch failed)
//   - spo.go.kr: 공소청 개편으로 기존 경로 404, 대검찰청 번호 02-3480-2000도 재확인 필요
//   - counterscam112.go.kr(피싱안심SOS, 1394): 메인만 열림, 예방 수칙 본문은 스크립트 렌더링
// 원문을 사람이 직접 확인해 content/evidence/에 출처·확인일을 남긴 뒤 이 문구를 고친다.
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
