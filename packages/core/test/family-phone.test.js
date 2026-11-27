import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractCodeSignals } from "../src/extract.js";
import { SIG_AVOID_VOICE, SIG_FAMILY_IMPERSONATION, SIG_NEW_NUMBER } from "../src/signals.js";

describe("발신자가 빌려 쓰는 기기와 해지한 이전 연락처", () => {
  for (const text of [
    "어머니, 저예요. 친구 폰 빌려서 문자 보내요.",
    "아빠 나 휴대폰 고장 나서 동료 거로 보내.",
    "누나, 이 번호로 문자해. 전에 쓰던 번호는 해지됐어.",
    "형님 저 막내인데요. 번호 바꿨어요.",
  ]) it(text, () => {
    const { signals } = extractCodeSignals(text);
    assert.ok(signals.includes(SIG_FAMILY_IMPERSONATION) && signals.includes(SIG_NEW_NUMBER));
  });
  it("본인의 기기 고장을 알리는 정중한 자기소개만으로는 새 번호를 추정하지 않는다", () => {
    const { signals } = extractCodeSignals("아버지 저예요 폰이 고장나서 컴퓨터를 켰어요.");
    assert.ok(signals.includes(SIG_FAMILY_IMPERSONATION) && !signals.includes(SIG_NEW_NUMBER));
  });
  for (const text of [
    "어머니, 저예요. 친구 폰 빌려서 사진 보내 줘.",
    "아빠, 내 친구가 휴대폰 고장 나서 동료 거로 보내.",
    "누나, 이 번호로 문자해. 전에 쓰던 번호는 그대로야.",
    "아빠, 이 번호로 문자해. 원래 번호는 해지하지 마.",
    "형님, 예전에 번호 바꿨어요. 지금은 원래 번호를 씁니다.",
    "누나, 어제 친구 폰 빌려서 문자 보냈어.",
  ]) it(text, () => assert.ok(!extractCodeSignals(text).signals.includes(SIG_NEW_NUMBER)));
});

describe("빌린 휴대폰으로 직접 연락했고 그 기기로 통화하기 어렵다는 설명", () => {
  for (const text of [
    "누나, 나 친구 휴대폰을 빌려서 문자 보내요. 전화는 빌린 폰이라 받을 수가 없어요.",
    "어머니, 제가 동료 폰 빌려서 연락드려요. 통화는 동료 거라 못 받아요.",
    "형, 내다. 지인 폰 빌려 문자 보낸다. 전화는 남의 폰이라 몬 받는다.",
  ]) it(text, () => {
    const { signals } = extractCodeSignals(text);
    assert.ok(signals.includes(SIG_FAMILY_IMPERSONATION) && signals.includes(SIG_AVOID_VOICE));
  });
  for (const text of [
    "누나, 나 친구 휴대폰을 빌려서 문자 보내요. 이따가 다시 통화해.",
    "형, 내가 친구 폰 빌려서 문자 보낸다. 어제는 전화가 친구 거라 못 받았어.",
    "엄마, 나 동료 폰 빌려서 연락드려요. 동료는 전화가 빌린 폰이라 못 받아요.",
    "형, 나 친구 폰으로 사진 봤어. 전화는 남의 폰이라 못 받아.",
    "어머니, 제가 지인 폰 빌려서 연락드려요. ‘전화는 친구 거라 못 받아’라는 문구가 있네요.",
    "누나, 나 친구 휴대폰을 빌려서 문자 보내요. 전화는 빌린 폰이라 받을 수가 없어요?",
  ]) it(text, () => {
    const { signals } = extractCodeSignals(text);
    assert.ok(!(signals.includes(SIG_FAMILY_IMPERSONATION) && signals.includes(SIG_AVOID_VOICE)));
  });
  it("첫머리 길이 제한에서 끊긴 질문을 통화 거절로 판정하지 않는다", () => {
    const question = "전화는 친구 거라 못 받아요";
    const introduction = "나 친구 폰 빌려 문자 보낸다.";
    const opening = introduction.padEnd(100 - question.length, " ") + question;
    const { signals } = extractCodeSignals("누나, " + opening + "?");
    assert.ok(!signals.includes(SIG_AVOID_VOICE));
  });
});

describe("발신자가 지금 쓰는 번호를 설명하는 말", () => {
  for (const text of [
    "아버지, 제가 새로 받은 번호입니다. 주말에 뵈어요.",
    "어머니, 나 정류장에 있어. 임시번호로 보내요.",
    "누나 나야. 폰을 바꿨어. 이 번호 저장해 둬.",
    "아빠, 내 휴대폰을 잃어버려서 친구 폰으로 보내. 다행히 집에 왔어.",
    "언니 나야. 빌린 폰이야. 이 번호로 잠깐 연락할게.",
    "엄마 나야. 임시번호로 보내. 내일 만날까?",
  ]) it(text, () => {
    const { signals } = extractCodeSignals(text);
    assert.ok(signals.includes(SIG_FAMILY_IMPERSONATION) && signals.includes(SIG_NEW_NUMBER));
  });
  for (const text of [
    "어머니, 제가 새로 받은 번호표입니다. 여기서 기다릴게요.",
    "아버지, 내 친구가 새로 받은 번호예요.",
    "누나 나야. 친구 폰으로 보내 주세요.",
    "누나 나야. 폰을 바꿨어. 이 번호는 수리점 번호니까 저장해 둬.",
    "아빠, 예전에 임시번호로 보냈어요. 지금은 원래 번호예요.",
    "언니, 친구 폰으로 받은 사진을 보내요.",
  ]) it(text, () => assert.ok(!extractCodeSignals(text).signals.includes(SIG_NEW_NUMBER)));
});

describe("본인의 단말 상태와 직전 통화를 설명하는 가족", () => {
  for (const text of [
    "어머니, 나 집에 오는 길에 휴대폰 떨어뜨려서 화면이 안 보여.",
    "여보 나야. 내 폰 배터리가 방전됐어.",
    "아빠, 방금 전화한 사람 저 맞아요. 공연 잘 끝났어요.",
    "엄마, 나 새 휴대폰 개통 전이라 이 번호로 보내요. 안부 전해.",
  ]) it(text, () => assert.ok(extractCodeSignals(text).signals.includes(SIG_FAMILY_IMPERSONATION)));
  it("새 단말을 기다리며 지금 쓰는 다른 연락처를 밝힌 경우만 번호 변경을 인정한다", () => {
    assert.ok(extractCodeSignals("언니, 나 새폰 개통 전이라 이 번호로 보내.").signals.includes(SIG_NEW_NUMBER));
    assert.ok(!extractCodeSignals("언니, 나 새폰 개통 중이야. 번호는 그대로야.").signals.includes(SIG_NEW_NUMBER));
  });
  for (const text of [
    "어머니, 제 친구가 휴대폰 떨어뜨려서 수리 맡겼대요.",
    "아빠, 아까 전화한 사람 저 맞아요 라고 적힌 교육 예시예요.",
    "여보, 지난번에 내 폰 배터리가 방전됐었던 거 기억나?",
  ]) it(text, () => assert.ok(!extractCodeSignals(text).signals.includes(SIG_FAMILY_IMPERSONATION)));
});

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
