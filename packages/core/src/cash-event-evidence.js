// Each match is evidence for one grammatical role. Object and receiver may appear in either order.
const cash = /(?<![\p{L}\p{N}])(?:현금|현찰)(?<case>으로|로|을|를|은|는)?(?=[\s,，.!?]|$)/gu;
const staff = /(?<![\p{L}\p{N}])(?:방문\s*수거인|방문자|수거인|수령인|직원|담당자|수사관|요원|대리인|사람)(?<case>에게|한테|이|가|은|는|을|를)?(?=이라고|이라는|입니다|이었다|[\s,，.!?]|$)/gu;
const selfCollector = /(?<![\p{L}\p{N}])(?:자기|자신|본인)(?<case>이|가)(?=[\s,，]|$)/gu;
const visit = /(?:방문(?:하는|할|해(?:서)?|하여|한|하기로)|찾아\s*(?:오는|올|와서|와|온|가서|간)|만나(?:서|는)?|(?:직접\s*)?와서|대면(?:하는|으로|해서)?)/gu;
const handoff = /(?:인계|전달|교부)하(?:라고|라는|도록)|(?:인계|전달|교부)해야|(?:넘기|건네)(?:라고|라는|라네|도록)|(?:넘겨|건네)야|(?:넘기|건네|인계하|전달하)는\s*(?:일|것)(?:이|은|는)?\s*(?:제|수신자의)?\s*(?:몫|의무)|대면\s*(?:현금|현찰)\s*(?:인계|전달|교부)(?:를|을)?\s*(?:요구|지시)|(?:건네|넘기|전달하|인계하)는\s*방식(?:으로)?\s*(?:적|기록|표시)/gu;
const pickup = /(?:수거|수령|회수)하(?:겠다고|겠다는|기로\s*했|ㄴ다고)|(?:받아|가져|거둬|거두어)\s*(?:가겠(?:다고|다는)|간(?:다고|다는))|(?:받겠|거두겠)(?:다고|다는)|(?:수거|수령|회수)하(?:는\s*(?:방식|계획)|겠습니다)|(?:방문\s*)?(?:수거|수령|회수)합니다|(?:받아|가져)\s*(?:감(?=[\s,.]|$)|가는\s*방식)/gu;
const structuredPickup = /(?:수거|수령|회수)(?:함|하는\s*방식|할\s*예정)?(?=[\s,.]|$)|(?:받아|가져)\s*(?:감(?=[\s,.]|$)|가는\s*방식)/gu;
const structuredHandoffAction = /(?:인계|전달|교부)(?=[\s,.]|$)/gu;
const speakerCashPickup = /(?:현금|현찰)(?:을|를|으로|로)\s*찾아\s*가겠(?:다고|다는)/u;
const investigatingPickup = /(?:직접\s*)?(?:넘겨받|인수하|받아\s*가)(?:는다고|는다는|겠다고|는\s*(?:절차|방식))/u;
const payerOwnsCash = /(?:제가|내가|수신자가)\s*(?:가진|보관한|준비한)|(?:제|내|수신자의)\s*(?:현금|현찰)|(?:제게서|저에게서|수신자에게서)/u;
const loanPayment = /(?:대출(?:금)?|융자(?:금)?)(?:의|을|를)?\s*(?:상환(?:금|액)?|갚을\s*(?:돈|금액))|(?:상환금|상환액)(?=[을를은는이가\s,，.!?]|$)/u;
const newSubject = /(?:다른\s*(?:직원|사람|창구|기관)|(?:제가|내가|수신자가|고객이)\s*(?:영업점|지점|창구)에\s*방문)/u;
const activeObjection = /(?:그와|이와)(?:는)?\s*별개로|한편|별건|환급|반환|돌려(?:주|받)|분실물|습득물|(?:예방|교육|훈련|예시)\s*(?:안내|자료|예시|문구|사례)|(?:영업점|지점|매장)\s*(?:에서|에)\s*(?:내|납부|결제)|(?:현금|현찰|상환금)(?:을|를|은|는|이|가)?\s*(?:납부가\s*)?(?:이미\s*)?(?:처리|납부|정산)(?:했|하였|됐|되었|가\s*끝)|(?:해야|하라|수거한다)\s*(?:하는지|하는\s*건지|할지)|(?:요구|지시|방문|수거|인계)(?:은|는|이|가|을|를)?\s*(?:이미\s*)?(?:없|아니|취소|철회|종료)|(?:요구|지시)한\s*(?:적|것)(?:은|는|이|가)?\s*(?:없|아니)|하지\s*(?:말|마|않)/u;
const competingObject = /(?:서류|영수증|증빙|동의서|물건|물품|카드|서명)(?:만을|을|를|만)(?=[\s,，]|$)/u;
const giverIsStaff = /(?<![\p{L}\p{N}])(?:직원|담당자|상대(?:방)?|발신(?:자|인)|다른\s*사람)(?:이|가|은|는)(?=[\s,，]|$)/u;
const receiverIsUser = /(?:제게|저에게|저한테|내게|나에게|수신자에게|수신자한테)(?:만)?\s*(?:직접\s*)?$/u;
const sameTransferRole = /(?:그|이|해당|같은)\s*(?:현금\s*)?(?:인계|전달|교부)(?:의)?\s*(?:수취인|수령인|받는\s*사람)(?:은|는|이|가)/u;
const samePickupRole = /(?:그|이|해당|같은)\s*(?:현금\s*)?(?:수거|회수|수령)(?:의)?\s*(?:담당자|수거인|수령인|받는\s*사람)(?:은|는|이|가)/u;
const subjectOtherThanVisitor = /(?<![\p{L}\p{N}])(?:직원|담당자|발신(?:자|인)|수신자|고객|상대|제가|내가)(?:이|가|은|는)?(?=[\s,，]|$)/u;
const explicitHandoverDenied = /(?:인계|전달|교부)하라고\s*(?:요구|지시)한\s*(?:것|바|사실)(?:이|은|는|가)?\s*(?:아니|없)|(?:인계|전달|수거|회수|방문)(?:은|는|이|가|을|를)?\s*(?:하지\s*않|하지\s*말|할\s*필요\s*없)/u;

const endOf = match => match.index + match[0].length;

function hasVisitForStaff(action, worker, visits) {
  if (/^(?:방문\s*수거인|방문자)/u.test(worker[0])) return true;
  return visits.some(movement => {
    if (endOf(movement) <= worker.index) {
      // ‘방문할 직원’에서 방문은 바로 뒤 사람의 수식어다.
      return action.slice(endOf(movement), worker.index).trim() === "";
    }
    if (endOf(worker) > movement.index) return false;
    if (/^(?:을|를)$/.test(worker.groups.case ?? "")) {
      return /만나/u.test(movement[0]) && action.slice(endOf(worker), movement.index).trim() === "";
    }
    if (!/^(?:이|가|은|는)$/.test(worker.groups.case ?? "")) return false;
    const beforeMovement = action.slice(endOf(worker), movement.index);
    return /^\s*(?:(?:직접|다시|나중에|당일에?)\s+)*(?:(?:집|댁|자택|거주지|현장)(?:에|으로|로|을|를)\s+)?$/u.test(beforeMovement);
  });
}

function handoverEvidence(action, payment, workers, visits, structuredReceiver) {
  return [...action.matchAll(handoff)].some(demand => {
    const combinedDemand = /대면\s*(?:현금|현찰)/u.test(demand[0]);
    if (!combinedDemand && !structuredReceiver && (!/^(?:을|를|만)$/.test(payment.groups.case ?? "") || endOf(payment) > demand.index)) return false;
    const beforeVerb = action.slice(0, demand.index);
    if (receiverIsUser.test(beforeVerb) || giverIsStaff.test(beforeVerb) || competingObject.test(beforeVerb)) return false;
    if (combinedDemand || structuredReceiver || /직접\s*$/u.test(beforeVerb)) return true;
    return workers.some(worker => {
      if (!hasVisitForStaff(action, worker, visits)) return false;
      if (endOf(worker) <= demand.index) return /^(?:에게|한테|을|를)$/.test(worker.groups.case ?? "");
      return sameTransferRole.test(action.slice(endOf(demand), worker.index));
    });
  });
}

function pickupEvidence(action, payment, workers, visits, { loanFromSource, sourceInClause, structuredLoan, structuredHandoff }) {
  const plans = structuredLoan ? [...action.matchAll(pickup), ...action.matchAll(structuredPickup)] : [...action.matchAll(pickup)];
  if (structuredLoan && structuredHandoff && [...action.matchAll(structuredHandoffAction)].some(handoff => workers.some(worker =>
      hasVisitForStaff(action, worker, visits) && /^(?:에게|한테)$/.test(worker.groups.case ?? "") &&
      endOf(worker) <= handoff.index && !competingObject.test(action.slice(0, handoff.index))))) return true;
  if (sourceInClause && loanPayment.test(action) && speakerCashPickup.test(action) && !competingObject.test(action)) return true;
  return plans.some(plan => {
    if (!structuredLoan && endOf(payment) > plan.index || competingObject.test(action.slice(0, plan.index))) return false;
    const actionBeforePlan = action.slice(0, plan.index);
    if (!structuredLoan && !loanPayment.test(actionBeforePlan) && !(loanFromSource && /(?:갚을|갚아야\s*할)\s*(?:금액|몫|돈)/u.test(actionBeforePlan))) return false;
    const qualifiedStaff = workers.filter(worker => hasVisitForStaff(action, worker, visits));
    if (sourceInClause && !qualifiedStaff.length && visits.some(movement =>
        endOf(movement) <= plan.index && /직접|찾아|와서/u.test(movement[0])) &&
        !giverIsStaff.test(actionBeforePlan)) return true;
    const role = samePickupRole.exec(action.slice(endOf(plan)));
    if (role) {
      const roleEnd = endOf(plan) + endOf(role);
      return qualifiedStaff.filter(worker => worker.index >= roleEnd).length === 1;
    }
    if (qualifiedStaff.length !== 1) return false;
    const [worker] = qualifiedStaff;
    return endOf(worker) <= plan.index && /^(?:이|가|은|는)$/.test(worker.groups.case ?? "") &&
      !subjectOtherThanVisitor.test(action.slice(endOf(worker), plan.index));
  });
}

export function couldDescribeCashTransaction(action) {
  return action.search(cash) >= 0 && (action.search(handoff) >= 0 || action.search(pickup) >= 0 || investigatingPickup.test(action) || speakerCashPickup.test(action));
}

export function cashEventEvidence(action, { investigative, financialStaff, loanFromSource, sourceInClause, structuredLoan = false, structuredReceiver = false, structuredHandoff = false }) {
  if (activeObjection.test(action) || explicitHandoverDenied.test(action) || newSubject.test(action)) return null;
  const payments = [...action.matchAll(cash)];
  if (payments.length !== 1) return null;
  const [payment] = payments;
  const workers = [...action.matchAll(staff)];
  const visits = [...action.matchAll(visit)];
  if (investigative && (handoverEvidence(action, payment, workers, visits, structuredReceiver) ||
      payerOwnsCash.test(action) && investigatingPickup.test(action) && !competingObject.test(action) &&
      (workers.some(worker => /^(?:이|가)$/.test(worker.groups.case ?? "")) || sourceInClause && visits.length))) {
    return "investigative_handover";
  }
  if (financialStaff) {
    const collectors = sourceInClause ? [...workers, ...action.matchAll(selfCollector)] : workers;
    if (pickupEvidence(action, payment, collectors, visits, { loanFromSource, sourceInClause, structuredLoan, structuredHandoff })) return "staff_loan_pickup";
  }
  return null;
}
