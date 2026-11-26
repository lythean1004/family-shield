// 승인된 합성 평가의 저장·표본 추출 시험용. 모든 모델 호출을 메모리에서 처리한다.
let sequence = 0;
globalThis.fetch = async (url) => {
  if (url !== "https://fixture.invalid/model") throw new Error("예상하지 않은 시험 호출");
  const index = sequence++ % 3;
  const signals = [[], ["SIG_PERSONAL_INFO"], ["SIG_PREPAYMENT"]][index];
  const phrases = ["보낸 곳을 직접 확인해 보세요.", "정보를 묻는 부분을 살펴보세요.", "비용을 먼저 내라는 내용이 있어요."];
  const args = { signals, impersonation_type: "none", evidence_card_ids: [],
    explanation_for_parent: [phrases[index], "이상이 없어요."] };
  return Response.json({ model: "synthetic-mock", choices: [{ finish_reason: "tool_calls",
    message: { tool_calls: [{ function: { name: "report_signals", arguments: JSON.stringify(args) } }] } }] });
};
