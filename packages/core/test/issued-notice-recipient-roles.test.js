import test from "node:test";
import assert from "node:assert/strict";
import { extractCodeSignals } from "../src/extract.js";
import { decide } from "../src/rule-engine.js";
import { SIG_AGENCY_IMPERSONATION, SIG_LINK, SIG_OFFICIAL_LINK } from "../src/signals.js";

const publicNotice = "수신자가 받은 통지문은 행정기관 명의였습니다.";
const describedLink = "해당 통지문에 운영처를 확인하지 못한 접수 링크가 포함되어 있었습니다.";
const address = "기록에 남긴 링크는 https://public-form.invalid/intake 입니다.";
const claimedSender = "통신업체 고객관리 부서를 자처한 담당자가";
const action = "여권 사본을 해당 메시지에 답장으로 첨부하라고";
const official = "https://hometax.go.kr";

function classify(text) {
  const code = extractCodeSignals(text);
  return { ...code, ...decide({
    signals_final: code.signals, signals_code: code.signals,
    unlinkedAgencyActions: code.unlinkedAgencyActions,
  }) };
}

const cases = [
  [true, [publicNotice, describedLink, address].join(" ")],
  [true, [claimedSender, action, "했다는 기록이다."].join(" ")],
  [false, "전산 점검을 한다는 업체 명의의 문자에 이어 수신자는 발신자가 지정한 프로그램을 설치하라는 요청을 받았다."],
  [false, [publicNotice, "별개의 발신자가 보낸 통지문에 운영처를 확인하지 못한 접수 링크가 포함되어 있었습니다.", address].join(" ")],
  [false, [publicNotice, describedLink, "원본은 삭제하고 주소를 https://public-form.invalid/intake 로 치환했습니다."].join(" ")],
  [false, [publicNotice, describedLink, "그 링크는 기록에서 제외했습니다.", address].join(" ")],
  [false, [publicNotice, describedLink, "참고 링크는 https://public-form.invalid/intake 입니다."].join(" ")],
  [false, ["수신자가 받은 통지문은 행정기관 명의였다는 뜻이 아니었습니다.", describedLink, address].join(" ")],
  [false, ["수신자가 받은 통지문은 행정기관 명의였는지 알 수 없습니다.", describedLink, address].join(" ")],
  [false, [publicNotice, describedLink, "기록에 남긴 링크는 https://public-form.invalid/intake 와 https://other-form.invalid/intake 입니다."].join(" ")],
  [false, [claimedSender, "다른 사람에게만", action, "했다는 기록이다."].join(" ")],
  [false, [claimedSender, action, "한 적은 없다고 했다."].join(" ")],
  [false, [claimedSender, action, "했다는 기록이다. 발신자가 그 요구를 철회했다고 했다."].join(" ")],
  [false, [claimedSender, "여권 사본을 해당 메시지에 답장으로 첨부해야 하는지 물었다."].join(" ")],
  [false, [claimedSender, "여권 사본을 본인만 보관하라고 했다."].join(" ")],
  [false, [claimedSender, "수신자에게 여권 사본을 해당 메시지의 답장으로 첨부해 보냈다."].join(" ")],
  [false, [claimedSender, "나중에 신청한다면 별도 절차를 안내할 수 있다고 설명했다."].join(" ")],
  [false, "담당 직원이 통신업체 담당자를 소개했지만 수신자에게 자료를 요구하지 않았다."],
  [false, [publicNotice, "해당 통지문의 정상 접수 링크는", official, "입니다."].join(" ")],
];

for (const [index, [expected, text]] of cases.entries()) {
  test("수신 발신 역할과 행동 연결 " + (index + 1), () => {
    assert.equal(classify(text).fired_rules.includes("R6"), expected);
  });
}

test("공식 링크 예외와 혼합 입력의 기존 링크 신호", () => {
  const officialNotice = cases.at(-1)[1];
  assert.ok(classify(officialNotice).signals.includes(SIG_OFFICIAL_LINK));
  const mixed = classify(officialNotice + " 다른 발신자가 보낸 참고 링크는 https://sample-form.invalid/intake 입니다.");
  assert.ok(mixed.signals.includes(SIG_LINK));
  assert.ok(!mixed.signals.includes(SIG_OFFICIAL_LINK));
  assert.ok(!mixed.fired_rules.includes("R6"));
});

test("별개의 공식 안내 주소는 같은 수신문의 확인된 미등록 주소와 구분한다", () => {
  const mixed = classify(cases[0][1] + " 다른 발신자가 보낸 공개 주소는 " + official + " 입니다.");
  assert.ok(mixed.signals.includes(SIG_LINK));
  assert.ok(!mixed.signals.includes(SIG_OFFICIAL_LINK));
  assert.ok(mixed.fired_rules.includes("R6"));
});

test("보고에서 인식한 기관 회신은 건강정보 전송 신호를 넓히지 않는다", () => {
  const { signals, healthRoutingSignals } = classify(cases[1][1] + " 혈압 검사 결과도 기록에 남겼다.");
  assert.ok(signals.includes(SIG_AGENCY_IMPERSONATION));
  assert.ok(!healthRoutingSignals.includes(SIG_AGENCY_IMPERSONATION));
});
