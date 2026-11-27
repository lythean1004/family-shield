import { currentReceivedRequests } from "./received-message.js";

const pickupStatusSubject = /^(?:(?<sender>(?:발신자|발신인|상대(?:방)?|보낸\s*사람)(?:가|이|는|은))\s*)?(?:그|이|해당|같은)\s*(?:현금\s*)?(?<event>방문\s*(?:수거|회수)|수거|회수|방문)(?:\s*(?:계획|일정|요청|절차))?(?:은|는|이|가|을|를)?(?=\s|$)\s*/u;
const pickupStatusPreface = /^(?:(?:이후|재차|최종적으로|다만|그리고)\s*){0,2}/u;
const pickupCancellationVerb = /^(?:취소|철회|중단)\s*/u;
const finalCancellation = /^(?:(?:처리\s*)?(?:(?:했|하였|됐|되었)(?:습니다|어요|다|음)|함|됨)|완료(?:됐습니다|되었습니다|됐다|되었다|됨)?|된\s*것으로\s*확인(?:됐습니다|되었습니다|됐다|되었다|됨))[.!。]?$/u;
const pendingCancellation = /^(?:(?:되지|하지)\s*않았(?:다|습니다|음)|(?:를|을|여부를)?\s*검토\s*중(?:이다|입니다|임)|될\s*수(?:도)?\s*있(?:다|습니다|음))[.!。]?$/u;
const resumedPickup = /^(?:재개(?:(?:됐|되었|했|하였)(?:다|습니다|음)|됨|함)|유효(?:하다|합니다|함|한\s*상태(?:다|이다|입니다|임|로\s*확인(?:됐다|되었다|했다)))|진행\s*중(?:이다|입니다|임))[.!。]?$/u;
const otherActor = /^(?:다른|별도(?:의)?|별개(?:의)?)\s*(?:발신자|발신인|사람|상대(?:방)?|담당자|직원)(?:가|이|는|은|의)\s*/u;
const otherPlan = /^(?:별도(?:의)?|다른|별개(?:의)?)\s*(?:방문\s*(?:수거|회수)|방문|수거|회수)(?:\s*(?:계획|일정|요청|절차))?(?:은|는|이|가|을|를)\s*/u;
const otherWork = /^(?:(?:(?:그|이|해당|같은|별도(?:의)?|별개(?:의)?|다른)\s*)|(?:발신자|담당자)의\s*){0,2}(?:상담|문의|업무|서류\s*(?:정리|확인))(?:은|는|이|가|을|를)\s*(?:이미\s*)?(?:완료|종료|보류|중단)(?:(?:됐|되었|했|하였)(?:다|습니다|음)|됨|함)[.!。]?$/u;
const visitReference = /방문(?:해|하여|하[고는겠였]|했|할|을|\s)|찾아\s*(?:오|와|온|가|간)|댁\s*(?:에|으로)?\s*방문/gu;

function readPickupStatus(note) {
  const statement = note.trim().replace(pickupStatusPreface, "");
  const subject = pickupStatusSubject.exec(statement);
  if (!subject) return null;
  const event = subject.groups.event === "방문" ? "visit" : /^방문/u.test(subject.groups.event) ? "combined" : "collection";
  const predicate = statement.slice(subject[0].length).replace(/^(?:(?:다시|현재|이미)\s*){0,2}/u, "");
  return { event, predicate, sender: subject.groups.sender };
}

const startsPickupStatus = note => Boolean(readPickupStatus(note));

function confirmedPickupStatus(status) {
  const { predicate, sender } = status;
  const verb = pickupCancellationVerb.exec(predicate);
  if (verb) {
    const outcome = predicate.slice(verb[0].length);
    if (finalCancellation.test(outcome) || sender && /^한다[.!。]?$/u.test(outcome)) return "closed";
    if (pendingCancellation.test(outcome)) return "pending";
  }
  if (resumedPickup.test(predicate)) return "active";
  return "unresolved";
}

export function reportedPickupPlanStatus(clause, notes = [], requireConfirmedStatus = false) {
  let status;
  let initialEvent;
  for (const [index, note] of [clause, ...notes].join(",").split(/[,，]/u).entries()) {
    const update = readPickupStatus(note);
    if (!update) {
      if (requireConfirmedStatus) return "unresolved";
      break;
    }
    const { event, predicate } = update;
    initialEvent ??= event;
    if (event !== initialEvent && event !== "combined" && initialEvent !== "combined") {
      if (requireConfirmedStatus) return "unresolved";
      break;
    }
    const outcome = confirmedPickupStatus(update);
    if (outcome === "closed") status = "closed";
    else if ((outcome === "pending" && index === 0) || (outcome === "active" && (status || requireConfirmedStatus))) status = "active";
    else if (requireConfirmedStatus) return "unresolved";
    else if (!/^(?:취소|철회|중단|재개|유효|진행)/u.test(predicate)) break;
    // 수거 상태를 만난 적이 없거나 화제가 바뀌면 뒤의 지시어까지 연결하지 않는다.
    if (!status) break;
  }
  return status ?? (requireConfirmedStatus ? "unresolved" : "active");
}

export function isOtherPickupStatus(note) {
  const statement = note.trim().replace(pickupStatusPreface, "");
  if (otherWork.test(statement)) return true;
  const other = otherActor.exec(statement);
  const otherSubject = otherPlan.exec(statement);
  const afterActor = other ? statement.slice(other[0].length) : "";
  const status = other ? readPickupStatus(afterActor) ?? readPickupStatus("그 " + afterActor) :
    otherSubject ? { predicate: statement.slice(otherSubject[0].length), sender: true } : null;
  return Boolean(status && confirmedPickupStatus(status) !== "unresolved");
}

const clauseBoundaries = /((?<=[.!?。…])\s+|[\r\n]+)/u;
const inlineBoundaries = /([,，;；])/u;
const statusPredicate = /^(?:취소|철회|중단|재개|유효|진행)/u;

function isInlinePickupStatus(note) {
  const status = readPickupStatus(note);
  return status ? statusPredicate.test(status.predicate) : isOtherPickupStatus(note);
}

function separatedPickupStatus(clause) {
  const parts = clause.split(inlineBoundaries);
  const index = parts.findIndex((part, index) => index > 0 && index % 2 === 0 && isInlinePickupStatus(part));
  if (index < 0 || !parts.slice(index).every((part, index) => index % 2 || isInlinePickupStatus(part))) return clause;
  const report = parts.slice(0, index - 1).join("").trimEnd();
  // 두 방문을 구별할 수 없는 문장에서는 어느 쪽도 취소하지 않는다.
  if ([...report.matchAll(visitReference)].length !== 1) return clause;
  return [report, ...parts.slice(index).filter((_, i) => i % 2 === 0).map(part => part.trim())].join(". ");
}

export function* currentPickupRequests(text, identifiesIssuer, identifiesRequest, needsReceiptRemainder) {
  for (const record of text.split(/\r?\n[ \t]*\r?\n/u)) {
    const clauses = record.split(clauseBoundaries).map((part, i) => i % 2 ? part : separatedPickupStatus(part));
    for (const frame of currentReceivedRequests(clauses.join(""), identifiesIssuer, identifiesRequest, startsPickupStatus, needsReceiptRemainder)) {
      const multipleVisits = [...frame.body.matchAll(visitReference)].length > 1;
      yield { ...frame, pickupStatus: multipleVisits ? "active" : reportedPickupPlanStatus(frame.next, frame.statusNotes) };
    }
  }
}
