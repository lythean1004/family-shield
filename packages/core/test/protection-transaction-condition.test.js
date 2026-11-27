import assert from "node:assert/strict";
import test from "node:test";
import { analyze } from "../src/pipeline.js";
import { SIG_DELETE_APP } from "../src/signals.js";

const cases = [
  ["사용 중인 백신을 지워야 지급 절차를 진행할 수 있다는 조건", true,
    "발신자가 내 기기에 있는 백신 앱을 지워야 결제를 진행할 수 있다고 설명했습니다."],
  ["보호 프로그램을 제거해야 계약을 이어 갈 수 있다는 발신자", true,
    "받은 연락에서 상대방이 제 휴대폰의 보안 프로그램을 제거해야 계약을 이어 갈 수 있다고 했습니다."],
  ["거래를 재개할 조건인 담당자의 삭제 요구", true,
    "보낸 사람이 사용 중인 보호 앱을 완전히 없애야 정산을 재개할 수 있다고 말했습니다."],
  ["교육 사례", false, "예방 교육 자료입니다. 상대가 제 기기의 백신 앱을 지워야 결제를 진행할 수 있다고 설명했습니다."],
  ["지울 대상은 보호 앱의 임시 파일", false,
    "발신자가 내 기기에 있는 백신 앱의 임시 파일을 지워야 결제를 진행할 수 있다고 설명했습니다."],
  ["다른 사람에게 지급한 공용 기기", false,
    "상대가 회사 지급 기기의 백신 앱을 지워야 결제를 진행할 수 있다고 했습니다."],
  ["거래 조건이 아니라 수신자가 먼저 한 요청", false,
    "제가 먼저 요청한 정기 정비에서 제 휴대폰의 백신 앱 교체 일정을 확인했습니다."],
  ["악성 위장 프로그램을 제거하는 지침", false,
    "상대가 제 휴대폰의 가짜 보안 앱을 지워야 계약을 이어 갈 수 있다고 설명했습니다."],
  ["같은 삭제 요구를 발신자가 철회", false,
    "상대가 사용 중인 보호 앱을 없애야 결제를 진행할 수 있다고 말했습니다. 발신자가 그 삭제 요구를 철회했습니다."],
  ["거래를 할 수 있는지는 문의만 함", false,
    "보낸 사람이 내 기기의 보안 앱을 지워야 거래를 계속할 수 있는지 물었습니다."],
  ["거래와 무관한 기기 변경", false,
    "정상 교체 일정에 따라 직원이 기존 보호 앱 버전을 기록했습니다. 정산은 평소처럼 진행됐습니다."],
  ["보호 기능을 유지하고 알림만 정리", false,
    "상대가 내 기기에서 보안 앱의 지난 알림만 지워야 결제를 진행할 수 있다고 설명했습니다."],
];
for (const [name, expected, text] of cases) {
  test(name, async () => {
    const result = await analyze({ text, ai: null });
    assert.equal(result.signals_code.includes(SIG_DELETE_APP), expected);
    assert.equal(result.fired_rules.includes("R9"), expected);
  });
}
