import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../src/pipeline.js";
import { SIG_DELETE_APP, SIG_ISOLATION } from "../src/signals.js";

describe("수신 보고의 연락 단절 요구", () => {
  const requirements = [
    ["간접명령 -으래", "저에게 온 연락에는 가까운 사람과의 연락을 끊으래요."],
    ["간접명령 -으라는", "도착한 연락에 주변 사람과 대화를 끊으라는 내용이 적혀 있었습니다."],
    ["간접명령 -으라고", "받은 답신에는 제가 아끼는 지인과 연락을 끊으라고 적혀 있었어요."],
    ["금지 간접명령", "새 문자 수신 기록에 가족과 의논하지 말라는 요구가 적혀 있었습니다."],
    ["간접명령 -으라며", "새 연락을 받았어요. 가까운 이들과 연락을 끊으라며 요구했다고 기록했습니다."],
  ];

  for (const [name, text] of requirements) {
    it(name, async () => {
      const result = await analyze({ text });
      assert.equal(result.level, "위험");
      assert.ok(result.fired_rules.includes("R9"));
      assert.ok(result.signals_code.includes(SIG_ISOLATION));
    });
  }

  const ordinary = [
    ["제삼자 번호 차단 도움말", "은행의 안내를 받았어요. 제삼자의 번호를 차단하는 방법을 설명한 내용입니다."],
    ["가해자 번호 차단", "안내문에 지인의 지인이 아니라 가해자 번호를 차단하라는 내용이 있어서 설정만 확인했어요."],
    ["수신자의 자발적 요청", "친구와 연락을 끊으라는 요청은 제가 먼저 했다고 안내받았어요."],
    ["예방 자료", "가족과 연락을 끊으라는 내용은 피싱 예방 자료에서 읽었어요."],
    ["보낸 사람의 설명", "방금 답장을 받았는데 가족과 연락을 끊으라는 뜻은 아니라고 설명했어요."],
    ["상영 중 관람 규칙", "상영 중 친구와 대화를 그만두라고 관람 안내를 받았어요."],
    ["교육 중 짧은 통화 중단", "회사에서는 교육 진행 동안 가족과의 통화는 잠깐 중단하라는 안내가 왔어요."],
    ["앞에서 받은 연락과 별개인 소설", "친구에게 연락이 왔어요. 그와 별개로 가족과 연락을 끊으라는 이야기를 소설에서 읽었어요."],
    ["문장의 예시", "가족과 연락을 끊으라는 문장을 예시 문구에 넣었습니다."],
    ["요구한 사실 부인", "지인과 연락하지 말라는 말은 요구한 적이 없다고 온 답장입니다."],
    ["이미 연락이 끊긴 사실 전달", "제가 지인과 연락이 끊겼다는 소식을 먼저 다른 친구에게 보냈어요."],
    ["수업 시간 규칙 부인", "수업 중 주변 사람과 연락을 끊으라는 뜻의 규정은 없다는 공지예요."],
  ];

  for (const [name, text] of ordinary) {
    it(name, async () => {
      const result = await analyze({ text });
      assert.notEqual(result.level, "위험");
      assert.ok(!result.signals_code.includes(SIG_ISOLATION));
    });
  }
});

describe("수신 보고의 보안 앱 제거 요구", () => {
  const requirements = [
    ["상담의 선행 조건", "낯선 발신자의 답장을 받았습니다. 상담 진행에는 제가 사용 중인 보안 프로그램을 먼저 지우는 것이 필수라는 설명이었습니다."],
    ["삭제 자체가 요청의 동작", "보호 프로그램을 삭제해 달라는 쪽지가 도착했다는 분류용 메모입니다."],
    ["신청 진행의 조건", "새 메시지를 받았습니다. 신청을 계속하려면 백신 앱 삭제가 조건이라고 기재돼 있어요."],
  ];

  for (const [name, text] of requirements) {
    it(name, async () => {
      const result = await analyze({ text });
      assert.equal(result.level, "위험");
      assert.ok(result.fired_rules.includes("R9"));
      assert.ok(result.signals_code.includes(SIG_DELETE_APP));
    });
  }

  const ordinary = [
    ["업무용 기기 정기 교체", "업무용 노트북을 정기 교체하므로 구형 보안 프로그램을 제거하라는 내부 공지가 도착했어요. 대체 제품은 전산실에서 이미 설치했습니다."],
    ["학교 정기 정비", "학교에서 공용 단말기의 보안 앱을 삭제하라는 정기 정비 안내문을 받았습니다."],
    ["대여 기기 반납", "대여 기기 반납 절차 안내를 받았어요. 대여 기간에만 쓰던 보안 프로그램을 삭제하라는 내용입니다."],
    ["예방 자료 인용", "보안 앱을 삭제하라는 안내는 피싱 예방 자료의 일부예요."],
    ["제거할 필요가 없다고 알림", "보안 앱을 삭제할 필요가 없다는 안내를 받았어요."],
    ["삭제 버튼의 모양", "앱 도움말에 보안 앱 삭제 버튼의 색을 확인해 달라는 요청이 적혀 있어요."],
    ["이전에 지웠던 항목", "문의 답장에는 보호 프로그램을 지웠던 날짜만 확인해 달라는 요청이 있었어요."],
    ["삭제 기록 보관", "보낸 쪽지에는 백신 프로그램 삭제 기록을 보관해 달라는 요청만 남아 있었어요."],
  ];

  for (const [name, text] of ordinary) {
    it(name, async () => {
      const result = await analyze({ text });
      assert.notEqual(result.level, "위험");
      assert.ok(!result.signals_code.includes(SIG_DELETE_APP));
    });
  }
});
