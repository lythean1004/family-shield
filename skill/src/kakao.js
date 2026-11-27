/**
 * 카카오 오픈빌더 스킬 요청/응답 형식 (v2.0)
 *
 * 요청: { userRequest: { utterance, user: { properties: { botUserKey } } } }
 * 응답: { version: "2.0", template: { outputs: [{ simpleText: { text } }], quickReplies: [...] } }
 *
 * 규칙: 말풍선 최대 3개, 글 1,000자, 바로연결 최대 3개. URL은 카드 버튼으로 보낸다.
 */

import { isAffirmativeParentAnswer } from "../../packages/core/src/rule-engine.js";

export const MAX_TEXT_CHARS = 1000;
export const MAX_OUTPUTS = 3;
export const MAX_QUICK_REPLIES = 3;

/** 요청에서 부모님이 쓴 글, 봇 사용자 키, 화면 입력값을 꺼낸다. 없으면 null. */
export function readRequest(payload) {
  const userRequest = payload?.userRequest;
  if (!userRequest || typeof userRequest !== "object") return null;
  const text = typeof userRequest.utterance === "string" ? userRequest.utterance : "";
  const botUserKey = userRequest.user?.properties?.botUserKey ?? userRequest.user?.id ?? null;

  // 이 서비스가 이전 화면의 응답을 전달받는 경로. 발화에서 추출한 엔티티는 읽지 않는다.
  const raw = userRequest.params ?? {};
  const get = (key) => {
    const v = raw[key];
    if (v == null) return undefined;
    // 이전 화면은 평탄한 값과 { value } 형식을 쓴다.
    return typeof v === "object" ? (v.value ?? "") : String(v);
  };
  const parentInputs = {};
  const cip = get("call_in_progress");
  if (cip != null) parentInputs.call_in_progress = isAffirmativeParentAnswer(cip);
  const cb = get("called_before");
  if (cb != null) parentInputs.called_before = isAffirmativeParentAnswer(cb);
  const fd = get("family_denied");
  if (fd != null) parentInputs.family_denied = isAffirmativeParentAnswer(fd);
  const sl4 = get("sender_last4");
  if (sl4 != null) parentInputs.sender_last4 = sl4 || null;

  return { text, botUserKey, parentInputs };
}

/** 텍스트 말풍선 하나짜리 응답. 버튼은 최대 3개만 남긴다. */
export function simpleText(text, quickReplies = []) {
  const body = String(text ?? "").slice(0, MAX_TEXT_CHARS);
  const template = { outputs: [{ simpleText: { text: body } }] };
  if (quickReplies.length) template.quickReplies = quickReplies.slice(0, MAX_QUICK_REPLIES);
  return { version: "2.0", template };
}

/** 링크는 선택할 수 있는 텍스트 카드의 버튼으로 보낸다(D25). */
export function withLinkCard(body, links) {
  if (!links.length) return body;
  const buttons = links.map(({ label, url }) => ({ action: "webLink", label, webLinkUrl: url }));
  const card = { textCard: { title: "웹에서 보기", buttons } };
  const outputs = [...body.template.outputs, card].slice(0, MAX_OUTPUTS);
  return { ...body, template: { ...body.template, outputs } };
}

/**
 * 말풍선 맨 앞에 이미지 하나를 넣는다(멘토링 2026-11-26: 주의·위험은 이미지로 확실하게 경고).
 * 이미지는 우리 웹 서버의 고정 파일만 쓴다. altText는 화면 읽기·이미지 안 뜰 때 대신 보인다.
 */
export function withImage(body, imageUrl, altText) {
  const outputs = [{ simpleImage: { imageUrl, altText } }, ...body.template.outputs].slice(0, MAX_OUTPUTS);
  return { ...body, template: { ...body.template, outputs } };
}

/** 버튼에 적힌 문장을 사용자 발화로 보낸다. */
export const quickReply = {
  message: (label, messageText) => ({ label, action: "message", messageText }),
};

/**
 * 봇 사용자 키를 익명 코드로 바꾼다(PRD 13-3). 키가 없으면 null.
 * 원문 키는 저장·기록하지 않는다.
 */
export async function anonymousCode(botUserKey, salt) {
  if (!botUserKey || !salt) return null;
  const data = new TextEncoder().encode(`${salt}:${botUserKey}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest).slice(0, 6)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
