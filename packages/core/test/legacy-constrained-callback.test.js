import assert from "node:assert/strict";
import test from "node:test";
import { analyze } from "../src/pipeline.js";
import { classifyCallback } from "../src/callback-number.js";
import { OFFICIAL_DOMAIN_CARDS } from "../src/lookalike.js";

const testNumber = "000-0000-0000";
const knownNumber = OFFICIAL_DOMAIN_CARDS.find(card => card.status === "source_checked" &&
  card.callback_contact?.numbers.some(number => number.replace(/\D/g, "").length >= 8))
  .callback_contact.numbers.find(number => number.replace(/\D/g, "").length >= 8);

const active = [
  ["a received field designates one contact as the only appeal channel", `수신 요약의 이의신청 상담: ${testNumber} 해당 번호로만 가능하다고 기록돼 있습니다.`],
  ["a received field restricts review to its named phone destination", `접수 문의 ${testNumber} 번호로만 처리된다는 설명을 받았어요.`],
  ["a fragment records an explicit enforcement measure without a verb", `수신 표의 항목은 ${testNumber}으로 연락이 없을 경우: 법적 조치`],
  ["a received record ties a consequence to no response at the specified number", `수신 기록의 회신 항목: ${testNumber}으로 기한 내 회신이 없으면 법적 조치를 한다고 적혀 있었습니다.`],
];

const controls = [
  ["a verified destination is still exempt", `회신 항목: ${knownNumber}으로 기한 내 회신이 없으면 법적 조치를 한다고 표시돼 있습니다.`],
  ["a verified sole contact remains exempt", `상담: ${knownNumber} 해당 번호로만 가능하다고 기록돼 있습니다.`],
  ["ordinary availability is a time limit", `업무 문의 ${testNumber} 평일에만 가능하다고 안내돼 있습니다.`],
  ["the only available type is phone service, with no designated exclusive number", `상담: ${testNumber} 전화 상담으로만 가능하며 다른 번호로도 연결됩니다.`],
  ["an ordinary deadline is separate from a review of legal topics", `회신 항목 ${testNumber}으로 기한 내 연락이 없으면 먼저 새 일정을 확인하며, 다른 안건에는 법적 조치 검토 여부가 적혀 있습니다.`],
  ["an ordinary deadline gives no penalty", `문서의 회신 항목 ${testNumber}으로 오늘까지 회신이 없으면 처리에 시간이 걸린다는 설명이었습니다.`],
  ["a labelled contact appears as a signature only", `확인서에 업무 담당자 연락처: ${testNumber}이 적혀 있습니다.`],
  ["the routing statement was rejected", `상담 ${testNumber} 해당 번호로만 가능하다는 요청은 제가 이미 거절했습니다.`],
  ["an earlier requirement was explicitly cancelled", `수신 요약의 상담 ${testNumber} 해당 번호로만 가능하다고 했었어요. 그 요청은 철회됐다고 새 연락이 왔습니다.`],
  ["the sentence is part of training", `피싱 예방 교육 예시입니다. 상담 ${testNumber} 해당 번호로만 가능이라는 문구와 대응을 비교했습니다.`],
  ["a denial of the exclusive route is not a requirement", `상담 ${testNumber} 해당 번호로만 가능한 것이 아니라고 적혀 있습니다.`],
];

for (const [cases, directed] of [[active, true], [controls, false]]) {
  for (const [label, text] of cases) {
    test(label, () => {
      const result = classifyCallback(text, []);
      assert.equal(result.directed, directed);
      assert.equal(result.signal, directed);
    });
  }
}

const inactive = [
  ["archived exhibit material no longer designates the current contact", `[세무서] 보관한 전시물입니다. 당시 상담은 ${testNumber} 번호로만 가능했다고 옛 기록을 덧붙였습니다. 그 창구는 작년에 폐쇄됐습니다.`],
  ["an earlier statement was rejected in passive voice", `[경찰청] 당시 상담은 ${testNumber} 번호로만 가능했다는 요청은 거절됐습니다.`],
  ["a teaching comparison uses a different actual channel", `[국세청] 기관 전화번호 비교 연습입니다. 문의 ${testNumber} 번호로만 가능하다는 예를 읽고, 실제 문의는 대표 누리집으로 했습니다.`],
  ["the institution denies actually proceeding with the measure", `[세무서] 차례가 지나도 ${testNumber}로 연락이 없으면 법적 조치를 진행하는 일은 없다고 안내했습니다.`],
  ["access used to be limited and now has another channel", `[경찰청] 지난달 상담은 ${testNumber} 번호로만 가능했습니다. 지금은 공식 누리집도 열렸습니다.`],
  ["the comparison belongs to another sender or meeting", `[국세청] 운영 시간이 변경됐습니다. 그와 별개로 동아리 문의는 ${testNumber} 번호로만 가능한 이유를 회의에서 설명했어요.`],
];

for (const [label, text] of inactive) {
  test(label, async () => {
    assert.equal(classifyCallback(text, []).directed, false);
    assert.ok(!(await analyze({ text, ai: null })).fired_rules.includes("R6"));
  });
}
