import { currentReceivedRequests } from "./received-message.js";

const incomingRecord = /(?<![\p{L}\p{N}])(?:온|받은|도착한|수신한|전달받은)\s+(?:채팅|문자|메시지|안내문?|답장|답신|회신|쪽지|연락|통지문?)(?:에서|에는|에)(?=\s|$)\s*/u;
const independentContext = /(?:교육|예시|가상|훈련|연습|역할극|대본|각본|옮겨\s*들은|전해\s*들은|지난달|작년|과거|별개로|한편|다른\s*(?:상담|발신자|수신자|사람))(?:\s|[은는이가을를의]|$)/u;
const receiverOfRecord = /(?:^|[\s,，])(?<actor>[가-힣]+?)(?:가|이|은|는)\s*(?:(?:먼저|직접|별도로|방금|이전에)\s+)?$/u;
const currentReceiver = /^(?:저|나|제|내|수신자|수신인|신고인|신고자)$/u;
const reportedPurpose = /^(?:(?:거래|상담|접수|확인|처리|신청|예약|등록|답변|참여|업무|진행|절차)(?:을|를)?\s*(?:계속|이어|진행|재개|마무리|이용|완료|확정)(?:하)?려면|(?:상담|확인|신청|답변|접수)(?:을|를)?\s*(?:진행받|받|하|이어가)으?려면)\s*[,，]?\s*/u;
const recipient = "(?:제가|내가|수신자가|수신인은|수신자는|저에게|제게|나에게|수신자에게|수신인에게)";
const device = "(?:휴대전화|휴대폰|폰|단말기|기기|컴퓨터)";
const clearRecipient = new RegExp(
  "^(?:(?:상대(?:방)?|담당자|발신자)(?:가|이|은|는)\\s+(?=" + recipient + "(?=\\s)))?(?:" +
  recipient + "\\s+(?:(?:내|제|자기|수신자의)\\s*" + device + "(?:에|에서)\\s+)?|" +
  "(?:내|제|수신자의)\\s*" + device + "(?:에|에서)\\s+)?", "u",
);
const recordedInstallation = /^(?:(?:새|별도(?:의)?|추가|지정된)\s*)?(?:앱|어플(?:리케이션)?|프로그램|소프트웨어)(?:을|를)?\s*설치하라는\s*(?:요구|요청|지시|안내)(?:가|이)\s*(?:(?:들어|담겨|적혀|쓰여)\s*)?있었(?:습니다|어요|다|음)(?:[.!。]|$)\s*$/u;
const installationWithdrawn = /^(?:(?:발신자|상대(?:방)?|보낸\s*사람)(?:가|이|는|은)\s+)?(?:(?:그|같은|해당|이)\s*)?설치\s*(?:요구|요청|지시|조건)(?:은|는|이|가|을|를)?\s*(?:이미\s*|이후에?\s*)?(?:철회|취소|종료)/u;

function requirementInReceivedRecord(text) {
  const source = incomingRecord.exec(text);
  if (!source) return false;
  const context = text.slice(0, source.index);
  const receiver = receiverOfRecord.exec(context)?.groups.actor;
  if (independentContext.test(context) || (receiver && !currentReceiver.test(receiver))) return false;
  // 수신문 뒤에 이어지는 같은 설치 요구를 확인한다. 통화 이력이나 발신자 신원은 여기서 추론하지 않는다.
  const requires = text.slice(source.index + source[0].length).replace(reportedPurpose, "");
  return recordedInstallation.test(requires.replace(clearRecipient, ""));
}

export function reportsReceivedInstallation(text) {
  if (!text.includes("설치하라는")) return false;
  for (const passage of text.split(/\r?\n[ \t]*\r?\n/u)) {
    for (const { body, next } of currentReceivedRequests(passage, clause => incomingRecord.test(clause), requirementInReceivedRecord)) {
      if (requirementInReceivedRecord(body) && !installationWithdrawn.test(next)) return true;
    }
  }
  return false;
}
