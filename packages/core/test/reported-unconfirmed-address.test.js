import test from "node:test";
import assert from "node:assert/strict";
import { extractCodeSignals } from "../src/extract.js";
import { SIG_OFFICIAL_LINK } from "../src/signals.js";
import { decide } from "../src/rule-engine.js";

const credentialCases = [
  ["지갑 수신 기록", "지갑 서비스와 연관이 확인되지 않은 note-one.invalid에서 지갑 복구 구문을 입력하라는 요청을 받았습니다."],
  ["별도 조사와 경로가 있는 입력 목적지", "운영자를 확인하지 못한 https://note-four.invalid/review 에서 지갑 복구 문구를 입력하라는 요구를 받음."],
  ["주소와 조사가 분리된 수신 기록", "운영자를 확인하지 못한 https://note-two.invalid 에 지갑 복구 문구를 입력하라는 요구를 전달받음."],
  ["같은 수신 안내에 적힌 입력 요구", "받은 메시지에는 운영처를 확인하지 못한 note-three.invalid에서 지갑의 시드 문구 입력이 필수라고 적혀 있었음."],
];

const documentCases = [
  ["부업 모집 조건 기록", "정리 부업 모집 안내의 수신 기록. 운영자를 확인하지 못한 forms-one.invalid에 신분증과 통장 사본을 모두 제출하는 조건이 명시돼 있었음."],
  ["별도 조사와 경로가 있는 서류 접수처", "지원금 신청 안내의 수신 요약. 운영자를 확인하지 못한 https://forms-four.invalid/intake 에 신분증과 통장 사본을 함께 제출하는 조건이 적혀 있었음."],
  ["지원금 신청 안내 요약", "받은 지원금 신청 안내 요약. 운영자를 확인하지 못한 https://forms-two.invalid 로 통장 사본과 신분증을 함께 첨부해야 한다고 적혀 있었음."],
  ["모집 절차의 두 서류", "재택 일자리 모집 공고 수신 요약. 운영처를 확인하지 못한 forms-three.invalid에서 신분증 사본과 통장 사본을 제출하는 조건이 적혀 있었음."],
];

const ordinaryCases = [
  ["별개 화면의 입력 요구", "지갑 서비스와 관계가 확인되지 않는 note-one.invalid에서 안내만 조회했다고 기록됨. 복구 문구는 본인 앱에서 입력함."],
  ["입력 없이 이름만 언급", "운영자를 확인하지 못한 note-one.invalid에서 지갑 복구 문구라는 항목 이름을 확인했다고 기록함."],
  ["요구 없는 입력 여부 확인", "운영자를 확인하지 못한 note-one.invalid에서 지갑 복구 문구를 입력하라는 요구는 없었다고 기록함."],
  ["새로 받은 다른 안내의 입력 요구", "지갑 서비스와 관계가 확인되지 않는 note-one.invalid에서 안내를 열었음. 다른 문자에는 지갑 복구 문구를 입력하라는 요구가 적혀 있었음."],
  ["운영자 미확인 표현이 없는 명칭", "동아리 운영자가 안내한 note-one.invalid에서 지갑 복구 문구를 입력하라는 요구를 받았다고 적음."],
  ["지갑과 무관한 복구 문구", "운영자를 확인하지 못한 note-one.invalid에서 복구 문구를 입력하라는 요청을 받았습니다."],
  ["철회된 입력 요구", "운영자를 확인하지 못한 note-one.invalid에서 지갑 복구 문구를 입력하라는 요청을 받았습니다. 입력 요구는 이미 철회됐음."],
  ["일반 서류 접수", "회원 정보 변경 안내의 수신 요약. 운영자를 확인하지 못한 forms-one.invalid에 신분증과 통장 사본을 함께 제출하는 조건이 적혀 있었음."],
  ["철회된 제출 요구", "정리 부업 모집 안내의 수신 기록. 운영자를 확인하지 못한 forms-one.invalid에 신분증과 통장 사본을 모두 제출하는 조건이 명시돼 있었음. 제출 요구는 이미 취소됐음."],
  ["둘 중 하나를 선택", "정리 부업 모집 안내의 수신 기록. 운영자를 확인하지 못한 forms-one.invalid에 신분증이나 통장 사본 중 하나를 제출하는 조건이 적혀 있었음."],
  ["이전 모집 기록과 신규 별건", "정리 부업 모집 안내의 수신 기록.\n\n운영자를 확인하지 못한 forms-one.invalid에 신분증과 통장 사본을 함께 제출하는 조건이 적혀 있었음."],
  ["다른 연락에서 받은 주소", "정리 부업 모집 안내의 수신 기록. 다른 연락에서 운영자를 확인하지 못한 forms-one.invalid에 신분증과 통장 사본을 함께 제출하는 조건이 적혀 있었음."],
  ["참고 서류의 이름만 나열", "정리 부업 모집 안내의 수신 기록. 운영자를 확인하지 못한 forms-one.invalid에 신분증과 통장 사본 예시가 적혀 있었음."],
  ["한 토큰의 다른 목적지", "지원금 신청 안내의 수신 요약. 운영자를 확인하지 못한 forms-one.invalid에서 forms-two.invalid에 신분증과 통장 사본을 함께 제출하는 조건이 적혀 있었음."],
  ["일반 제출이며 모집은 과거 이야기", "예전 정리 부업 모집 안내의 수신 기록. 운영자를 확인하지 못한 forms-one.invalid에 신분증과 통장 사본을 함께 제출하는 조건이 적혀 있었음."],
];

function classify(text, options) {
  const code = extractCodeSignals(text, options);
  return { ...code, ...decide({ signals_code: code.signals, signals_final: code.signals }) };
}

for (const [rule, cases] of [["R16", credentialCases], ["R17", documentCases]]) {
  for (const [label, text] of cases) {
    test(rule + " 미확인 목적지와 같은 요구를 인식: " + label, () => {
      const result = classify(text);
      assert.equal(result.level, "위험");
      assert.ok(result.fired_rules.includes(rule));
      assert.ok(!result.signals.includes(SIG_OFFICIAL_LINK));
    });
  }
}

for (const [label, text] of ordinaryCases) {
  test("요구나 목적지가 연결되지 않으면 가산하지 않음: " + label, () => {
    const result = classify(text);
    assert.ok(!result.fired_rules.includes("R16"));
    assert.ok(!result.fired_rules.includes("R17"));
  });
}

test("파서의 전체 입력이 불완전하면 기존 링크 판정과 조회 도메인 유지", () => {
  for (const [, text] of [credentialCases[0], documentCases[0]]) {
    const result = classify(text, { inputComplete: false });
    assert.equal(result.level, "주의");
    assert.ok(result.fired_rules.includes("R7"));
    assert.ok(!result.fired_rules.includes("R16"));
    assert.ok(!result.fired_rules.includes("R17"));
    assert.deepEqual(result.domains, classify(text).domains);
  }
});

test("확인된 URL의 경로는 유지하고 기존 위험 검사에는 같은 도메인을 사용", () => {
  for (const [cases, host] of [[credentialCases, "note-four.invalid"], [documentCases, "forms-four.invalid"]]) {
    const [, text] = cases[1];
    const result = classify(text);
    const truncated = classify(text, { inputComplete: false });
    assert.deepEqual(result.domains, [host]);
    assert.deepEqual(result.domains, truncated.domains);
    assert.ok(!result.signals.includes(SIG_OFFICIAL_LINK));
    assert.ok(!truncated.signals.includes(SIG_OFFICIAL_LINK));
  }
});
