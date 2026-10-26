/**
 * 링크 찾기 (마스킹과 코드 신호 추출이 같이 쓴다)
 *
 * - 링크에 접속하지 않는다. 단축 URL도 펼치지 않는다(D11).
 * - 평판 조회에는 도메인만 넘긴다(경로에 개인 토큰이 있을 수 있음, PRD 12-3).
 */

// 1) 스킴이 있는 URL, www.로 시작하는 주소
export const SCHEME_URL_RE = /(?:https?|ftp):\/\/[^\s,)'"<>\]]+|www\.[^\s,)'"<>\]]+/gi;

// 2) 스킴 없이 쓴 주소(예: bit.ly/abc, evil.invalid/login).
//    이메일의 도메인 부분(@ 뒤)은 잡지 않는다.
const TLDS = [
  "co\\.kr", "or\\.kr", "go\\.kr", "ne\\.kr", "kr",
  "com", "net", "org", "info", "biz", "io", "me", "ly", "gl", "do", "la", "at", "to", "cc", "co",
  "xyz", "top", "site", "online", "shop", "link", "click", "app", "page", "live", "store", "invalid",
].join("|");
export const BARE_DOMAIN_RE = new RegExp(
  `(?<![@\\w.\\-/])(?:[a-z0-9](?:[a-z0-9\\-]{0,61}[a-z0-9])?\\.)+(?:${TLDS})(?![a-z0-9\\-])(?:[/?#][^\\s,)'"<>\\]]*)?`,
  "gi",
);

/** 알려진 단축 URL 서비스 (펼치지 않고 SIG_SHORT_URL로만 처리) */
export const SHORTENER_DOMAINS = new Set([
  "bit.ly", "abit.ly", "han.gl", "me2.do", "url.kr", "vo.la", "t.ly", "tinyurl.com",
  "goo.gl", "is.gd", "buly.kr", "c11.kr", "naver.me", "t.co", "ow.ly", "shorturl.at",
  "rebrand.ly", "cutt.ly", "zrr.kr", "lrl.kr", "muz.so", "asq.kr",
]);

/** 문자 안의 링크 원문을 모두 찾는다(중복 포함, 등장 순서). */
export function findLinks(text) {
  const found = [];
  const withoutScheme = text.replace(SCHEME_URL_RE, (m) => {
    found.push(m);
    return " ";
  });
  for (const m of withoutScheme.matchAll(BARE_DOMAIN_RE)) found.push(m[0]);
  return found;
}

/** 링크 원문에서 도메인(호스트)만 뽑는다. 소문자, 포트 제거. */
export function toDomain(link) {
  const noScheme = link.replace(/^(?:https?|ftp):\/\//i, "");
  const host = noScheme.split(/[/?#]/)[0].split("@").pop().split(":")[0];
  return host.toLowerCase().replace(/\.+$/, "");
}

/** 단축 URL 서비스인지 (www. 는 떼고 비교) */
export function isShortener(domain) {
  return SHORTENER_DOMAINS.has(domain.replace(/^www\./, ""));
}
