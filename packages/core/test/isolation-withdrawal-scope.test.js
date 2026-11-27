import assert from 'node:assert/strict';
import test from 'node:test';
import { analyze } from '../src/pipeline.js';

const examples = [
  {
    "key": "same-speaker-later",
    "text": "담당자가 가족과 상의하지 못하도록 연락을 끊고 혼자 판단하라고 통지했다. 이후 담당자는 그 조건을 철회했다.",
    "isolation": false,
    "deletion": false
  },
  {
    "key": "same-speaker-topic-marker",
    "text": "상담원은 안내에서 친구한테 의논하지 못하게 연락을 차단하고 혼자 답변을 정하라고 설명했다. 한편 상담원은 그 요구를 취소했다.",
    "isolation": false,
    "deletion": false
  },
  {
    "key": "same-speaker-report",
    "text": "발신인은 가족에게 도움을 구하지 못하도록 연락을 끊고 혼자 응답하라는 조건을 통지했다. 뒤이어 발신인은 그 요청을 철회했다.",
    "isolation": false,
    "deletion": false
  },
  {
    "key": "receiver-declines",
    "text": "담당자는 가족과 상의하지 못하게 연락을 끊고 혼자 판단하라고 안내했다. 수신자는 그 요청을 거절해 실행하지 않았다고 기록했다.",
    "isolation": true,
    "deletion": false
  },
  {
    "key": "different-speaker",
    "text": "상담원은 친구에게 조언을 구하지 못하게 연락을 끊고 혼자 결정하라는 요구를 전했다. 이후 다른 직원은 자신의 별도 상담 요청을 취소했다.",
    "isolation": true,
    "deletion": false
  },
  {
    "key": "withdrawal-uncertain",
    "text": "발신인은 가족에게 조언을 얻지 못하도록 연락을 끊고 혼자 답을 정하라고 통지했다. 이후 발신인이 그 지시를 취소했는지는 아직 확인되지 않았다.",
    "isolation": true,
    "deletion": false
  },
  {
    "key": "demand-renewed",
    "text": "담당자는 가족과 상의하지 못하게 연락을 끊고 혼자 판단하라고 안내했다. 이후 담당자는 그 조건을 철회했다. 다음 연락에서 담당자는 지인과 의논하지 못하도록 연락을 끊고 혼자 답하라고 다시 요구했다.",
    "isolation": true,
    "deletion": false
  },
  {
    "key": "same-role-different-person",
    "text": "상담원이 가족과 상의하지 못하도록 연락을 끊고 혼자 답변하라고 통지했다. 이후 다른 상담원이 그 지시를 취소했다고 적었다.",
    "isolation": true,
    "deletion": false
  },
  {
    "key": "passive-withdrawal-unverified",
    "text": "담당자가 지인과 의논하지 못하게 연락을 중단하고 혼자 판단하라고 안내했다. 그 지시가 취소됐는지 확인되지 않았다.",
    "isolation": true,
    "deletion": false
  },
  {
    "key": "later-withdrawal-only-planned",
    "text": "상담원은 가족에게 도움을 구하지 못하게 연락을 끊고 혼자 답하라고 통지했다. 이후 상담원은 그 조건을 장차 취소하겠다고 알렸다.",
    "isolation": true,
    "deletion": false
  },
  {
    "key": "unrelated-app-removal-remains",
    "text": "담당자가 가족과 상의하지 못하도록 연락을 끊고 혼자 판단하라고 통지했다. 이후 담당자는 그 조건을 철회했다. 추가 안내에는 신청을 계속하려면 휴대전화의 보안 앱을 삭제해야 한다고 적혀 있었다.",
    "isolation": false,
    "deletion": true
  }
];

for (const { key, text, isolation, deletion } of examples) {
  test(key, async () => {
    const result = await analyze({ text, ai: null, urlReputation: null, domainAge: null });
    assert.equal(result.signals_code.includes('SIG_ISOLATION'), isolation);
    assert.equal(result.signals_code.includes('SIG_DELETE_APP'), deletion);
    assert.equal(result.fired_rules.includes('R9'), isolation || deletion);
  });
}

test('retains the existing explicitly reported completion', async () => {
  const text = '상담원은 지인과 의논하지 못하게 연락을 끊고 혼자 답하라고 안내했다. 그 조건은 철회됐다고 기록했다.';
  const result = await analyze({ text, ai: null, urlReputation: null, domainAge: null });
  assert.ok(!result.signals_code.includes('SIG_ISOLATION'));
  assert.ok(!result.fired_rules.includes('R9'));
});

const initialDemand = '상담원은 지인과 의논하지 못하게 연락을 끊고 혼자 답하라고 안내했다. ';
for (const [title, followup, expected] of [
  ['철회에 이어 다른 일정을 알림', '그 조건은 철회됐으며 정기 모임 일정을 공지했다.', false],
  ['철회 후 회의 날짜를 정함', '그 조건은 이미 철회되었고 다른 일정이 잡혔다.', false],
  ['같은 조건을 다시 요구함', '그 조건은 철회됐지만 상대가 같은 조건을 다시 요구했다.', true],
]) {
  test(title, async () => {
    const result = await analyze({ text: initialDemand + followup, ai: null });
    assert.equal(result.signals_code.includes('SIG_ISOLATION'), expected);
  });
}
