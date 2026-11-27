const artifact = "(?:문자|메시지|연락|안내(?:문)?|쪽지|통지(?:문)?|고지(?:문)?|알림|회신|답장|답신|요청서|채팅)";
const arrived = "(?:받았|받은|받아\\s*(?:확인|기록)|왔|도착|수신|전달받|저장해\\s*둔)";
const received = new RegExp(artifact + "(?:[을를이가은는])?\\s*(?:[^.!?\\n]{0,20}\\s+)?" + arrived +
  "|" + arrived + "[^.!?\\n]{0,12}" + artifact, "u");
const inactive = /(?:사기|피싱|사칭|피해)\s*(?:예방|사례|교육)|(?:교육|훈련|수업|예시|예방|가상|모의)\s*(?:용|자료|사례|문구|대본|기록|수업)|(?:연극|역할극|극본|대본|낭독극)|(?:요청|요구|절차|업무|처리)(?:를|을|은|는|이|가)?\s*(?:이미\s*)?(?:취소|철회|거절|종료|완료)|(?:이미\s*)?(?:거절했|철회했|취소했|처리됐|끝냈)|(?:요구한|부탁한|말한|받은|보낸)\s*적(?:이|은)?\s*없/u;
const attributed = /(?:발신(?:자|처|\s*표시|\s*이름)|보낸\s*(?:곳|이)|발행처|(?:상대|발신자|발신처|담당자|직원)(?:가|이)\s*(?:보낸|관리하는|운영하는)\s*[^,.!?\n]{0,14}(?:양식|서식|폼)|(?:같은|그|이|해당)\s*(?:문자|메시지|채팅|통지|알림|안내문)|(?:문자|메시지|채팅|통지|알림|안내문)(?:에|에는)\s*(?:적혀|실린|표시|들어\s*있)|(?:발신|수신)\s*(?:내용|기록))/u;
const relevant = /(?:겠다고|겠다는|간다고|간다는|한다고|한다는|온다고|온다는)(?:\s|$)|(?:요구|요청|(?:해야|하라|달라|넘겨야|내야|받겠|수거하겠|찾아가겠|받아\s*가겠)고|(?:하라|달라|받겠|한다)는|(?:해야|한다)고\s*(?:되어|돼|적혀|써)|(?:받는|설치|회신|전화|제출)\s*(?:조건|방식|방법|절차))/u;
const unrelated = /^(?:(?:그와|이와)\s*별개로|한편|별건으로|(?:다른|별도의?)\s*(?:발신처|담당자|쪽지|문자|사람|기관|업체)|(?:예전|이전|지난번)\s*(?:에|의|에는)?(?=\s|$))/u;
const notDirected = /(?:요구|요청|안내|부탁)(?:[은는이가])?\s*(?:사실이\s*)?(?:아니|없(?:었|다))|(?:선택\s*사항|할\s*필요(?:가|는)?\s*없|(?:필수|조건|요건|의무)(?:가|이|은|는)?\s*아니|(?:제출|입력|설치|삭제|회신|연락|납부|송금|이체)\s*하지\s*(?:않|말|마)|(?:보내|적|알리|주|지우|내)지\s*(?:않|말|마)|(?:여부|유무|날짜|일정|버전)만)/u;
const sameRequestClosed = /^(?:(?:그|이|같은|해당)\s*(?:요청|요구|절차|거래)(?:[을를이가은는])?\s*)?(?:이미\s*)?(?:거절했|철회했|취소했|취소됐|종료됐|처리됐|끝냈|끝났)/u;
const endOfClause = /(?<=[.!?。…])\s+|[\r\n]+/u;

const isReceivedMessage = text => received.test(text) && !inactive.test(text);
const isInactiveRequest = text => inactive.test(text) || notDirected.test(text);
const isSeparateRequest = text => unrelated.test(text);

export function* currentReceivedRequests(text) {
  const clauses = text.split(endOfClause).map(clause => clause.trim()).filter(Boolean);
  for (const [i, body] of clauses.entries()) {
    const previous = clauses[i - 1] ?? "";
    const next = clauses[i + 1] ?? "";
    if (isInactiveRequest(body) || isInactiveRequest(previous) || isSeparateRequest(body) || sameRequestClosed.test(next)) continue;
    const documented = relevant.test(body) && (attributed.test(body) || attributed.test(previous));
    if (!documented && !isReceivedMessage(body) && !isReceivedMessage(previous)) continue;
    yield { body, previous, next };
  }
}
