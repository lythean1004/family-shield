import { api } from './api.js'
import { createDemoConfirmStore } from './demo-confirm.js'
import { decide } from '../../../packages/core/src/rule-engine.js'

// F5-1: 가족 사칭 확인 답변 3종
export const ANSWERS = {
  NOT_SENT: 'not_sent',   // 보낸 적 없어요 → R5
  WILL_CALL: 'will_call', // 지금 엄마께 전화할게요
  SENT: 'sent',           // 제가 보냈어요 → 판정 그대로(F5-5)
}

// F5-3: 링크·수상한 문자 확인 답변 3종 ("애들한테 물어보기" 흐름)
export const ANSWERS_LINK = {
  DONT_PRESS: 'dont_press',  // 누르지 마세요
  WILL_CALL:  'will_call',   // 제가 전화할게요
  WAIT:       'wait',        // 잠깐 기다려 주세요
}

// 확인 요청 유형: 가족 사칭(F5-1) vs 링크·일반 문자 확인(F5-3)
export const REQUEST_TYPES = {
  IMPERSONATION: 'impersonation', // F5-1
  LINK_CHECK:    'link_check',    // F5-3
}

// 개발용 가족 정보. 번호는 테스트 번호 대역(010-0000-XXXX)만 쓴다(PRD 15-1 작성 원칙).
// 로그인 후에는 circle_members(name_for_parent, relation)와 등록 번호로 바꾼다.
export const DEV_FAMILY = {
  parent: { title: '엄마', name: '김○○', phone: '010-0000-5678' },
  guardian: { callName: '지은이', relation: '딸', phone: '010-0000-1234' },
}

const LEVEL_RANK = { 확인필요: 0, 주의: 1, 위험: 2 }
export function toGuardianSummary(result, senderLast4 = null) {
  return { level:result.level, signals_final:[...(result.signals_final ?? [])],
    impersonated_relation:result.impersonated_relation ?? null,
    sender_last4:senderLast4 && /^\d{4}$/.test(senderLast4) ? senderLast4 : null }
}
// Explicit fixture storage is for isolated demos/tests only. Production always uses the API.
export function createConfirmStore(options = {}) {
  if (Object.hasOwn(options,'fallbackStorage')) return createDemoConfirmStore(options)
  return {
    async create(result,{requestType=REQUEST_TYPES.IMPERSONATION,processingConsent=false,targetId}={}) {
      return (await api('/confirm',{receipt:result.receipt,requestType,processingConsent,targetId,
        processingVersion:'confirm-processing-2026-10-28-v1'})).request
    },
    async get(id) { if(!id)return null; try{return (await api(`/confirm/${encodeURIComponent(id)}`)).request}
      catch(error){if(error.status===404)return null;throw error} },
    async respond(id,answer){return (await api(`/confirm/${encodeURIComponent(id)}/respond`,{answer})).request},
    async markDeviceSuspect(id){if(id)await api(`/confirm/${encodeURIComponent(id)}/suspect`,{})},
    async listRecent(){return (await api('/confirm')).requests},
  }
}
export const confirmStore = createConfirmStore()

export function applyFamilyAnswer(result, answer) {
  if (answer !== ANSWERS.NOT_SENT) return result
  const { level, fired_rules } = decide({ signals_final: result.signals_final ?? [], family_denied: true })
  const higher = LEVEL_RANK[level] >= LEVEL_RANK[result.level] ? level : result.level
  const rules = [...new Set([...(result.fired_rules ?? []), ...fired_rules])].filter((r) => r !== 'R8')
  return { ...result, level: higher, fired_rules: rules }
}

/**
 * 전화 여부(P2)를 판정에 반영한다. R1(통화 중)은 끊기 화면으로 따로 가므로 여기서는 R2만.
 * 원문 없이 signals_final만으로 규칙 엔진을 다시 돌리고, 더 높은 쪽을 쓴다.
 */
export function applyCallContext(result, { calledBefore }) {
  if (!calledBefore) return result
  const { level, fired_rules } = decide({ signals_final: result.signals_final ?? [], called_before: true })
  if (LEVEL_RANK[level] <= LEVEL_RANK[result.level]) return result
  return { ...result, level, fired_rules: [...new Set([...(result.fired_rules ?? []), ...fired_rules])] }
}

/** "오후 3:12" */
export function formatTime(ms) {
  const d = new Date(ms)
  const h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${m}`
}

/** P6: 이 시간 넘게 답이 없으면 "원래 번호로 전화해 보세요"(F5-7) [임시 5분] */
export const SLOW_ANSWER_MS = 5 * 60 * 1000
/** P6 폴링 간격(F5-6) */
export const POLL_MS = 3000
