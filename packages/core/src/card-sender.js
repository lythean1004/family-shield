import { OFFICIAL_DOMAIN_CARDS } from "./lookalike.js";
import { OFFICIAL_LINK_HOST_CARDS } from "./official-links.js";
import { readFileSync } from "node:fs";

const serviceFile = new URL("../../../content/evidence/sender-services.json", import.meta.url);
const serviceNames = new Set(JSON.parse(readFileSync(serviceFile, "utf8")).cards
  .filter(c => c.status === "source_checked").map(c => c.name));

const compactName = (name) => name.replace(/\s+/g, "").toLowerCase();
const senderCards = new Map(
  [...OFFICIAL_DOMAIN_CARDS, ...OFFICIAL_LINK_HOST_CARDS]
    .filter(card => card.status === "source_checked")
    .flatMap(card => (card.sender_names ?? card.name.split("(")[0].replace(/\s+(?:대표 주소|첫 화면)$/, "").split("·"))
      .map(name => [compactName(name), card])),
);

// 조회·배송 완료와 구분할 수 있는 주소 정정, 결제 취소 등의 처리 요구.
const SERVICE_CHANGE = /(?:배송지|수령지|주소|결제|승인)[^.!?\n]{0,12}?(?:수정|정정|변경|취소)\s*(?:신청|양식|접수|요청|부탁|필요|해\s*(?:주|줘)|하(?:세|십|시)|바랍|후\s*재배송)(?!\s*(?:(?:하)?지\s*(?:마|말|않)|(?:은|는|이|가)\s*(?:사칭|사기|피싱)))/;
const RETURN_NOTICE = /(?:배송지|수령지|(?:도로명\s*)?주소지?)(?:가|의)?\s*(?:오류|불일치|불명|미확인)[^.!?\n]{0,45}(?:[.!]\s*(?:오늘|내일|금일|기한|\d+\s*(?:시간|시|일))[^.!?\n]{0,26})?반송\s*(?:예정|됩니다|될\s*수)/;
const CANCEL_ROUTE = /(?:결제|거래|승인)\s*취소(?:를)?\s*(?:원하(?:시)?면|하시려면|하려면)/;
const BENEFIT = /(?:쿠폰|이용권|지원금|포인트|바우처)/;
const ENDING = /(?:미신청자|신청\s*마감|소멸\s*예정)/;
const ACTION = /(?:신청하기|(?:쿠폰|이용권|혜택|포인트)\s*(?:받기|등록하기)|까지\s*받기)(?=[\s:：.!→]|$)/;
const SENSITIVE_CONDITION = /(?:앱|어플)\s*설치\s*(?:후|해야|하셔야)\s*(?:신청|수령|지급)|(?:조회|납부|신청)\s*시\s*본인\s*인증\s*[(（]\s*(?:(?:성명|이름|생년월일|연락처)\s*[/,·]\s*){0,4}카드\s*번호\s*[,·/)）]|카드\s*번호로\s*본인\s*인증\s*(?:필수|필요)/;
const authenticationForm = /(?:본인\s*인증\s*[(（][^()（）\n]{0,35}(?:인증\s*번호|일회용\s*코드)\s*[)）]|보안\s*카드\s*번호\s*(?:전체|전부)(?:를)?\s*입력)\s*(?:후|해야)\s*(?:지급|수령|신청|해제|인증|이용)/;
const collectionNotice = /(?:압류\s*(?:예정|예고)|체납\s*처분)/;
const collectionRoute = /납부\s*(?:(?:및|또는|·)\s*)?이의\s*신청/;

// 금융위·경찰청 등 합동 예방 안내의 택배·기관 발신 사칭 유형. https://www.fsc.go.kr/no010101/87779
export function hasCardServiceRequest(text, { externalLink, unverifiedLink, sensitiveRequest, directedCallback, personalReply }) {
  const opening = text.trimStart().replace(/^(?:\[(?:Web발신|국제발신|국외발신)\]\s*)+/i, "");
  const sender = /^\[([^\]\n]{1,30})\]\s*/.exec(opening) ?? /^\(([^()\n]{1,30})\)\s*/.exec(opening) ??
    /^([가-힣a-z0-9]{2,20})[ \t]+[가-힣]{1,10}(?:과|부|팀)[ \t]+(?:알림|안내)(?=[\s.!]|$)/i.exec(opening) ??
    /^([가-힣a-z0-9]{2,24}?)(?:\s*[:：]|입니다(?=[\s.!]|$)|\s+(?=배송|결제|민원|공지|서비스\s*안내|신청|추가\s*지원))/i.exec(opening);
  const card = sender && senderCards.get(compactName(sender[1]));
  if (!sender || (!card && !serviceNames.has(sender[1]))) return false;
  const body = opening.slice(sender[0].length).trimStart();
  if (/^[.!:\s]*(?:(?:보이스|메신저)?피싱|스미싱|사칭)\s*(?:문자\s*)?(?:주의|예방|교육|경고)/.test(body)) return false;
  if (unverifiedLink && !/수신\s*거부|[(（]광고[)）]|[‘“「]|(?:라는|다는)\s*(?:문구|문자)|(?:설치|인증)하지\s*마/.test(body)) {
    if (!/(?:예방\s*(?:안내|교육)|교육\s*자료|(?:라는|다는)\s*(?:사례|요구))/.test(body) &&
        (authenticationForm.test(body) || (collectionNotice.test(body) && collectionRoute.test(body)))) return true;
    if (SENSITIVE_CONDITION.test(body) || (BENEFIT.test(body) && ENDING.test(body) && ACTION.test(body))) return true;
  }
  if (!card) return false;
  if (unverifiedLink && (RETURN_NOTICE.test(body) || CANCEL_ROUTE.test(body))) return true;
  const contact = card.callback_contact;
  const compactBody = body.replace(/\s+/g, "");
  const matchesContact = contact && (!contact.topics || contact.topics.some(topic => compactBody.includes(topic)));
  return personalReply || (directedCallback && Boolean(matchesContact)) || (externalLink && (sensitiveRequest || SERVICE_CHANGE.test(body)));
}
