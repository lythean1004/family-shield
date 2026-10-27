// 가족 확인 요청 (F5, screen-spec P6·P8·C2·C3) — Supabase 연결
//
// confirm_requests 테이블에 저장한다. RLS 정책으로 권한을 제어한다.
// 저장하는 것은 F5-8 범위뿐: 판정·신호·사칭 관계·끝 4자리·보낸 시각. 원문·AI 설명은 넣지 않는다(U8).
//
// 로그인 전에는 localStorage 폴백으로 개발·데모 가능.
import { supabase } from '../lib/supabase.js'
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

const KEY = 'fs.confirm.' // localStorage 폴백용
const LEVEL_RANK = { 확인필요: 0, 주의: 1, 위험: 2 }

/** 보호자에게 넘길 범위만 남긴다(F5-8) */
export function toGuardianSummary(result, senderLast4 = null) {
  return {
    level: result.level,
    signals_final: [...(result.signals_final ?? [])],
    impersonated_relation: result.impersonated_relation ?? null,
    sender_last4: senderLast4 && /^\d{4}$/.test(senderLast4) ? senderLast4 : null,
  }
}

/**
 * Supabase 기반 확인 요청 저장소
 * 로그인 전에는 localStorage 폴백 (개발·데모용)
 * 
 * 주의: 현재 DB 스키마는 check_id 필수이지만, 로그인 전에는 checks 테이블 사용 안 함.
 * 간단한 확인 요청만 localStorage로 시연 가능.
 */
export function createConfirmStore({ fallbackStorage = null, clock = Date.now } = {}) {
  // localStorage 폴백 헬퍼
  const fbRead = (id) => {
    if (!fallbackStorage) return null
    const raw = fallbackStorage.getItem(KEY + id)
    try { return raw ? JSON.parse(raw) : null } catch { return null }
  }
  const fbWrite = (req) => fallbackStorage?.setItem(KEY + req.id, JSON.stringify(req))
  const fbNewId = () => {
    const c = globalThis.crypto
    if (c?.randomUUID) return `fb_${c.randomUUID()}`
    return `fb_${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
  }

  return {
    /**
     * 확인 요청 생성 (부모님이 보호자에게)
     * 로그인 후: confirm_requests 테이블 insert (현재 스키마는 check_id 필수)
     * 로그인 전: localStorage 폴백
     */
    async create(result, { senderLast4 = null, requestType = REQUEST_TYPES.IMPERSONATION, checkId = null } = {}) {
      const summary = toGuardianSummary(result, senderLast4)

      // 로그인 상태 확인
      const { data: { user } } = await supabase.auth.getUser()

      // localStorage 폴백 (로그인 전 또는 checkId 없을 때)
      if (!user || !checkId) {
        const fbReq = {
          id: fbNewId(),
          state: 'pending',
          sentAt: clock(),
          requestType,
          summary,
          answer: null,
          respondedAt: null,
          deviceSuspect: false,
        }
        fbWrite(fbReq)
        return fbReq
      }

      // Supabase에 저장 (현재는 스키마 맞지 않아 스킵, Auth 구현 후 활성화)
      // TODO: checks 테이블과 연동 후 활성화
      console.warn('Supabase confirm_requests insert는 Auth 구현 후 활성화 예정')
      
      // 임시로 localStorage 폴백
      const fbReq = {
        id: fbNewId(),
        state: 'pending',
        sentAt: clock(),
        requestType,
        summary,
        answer: null,
        respondedAt: null,
        deviceSuspect: false,
      }
      fbWrite(fbReq)
      return fbReq
    },
    get: async (id) => {
      if (!id) return null
      // localStorage 폴백
      if (id.startsWith('fb_')) return fbRead(id)
      
      // Supabase 조회 (Auth 구현 후 활성화)
      return fbRead(id)
    },
    
    /** 응답은 한 번만(F5-4). 이미 응답했으면 바꾸지 않는다. */
    async respond(id, answer) {
      if (!id) return null

      // localStorage 폴백
      if (id.startsWith('fb_')) {
        const req = fbRead(id)
        if (!req || req.state !== 'pending') return req
        const allAnswers = [...Object.values(ANSWERS), ...Object.values(ANSWERS_LINK)]
        if (!allAnswers.includes(answer)) throw new Error('unknown answer')
        const next = { ...req, state: 'responded', answer, respondedAt: clock() }
        fbWrite(next)
        return next
      }

      // Supabase 업데이트 (Auth 구현 후 활성화)
      return fbRead(id)
    },
    
    /** E1에서 링크·앱을 골랐으면 보호자 화면에 "다른 방법으로 연락"을 띄운다(F6-3) */
    async markDeviceSuspect(id) {
      if (!id) return
      
      if (id.startsWith('fb_')) {
        const req = fbRead(id)
        if (req) fbWrite({ ...req, deviceSuspect: true })
        return
      }

      // Supabase 업데이트 (Auth 구현 후 활성화)
    },
    /** F5-10: 최근 windowMs 이내 요청 목록 (localStorage 전체 스캔) */
    async listRecent(windowMs = 24 * 60 * 60 * 1000) {
      // 로그인 상태 확인
      const { data: { user } } = await supabase.auth.getUser()

      // localStorage 폴백 (로그인 전)
      if (!user || !fallbackStorage) {
        if (!fallbackStorage) return []
        const cutoff = clock() - windowMs
        const result = []
        for (let i = 0; i < fallbackStorage.length; i++) {
          const k = fallbackStorage.key(i)
          if (!k?.startsWith(KEY)) continue
          const id = k.slice(KEY.length)
          const req = fbRead(id)
          if (req && req.sentAt >= cutoff) result.push(req)
        }
        return result.sort((a, b) => b.sentAt - a.sentAt)
      }

      // Supabase 조회 (Auth 구현 후 활성화)
      console.warn('Supabase confirm_requests list는 Auth 구현 후 활성화 예정')
      return []
    },
  }
}

export const confirmStore = createConfirmStore({
  fallbackStorage: typeof localStorage === 'undefined' ? null : localStorage,
})

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
