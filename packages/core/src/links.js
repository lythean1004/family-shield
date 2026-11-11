/**
 * 링크 찾기 (마스킹과 코드 신호 추출이 같이 쓴다)
 *
 * - 링크에 접속하지 않는다. 단축 URL도 펼치지 않는다(D11).
 * - 평판 조회에는 도메인만 넘긴다(경로에 개인 토큰이 있을 수 있음, PRD 12-3).
 */

// 1) 스킴이 있는 URL, www.로 시작하는 주소
export const SCHEME_URL_RE = /(?:https?|ftp):\/\/[^\s,)'"<>\]]+|(?<![@\w.\-/])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*www\.[^\s,)'"<>\]]+/gi;

// 2) 스킴 없이 쓴 주소(예: bit.ly/abc, evil.invalid/login).
//    이메일의 도메인 부분(@ 뒤)은 잡지 않는다.
const TLDS = [
  "co\\.kr", "or\\.kr", "go\\.kr", "ne\\.kr", "kr",
  "com", "net", "org", "info", "biz", "io", "me", "ly", "gl", "do", "la", "at", "to", "cc", "co",
  "xyz", "top", "site", "online", "shop", "link", "click", "app", "page", "live", "store", "invalid",
  // KISA 피싱 목록(2023~2024)에서 20번 이상 나온 끝부분(2026-11-11, D40). 스킴 없이 쓴 피싱 링크의 31%를 놓치고 있었다
  "pro", "one", "icu", "art", "work", "buzz", "pw", "mom", "yachts", "cfd", "life", "lat", "sbs", "bar", "hair",
  "boats", "golf", "run", "wtf", "ac", "wiki", "cyou", "lol", "gg", "rest", "pics", "world", "skin", "press", "su",
  "digital", "asia", "ink", "loan", "de", "today", "jp", "in", "quest", "gd", "be", "best", "homes", "fit", "guru",
  "makeup", "sk", "cn", "autos", "im", "so", "help", "email", "fm", "gy", "beauty", "it", "fyi", "ws", "blog", "lu",
  "cx", "ms", "uno", "bz", "ru", "social", "casa", "pl", "cl", "id", "tw", "es", "tc", "monster", "cam", "lgbt",
  "agency", "expert", "eu", "bid", "tel", "bio", "yt", "black", "li", "rocks", "mov", "us", "miami",
].join("|");
// 2026-11-11 후속 조사: 스킴 없는 누락 14행, IANA 2026111100 위임 목록 확인.
const FOLLOWUP_TLDS = ["show", "media", "gold", "vin", "services", "ski", "pub", "moe", "mobi", "baby", "rent"].join("|");
export const BARE_DOMAIN_RE = new RegExp(
  // 새 끝부분은 example.media.backup 같은 파일명 중간까지 잡지 않는다.
  // 기존 끝부분의 경계까지 일괄 변경하면 미지원 국가 도메인의 인식이 달라져 별도 검토로 남긴다.
  `(?<![@\\w.\\-/])(?:[a-z0-9](?:[a-z0-9\\-]{0,61}[a-z0-9])?\\.)+(?:${TLDS}|(?:${FOLLOWUP_TLDS})(?!\\.[a-z0-9\\-]))(?![a-z0-9\\-])(?:[/?#][^\\s,)'"<>\\]]*)?`,
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
