/**
 * AI 사용 상태 (카카오 답 ↔ 웹 [자세히 보기] 일치, docs/plan-kakao-web-consistency.md, 운영자 A안)
 *
 * AI 문장은 저장하지 않는다. 대신 “어떤 경우였는지”만 정해진 값으로 저장해 두 화면이 같은 고정 문장을 고르게 한다.
 * - explained: AI 설명이 나왔다(문장은 카카오 답에만)
 * - rules_only: 카카오 동의 기록이 없어 규칙만
 * - declined: 거절·‘AI 끄기’·웹에서 허락하지 않음
 * - health: 건강 관련 내용이라 AI로 보내지 않음(작업 ⑦)
 * - fallback: AI를 불렀지만 시간 초과·검증 실패 등으로 설명이 없음
 */
import { RULES_ONLY_TEXT, AI_DECLINED_TEXT, HEALTH_SKIPPED_TEXT } from "./fixed-text.js";

export const AI_STATES = Object.freeze(["explained", "rules_only", "declined", "health", "fallback"]);

/** @param {{ explanation_for_parent?: string[], fallback_used?: boolean, ai_skipped?: string }} result
 *  @param {{ consent?: "granted"|"refused"|"unknown" }} [ctx] */
export function aiState(result, { consent } = {}) {
  if (result?.ai_skipped === "health") return "health";
  if (result?.explanation_for_parent?.length && !result.fallback_used) return "explained";
  if (consent === "unknown") return "rules_only";
  if (consent === "refused") return "declined";
  return "fallback";
}

/** 동의 전·거절·건강정보일 때 양쪽 화면에 똑같이 붙이는 문장. 그 밖에는 null */
export function aiStateNotice(state) {
  if (state === "rules_only") return RULES_ONLY_TEXT;
  if (state === "declined") return AI_DECLINED_TEXT;
  if (state === "health") return HEALTH_SKIPPED_TEXT;
  return null;
}
