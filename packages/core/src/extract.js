/**
 * ① 코드로 신호 뽑기 (PRD 9-1 ①, 9-3, 9-4)
 *
 * extractCodeSignals(text, options?) → { signals: string[], domains: string[] }
 *
 * - 원문을 받는다(마스킹 전). 결과에는 원문을 담지 않는다.
 * - '요구' 표현만 잡는다. "보냈어", "출금", "결제 예정" 같은 알림·지난 일은 잡지 않는다.
 * - 코드는 놓쳐도 AI 신호와 합집합이 되므로, 오경보를 줄이는 쪽(정밀도)을 우선한다.
 *   키워드 정밀도는 평가 때 AI와 따로 잰다(PRD 15-2).
 * - domains: 평판 조회(F4-11)에 넘길 도메인 목록. 단축 URL 도메인은 넣지 않는다.
 *
 * options.senderLast4     : 부모님이 입력한 발신 번호 끝 4자리(F4-1, 선택)
 * options.registeredLast4 : 사칭된 가족의 등록 번호 끝 4자리(P3에서 고른 뒤 알 수 있음)
 *   두 값이 모두 있고 다르면 SIG_NEW_NUMBER. 같아도 판정을 낮추지 않는다(발신번호 조작 가능).
 */
import {
  SIG_LINK, SIG_SHORT_URL, SIG_APP_INSTALL, SIG_MONEY,
  SIG_GIFTCARD, SIG_PERSONAL_INFO, SIG_NEW_NUMBER,
} from "./signals.js";
import { findLinks, toDomain, isShortener } from "./links.js";

// 같은 문장 안(마침표·물음표·느낌표·줄바꿈 전)에서 최대 n글자 사이
const gap = (n) => `[^.!?\\n]{0,${n}}`;

// 요구 어미: 해 줘 / 해주세요 / 하세요 / 해라 / 부탁 / 바랍니다 / 좀
const ASK = "(?:해\\s*(?:줘|줄래|주세요|주실|주라|줄\\s*수)|하세요|해라|해\\s*달라|부탁|바랍니다|좀\\s*해)";

const PATTERNS = {
  [SIG_MONEY]: [
    // 송금해 줘, 입금 부탁, 이체하세요, 결제해 주세요
    new RegExp(`(?:송금|입금|이체|결제|계좌\\s*이체)\\s*(?:좀\\s*)?${ASK}`),
    // 돈 좀 보내 줘, 50만 원만 빌려줘, 돈 부쳐 줘
    new RegExp(`(?:돈|만\\s*원|천\\s*원|원만|금액)${gap(10)}(?:보내|부쳐|빌려|넣어)\\s*(?:줘|주세요|주라|줄래|줄\\s*수|달)`),
  ],
  [SIG_GIFTCARD]: [
    // 상품권 사서 사진 찍어 보내, 구글 기프트카드 구매해 줘
    new RegExp(`(?:상품권|기프트\\s*카드|기프티콘|플레이\\s*카드|구글\\s*카드)${gap(20)}(?:사\\s*(?:줘|서|다|와|주)|구매|결제|보내|찍어|핀\\s*번호)`),
    // 핀번호 보내 줘
    new RegExp(`핀\\s*번호${gap(10)}(?:보내|알려|찍어)`),
  ],
  [SIG_PERSONAL_INFO]: [
    new RegExp(
      `(?:인증\\s*번호|비밀\\s*번호|비번|주민\\s*(?:등록\\s*)?번호|신분증|보안\\s*카드|OTP|카드\\s*번호|계좌\\s*번호)` +
      `${gap(15)}(?:알려|보내|입력\\s*(?:해|하세요|부탁)|찍어|불러|말해)`,
      "i",
    ),
  ],
  [SIG_APP_INSTALL]: [
    new RegExp(
      `(?:앱|어플|애플리케이션|프로그램|팀뷰어|애니\\s*데스크|원격|보안\\s*프로그램)` +
      `${gap(15)}(?:설치\\s*(?:해|하세요|부탁|바랍|좀)|깔아|다운\\s*(?:받아|로드\\s*(?:해|하세요))|받아\\s*(?:줘|주세요|주시|봐))`,
    ),
  ],
};

/**
 * @param {string} text
 * @param {{ senderLast4?: string, registeredLast4?: string }} [options]
 * @returns {{ signals: string[], domains: string[] }}
 */
export function extractCodeSignals(text, options = {}) {
  const signals = new Set();
  const domains = new Set();
  const input = typeof text === "string" ? text : "";

  // 링크
  const links = findLinks(input);
  for (const link of links) {
    signals.add(SIG_LINK);
    const domain = toDomain(link);
    if (!domain) continue;
    if (isShortener(domain)) signals.add(SIG_SHORT_URL);
    else domains.add(domain);
    if (/\.apk(?:$|[?#])/i.test(link)) signals.add(SIG_APP_INSTALL); // 설치 파일 링크
  }

  // 요구 키워드
  for (const [signal, patterns] of Object.entries(PATTERNS)) {
    if (patterns.some((re) => re.test(input))) signals.add(signal);
  }

  // 끝 4자리 비교
  const { senderLast4, registeredLast4 } = options;
  const isLast4 = (v) => typeof v === "string" && /^\d{4}$/.test(v);
  if (isLast4(senderLast4) && isLast4(registeredLast4) && senderLast4 !== registeredLast4) {
    signals.add(SIG_NEW_NUMBER);
  }

  return { signals: [...signals], domains: [...domains] };
}
