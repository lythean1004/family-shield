
import test from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../src/pipeline.js";
import { SIG_PREPAYMENT } from "../src/signals.js";

const approval = "받은 금융 안내에는 융자가 승인됐다고 적혀 있었습니다.";
const explicit = "진행 수수료를 우선 송금하라는 안내가 이어졌습니다.";
const checks = [
  ["융자 승인 통지와 별도 지급 요청", approval + " " + explicit, true],
  ["수신 답변에서 처리비를 먼저 내는 것이 조건", "같은 안내에서 대출 승인 사실을 알렸습니다. 아직 받지 못한 대금을 진행하려면 처리 수수료를 먼저 내야 한다는 답변을 받았습니다.", true],
  ["당첨 통지와 그 혜택을 받기 위한 별도 비용", "행사 경품에 선정되었다는 통지를 받았습니다. 상품을 받으려면 추가 비용부터 지불해야 한다는 설명을 이어서 받았습니다. 수신자는 내지 않았습니다.", true],
  ["다른 순서의 수신 경위", "상품 당첨 사실을 적은 안내를 받았습니다. 물품을 수령하려면 별도 수수료를 미리 납부해야 한다는 회신이 왔습니다.", true],
  ["당첨 사실을 주장하지 않는 일반 행사", "행사에 참가할 수 있는지 문의했습니다. 신청에 필요한 일반 참가비가 있다는 안내를 받았습니다.", false],
  ["승인 전에 비용을 받을 것인지 질문", approval + " 처리 수수료를 먼저 내라고 한 것인지 제가 물었습니다. 아직 답변은 오지 않았습니다.", false],
  ["명시적 철회가 같은 사건에 적용됨", approval + " " + explicit + " 발신자가 그 납부 요구를 취소했습니다.", false],
  ["승인 자체가 철회된 상태", "융자가 승인됐지만 승인은 취소되었다고 안내했습니다. 처리 수수료를 우선 송금하라는 별도 예시는 비교하려고 읽었습니다.", false],
  ["정식 급부와 다른 비용을 합치지 않음", approval + " 별개로 행사 진행 수수료를 먼저 지불하라는 안내가 뒤따랐습니다.", false],
  ["지급 끝난 대출의 정식 청구서", "대출금 입금이 이미 완료됐다고 확인했습니다. 발신자는 정해진 정기 상환 내역을 안내했습니다.", false],
  ["자료 속 사례의 인용", "예방 교육 자료에 융자 승인 내역과 먼저 수수료를 내라는 문구가 함께 있었습니다. 실제로 지급을 요구받은 적은 없습니다.", false],
  ["발신자가 자기 비용을 대신 지급함", approval + " 발신자가 이 절차에 드는 처리 수수료를 자신이 먼저 납부하겠다고 했습니다.", false],
  ["승인 안내와 다른 문단의 별개 청구", approval + "\n\n처리 수수료를 우선 송금하라는 안내가 있었습니다.", false],
  ["기존 계좌에서 자동 차감하는 정상 고지", approval + " 처리 수수료는 대출 지급액에 포함해 자동 차감되며 별도 납부할 필요는 없다고 설명했습니다.", false],
];
for (const [name,text,expected] of checks) {
  test(name, async () => {
    const result=await analyze({text,ai:null,urlReputation:null,domainAge:null});
    assert.equal(result.signals_code.includes(SIG_PREPAYMENT),expected);
  });
}
