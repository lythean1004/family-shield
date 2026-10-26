// F5-9: 가족 확인 동의 — Supabase circle_members 연결 전까지 기기 localStorage에만 저장
//
// 동의 ②(가족 확인 요청): 이 동의가 없으면 결과 화면에서 "가족에게 물어보기" 버튼이 나오지 않는다.
// 설정 화면(/settings)에서 켜고 끌 수 있다.
// 4주차에 Supabase circle_members.has_family_consent 컬럼으로 이동한다.
const KEY = 'fs.consent.family'

/**
 * 가족 확인 동의 여부를 읽는다. localStorage가 없으면 false.
 * @returns {boolean}
 */
export function loadFamilyConsent() {
  try { return localStorage.getItem(KEY) === 'true' } catch { return false }
}

/**
 * 가족 확인 동의를 저장한다.
 * storage 이벤트가 발생하므로 다른 탭/컴포넌트가 바로 반영된다.
 * @param {boolean} value
 */
export function saveFamilyConsent(value) {
  try { localStorage.setItem(KEY, value ? 'true' : 'false') } catch {}
}
