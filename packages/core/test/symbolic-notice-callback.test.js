import assert from 'node:assert/strict';
import test from 'node:test';
import { analyze } from '../src/pipeline.js';
import { extractCodeSignals } from '../src/extract.js';
import { OFFICIAL_DOMAIN_CARDS } from '../src/lookalike.js';

const cases = [
  {
    "key": "same-notice-required",
    "text": "수신 기록에서 발신 쪽은 민원 접수 기관이라고 밝혔다. 그 기관은 접수 상태를 확인하려면 같은 통지에 별도로 지정한 전화 연락처로만 다시 통화해야 한다고 요구했다.",
    "expected": true
  },
  {
    "key": "signed-source-route",
    "text": "수령 정보를 정정한다는 통지의 발신자는 택배사를 자처했다. 같은 발신 내용에서 처리에 쓸 회신 연락처를 별도로 지정했고 수신자가 그 연락처로 전화해야 한다고 적었다.",
    "expected": true
  },
  {
    "key": "substituted-route",
    "text": "은행 업무 담당이라고 밝힌 쪽에서 안내가 왔다. 평소 상담 창구를 이용하는 대신 그 문자에 정해 둔 별도 연락처로 다시 전화하라는 요구였다고 기록했다.",
    "expected": true
  },
  {
    "key": "independently-found-official",
    "text": "발신인은 민원 담당 기관이라고 소개했다. 수신자가 스스로 찾아 확인한 기관의 공식 고객센터에서 상담하면 된다고 안내했고 문자에 다른 회신처를 지정하지 않았다.",
    "expected": false
  },
  {
    "key": "a-different-issuer",
    "text": "택배사를 자처한 발신자의 통지는 배달 일정만 설명했다. 별개로 받은 동호회 개별 연락에는 그 안내에서 지정한 연락처로만 통화해야 한다고 적혀 있었다.",
    "expected": false
  },
  {
    "key": "receiver-consideration",
    "text": "금융기관 담당자라고 밝힌 쪽의 안내에는 처리 시각만 있었다. 수신자가 별도 안내에서 찾은 연락처로 전화해도 될지 생각했다고 상담에 정리했다.",
    "expected": false
  },
  {
    "key": "claimed-delivery-same-exclusive-route",
    "text": "배송사를 자칭한 안내가 도착했다. 처리 요건으로 이 통지에 따로 지정된 확인되지 않은 전화번호로만 통화하도록 요청했다고 기록했다.",
    "expected": true
  },
  {
    "key": "generic-recall-route-not-reproduced",
    "text": "통신 업체라고 밝힌 발신인의 알림에는 본문에 적힌 연락처로 다시 연락해야 한다는 말이 있었다. 번호는 옮기지 않았다.",
    "expected": false
  },
  {
    "key": "record-substitution-not-original-route",
    "text": "은행 담당 부서라고 밝힌 쪽에서 통지가 왔다. 같은 안내에 별도로 지정된 연락처로만 통화하도록 요구했다. 기록에는 원래 번호 대신 다른 연락처를 넣었다.",
    "expected": false
  },
  {
    "key": "actual-instruction-withdrawn",
    "text": "금융기관이라고 밝힌 발신자가 안내를 보냈다. 같은 통지에 별도로 지정한 전화 연락처로만 다시 통화해야 한다고 요구했다. 발신인은 그 지시를 철회했다.",
    "expected": false
  },
  {
    "key": "no-actual-instruction",
    "text": "은행 업무 담당이라고 밝힌 발신자의 안내가 도착했다. 같은 통지에 별도로 지정된 연락처로만 통화하라는 요구는 없었다고 상담에 남겼다.",
    "expected": false
  },
  {
    "key": "separate-route-is-official",
    "text": "은행 담당 부서 명의의 안내에는 접수 일정이 적혀 있었다. 같은 통지에서 안내한 기관의 공식 고객센터로 전화하면 된다는 뜻이었다.",
    "expected": false
  }
];

for (const { key, text, expected } of cases) {
  test(key, async () => {
    const result = await analyze({ text, ai: null, urlReputation: null, domainAge: null });
    assert.equal(result.fired_rules.includes('R6'), expected);
    assert.ok(!result.fired_rules.includes('R19'));
    if (expected) {
      assert.ok(result.signals_code.includes('SIG_CALL_THIS_NUMBER'));
      assert.ok(!extractCodeSignals(text).healthRoutingSignals.includes('SIG_CALL_THIS_NUMBER'));
    }
  });
}

test('does not override a present documented official number', async () => {
  const card = OFFICIAL_DOMAIN_CARDS.find(item => item.status === 'source_checked' && item.callback_contact?.numbers?.length);
  assert.ok(card);
  const text = '은행 담당 부서라고 밝힌 쪽에서 접수 안내가 왔다. 같은 통지에 따로 지정된 전화 연락처 ' +
    card.callback_contact.numbers[0] + '로만 다시 통화하라고 요구했다고 기록했다.';
  const result = await analyze({ text, ai: null, urlReputation: null, domainAge: null });
  assert.ok(!result.fired_rules.includes('R6'));
  assert.ok(!result.fired_rules.includes('R19'));
});

const completionCases = [
  {
    "key": "affirmative-completion",
    "text": "수신 기록에서 발신 쪽은 민원 접수 기관이라고 밝혔다. 그 기관은 접수 상태를 확인하려면 같은 통지에 별도로 지정한 전화 연락처로만 다시 통화하도록 요청했습니다.",
    "expected": true
  },
  {
    "key": "affirmative-nominal",
    "text": "수신 기록에서 발신 쪽은 민원 접수 기관이라고 밝혔다. 그 기관은 접수 상태를 확인하려면 같은 통지에 별도로 지정한 전화 연락처로만 다시 통화하라는 지시였다고 설명했다.",
    "expected": true
  },
  {
    "key": "actual-continued-use",
    "text": "수신 기록에서 발신 쪽은 민원 접수 기관이라고 밝혔다. 그 기관은 접수 상태를 확인하려면 같은 통지에 별도로 지정한 전화 연락처로만 다시 통화해야 한다고 알렸다. 수신자는 다음날 이 안내를 회의에서 검토했다고 기록했다.",
    "expected": true
  },
  {
    "key": "uncertain-requirement",
    "text": "수신 기록에서 발신 쪽은 민원 접수 기관이라고 밝혔다. 그 기관은 접수 상태를 확인하려면 같은 통지에 별도로 지정한 전화 연락처로만 다시 통화하도록 요청했는지는 확인하지 못했다.",
    "expected": false
  },
  {
    "key": "question-about-requirement",
    "text": "수신 기록에서 발신 쪽은 민원 접수 기관이라고 밝혔다. 그 기관은 접수 상태를 확인하려면 같은 통지에 별도로 지정한 전화 연락처로만 다시 통화하도록 지시한 일이 있는지 상담에서 물었다.",
    "expected": false
  },
  {
    "key": "rehearsed-scene",
    "text": "수신 기록에서 발신 쪽은 민원 접수 기관이라고 밝혔다. 그 기관은 접수 상태를 확인하려면 같은 통지에 별도로 지정한 전화 연락처로만 다시 통화하라는 장면을 연습하고 있었다.",
    "expected": false
  },
  {
    "key": "conjectured-requirement",
    "text": "수신 기록에서 발신 쪽은 민원 접수 기관이라고 밝혔다. 그 기관은 접수 상태를 확인하려면 같은 통지에 별도로 지정한 전화 연락처로만 다시 통화하도록 지시할 가능성이 있다는 추정이었다.",
    "expected": false
  },
  {
    "key": "retrospective-correction",
    "text": "수신 기록에서 발신 쪽은 민원 접수 기관이라고 밝혔다. 그 기관은 접수 상태를 확인하려면 같은 통지에 별도로 지정한 전화 연락처로만 다시 통화하도록 요구했다. 뒤이어 앞의 기록은 연습용으로 꾸민 사례라고 바로잡았다.",
    "expected": false
  },
  {
    "key": "retrospective-referenced-paragraph",
    "text": "수신 기록에서 발신 쪽은 민원 접수 기관이라고 밝혔다. 그 기관은 접수 상태를 확인하려면 같은 통지에 별도로 지정한 전화 연락처로만 다시 통화하도록 요구했다.\n\n그 뒤 이것은 교육을 위해 꾸며 낸 이야기라고 정정했다.",
    "expected": false
  },
  {
    "key": "unrelated-training-not-a-correction",
    "text": "수신 기록에서 발신 쪽은 민원 접수 기관이라고 밝혔다. 그 기관은 접수 상태를 확인하려면 같은 통지에 별도로 지정한 전화 연락처로만 다시 통화하도록 요구했다.\n\n별개 수업에서 유사한 상황을 교육 자료로 만들었다고 기록했다.",
    "expected": true
  }
];
for (const { key, text, expected } of completionCases) {
  test(key, async () => {
    const result = await analyze({ text, ai: null, urlReputation: null, domainAge: null });
    assert.equal(result.fired_rules.includes('R6'), expected);
    assert.ok(!result.fired_rules.includes('R19'));
    if (expected) assert.ok(!extractCodeSignals(text).healthRoutingSignals.includes('SIG_CALL_THIS_NUMBER'));
  });
}

const recordedCall = cases.find(row => row.key === 'same-notice-required').text;
test('한 문장에 이어 쓴 기관 수신과 별도 통화 요구', async () => {
  const text = '상담 기록 — 은행을 자처한 안내가 있었고, 그 기관은 같은 안내에 따로 지정한 회신 번호로만 통화하도록 요청했습니다.';
  assert.ok((await analyze({ text, ai: null })).fired_rules.includes('R6'));
});
const callbackAction = recordedCall.slice(recordedCall.indexOf('. ') + 2);
for (const [label, origin] of [
  ['부인된 발신 명의', '수신 기록에서 발신 쪽은 민원 접수 기관이라고 밝힌 적이 없었다.'],
  ['확인되지 않은 발신 명의', '수신 기록에서 발신 쪽이 민원 접수 기관이라고 밝혔는지는 알 수 없었다.'],
  ['발신자가 언급한 다른 기관', '수신 기록에서 발신 쪽은 다른 쪽을 민원 접수 기관이라고 소개했다.'],
  ['확인되지 않은 안내 도착', '배송사를 자칭한 안내가 도착했는지는 아직 확인 중이다.'],
  ['받은 사람이 다른 경우', '지인이 배송사를 자칭한 안내를 받았다.'],
  ['접속절에서 수신을 정정', '배송사를 자칭한 안내가 도착했고, 곧 수신 기록은 연습용으로 적었다고 정정했다.'],
]) {
  test(label, async () => {
    const result = await analyze({ text: origin + ' ' + callbackAction, ai: null });
    assert.equal(result.fired_rules.includes('R6'), false);
  });
}

for (const lead of ['동호회 운영자가 별도로 ', '가상 실습에서만 ']) {
  test('다른 주체나 가정에서만 나온 안내 ' + lead.trim(), async () => {
    const text = recordedCall.split('. ')[0] + '. ' + lead + '같은 통지에 별도로 지정한 전화 연락처로만 다시 통화하도록 요구했다.';
    assert.ok(!(await analyze({ text, ai: null })).fired_rules.includes('R6'));
  });
}

for (const [label, text] of [
  ['소설의 줄거리', '소설을 읽고 줄거리를 적었다. ' + recordedCall],
  ['다른 사람 상담 기록', '제가 겪은 일이 아닌 지인의 상담 기록이다. ' + recordedCall],
  ['발신 측이 실제 요구를 철회', recordedCall + ' 같은 담당자가 그 요구를 바로 철회했다.'],
  ['뒤에서 수신 사실을 정정', recordedCall + ' 이 내용은 제가 받은 문자가 아니라는 설명이 이어졌다.'],
]) {
  test(label, async () => {
    const result = await analyze({ text, ai: null });
    assert.equal(result.fired_rules.includes('R6'), false);
  });
}

test('불완전한 입력은 원번호가 생략된 수신 기록의 대상을 추론하지 않음', () => {
  assert.equal(extractCodeSignals(recordedCall, { inputComplete: false }).signals.includes('SIG_CALL_THIS_NUMBER'), false);
});
