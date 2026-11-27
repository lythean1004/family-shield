import assert from "node:assert/strict";
import test from "node:test";
import { analyze } from "../src/pipeline.js";

const header = "받은 신청 양식의 항목을 정리한 메모";
const purpose = "신청 구분 | 구직 지원금";
const pair = "필수 첨부 서류 | 운전면허증 사본 및 지급받을 통장 사본";
const destination = "제출 페이지 | https://intake.invalid/submit";
const password = "필수 입력 항목 | 통장 접속 암호";
const level = async (...fields) => analyze({ text: fields.join("\n"), ai: null });

test("지원 신청서에서 같은 창구에 내도록 지정한 두 서류를 찾는다", async () => {
  for (const fields of [
    [header, purpose, pair, destination],
    [header, destination, purpose, "신분 확인 서류와 통장 자료를 함께 첨부하라는 요구가 적혔다."],
    [header, purpose, destination, pair],
  ]) assert.ok((await level(...fields)).fired_rules.includes("R17"));
});

test("제출 주소와 필수 입력값은 같은 양식에서 순서와 무관하게 연결된다", async () => {
  for (const fields of [
    [header, password, destination],
    [header, destination, "양식이 요구한 값은 금융 계좌 비밀번호에 해당합니다."],
    [header, destination, "입력해야 할 값 | 복구 문구"],
  ]) assert.ok((await level(...fields)).fired_rules.includes("R16"));
});

for (const [name, fields] of [
  ["접수 주소가 생략된 자료", [header, purpose, pair]],
  ["별도 행사의 주소", [header, purpose, pair, "별개 행사 안내", destination]],
  ["선택 자료", [header, purpose, "선택 첨부 | 신분증 사본과 통장 사본", destination]],
  ["예방 교육의 가상 신청서", ["예방 교육 자료에서 받은 신청 양식", purpose, pair, destination]],
  ["신분증 제출 여부만 회신", [header, purpose, "필수 항목 | 신분증 사본 제출 여부와 통장 사본 발급일", destination]],
  ["공식 양식과 참고 링크", [header, purpose, pair, "접수 주소 | https://www.gov.kr/", "참고 자료 | https://extra.invalid/schedule"]],
  ["서로 다른 양식", [header, password, "받은 별도 신청 양식", destination]],
  ["암호 재설정 날짜", [header, destination, "필수 입력 항목 | 통장 접속 암호의 변경 일자"]],
  ["출처가 다른 제출처 두 곳", [header, password, destination, "접수 주소 | https://www.gov.kr/"]],
  ["종료된 그 제출 요구", [header, purpose, pair, destination, "해당 제출 요구는 이미 철회했습니다."]],
  ["지원금은 다른 참여자의 결제 수단", [header, "신청 구분 | 동창회 식사", pair, destination, "참가자 메모 | 다른 참가자는 지원금으로 식사비를 냈습니다."]],
  ["양식의 금지 항목", [header, destination, password, "해당 암호는 이 양식에 입력하지 말라고 명시돼 있다."]],
  ["보관한 옛 서식", ["지난해 받은 신청 양식의 전시 사본", purpose, pair, destination, "현재는 이 양식을 사용하지 않습니다."]],
]) test(name, async () => {
  const result = await level(...fields);
  assert.ok(!result.fired_rules.includes("R16") && !result.fired_rules.includes("R17"));
});
