import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractCodeSignals } from "../src/extract.js";
import { SIG_FAMILY_IMPERSONATION, SIG_NEW_NUMBER } from "../src/signals.js";

describe("가족에게 신분을 밝히는 발신자", () => {
  for (const text of [
    "어머니, 저 큰딸인데요. 주말에 뵐게요.",
    "할아버지, 나 손자야. 공연 끝났어.",
    "아빠, 나 이동 중이라 전화는 못 받아.",
    "언니, 나야. 폰 바꿨어. 저녁에 보자.",
  ]) it(text, () => {
    const { signals } = extractCodeSignals(text);
    assert.ok(signals.includes(SIG_FAMILY_IMPERSONATION));
    assert.ok(!signals.includes(SIG_NEW_NUMBER));
  });
  for (const text of [
    "어머니, 저 큰딸인데요 라고 시작하는 문구는 교육용 예시예요.",
    "할아버지, 손자가 공연을 끝냈대요.",
    "아빠, 나 동생 만나러 가. 저녁에 봐.",
    "언니, 그때 나는 전화를 못 받았어.",
    "엄마, 저녁에 전화할게. 입장 시간이 남았어.",
  ]) it(text, () => assert.ok(!extractCodeSignals(text).signals.includes(SIG_FAMILY_IMPERSONATION)));
});

describe("가족에게 직접 설명하는 통신 수단 변경", () => {
  for (const text of [
    "어머니, 제 새 번호로 연락드려요.",
    "누나, 빌린 폰으로 문자해. 토요일에 보자.",
    "아버지, 전화번호를 바꿨어요. 다음에 봬요.",
  ]) it(text, () => {
    const { signals } = extractCodeSignals(text);
    assert.ok(signals.includes(SIG_FAMILY_IMPERSONATION));
    assert.ok(signals.includes(SIG_NEW_NUMBER));
  });

  it("휴대폰 고장 설명만으로 발신 번호 변경을 추정하지 않는다", () => {
    const { signals } = extractCodeSignals("아빠, 내 휴대폰이 고장나서 컴퓨터로 안부 전해.");
    assert.ok(signals.includes(SIG_FAMILY_IMPERSONATION));
    assert.ok(!signals.includes(SIG_NEW_NUMBER));
  });

  for (const text of [
    "어머니, 친구 폰으로 연락한다는 사칭 문자를 조심하세요.",
    "아빠, 그때 빌린 폰으로 문자했었지.",
    "엄마, 전화번호를 바꾸지 마세요.",
    "할머니, 휴대폰이 고장났어요?",
    "아빠, 동생 휴대폰이 고장났다고 하더라.",
    "어머니, 친구 휴대폰이 고장나서 수리점에 갔어요.",
    "이번 모임 공지입니다. 새 번호로 연락드려요.",
  ]) it(text, () => {
    const { signals } = extractCodeSignals(text);
    assert.ok(!signals.includes(SIG_FAMILY_IMPERSONATION));
    assert.ok(!signals.includes(SIG_NEW_NUMBER));
  });
});
