import assert from "node:assert/strict";
import test from "node:test";
import { extractCodeSignals } from "../src/extract.js";
import { decide } from "../src/rule-engine.js";
import { SIG_AGENCY_IMPERSONATION, SIG_APP_INSTALL } from "../src/signals.js";

const heading = "받은 알림 기록";
const bank = "발신자: 은행";
const namedIssuer = "발신자: 국세청";
const action = "요청 항목: 원격 지원 프로그램 설치";
const attachedReceiver = ["설치 담당: 수신자", "설치 대상: 개인 기기"];
const attachedStaff = ["설치 담당: 전산팀 직원", "설치 대상: 은행 업무용 기기"];

const record = (...rows) => [heading, ...rows].join("\n");
const table = (...rows) => ["| 항목 | 내용 |", "| --- | --- |",
  ...rows.map(row => "| " + row.replace(": ", " | ") + " |"),
].join("\n");

function result(input) {
  const { signals } = extractCodeSignals(input);
  const { level, fired_rules } = decide({ signals_final: signals, signals_code: signals });
  return { agency: signals.includes(SIG_AGENCY_IMPERSONATION), installation: signals.includes(SIG_APP_INSTALL), level, fired_rules };
}

const danger = { agency: true, installation: true, level: "위험", fired_rules: ["R6"] };
const check = { agency: false, installation: false, level: "확인필요", fired_rules: ["R8"] };
const checkWithExistingInstallation = { ...check, installation: true };

for (const [name, input, expectation] of [
  ["keeps a previously covered report with the action immediately after the generic issuer", record(bank, action), danger],
  ["does not extend the legacy actorless rule to a newly recognized field name", record(bank, "필수 설치 항목: 원격 지원 프로그램 설치"), check],
  ["keeps informational metadata in the same record without binding it as an action", record(bank, action, "수신 시각: 오전", ...attachedStaff), check],
  ["같은 기록의 보관 메모 다음에 적힌 실제 설치 담당자를 확인한다", record(bank, action, "보관 분류: 문헌 참고용", ...attachedStaff), check],
  ["중간에 용지 종류가 있어도 뒤에 명시한 철회 상태를 읽는다", record(bank, action, "용지 종류: 문서 사본", "설치 상태: 철회"), check],
  ["새 기록 표제 뒤의 요청을 이전 발신자에게 붙이지 않는다", record(bank, "별도 문서: 독서 모임", ...attachedReceiver, action), check],
  ["binds the recipient to the same reported action when the action comes before the actor", record(bank, action, ...attachedReceiver), danger],
  ["binds the recipient when the actor comes before the action", record(bank, ...attachedReceiver, action), danger],
  ["reads an exact registered issuer name as an asserted role", record(namedIssuer, ...attachedReceiver, action, "설치 필수 여부: 필수"), danger],
  ["recognizes the same recipient action after a Markdown heading and blank line", record("", table(namedIssuer, ...attachedReceiver, action)), danger],
  ["permits a still-pending request with an explicit record status", record(bank, action, ...attachedReceiver, "설치 상태: 미설치"), danger],
  ["keeps staff installation outside R6 when actor and equipment follow the requested item", record(bank, action, ...attachedStaff), check],
  ["keeps staff installation outside R6 when actor and equipment precede the requested item", record(bank, ...attachedStaff, action), check],
  ["does not treat an absent device field as evidence that the recipient's own equipment was targeted", record(bank, action, attachedReceiver[0]), check],
  ["does not treat a recipient field alone as evidence that the recipient performs the action", record(bank, action, attachedReceiver[1]), check],
  ["does not accept an empty actor field as permission to infer the actor", record(bank, action, "설치 담당: ", attachedReceiver[1]), check],
  ["leaves conflicting actor fields unresolved", record(bank, action, ...attachedReceiver, attachedStaff[0]), check],
  ["leaves two different action fields unresolved and preserves the other installation detector", record(bank, action, "해야 할 일: 기존 시스템 안내 확인", ...attachedReceiver), checkWithExistingInstallation],
  ["keeps a previously covered actorless installation separate from status marked optional", record(bank, action, "설치 필수 여부: 선택 사항"), check],
  ["does not treat a conditional or unknown necessity field as a requirement", record(bank, action, ...attachedReceiver, "설치 필수 여부: 미정"), check],
  ["excludes a completed installation", record(bank, action, ...attachedReceiver, "설치 상태: 완료"), check],
  ["excludes a withdrawn request", record(bank, action, ...attachedReceiver, "요청 상태: 철회"), check],
  ["excludes checking an installation or seeing instructions about it", record(bank, "요청 항목: 원격 지원 프로그램 설치 방법 확인", ...attachedReceiver), check],
  ["does not treat the installation or official-route alternatives as a single required action", record(bank, "요청 항목: 원격 지원 프로그램 설치 또는 기존 경로 확인", ...attachedReceiver), check],
  ["excludes an explicitly negated requirement", record(bank, "요청 항목: 원격 지원 프로그램 설치 필요 없음", ...attachedReceiver), check],
  ["keeps an ordinary notice using an already-installed official app separate", record(namedIssuer, "요청 항목: 기존 공식 앱에서 공지 확인", "설치 경로: 기존 공식 앱"), check],
  ["keeps the explicit remote installation request even when an official store is mentioned", record(namedIssuer, action, ...attachedReceiver, "설치 경로: 직접 찾은 공식 스토어"), danger],
  ["does not promote a named institution's ordinary publication notice", record(namedIssuer, "요청 항목: 신고 안내 책자 확인", "안내 대상: 수신자", "이용 경로: 기존 공식 홈페이지"), check],
  ["does not borrow a claimed issuer from another paragraph", record(bank, "", action, ...attachedReceiver), check],
  ["does not borrow a claimed issuer from an adjacent Markdown table", record(table(bank), table("발신자: 동아리", ...attachedReceiver, action)), check],
  ["does not carry the issuer across two consecutive sender fields", record(bank, "요청 항목: 업무 공지 확인", "발신자: 동아리", ...attachedReceiver, action), check],
  ["keeps an independent later received record eligible", record(bank, action, ...attachedStaff, "", heading, namedIssuer, ...attachedReceiver, action), danger],
]) {
  test(name, () => assert.deepEqual(result(input), expectation));
}
