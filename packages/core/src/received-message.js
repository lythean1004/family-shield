const artifact = "(?:문자|메시지|연락|안내(?:문)?|쪽지|통지(?:문)?|고지(?:문)?|알림|회신|답장|답신|요청서|채팅)";
const arrived = "(?:받았|받은|받아\\s*(?:확인|기록)|왔|도착|수신|전달받|저장해\\s*둔)";
const received = new RegExp(artifact + "(?:[을를이가은는])?\\s*(?:[^.!?\\n]{0,20}\\s+)?" + arrived +
  "|" + arrived + "[^.!?\\n]{0,12}" + artifact, "u");
const inactive = /(?:사기|피싱|사칭|피해)\s*(?:예방|사례|교육)|(?:교육|훈련|수업|예시|예방|가상|모의)\s*(?:용|자료|사례|문구|대본|기록|수업)|(?:연극|역할극|극본|대본|낭독극)|(?:요청|요구|절차|업무|처리)(?:를|을|은|는|이|가)?\s*(?:이미\s*)?(?:취소|철회|거절|종료|완료)|(?:이미\s*)?(?:거절했|철회했|취소했|처리됐|끝냈)|(?:요구한|부탁한|말한|받은|보낸)\s*적(?:이|은)?\s*없/u;
const attributed = /(?:발신(?:자|처|\s*표시|\s*이름)|보낸\s*(?:곳|이)|발행처|(?:상대|발신자|발신처|담당자|직원)(?:가|이)\s*(?:보낸|관리하는|운영하는)\s*[^,.!?\n]{0,14}(?:양식|서식|폼)|(?:같은|그|이|해당)\s*(?:문자|메시지|채팅|통지|알림|안내문)|(?:문자|메시지|채팅|통지|알림|안내문)(?:에|에는)\s*(?:적혀|실린|표시|들어\s*있)|(?:발신|수신)\s*(?:내용|기록))/u;
const narrator = /^(?<label>나|저|수신자|신고인|기록자)\s*[:：]\s*/u;
const sequentialReceipt = new RegExp(String.raw`^(?:이어|뒤이어|이어서|(?:그\s*)?(?:뒤|후)(?:에)?)\s*(?:온|받은|도착한|수신한)\s*` + artifact +
  String.raw`(?=$|[\s:：]|(?:에는|에서|에|은|는|이|가)(?=\s|$))`, "u");

export function isReceivedContinuation(text) {
  return sequentialReceipt.test(text.replace(narrator, ""));
}

const relevant = /(?:겠다고|겠다는|간다고|간다는|한다고|한다는|온다고|온다는)(?:\s|$)|(?:요구|요청|(?:해야|하라|달라|넘겨야|내야|받겠|수거하겠|찾아가겠|받아\s*가겠)고|(?:하라|달라|받겠|한다)는|(?:해야|한다)고\s*(?:되어|돼|적혀|써)|(?:받는|설치|회신|전화|제출)\s*(?:조건|방식|방법|절차))/u;
const explicitSeparateNotice = /^(?:(?:그와|이와)(?:는)?\s*별개로|별건으로|(?:다른|별도의?)\s*(?:발신처|담당자|쪽지|문자|사람|기관|업체))/u;
const topicShiftOrPast = /^(?:한편|(?:예전|이전|지난번)\s*(?:에|의|에는)?(?=\s|$))/u;
const notDirected = /(?:요구|요청|안내|부탁)(?:[은는이가])?\s*(?:사실이\s*)?(?:아니|없(?:었|다))|(?:선택\s*사항|할\s*필요(?:가|는)?\s*없|(?:필수|조건|요건|의무)(?:가|이|은|는)?\s*아니|(?:제출|입력|설치|삭제|회신|연락|납부|송금|이체)\s*하지\s*(?:않|말|마)|(?:보내|적|알리|주|지우|내)지\s*(?:않|말|마)|(?:여부|유무|날짜|일정|버전)만)/u;
const sameRequestClosed = /^(?:(?:그|이|같은|해당)\s*(?:요청|요구|절차|거래)(?:[을를이가은는])?\s*)?(?:이미\s*)?(?:거절했|철회했|취소했|취소됐|종료됐|처리됐|끝냈|끝났)/u;
const reportedDenial = /(?:하라|으라)(?:고|는)\s*(?:(?:한|말한)\s*적(?:이|은)?\s*없|(?:뜻|의미|말)(?:[은는이가])?\s*아니)/u;
// Strong boundaries only. Generic topic changes do not establish a different sender.
const explicitIndependentSender = /^(?:(?:(?:그와|이와)(?:는)?\s*별개로|별건으로|또)\s+)?(?:다른|별도의?)\s+(?:발신자|발신처)(?:가|이|는|은|에게(?:서)?|한테(?:서)?)(?=\s)/u;
const earlierSender = /^(?:첫(?:\s*번째)?|처음|앞선|기존|원래|먼저\s*(?:온|연락한))\s+(?:발신자|발신처|상대|보낸\s*사람)(?:가|이|는|은)(?=\s)/u;
const otherRecipientOnly = /^(?:(?:같은|그|이|해당)\s+)?(?:발신자|발신처|상대|보낸\s*사람)(?:는|가|이|은)\s+(?:저나\s+수신자가\s+아닌\s+)?(?:다른\s+(?:참가자|사람|수신자|직원)|제\s*3\s*자)(?:에게|한테)만(?=\s)/u;
const senderWithdrew = /^(?:(?:같은|그|이|해당)\s+)?(?:발신자|발신처|상대|보낸\s*사람)(?:가|이|는|은)\s+(?:그|이|같은|해당)\s*(?:요청|요구)(?:을|를)\s*(?:이미\s*)?(?:철회|취소)\s*(?:했(?:다|습니다|어요|음)|함|하였습니다|하였다)[.!?。…]*$/u;
const endOfClause = /(?<=[.!?。…])\s+|[\r\n]+/u;

const scopedClause = new RegExp("(" + endOfClause.source + ")", "u");

// Null means there is insufficient bounded scope evidence to partition this report.
export function receivedRequestEpisodes(text) {
  const clauses = text.split(scopedClause, 24);
  if (clauses.length < 3 || clauses.length > 23) return null;
  let changed = false;
  const episodes = [];
  for (let index = 0; index < clauses.length; index += 2) {
    const text = clauses[index];
    const clause = text.trim();
    if (!clause) continue;
    const attribution = narrator.exec(clause);
    const body = clause.slice(attribution?.[0].length ?? 0);
    const separate = explicitIndependentSender.test(body) && !attribution;
    const otherRecipient = otherRecipientOnly.test(body) && relevant.test(body) && !attribution;
    const withdrawn = senderWithdrew.test(body) && !attribution;
    if (episodes.length > 1 && earlierSender.test(body)) return null;
    if (!episodes.length || separate) episodes.push([]);
    changed ||= (separate && episodes.length > 1) || otherRecipient || withdrawn;
    episodes.at(-1).push({ text, separator: clauses[index + 1] ?? "", otherRecipient, withdrawn, request: relevant.test(body) });
  }
  return changed ? episodes : null;
}

const isReceivedMessage = text => received.test(text) && !inactive.test(text);
const isInactiveRequest = text => inactive.test(text) || notDirected.test(text) || reportedDenial.test(text);
const isSeparateRequest = text => explicitSeparateNotice.test(text) || topicShiftOrPast.test(text);

const newReceipt = /^(?:(?:오늘|방금|이번에|지금)\s*)?(?:새로|별도로)\s*(?:받(?:은|았)|온|도착(?:한|했)|수신(?:한|했))/u;

function opensIndependentReceipt(text) {
  return isReceivedMessage(text) && (explicitSeparateNotice.test(text) || newReceipt.test(text));
}

const tableRow = /^\|\s*(?<field>[^|]+?)\s*\|\s*(?<value>[^|]+?)\s*\|$/u;
const tableDivider = /^\|\s*:?-{3,}:?\s*\|\s*:?-{3,}:?\s*\|$/u;

export function receivedFieldLines(text) {
  const lines = text.split(/\r?\n/u).map(line => line.trim());
  const fields = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (!line) continue;
    if (!tableRow.test(line) || !tableDivider.test(lines[index + 1] ?? "")) {
      fields.push(line);
      continue;
    }
    // 헤더와 구분선은 필드가 아니다. 한 표 안에서 두 칸이 모두 있는 행만 읽는다.
    index += 2;
    for (; index < lines.length; index++) {
      const row = tableRow.exec(lines[index]);
      if (!row || !row.groups.field.trim() || !row.groups.value.trim()) break;
      if (tableDivider.test(lines[index + 1] ?? "")) break;
      fields.push(row.groups.field + ": " + row.groups.value);
    }
    fields.push("");
    index--;
  }
  return fields;
}

function fromSameNarrator(neighbor, speaker) {
  if (!neighbor || (speaker && neighbor.speaker && speaker !== neighbor.speaker)) return "";
  return neighbor.body;
}

export function* currentReceivedRequests(text, identifiesIssuer = () => false, identifiesRequest = () => false) {
  const clauses = text.split(endOfClause).map(clause => clause.trim()).filter(Boolean);
  const reportedClauses = clauses.map(clause => {
    const attribution = narrator.exec(clause);
    return { body: clause.slice(attribution?.[0].length ?? 0), speaker: attribution?.groups.label };
  });
  for (const [i, { body, speaker }] of reportedClauses.entries()) {
    const independent = opensIndependentReceipt(body);
    const previous = independent ? "" : fromSameNarrator(reportedClauses[i - 1], speaker);
    const following = fromSameNarrator(reportedClauses[i + 1], speaker);
    const next = isSeparateRequest(following) || opensIndependentReceipt(following) ? "" : following;
    if (isInactiveRequest(body) || isInactiveRequest(previous) ||
        (isSeparateRequest(body) && !independent) || sameRequestClosed.test(next)) continue;
    const documented = (relevant.test(body) || identifiesRequest(body)) &&
      (attributed.test(body) || attributed.test(previous) || identifiesIssuer(body) || identifiesIssuer(previous));
    if (!documented && !isReceivedContinuation(body) && !isReceivedMessage(body) && !isReceivedMessage(previous)) continue;
    yield { body, previous, next };
  }
}
