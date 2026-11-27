import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../src/pipeline.js";
import { SIG_AGENCY_IMPERSONATION, SIG_CALL_THIS_NUMBER, SIG_LINK } from "../src/signals.js";

describe("수신 기록의 기관 주장과 기관이 지정한 연락 경로", () => {
  const routes = [
    ["공식 창구에서 다른 접수 페이지로 전환", SIG_LINK,
      "군청이 발송했다고 밝힌 메시지를 받았습니다. 평소 쓰던 공식 접수처가 아닌 https://intake-record.invalid/case 에서만 접수 상태를 읽으라는 요청이 담겼습니다."],
    ["페이지 이용 요구와 기존 창구 변경이 한 기록에 있음", SIG_LINK,
      "시청에서 전달했다고 적힌 통지를 받았는데, 검토 결과는 https://case-sheet.invalid/view 에서 열람하도록 했고 기존 접수처와는 별개라고 밝혔습니다."],
    ["금융사 역할과 발신자가 지정한 회신 번호", SIG_CALL_THIS_NUMBER,
      "은행 사고 관리 부서라고 밝힌 쪽에서 연락이 왔습니다. 상담 접수에는 발신자가 지정한 회신 번호 000-0000-1234로 전화해야 한다고 적혀 있었습니다."],
    ["지정한 번호로 하는 회신과 뒤에 나오는 발신 역할", SIG_CALL_THIS_NUMBER,
      "받은 연락에는 상대가 정한 상담 번호 000-0000-5678로 회신하도록 되어 있는데, 발신자는 카드사 직원이라고 자신을 소개했습니다."],
  ];
  for (const [name, signal, text] of routes) {
    it(name, async () => {
      const result = await analyze({ text });
      assert.ok(result.signals_code.includes(SIG_AGENCY_IMPERSONATION));
      assert.ok(result.signals_code.includes(signal));
      assert.ok(result.fired_rules.includes("R6"));
    });
  }

  const controls = [
    ["독립 단체의 연락", "군청이 발송했다고 밝힌 안내를 받았습니다. 그와 별개로 다른 단체에서는 기존 접수처 대신 https://intake-record.invalid/case 에서 결과를 확인해야 한다고 했습니다."],
    ["공식 호스트", "시청이 발송했다고 밝힌 메시지를 받았습니다. 기존 접수처가 아닌 https://www.gov.kr/ 에서만 접수 상태를 확인하라는 행정 안내입니다."],
    ["기록용 주소", "군청에서 전달했다고 적힌 통지를 받았습니다. 기존 접수처와 별개로 검토자 참고용 https://case-sheet.invalid/view 주소를 기록했고 결과를 열람할 것을 요청받지는 않았습니다."],
    ["발신 주장 없이 임의로 적은 접수처", "기존 접수처가 아닌 https://notes-sheet.invalid/view 에서만 상태를 확인하라는 말이 있었지만 기관에서 보냈다고 하는 발신 표시는 없었습니다."],
    ["번호 없는 콜백", "은행 사고 관리 부서라고 밝힌 쪽에서 연락이 왔습니다. 발신자가 지정한 회신 번호로만 전화하라고 했지만, 받은 연락의 번호 칸은 비어 있었습니다."],
    ["다른 건에서 나온 번호", "은행 사고 관리 부서라고 밝힌 연락을 받았습니다. 계정에 변경 사항이 없다는 내용입니다. 별건으로 발신자가 지정한 회신 번호 000-0000-1234로만 전화해야 한다는 기록을 남겼습니다."],
    ["회신이 선택 사항", "카드사 담당이라고 밝힌 쪽에서 연락이 왔습니다. 발신자가 지정한 번호 000-0000-5678로도 연락할 수 있지만 회신은 선택 사항이라고 했습니다."],
    ["기관의 처리 예정 문구", "군청에서 발송했다고 소개하는 통지를 받았습니다. 청사 접수처와 별개로 마련한 안내판을 기관 직원이 검토할 예정이라는 소식만 담겼습니다."],
    ["직전 교육 자료의 발신 명의를 이어 붙이지 않음", "교육 자료에는 군청이 발송했다고 설명하는 예시가 있었습니다. 실제 받은 안내는 행사 날짜만 기록한 별도 연락이었습니다."],
  ];
  for (const [name, text] of controls) {
    it(name, async () => {
      const result = await analyze({ text });
      assert.ok(!result.fired_rules.includes("R6"));
    });
  }
});
