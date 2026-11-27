import { it } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../src/pipeline.js";

const report = "도청 민원팀이라며 전화한 상대와 통화했다고 기록했습니다.";
const required = "제 휴대폰에 새 프로그램을 설치하라는 요구가 있었다고 기록했습니다.";
const cases = [
  [false, "전화 발신자 설명 다음에 시간 순서만 담긴 수신 문자", report + " 이어 받은 문자에는 " + required],
  [false, "통화 종료 뒤 문자와 이전 발신자를 결합하지 않음", report + " 통화가 끝난 뒤 온 문자에는 " + required],
  [false, "다른 업체가 송신한 후속 문자", report + " 다른 업체에서 보낸 문자에는 " + required],
  [true, "후속 문자에서도 같은 발신자를 명시", report + " 이어 받은 문자에는 같은 상대가 제 휴대폰에 새 프로그램을 설치하라는 요구를 남겼다고 기록했습니다."],
  [true, "통화와 문자의 발신 연결 및 발신자가 지정한 앱과 수신자 기기", "구청 전산팀이라고 소개한 상대와 통화했습니다. 이어 받은 문자에서 상대가 지정한 프로그램을 제 휴대폰에 설치하라는 요구를 기록했습니다."],
  [true, "전화 사용 없이 한 수신 문자에서 보낸 사람과 요구가 결속", "공공기관이라고 적힌 문자를 받았습니다. 제 휴대폰에 별도 프로그램을 설치하라는 요구를 기록했습니다."],
  [false, "받은 문자에서 회신 요청이 있어도 직전 통화 발신자는 확인되지 않음", report + " 이어 받은 문자에는 문자에 적힌 000-0000-8660으로 전화하라는 요구가 있었습니다."],
  [true, "문자 발신 주체와 본문 회신 요청이 명확함", report + " 이어 받은 문자에는 같은 상대가 본문에 적힌 000-0000-8660으로 전화하라고 표시했습니다."],
  [false, "같은 발신자라도 업무 직원의 기기", report + " 이어 받은 안내에는 같은 상대가 직원의 업무용 휴대폰에 새 프로그램을 설치하라고 썼습니다."],
  [false, "수신자 설치 조치가 철회됨", report + " 이어 받은 문자에는 같은 상대가 제 휴대폰에 새 프로그램을 설치하라고 썼습니다. 그 요청은 철회됐습니다."],
];
for (const [expected, name, text] of cases) it(name, async () => {
  assert.equal((await analyze({ text })).fired_rules.includes("R6"), expected);
});
