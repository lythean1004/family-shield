/**
 * 공식 주소 예외에 쓰는 링크 후보 검사. 네트워크 요청 없이 WHATWG URL로 호스트를 읽는다.
 * 기존 findLinks의 인식 성공만으로 입력 전체를 확인했다고 간주하지 않는다.
 * raw와 파서 상태는 이번 호출 안에서만 사용하며 결과·로그·DB로 내보내지 않는다.
 */
import { findLinks } from "./links.js";

const WEB_SCHEME = /^(?:https?|ftp):\/\//i;
const SCHEME_HINT = /^(?:https?|ftp):/i;
const DOMAIN_HINT = /^(?:[\p{L}\p{N}_-]+\.)+[\p{L}][\p{L}\p{N}-]*(?:[:/?#].*)?$/u;
const IP_HINT = /^(?:\d{1,3}\.){3}\d{1,3}(?:[:/?#]|$)/;
const EMAIL = /^[^\s/@:]+@[^\s/@:]+\.[^\s/@:]+$/u;
const INVISIBLE = /[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/u;
const WRAPPERS = new Map([["(", ")"], ["[", "]"], ["{", "}"], ["<", ">"], ['"', '"'], ["'", "'"]]);

/** 안내문 바깥의 짝지어진 감싸기만 제거한다. 후보 안의 문장부호로 주소를 나누지 않는다. */
function unwrapToken(token) {
  let raw = token;
  // ‘홈택스(주소)에서’처럼 한글 안내와 짝지어진 괄호가 있는 표기를 보존한다.
  const labeled = raw.match(/^[가-힣]*([([{<])(.*)([)\]}>])[가-힣]*[.,;!?。…]*$/u);
  if (labeled && WRAPPERS.get(labeled[1]) === labeled[3]) raw = labeled[2];
  while (WRAPPERS.has(raw[0])) {
    const end = raw.lastIndexOf(WRAPPERS.get(raw[0]));
    if (end <= 0 || !/^[,.;!?。…]*$/u.test(raw.slice(end + 1))) break;
    raw = raw.slice(1, end);
  }
  return raw;
}

/** 후보 하나의 전체 구문·목적지. URL 생성은 주소에 접속하지 않는다. */
export function parseLinkCandidate(raw) {
  const empty = { raw, complete: false, host: "", protocol: "", port: "", rest: "", hasUserinfo: false };
  if (typeof raw !== "string" || !raw || raw !== raw.trim() || /\s/u.test(raw)) return empty;
  const noScheme = raw.replace(WEB_SCHEME, "");
  const authority = noScheme.split(/[/?#]/)[0];
  const at = authority.lastIndexOf("@");
  // 기존 주소 앞부분 @ 경고는 유지한다. 역슬래시 등으로 해석이 불확실하면 공식 예외만 보류한다.
  const hasUserinfo = at > 0 && at < authority.length - 1;
  const uncertain = !authority || raw.includes("\\") || INVISIBLE.test(raw) ||
    raw !== raw.normalize("NFKC") || /[%。｡]/u.test(authority) || authority.endsWith(":");
  try {
    const url = new URL(WEB_SCHEME.test(raw) ? raw : `https://${raw}`);
    return {
      raw, complete: !uncertain,
      host: url.hostname.toLowerCase().replace(/\.+$/, ""),
      protocol: url.protocol, port: url.port,
      rest: url.pathname + url.search + url.hash,
      hasUserinfo: hasUserinfo || Boolean(url.username || url.password),
    };
  } catch {
    return { ...empty, hasUserinfo };
  }
}

/**
 * 완전한 토큰을 먼저 보존하고 그 안에서 기존 인식기가 링크를 찾았는지 확인한다.
 * 지원하지 않는 도메인 모양도 전체 확인 상태를 false로 만든다. 평범한 이메일은 제외한다.
 * 미지원 파일명/도메인처럼 구분할 수 없는 토큰은 새 위험 신호 대신 공식 예외만 보류한다.
 */
export function inspectLinkCandidates(text, { inputComplete = true } = {}) {
  const candidates = [];
  let complete = inputComplete === true;
  const input = typeof text === "string" ? text : "";
  for (const match of input.matchAll(/\S+/gu)) {
    const raw = unwrapToken(match[0]);
    // 표시를 바꾼 문자열은 인식의 보조 자료로만 쓰며 공식 주소 근거로 쓰지 않는다.
    const view = raw.normalize("NFKC").replace(/[。｡]/g, ".");
    const matches = findLinks(view);
    const recognized = matches.length > 0;
    if (!recognized && EMAIL.test(view)) continue;
    if (recognized || SCHEME_HINT.test(view) || IP_HINT.test(view)) {
      const parsed = parseLinkCandidate(raw);
      candidates.push(parsed);
      if (!parsed.complete || matches.length > 1) complete = false;
    } else if (DOMAIN_HINT.test(view.replace(/\.+$/, ""))) {
      complete = false;
    }
  }
  return { candidates, complete };
}

/** 완결성은 공식 예외에만 적용한다. 이전 위험 검사 입력을 불완전 상태 때문에 버리지 않는다. */
export function linksForRiskChecks(legacyLinks, { candidates }) {
  return [...new Set([...legacyLinks, ...candidates.filter((c) => c.complete).map((c) => c.raw)])];
}
