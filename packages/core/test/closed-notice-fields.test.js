import assert from "node:assert/strict";
import test from "node:test";
import { analyze } from "../src/pipeline.js";
import { addReportedNoticeFields } from "../src/reported-notice-fields.js";
import { SIG_APP_INSTALL, SIG_CALL_THIS_NUMBER } from "../src/signals.js";

const closed = [
  ["the installation request was refused in the same sentence", "구청에서 보낸 안내를 읽었습니다. 개인 기기에 외부 프로그램 설치가 필요하다는 내용은 어제 거절했습니다. 답장은 접수 종료 확인이었습니다."],
  ["the next sentence explicitly rejects the same request", "교육 기관에서 보낸 회신입니다. 별도 앱 설치가 열람 요건이라고 적혀 있었어요. 그 요청은 제가 이미 거절했습니다."],
  ["a rejected condition is followed by a new optional instruction", "교육 기관에서 보낸 답장을 받았어요. 별도 앱 설치가 신청 요건이라는 요구를 거절했지만, 이번 새 통지에는 별도 앱 설치가 필수가 아니라고 적혀 있습니다."],
  ["the next sentence closes the reception tied to the same notice", "공단 명의로 온 답신을 보았어요. 별도 프로그램 설치가 접수 요건이라고 써 있었습니다. 해당 접수는 종료됐다는 확인만 받았습니다."],
  ["closing the reception also prevents the independent institutional summary", "공공기관이라고 표시된 메시지를 받았습니다. 수신자의 개인 기기에 외부 프로그램 설치가 필요하다고 요구한 대목만 기록했습니다. 그 접수는 종결됐다는 확인이 왔습니다."],
];

const current = [
  ["the notice still contains a current installation requirement", "구청에서 보낸 문서를 받았어요. 별도 앱 설치가 신청 요건이라고 써 있었습니다."],
  ["a current requirement explicitly repeated after a rejected request in the same sentence", "교육 기관에서 보낸 답장을 받았어요. 별도 앱 설치가 신청 요건이라는 요구를 거절했지만, 이번 새 통지에도 별도 앱 설치가 신청 요건이라는 내용이 적혀 있습니다."],
  ["a previous refusal does not close a new notice", "지난주에 앞선 문의를 거절했습니다. 오늘 공단에서 보낸 새 안내문을 받았어요. 별도 프로그램 설치가 열람 요건이라고 적혀 있습니다."],
  ["a new sender can issue a current requirement after the previous reception closed", "공단 명의로 온 답신을 보았어요. 별도 프로그램 설치가 접수 요건이라고 써 있었습니다. 해당 접수는 종료됐다는 확인만 받았습니다. 관공서에서 보낸 새 공지를 받았어요. 별도 앱 설치가 신청 요건이라고 표시돼 있었습니다."],
  ["a nearby refusal of an unrelated application leaves the present request open", "관공서 명의로 온 답장입니다. 외부 앱 설치가 접수 요건이라고 적혀 있어요. 작년의 별개 문의를 이미 거절했습니다."],
  ["a later receipt text about last year's application does not close the current request", "공공기관이라고 표시된 메시지를 받았습니다. 수신자의 개인 기기에 외부 프로그램 설치가 필요하다고 요구한 대목만 기록했습니다. 예전의 별개 접수는 종결됐다는 확인이 왔습니다."],
];

for (const [cases, expected] of [[closed, false], [current, true]]) {
  for (const [name, text] of cases) {
    test(name, async () => {
      const verdict = await analyze({ text, ai: null });
      assert.equal(verdict.fired_rules.includes("R6"), expected);
    });
  }
}

// 기관 수신 요약의 독립 경로와 별개로 이 모듈이 같은 접수의 종결을 처리하는지 확인한다.
test("the reported notice module ignores a closed application even with a direct sender claim", () => {
  const text = "공단 명의로 온 답신을 보았어요. 별도 프로그램 설치가 접수 요건이라고 써 있었습니다. 해당 접수는 종료됐다는 확인만 받았습니다.";
  const signals = new Set();
  addReportedNoticeFields(text, signals);
  assert.ok(!signals.has(SIG_APP_INSTALL));
});

test("rejecting installation leaves a separate callback requirement in the same notice", () => {
  const text = "교육 기관에서 보낸 회신을 받았습니다. 별도 앱 설치가 열람 요건이라는 요구는 어제 거절했고, 그 본문에 적힌 전용 번호로만 전화해야 한다는 설명도 있었어요.";
  const signals = new Set();
  addReportedNoticeFields(text, signals);
  assert.ok(!signals.has(SIG_APP_INSTALL));
  assert.ok(signals.has(SIG_CALL_THIS_NUMBER));
});
