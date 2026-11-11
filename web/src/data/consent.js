// The server is the source of truth. Failed writes never look like saved consent.
// 동의 화면 구조(작업 ⑤, docs/consent-redesign.md): 해외 AI 분석을 가족 제공과 분리, 펼쳐 보기, 전체/개별 동의.
// 문구는 전문가 확인 전 초안이다(D26). 제공사 기준은 2026-11-11 공식 문서 확인, 운영사 서면 답변으로 최종 확인.
import { api, getSession } from './api.js'
export const CONSENT_VERSION = 'demo-2026-11-11-v3'

export const CONSENT_STEPS = [
  {
    item: 'overseas_ai',
    title: '① 해외 AI로 더 자세히 살펴볼까요?',
    summary: '번호·계좌를 가린 문장을 해외 AI에 보내 분석해요.',
    details: [
      '보내는 것: 가린 문장만 보내요. 원문, 전화번호, 계좌번호는 보내지 않아요.',
      '거쳐 가는 곳: 모두의 AI 실험실 중계 서버(국내). 운영사 법인명은 확인 중이에요.',
      '받는 곳: Anthropic, PBC(미국, Claude)와 Google(대한민국 계약 법인 Google Cloud Korea LLC, Gemini). Google은 시설이 있는 나라에서 처리할 수 있어요.',
      '보관: Anthropic은 받은 뒤 30일 안에 지워요(정책 위반으로 분류되면 최대 2년). Google은 정책 위반 확인을 위해 제한된 기간 보관해요.',
      '학습: 두 회사 모두 유료 API로 받은 내용은 학습에 쓰지 않는다고 밝혀요. 실험실이 유료로 쓰는지는 확인 중이에요.',
      '보내는 때: 문자를 확인할 때마다 인터넷으로 바로 보내요.',
    ],
    ifDeclined: '허락하지 않아도 쓸 수 있어요. 해외 AI 없이 정해진 규칙으로만 알려 드려요.',
  },
  {
    item: 'family_alert',
    title: '② 가족에게 결과를 보낼까요?',
    summary: '내가 “가족에게 물어보기”를 누를 때 연결한 가족이 결과를 봐요.',
    details: [
      '받는 사람: 아래 “받는 사람”에 적힌 가족이에요.',
      '보내는 것: 위험 단계, 정해진 요약 문장, 사칭된 관계, 입력했다면 번호 끝 4자리.',
      '보내지 않는 것: 문자 원문, 전체 전화번호.',
      '알림에는 내용이 보이지 않아요. 내가 직접 누를 때만 보내요.',
      '언제든 [내 설정]에서 끌 수 있어요.',
    ],
    ifDeclined: '허락하지 않으면 가족 기능만 꺼지고, 문자 확인은 그대로 쓸 수 있어요.',
  },
  {
    item: 'impersonation_check',
    title: '③ 가족에게 진짜인지 물어볼까요?',
    summary: '가족이 보낸 문자인지 그 가족에게 직접 물어보고 답을 받아요.',
    details: [
      '받는 사람: 문자가 사칭한 가족 본인이에요.',
      '보내는 것: ②와 같은 내용이에요.',
      '②를 허락해야 켤 수 있어요.',
    ],
    ifDeclined: '허락하지 않으면 묻기 기능만 꺼져요.',
  },
  {
    item: 'check_log',
    title: '④ 확인 기록을 남길까요?',
    summary: '위험 단계와 신호 같은 확인 기록을 24시간 보관해요.',
    details: [
      '문자 원문은 저장하지 않아요.',
      '삭제는 10분마다 해요. 비상용 백업에는 삭제 뒤에도 최대 7일 남을 수 있어요.',
      '기록이 있으면 가족에게 물어볼 때 다시 확인하지 않아도 돼요.',
    ],
    ifDeclined: '허락하지 않으면 가족에게 물어볼 때마다 그 건만 따로 여쭤봐요.',
  },
]

const ITEMS = CONSENT_STEPS.map(s => s.item)

/** 처음에는 아무것도 고르지 않은 상태(미리 체크하지 않는다) */
export function emptySelection() {
  return Object.fromEntries(ITEMS.map(i => [i, null]))
}

/** [모두 허락] */
export function selectAll() {
  return Object.fromEntries(ITEMS.map(i => [i, true]))
}

/** 개별 선택. 가족에게 결과 보내기를 허락하지 않으면 가족에게 묻기도 꺼진다 */
export function setChoice(selection, item, granted) {
  const next = { ...selection, [item]: granted }
  if (next.family_alert !== true && next.impersonation_check === true) next.impersonation_check = false
  if (item === 'family_alert' && granted === false) next.impersonation_check = false
  return next
}

export function isComplete(selection) {
  return ITEMS.every(i => typeof selection[i] === 'boolean')
}

/** 저장 순서: 서버는 묻기 허락 전에 가족 보내기 허락을 요구한다 */
export function consentPlan(selection) {
  if (!isComplete(selection)) throw new Error('모든 항목을 골라 주세요.')
  return ITEMS.map(item => ({ item, granted: selection[item] }))
}

/** 이해 확인: “위험한 문자를 받으면 누가 결과를 보나요?” 정답은 이 그룹의 실제 가족 */
export function comprehensionQuestion(members, circleId) {
  const recipients = (members ?? []).filter(m => m.circleId === circleId)
  if (recipients.length === 0) return null
  const label = recipients.map(m => (m.callName && m.callName !== m.relation ? `${m.callName}(${m.relation})` : m.relation)).join(', ')
  return {
    question: '방금 허락한 내용이 맞는지 확인할게요. 내가 “가족에게 물어보기”를 누르면 누가 결과를 보나요?',
    options: [
      { label, correct: true },
      { label: '아무도 안 봐요', correct: false },
      { label: '잘 모르겠어요', correct: false },
    ],
  }
}

export async function loadFamilyConsent() {
  try {
    const session = await getSession()
    const circle = session?.circles.find(c=>c.isParent)
    if (!circle) return false
    return ['family_alert','impersonation_check'].every(item=>session.consents.find(c=>c.circleId===circle.id&&c.item===item)?.granted)
  } catch { return false }
}
/**
 * 설정 스위치가 보낼 요청을 정한다. 켜짐은 ②가족 알림 + ③사칭 확인이 모두 허락일 때다(loadFamilyConsent).
 * ②가 없으면 자세한 설명이 있는 동의 화면에서 먼저 허락받는다. 스위치 하나로 설명 없는 동의를 만들지 않는다.
 */
export function familyToggleRequest(session, granted) {
  const circle = session?.circles?.find(c=>c.isParent)
  if (!circle) return { error: '부모님 휴대폰에서만 켤 수 있어요. 위의 [가족 연결과 동의 설정]에서 먼저 가족을 연결해 주세요.' }
  const alertGranted = session.consents?.find(c=>c.circleId===circle.id && c.item==='family_alert')?.granted === true
  if (granted && !alertGranted) return { error: '먼저 “가족에게 결과를 보낼까요?”를 허락해야 해요. 위의 [가족 연결과 동의 설정]에서 설명을 읽고 허락해 주세요.' }
  return { body: { circleId:circle.id, item:'impersonation_check', granted, textVersion:CONSENT_VERSION } }
}
export async function saveFamilyConsent(granted) {
  const { error, body } = familyToggleRequest(await getSession(), granted)
  if (error) throw new Error(error)
  await api('/consent', body)
}
