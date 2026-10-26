/**
 * 카카오 오픈빌더 스킬 요청/응답 형식 (v2.0)
 *
 * 요청: { userRequest: { utterance, user: { properties: { botUserKey } } } }
 * 응답: { version: "2.0", template: { outputs: [{ simpleText: { text } }], quickReplies: [...] } }
 *
 * 규칙: 말풍선 최대 3개, 글 1,000자, 버튼 최대 3개. 넘으면 잘라서 보낸다.
 */

export const MAX_TEXT_CHARS = 1000;
export const MAX_OUTPUTS = 3;
export const MAX_QUICK_REPLIES = 3;

/** 요청에서 부모님이 쓴 글, 봇 사용자 키, 화면 입력값을 꺼낸다. 없으면 null. */
export function readRequest(payload) {
  const userRequest = payload?.userRequest;
  if (!userRequest || typeof userRequest !== "object") return null;
  const text = typeof userRequest.utterance === "string" ? userRequest.utterance : "";
  const botUserKey = userRequest.user?.properties?.botUserKey ?? userRequest.user?.id ?? null;

  // 카카오 블록 파라미터(이전 화면 입력값).
  // 오픈빌더 v2: userRequest.params 또는 detail_params["param"].value
  const raw = userRequest.params ?? {};
  const get = (key) => {
    const v = raw[key];
    if (v == null) return undefined;
    // detail_params 형태 { value: "true" } 또는 평탄 "true"
    const str = typeof v === "object" ? (v.value ?? "") : String(v);
    return str;
  };
  const parentInputs = {};
  const cip = get("call_in_progress");
  if (cip != null) parentInputs.call_in_progress = cip === "true";
  const cb = get("called_before");
  if (cb != null) parentInputs.called_before = cb === "true";
  const fd = get("family_denied");
  if (fd != null) parentInputs.family_denied = fd === "true";
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

/** 버튼 만들기 도우미 (D25: 우리가 먼저 링크를 보내지 않는다 → webLink는 사용자가 누를 때만) */
export const quickReply = {
  message: (label, messageText) => ({ label, action: "message", messageText }),
  phone: (label, phoneNumber) => ({ label, action: "phone", phoneNumber }),
  webLink: (label, webLinkUrl) => ({ label, action: "webLink", webLinkUrl }),
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
