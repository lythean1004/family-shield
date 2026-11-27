import assert from "node:assert/strict";
import { test } from "node:test";
import { analyze } from "../src/pipeline.js";
import { SIG_CREDENTIAL_DISCLOSURE } from "../src/signals.js";

const reports = [
  ["수신자 화면의 원격 코드와 발신자 수취",true,"함께 봐 주겠다는 사람이 수신자의 화면에 표시된 원격 지원용 코드를 자신에게 전해 달라고 설명했다."],
  ["수취인을 값보다 앞에 서술",true,"전화로 돕겠다는 쪽이 자기한테 내 표시창에서 뜬 원격 제어용 번호를 전송해 달라고 말했다."],
  ["코드 전달을 명사화해 보고",true,"발신자가 수신자의 표시창에 보이는 원격 접속용 번호를 자신에게 알려 달라는 요구를 했다."],
  ["코드를 보관하고 다른 자료만 전달",false,"함께 봐 주겠다는 사람이 제 화면에 나온 원격 접속용 코드는 화면에 남겨 두고 오류 사진을 자신에게 전해 달라고 설명했다."],
  ["발신자의 화면과 수신자의 수취로 역할 역전",false,"함께 봐 주겠다는 사람이 자신의 화면에 표시된 원격 지원용 코드의 관리 절차를 수신자에게 설명했다."],
  ["화면 값의 상태를 관찰한 기록",false,"화면을 봐 준 사람과 원격 지원 코드가 표시되는지만 확인했다. 기록 단계에서도 화면의 값은 전달 대상이 아니었다."],
  ["수신자가 같은 전달 요청을 거절",false,"도와 주겠다는 사람이 제 화면에 표시된 원격 접속용 코드를 자신에게 전해 달라고 설명했다. 그 요청을 거절했다."],
  ["발신자가 같은 전달 요청을 철회",false,"도와 주겠다는 사람이 제 화면에 표시된 원격 접속용 코드를 자기에게 전해 달라고 말했다. 발신자가 그 요구를 철회했다."],
];

for (const [description, expected, text] of reports) {
  test(description, async () => {
    const result = await analyze({ text, ai: null, urlReputation: null, domainAge: null });
    assert.equal(result.signals_code.includes(SIG_CREDENTIAL_DISCLOSURE), expected);
    assert.equal(result.level === "위험", expected);
  });
}
