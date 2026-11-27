import assert from "node:assert/strict";
import { test } from "node:test";
import { analyze } from "../src/pipeline.js";

const levy = "저에게 연락한 사람이 과징금 징수 담당을 자처했습니다.";
const installation = "검토용 기록에는 프로그램을 별도로 설치하라는 지시가 표시돼 있습니다.";

for (const [name, text, rule, signal] of [
  ["수신자에게 자칭한 담당자와 같은 연락의 설치 요구", levy + " " + installation, "R6", "SIG_APP_INSTALL"],
  ["담당자 소개 다음 문장에 실린 수신자의 설치 요구", "수신자에게 연락한 사람은 범칙금 납부 담당자라고 말했습니다. 그 메시지의 분류용 요약에는 지원 프로그램을 추가로 설치하라는 요구가 들어 있습니다.", "R6", "SIG_APP_INSTALL"],
  ["선납을 해야 문서 진위를 확인할 수 있다는 요구", "검토표에는 납부 뒤에 문서 진위 확인을 시작한다는 순서와 사전 결제 요구가 적혀 있습니다.", "R9", "SIG_PREPAYMENT"],
]) test(name, async () => {
  const result = await analyze({ text });
  assert.equal(result.level, "위험");
  assert.ok(result.fired_rules.includes(rule));
  assert.ok(result.signals_code.includes(signal));
});

for (const [name, text] of [
  ["직원 기기에만 해당하는 공지", levy + " 업무용 기기에만 프로그램을 별도로 설치하라는 직원 공지라고 합니다."],
  ["같은 설치 접수 종료", levy + " " + installation + " 해당 접수는 이미 종료됐습니다."],
  ["종료된 납부 영수증", "방문 기록에 납부한 뒤 본인 확인을 받고, 납부 내역만 출력했다고 적었습니다."],
  ["다른 거래의 선납 기록", "납부한 후 신청자의 신원을 확인했습니다. 그와는 별개로 다른 거래의 선입금 요구는 연구 자료에서 읽었습니다."],
  ["발신자가 자기 기기에 한 설치", levy + " 담당자가 자기 기기에 별도 프로그램을 설치한 내역을 알려 왔습니다."],
  ["수신자와 다른 사람에게 배정한 설치", levy + " 자원봉사자에게 프로그램을 별도로 설치하라는 지시도 있었답니다. 저는 전시 안내도만 받았습니다."],
  ["게시가 종료되어 전시 중인 과거 공지", "박물관이 보관한 옛날 안내문을 읽었습니다. 납부 이후 문서 진위 확인을 조건으로 하는 사전 결제 요구가 적혀 있었지만 지금은 안내를 종료했습니다."],
]) test(name, async () => {
  assert.notEqual((await analyze({ text })).level, "위험");
});
