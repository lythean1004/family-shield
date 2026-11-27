import { OFFICIAL_DOMAIN_CARDS } from "./lookalike.js";
import { OFFICIAL_LINK_HOST_CARDS } from "./official-links.js";

const compactName = (name) => name.replace(/\s+/g, "").toLowerCase();
const senderCards = new Map(
  [...OFFICIAL_DOMAIN_CARDS, ...OFFICIAL_LINK_HOST_CARDS]
    .filter(card => card.status === "source_checked")
    .flatMap(card => (card.sender_names ?? card.name.split("(")[0].replace(/\s+(?:대표 주소|첫 화면)$/, "").split("·"))
      .map(name => [compactName(name), card])),
);

// 조회·배송 완료와 구분할 수 있는 주소 정정, 결제 취소 등의 처리 요구.
const SERVICE_CHANGE = /(?:배송지|수령지|주소|결제|승인)[^.!?\n]{0,12}?(?:수정|정정|변경|취소)\s*(?:신청|양식|접수|요청|부탁|필요|해\s*(?:주|줘)|하(?:세|십|시)|바랍|후\s*재배송)(?!\s*(?:(?:하)?지\s*(?:마|말|않)|(?:은|는|이|가)\s*(?:사칭|사기|피싱)))/;

// 금융위·경찰청 등 합동 예방 안내의 택배·기관 발신 사칭 유형. https://www.fsc.go.kr/no010101/87779
export function hasCardServiceRequest(text, { externalLink, sensitiveRequest, directedCallback }) {
  const opening = text.trimStart().replace(/^(?:\[(?:Web발신|국제발신|국외발신)\]\s*)+/i, "");
  const sender = /^\[([^\]\n]{1,30})\]\s*/.exec(opening) ??
    /^([가-힣a-z0-9]{2,24}?)(?:입니다(?=[\s.!]|$)|\s+(?=배송|결제|민원|공지|서비스\s*안내))/i.exec(opening);
  const card = sender && senderCards.get(compactName(sender[1]));
  if (!card) return false;
  const body = opening.slice(sender[0].length).trimStart();
  if (/^[.!:\s]*(?:(?:보이스|메신저)?피싱|스미싱|사칭)\s*(?:문자\s*)?(?:주의|예방|교육|경고)/.test(body)) return false;
  return (directedCallback && Boolean(card.callback_contact)) || (externalLink && (sensitiveRequest || SERVICE_CHANGE.test(body)));
}
