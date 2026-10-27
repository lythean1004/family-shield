// F5-9: 가족 확인 동의 — Supabase consents 테이블 연동
//
// 동의 ②(가족 확인 요청): 이 동의가 없으면 결과 화면에서 "가족에게 물어보기" 버튼이 나오지 않는다.
// 설정 화면(/settings)에서 켜고 끌 수 있다.
//
// 로그인 전에는 localStorage 폴백, 로그인 후에는 consents 테이블에 쌓기만 한다 (F1-4).
import { supabase } from '../lib/supabase.js'

const KEY = 'fs.consent.family'

/**
 * 가족 확인 동의 여부를 읽는다.
 * 로그인 후: consents 테이블에서 최신 동의 조회 (RLS로 자동 필터링)
 * 로그인 전: localStorage 폴백
 * @returns {Promise<boolean>}
 */
export async function loadFamilyConsent() {
  // 로그인 상태 확인
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    // localStorage 폴백
    try { return localStorage.getItem(KEY) === 'true' } catch { return false }
  }

  // Supabase 조회 (Auth 구현 후 활성화)
  // TODO: circle_id 가져오기 필요
  console.warn('Supabase consents 조회는 Auth 구현 후 활성화 예정')
  
  // 임시로 localStorage 폴백
  try { return localStorage.getItem(KEY) === 'true' } catch { return false }
}

/**
 * 가족 확인 동의를 저장한다.
 * 로그인 후: consents 테이블에 insert (쌓기만 함, F1-4)
 * 로그인 전: localStorage
 * @param {boolean} value
 * @param {string} textVersion - 동의 문구 버전 (예: 'v1')
 */
export async function saveFamilyConsent(value, textVersion = 'v1') {
  // localStorage에 즉시 저장 (화면 반영용)
  try { localStorage.setItem(KEY, value ? 'true' : 'false') } catch {}

  // 로그인 상태 확인
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return // localStorage만 사용
  }

  // Supabase에 기록 (Auth 구현 후 활성화)
  // TODO: circle_id 가져오기 필요
  console.warn('Supabase consents insert는 Auth 구현 후 활성화 예정')
}
