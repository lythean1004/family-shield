// 가족 확인 요청 (F5, screen-spec P6·P8·C2·C3) — 가짜 저장소
//
// 4주차 Supabase(confirm_requests + Realtime/폴링) 연결 전까지 브라우저 localStorage에 둔다.
// localStorage는 같은 주소의 탭끼리 공유되므로, 탭 하나는 부모님(P6), 다른 탭은 보호자(C2)로
// 실제 왕복을 시연할 수 있다. 함수 모양은 나중에 서버 호출로 바꿀 때 그대로 쓴다.
//
// 저장하는 것은 F5-8 범위뿐: 판정·신호·사칭 관계·끝 4자리·보낸 시각. 원문·AI 설명은 넣지 않는다(U8).
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
// 4주차에 circle_members(name_for_parent, relation)와 등록 번호로 바꾼다.
export const DEV_FAMILY = {
  parent: { title: '엄마', name: '김○○', phone: '010-0000-5678' },
  guardian: { callName: '지은이', relation: '딸', phone: '010-0000-1234' },
}

const KEY = 'fs.confirm.'
const LEVEL_RANK = { 확인필요: 0, 주의: 1, 위험: 2 }

function defaultStorage() {
  return typeof localStorage === 'undefined' ? null : localStorage
}

function newId() {
  const c = globalThis.crypto
  if (c?.randomUUID) return c.randomUUID()
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
}

/** 보호자에게 넘길 범위만 남긴다(F5-8) */
export function toGuardianSummary(result, senderLast4 = null) {
  return {
    level: result.level,
    signals_final: [...(result.signals_final ?? [])],
    impersonated_relation: result.impersonated_relation ?? null,
    sender_last4: senderLast4 && /^\d{4}$/.test(senderLast4) ? senderLast4 : null,
  }
}

export function createConfirmStore({ storage = defaultStorage(), clock = Date.now } = {}) {
  const read = (id) => {
    const raw = storage?.getItem(KEY + id)
    try { return raw ? JSON.parse(raw) : null } catch { return null }
  }
  const write = (req) => storage?.setItem(KEY + req.id, JSON.stringify(req))

  return {
    create(result, { senderLast4 = null, requestType = REQUEST_TYPES.IMPERSONATION } = {}) {
      const req = {
        id: newId(),
        state: 'pending',
        sentAt: clock(),
        requestType,
        summary: toGuardianSummary(result, senderLast4),
        answer: null,
        respondedAt: null,
        deviceSuspect: false,
      }
      write(req)
      return req
    },
    get: read,
    /** 응답은 한 번만(F5-4). 이미 응답했으면 바꾸지 않는다. */
    respond(id, answer) {
      const req = read(id)
      if (!req || req.state !== 'pending') return req
      const allAnswers = [...Object.values(ANSWERS), ...Object.values(ANSWERS_LINK)]
      if (!allAnswers.includes(answer)) throw new Error('unknown answer')
      const next = { ...req, state: 'responded', answer, respondedAt: clock() }
      write(next)
      return next
    },
    /** E1에서 링크·앱을 골랐으면 보호자 화면에 "다른 방법으로 연락"을 띄운다(F6-3) */
    markDeviceSuspect(id) {
      const req = read(id)
      if (req) write({ ...req, deviceSuspect: true })
    },
    /** F5-10: 최근 windowMs 이내 요청 목록 (localStorage 전체 스캔) */
    listRecent(windowMs = 24 * 60 * 60 * 1000) {
      if (!storage) return []
      const cutoff = clock() - windowMs
      const result = []
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i)
        if (!k?.startsWith(KEY)) continue
        const id = k.slice(KEY.length)
        const req = read(id)
        if (req && req.sentAt >= cutoff) result.push(req)
      }
      return result.sort((a, b) => b.sentAt - a.sentAt)
    },
  }
}

export const confirmStore = createConfirmStore()

/**
 * 가족 답을 판정에 반영한다(P8). 판정은 올라가기만 한다(원칙 2).
 *   보낸 적 없어요 → family_denied로 규칙 엔진 재실행(R5 → 위험)
 *   그 밖의 답 → 판정 그대로(F5-5)
 */
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
