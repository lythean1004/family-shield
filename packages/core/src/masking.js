/**
 * 개인정보 마스킹 (PRD 9-2)
 *
 * mask(text, options?) → { masked: string, phoneHmacs: string[] }
 *
 * - 전화번호  → [번호]  (HMAC 값을 phoneHmacs 배열로 반환)
 * - 계좌번호  → [계좌]
 * - 카드번호  → [카드]
 * - 주민등록번호 → [주민번호]
 * - 이메일    → [이메일]
 * - URL       → [링크]
 * - 등록된 가족 이름 → [가족이름]
 *
 * options.hmacKey   : HMAC에 쓸 키 문자열. 없으면 HMAC을 계산하지 않는다.
 * options.familyNames: 마스킹할 가족 이름 배열 (정확히 일치하는 단어 단위만)
 */
import { createHmac } from "node:crypto";
import { SCHEME_URL_RE, BARE_DOMAIN_RE } from "./links.js";

// ── 패턴 ────────────────────────────────────────────────────────────────────

// 전화번호: 010/011/016/017/018/019-XXXX-XXXX, 02-XXXX-XXXX, 지역번호 0XX-XXX-XXXX
const PHONE_RE = /(?<!\d)(?:0(?:1[016789]|2|[3-9]\d)[-\s]?\d{3,4}[-\s]?\d{4})(?!\d)/g;

// 계좌번호: 숫자-숫자-숫자 형태, 총 10~14자리
const ACCOUNT_RE = /(?<!\d)\d{2,6}-\d{2,6}-\d{2,6}(?:-\d{2,3})?(?!\d)/g;

// 카드번호: XXXX-XXXX-XXXX-XXXX 또는 16자리 연속
const CARD_RE = /(?<!\d)(?:\d{4}[-\s]\d{4}[-\s]\d{4}[-\s]\d{4}|\d{16})(?!\d)/g;

// 주민등록번호: XXXXXX-XXXXXXX
const RRN_RE = /(?<!\d)\d{6}-[1-4]\d{6}(?!\d)/g;

// 이메일
const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

// URL: links.js의 SCHEME_URL_RE(스킴 있는 주소)와 BARE_DOMAIN_RE(bit.ly/abc 같은 주소)를 같이 쓴다.

// ── 헬퍼 ────────────────────────────────────────────────────────────────────

function hmacPhone(raw, key) {
  return createHmac("sha256", key).update(raw).digest("hex").slice(0, 16);
}

// ── 공개 API ─────────────────────────────────────────────────────────────────

/**
 * @param {string} text
 * @param {{ hmacKey?: string, familyNames?: string[] }} [options]
 * @returns {{ masked: string, phoneHmacs: string[] }}
 */
export function mask(text, options = {}) {
  const { hmacKey, familyNames = [] } = options;
  const phoneHmacs = [];

  // 순서: URL → 이메일 → 스킴 없는 주소 → 카드 → 주민번호 → 전화번호 → 계좌 → 가족이름
  // 링크를 먼저 처리해야 번호 패턴이 링크 안에서 잘못 잡히는 것을 막는다.
  // 이메일을 스킴 없는 주소보다 먼저 처리해야 이메일 도메인이 [링크]로 바뀌지 않는다.
  let out = text;

  out = out.replace(SCHEME_URL_RE, "[링크]");
  out = out.replace(EMAIL_RE, "[이메일]");
  out = out.replace(BARE_DOMAIN_RE, "[링크]");
  out = out.replace(CARD_RE, "[카드]");
  out = out.replace(RRN_RE, "[주민번호]");

  // 계좌처럼 보이는 전화번호가 [계좌]로 바뀌지 않게 전화번호를 먼저 처리하고 HMAC을 기록한다.
  out = out.replace(PHONE_RE, (raw) => {
    if (hmacKey) phoneHmacs.push(hmacPhone(raw.replace(/[-\s]/g, ""), hmacKey));
    return "[번호]";
  });

  out = out.replace(ACCOUNT_RE, "[계좌]");

  // 등록된 가족 이름: 단어 경계 기준 정확히 일치하는 경우만
  for (const name of familyNames) {
    if (!name) continue;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // 뒤에 한글 조사가 붙을 수 있으므로 lookahead는 영문자만 차단
    out = out.replace(new RegExp(`(?<![가-힣a-zA-Z])${escaped}(?![a-zA-Z])`, "g"), "[가족이름]");
  }

  return { masked: out, phoneHmacs };
}
