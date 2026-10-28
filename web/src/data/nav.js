// 전체 메뉴 (모든 부모님·공개 화면 맨 위). 항목은 홈 화면 버튼과 같다.
// 카카오톡 채널이 입구라(D27) 웹 직접 입력은 메뉴에 넣지 않는다.
export const NAV_ITEMS = [
  { to: '/',         label: '처음 화면' },
  { to: '/contacts', label: '공식 번호 보기' },
  { to: '/help',     label: '이미 눌렀거나 보냈어요', variant: 'danger' },
  { to: '/demo',     label: '예시 보기' },
  { to: '/quiz',     label: '오늘의 퀴즈 (연습)' },
  { to: '/settings', label: '설정' },
]

// 보호자 화면(C2·C3, 대시보드)은 다른 사람이 보는 화면이라 부모님 메뉴를 숨긴다.
// /share는 바로 입력 화면으로 넘어가는 중간 단계라 숨긴다.
const HIDDEN_PREFIXES = ['/family', '/share']

export function showNav(pathname = '/') {
  return !HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}
