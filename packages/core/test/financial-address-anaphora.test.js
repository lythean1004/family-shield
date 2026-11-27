import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../src/pipeline.js";
import { SIG_CREDENTIAL_DISCLOSURE } from "../src/signals.js";
const endpoint = "https://entry.invalid/abstract";
const different = "https://reference.invalid/abstract";

const cases = [
  ["주소를 먼저 밝힌 뒤 같은 주소의 은행 비밀번호 입력을 보고", true,
   "기록에 표시된 주소 " + endpoint + " 가 적혀 있었습니다. 그 주소에 은행 비밀번호를 입력하라고 했습니다."],
  ["금융 비밀을 먼저 말하고 지정 주소의 동작에 결속", true,
   "받은 안내에 사용 주소 " + endpoint + " 가 적혔습니다. 은행 암호를 해당 주소에서 기입하라는 설명이었습니다."],
  ["명시된 링크와 같은 링크에 제출하는 지갑 복구 문구", true,
   "원문에 나온 링크 " + endpoint + " 가 보였습니다. 같은 링크에 지갑 복구 문구를 입력하라고 요청했습니다."],
  ["서식으로 연결되지만 수신자가 아직 입력하지 않음", true,
   "메시지에 사용 주소 " + endpoint + " 가 적혀 있었습니다. 은행 비밀번호를 그 주소에서 기입하라고 설명했습니다. 저는 입력하지 않았습니다."],
  ["받은 한 주소의 입력 화면을 이어서 지칭", true,
   "문서에 원래 주소 " + endpoint + " 가 적혀 있었습니다. 입력 요청을 읽어 보니 그 화면에 은행 비밀번호를 기입하라는 내용이었습니다."],
  ["다른 화면은 실제 외부 주소와 결합하지 않음", false,
   "문서에 기록용 주소 " + endpoint + " 가 적혀 있었습니다. 입력할 곳은 다른 화면이라고 했으며 그 화면에 은행 비밀번호를 기입한다고 설명했습니다."],
  ["상담 주소가 또 다른 비밀번호 요구의 목적지가 아님", false,
   "상담 주소 " + endpoint + " 가 표시됐습니다. 다른 안내에서 계좌 비밀번호를 입력하라고 했지만 그 주소는 적혀 있지 않았습니다."],
  ["주소와 비밀번호는 같은 말에 있지만 입력 목적지 관계가 없음", false,
   "받은 안내에는 주소 " + endpoint + " 가 있었습니다. 그 주소에서 시간을 보고 은행 비밀번호를 공식 앱의 화면에 입력하라는 뜻이었습니다."],
  ["계좌 정보와 연락 시간은 비밀값 아님", false,
   "받은 안내에 제시된 주소 " + endpoint + " 를 기록했습니다. 그 주소에는 은행 연락 가능 시간과 계좌 변경 여부를 쓰라고 했습니다."],
  ["두 주소가 있어서 어느 숫자를 회신하는지 불명확", false,
   "받은 안내의 주소 " + endpoint + " 와 추가 주소 " + different + " 가 함께 기재됐습니다. 그 주소에 은행 비밀번호를 쓰라고 했습니다."],
  ["동일 요구 철회", false,
   "원문에 주소 " + endpoint + " 가 적혀 있었습니다. 그 주소에 은행 비밀번호를 입력하라고 했습니다. 해당 요청은 취소됐습니다."],
  ["목적지는 본인 기기의 은행 앱", false,
   "정보 페이지의 주소 " + endpoint + " 가 적혀 있었습니다. 본인의 앱에서 은행 비밀번호를 변경하라고 했습니다."],
  ["예방 자료의 예문", false,
   "예방 교육 자료에서 주소 " + endpoint + " 를 예로 제시했습니다. 그 주소에 계좌 비밀번호를 입력하라는 문장도 예였습니다."],
];

for (const [name, shouldFire, text] of cases) {
  test(name, async () => {
    const result = await analyze({text, ai:null});
    assert.equal(result.fired_rules.includes("R16"),shouldFire);
    assert.equal(result.signals_code.includes(SIG_CREDENTIAL_DISCLOSURE),shouldFire);
  });
}
