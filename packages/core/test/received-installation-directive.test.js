import assert from "node:assert/strict";
import { test } from "node:test";
import { analyze } from "../src/pipeline.js";

const current = [
  "통화를 마친 뒤 소프트웨어 설치를 요구하는 쪽지를 받았습니다.",
  "저는 어플을 설치하도록 지시한 안내문을 전달받았어요.",
  "제게 온 연락에서 프로그램 설치 요청을 받았습니다.",
  "저는 앱 설치를 지시한 문서를 받았어요. 다른 부서의 도서 구매 요청은 이미 취소되었습니다.",
];
const ordinary = [
  "도서관 안내를 읽었습니다. 소프트웨어 설치 여부를 확인하는 글을 받았습니다.",
  "전시 안내를 읽었습니다. 설치 미술 프로그램 초대장을 받았습니다.",
  "작년 사기 예방 교육 자료에서 앱 설치를 요구하는 쪽지를 받았다는 사례를 읽었습니다.",
  "아직 소프트웨어 설치를 요구하는 쪽지를 받은 적이 없습니다.",
  "제 내선으로 온 안내에 직원용 컴퓨터에 앱 설치를 지시하는 글이 적혀 있었습니다.",
  "전산 기사가 프로그램 설치를 요구하는 안내문을 받았습니다. 저는 일정을 전해 들었습니다.",
  "제가 휴대폰에 앱 설치를 지시하는 문서를 받은 일은 없습니다.",
  "제가 소프트웨어 설치를 요구하는 안내문을 받았습니다. 그 요구는 이미 철회되었습니다.",
  "소식지에서 프로그램 설치를 요구하는 안내문을 받았다는 가상의 장면을 읽었습니다.",
  "추가 앱을 설치할 필요가 없다는 회신을 받았습니다.",
  "사서가 소프트웨어 설치를 요구한 문서를 받았어요. 저는 안내 데스크 운영 시간만 전해 들었습니다.",
  "관람객에게 앱 설치를 지시하는 글을 받았습니다. 시립 전시의 안내 담당자로 우편물을 분류했습니다.",
];

for (const [i, text] of current.entries()) test(`수신한 소프트웨어 설치 지시 ${i + 1}`, async () => {
  const withCall = await analyze({ text, parentInputs: { called_before: true }, ai: null });
  assert.ok(withCall.signals_code.includes("SIG_APP_INSTALL"));
  assert.ok(withCall.fired_rules.includes("R2"));
  const withoutCall = await analyze({ text, ai: null });
  assert.ok(!withoutCall.fired_rules.includes("R2"));
});

for (const [i, text] of ordinary.entries()) test(`설치 요구의 방향과 상태 대조 ${i + 1}`, async () => {
  const r = await analyze({ text, parentInputs: { called_before: true }, ai: null });
  assert.ok(!r.fired_rules.includes("R2"));
});
