import { strict as assert } from "node:assert";
import { test } from "node:test";
import { addReportedFamilySignals } from "../src/reported-family.js";
import { analyze } from "../src/pipeline.js";
import { decide } from "../src/rule-engine.js";
import {
  SIG_APP_INSTALL, SIG_AVOID_VOICE, SIG_FAMILY_IMPERSONATION, SIG_GIFTCARD,
  SIG_LINK, SIG_MONEY, SIG_NEW_NUMBER, SIG_PERSONAL_INFO, SIG_SECRECY, SIG_URGENCY,
} from "../src/signals.js";

test("수신자가 말한 발신 주장과 음성 본인확인 거절을 제품 판정으로 전달한다", async () => {
  const input = "저한테 온 쪽지의 발신자는 동생이라고 밝혔어요. 목소리로 본인 확인하는 일은 거절했어요.";
  const result = await analyze({ text: input, ai: null });
  assert.equal(result.level, "위험");
  assert.ok(result.fired_rules.includes("R4"));
});

const positives = [
  {
    name: "친족 복합어의 전체 어절을 가족 발신 주장으로 판단",
    text: "처음 보는 번호에서 친손녀라고 밝혔어요. 신분 자료를 보내 달라는 요구가 있었다고 적었습니다.",
    signals: [SIG_FAMILY_IMPERSONATION, SIG_NEW_NUMBER, SIG_PERSONAL_INFO],
    rule: "R14",
  },
  {
    name: "지역에서 쓰는 친족 호칭을 가족 발신 주장으로 판단",
    text: "할매라고 소개한 발신자가 음성 본인확인을 거절했다고 합니다.",
    signals: [SIG_FAMILY_IMPERSONATION, SIG_AVOID_VOICE],
    rule: "R4",
  },
  {
    name: "정상 어절인 형과 가족 발신을 서술한 본문",
    text: "형이라고 소개한 발신자의 문자에 상품권을 요구하는 대목이 있었어요.",
    signals: [SIG_FAMILY_IMPERSONATION, SIG_GIFTCARD],
    rule: "R13",
  },
  {
    name: "가족을 보낸 사람으로 소개하는 간접 인용과 상품권 코드 요구",
    text: "할아버지가 남겼다는 문자에는 상품권 코드를 요청하는 대목이 있습니다.",
    signals: [SIG_FAMILY_IMPERSONATION, SIG_GIFTCARD],
    rule: "R13",
  },
  {
    name: "연락처 변경이 없는 가족 발신 주장과 반복적인 금전 요청",
    text: "그 사람은 아들이라면서 금전을 요청했어요. 여러 차례 재촉했어요.",
    signals: [SIG_FAMILY_IMPERSONATION, SIG_MONEY, SIG_URGENCY],
    rule: "R13",
  },
  {
    name: "낯선 번호의 가족 발신 주장과 설치를 조건으로 제시한 경우",
    text: "새 연락처로 조카라고 밝힌 메시지입니다. 앱을 설치하는 게 조건이라는 설명이 담겨 있었습니다.",
    signals: [SIG_FAMILY_IMPERSONATION, SIG_NEW_NUMBER, SIG_APP_INSTALL],
    rule: "R14",
  },
  {
    name: "발신자가 본인 확인 요청을 거절",
    text: "딸이라고 주장한 발신자는 전화로 신원을 확인해 보자는 요청을 거절했습니다.",
    signals: [SIG_FAMILY_IMPERSONATION, SIG_AVOID_VOICE],
    rule: "R4",
  },
  {
    name: "낯선 발신자와 가족 관계를 입증하는 서류 요구",
    text: "처음 보는 번호에서 아내라고 말한 사람이 가족관계 증명서를 요구했습니다.",
    signals: [SIG_FAMILY_IMPERSONATION, SIG_NEW_NUMBER, SIG_PERSONAL_INFO],
    rule: "R14",
  },
  {
    name: "새 연락처에서 전한 가족 발신 주장과 금전 요청",
    text: "모르는 연락처에서 아들이라고 소개했어요. 발신자가 송금을 요구했습니다.",
    signals: [SIG_FAMILY_IMPERSONATION, SIG_NEW_NUMBER, SIG_MONEY],
    rule: "R3",
  },
  {
    name: "직접적인 신원 진술과 임시 연락처 뒤의 민감 정보 요구에 대한 설명",
    text: "저는 손녀예요. 이건 임시 연락처예요. 발신 내용에 신분증 사본을 요구하는 부분이 있습니다.",
    signals: [SIG_FAMILY_IMPERSONATION, SIG_NEW_NUMBER, SIG_PERSONAL_INFO],
    rule: "R14",
  },
  {
    name: "가족이라고 소개한 발신자가 낯선 연락처로 전한 설치 요구",
    text: "발신자가 동생이라고 했는데 연락처가 낯설어요. 앱 설치 요청도 적혀 있었습니다.",
    signals: [SIG_FAMILY_IMPERSONATION, SIG_NEW_NUMBER, SIG_APP_INSTALL],
    rule: "R14",
  },
  {
    name: "수신자가 옮긴 가족 발신 주장과 음성 본인확인 거절",
    text: "아버지라고 소개한 발신자가 음성으로 본인 확인하기는 거절했어요.",
    signals: [SIG_FAMILY_IMPERSONATION, SIG_AVOID_VOICE],
    rule: "R4",
  },
  {
    name: "답장 속 가족 발신 주장과 상품권 요구",
    text: "손주라고 자처한 발신자의 답장에 상품권 구매 요청이 담겨 있어요.",
    signals: [SIG_FAMILY_IMPERSONATION, SIG_GIFTCARD],
    rule: "R13",
  },
  {
    name: "가족 발신 주장과 금전 요구를 제삼자에게 알리지 말라는 설명",
    text: "딸이라고 주장하는 사람이 돈을 요청했습니다. 그 발신자는 이 부탁을 다른 가족에게 알리지 말라고 했습니다.",
    signals: [SIG_FAMILY_IMPERSONATION, SIG_MONEY, SIG_SECRECY],
    rule: "R13",
  },
];

for (const { name, text, signals: expected, rule } of positives) {
  test(name, () => {
    const signals = new Set([SIG_LINK]);
    addReportedFamilySignals(text, signals);
    for (const signal of [...expected, SIG_LINK]) assert.ok(signals.has(signal), signal);
    const result = decide({ signals_code: [...signals], signals_final: [...signals] });
    assert.equal(result.level, "위험");
    assert.ok(result.fired_rules.includes(rule));
  });
}

const negatives = [
  ["사물 이름의 일부분은 친족 호칭이 아님", "공예품을 인형이라고 소개했어요. 상품권 구매 요청도 전시 매장 안내에 함께 있었습니다."],
  ["연구 기록의 분류 명칭은 가족 발신 주장이 아님", "논문에는 표본의 유형 명칭이 형이라고 적혀 있었습니다. 상품권 구매 요청도 조사 기록에 등장합니다."],
  ["별도 사업 담당자의 독립된 부탁", "처음 보는 번호에서 언니라고 소개했어요. 배송 담당자는 상품권 구매를 부탁했어요."],
  ["제삼자가 남긴 별도 안내와 가족 발신 주장", "동생이라고 소개한 발신자가 있었어요. 마트에서 보낸 안내에 상품권을 구매하라는 요청이 있었다고 적혀 있습니다."],
  ["새 번호이지만 결제 금지를 전달", "모르는 번호에서 언니라고 했어요. 결제를 하지 말라는 부탁이라고만 적혀 있었어요."],
  ["상품권을 사지 말라는 금지", "발신자가 제 동생이라고 소개했어요. 상품권을 사지 말라는 부탁이었습니다."],
  ["이미 확인한 실제 가족의 독립된 부탁", "아들이라고 주장한 낯선 연락이 있었어요. 실제 딸은 상품권 구매를 부탁했어요."],
  ["설치가 포함되지 않은 안전한 앱 정보 문의", "앱 이름 정보를 묻는 질문이었습니다. 새 연락처에서 형이라고 소개했어요."],
  ["호칭만 있는 일상 문자", "엄마, 오늘은 일찍 퇴근해요. 회의 때문에 전화는 저녁에 할게요."],
  ["새 기기를 샀지만 발신자가 같은 번호라고 설명", "저는 동생이에요. 휴대폰을 새로 샀지만 연락처는 그대로예요. 저녁에 통화할게요."],
  ["가족을 자처했지만 요구가 없는 일상 연락", "언니라고 소개하는 연락이 왔어요. 함께 식사하는 일정을 확인했어요."],
  ["실제 가족임을 확인한 일상 금전 처리", "아들이라고 소개했지만 평소 쓰던 번호로 통화해 본인임을 확인했어요. 공동 비용 이체를 요청했어요."],
  ["예방 안내로 인용된 요구", "피싱 예방 교육에서 손자라고 자처한 발신자의 상품권 요구를 예시로 다뤘어요."],
  ["수신자가 이미 거절한 요구", "딸이라고 자처한 발신자가 상품권을 요청했지만 저는 그 요청을 이미 거절했습니다."],
  ["발신자가 이미 철회한 요구", "모르는 번호에서 아들이라고 소개했어요. 송금 요청은 철회했습니다."],
  ["요구가 없었다는 부정", "새 연락처의 발신자가 엄마라고 주장했어요. 돈을 요청한 적은 없다고 명시했습니다."],
  ["요구의 부정에 과거의 요구 동사가 포함", "손주라고 주장한 발신자가 상품권을 부탁했다고 한 건 아니에요."],
  ["타인에게 과거 발생한 사건", "지난해 이웃에게 손녀라고 주장한 사람이 접근했어요. 상품권 구매 요청이 있었다고 들었어요."],
  ["여러 화자의 독립된 단서", "모르는 연락처에서 딸이라고 소개했어요. 별도로 동료는 공동 비용 송금을 부탁했어요."],
  ["문맥이 달라진 뒤 나온 상품권 이야기", "손주라고 자처한 발신자가 답장을 보냈어요. 기념일 얘기였어요. 화제를 바꿔 동료는 상품권 구매 요청을 받았다고 했어요."],
  ["음성 확인을 제안한 경우", "남편이라고 소개한 발신자는 음성으로 본인 확인을 해 주겠다고 했습니다."],
  ["일시적인 통화 불가와 일정 제안", "아들이라고 소개한 발신자는 일하는 중이라 전화가 어려웠고 퇴근 뒤 다시 통화하기로 했습니다."],
  ["감사를 표시하는 금전 알림", "모르는 번호에서 동생이라고 소개했어요. 먼저 받은 돈에 대해 감사하다고 했어요."],
  ["새 번호 발신 주장만 있고 위험 요구 없음", "처음 보는 번호에서 동생이라고 소개했어요. 안부를 보내왔습니다."],
  ["연락처와 돈의 일반적 언급", "아버지 전화번호를 고쳤어요. 가족 회의에서 공동 비용을 논의했습니다."],
];

for (const [name, text] of negatives) {
  test(name, () => {
    const signals = new Set([SIG_LINK]);
    addReportedFamilySignals(text, signals);
    assert.deepEqual([...signals], [SIG_LINK]);
  });
}
