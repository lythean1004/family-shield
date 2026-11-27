import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../src/pipeline.js";
import { decide } from "../src/rule-engine.js";
import { AI_ALLOWED_SIGNALS, codeOnlyFrom } from "../src/signals.js";

const secret = "SIG_CREDENTIAL_DISCLOSURE";
const external = "https://form.invalid/";
describe("수신자가 전한 인증값 전달 요구와 본인 기기 입력", () => {
  const samples = [
    [true, "경품 문의 답변에서 인증 코드를 상대방한테 불러 달라고 했다는 제보예요."],
    [true, "제게 새로 온 쪽지에는 원격지원 번호를 상담자에게 전달해 달라는 요청이 남아 있어요."],
    [true, "윗글은 인증 코드를 공유하지 말라는 보안 안내였어요. 그 아래 새로 온 답장에서는 인증 코드를 자기한테 알려 달래요."],
    [false, "상담받은 분이 인증 코드를 자기 기기에 직접 적었다는 이용 후기예요."],
    [false, "인증 코드를 상담자에게 불러 달라는 요구를 거절하고 상담을 종료했어요."],
    [false, "수업에서는 인증 코드를 상대방한테 불러 달라는 요청을 예시로 다뤘어요."],
    [false, "접수 번호를 상담자에게 전달해 달라는 답이 왔는데 본인인증 문자는 따로 받았어요."],
    [false, "기관의 안내는 인증 코드를 상대방에게 넘겨 달라고 하는 일이 없다는 내용이에요."],
    [false, "인증 코드를 상대방에게 알려 달라는 상황은 역할극 대본 속 이야기였어요."],
    [false, "상담자가 인증 코드를 자기한테 불러 달라고 한 적은 없대요."],
    [false, "무대 낭독극에서 인증번호를 상대에게 불러 달라는 대사를 배웠습니다."],
    [false, "희곡 속에서 인증번호를 담당자에게 읽어 달라는 장면을 정리했습니다."],
    [false, "지난 접수 때 인증번호를 접수 직원에게 알려 달라는 문구가 있었지만 그 절차는 이미 끝났습니다."],
    [false, "인증번호를 접수 직원에게 알려 달라는 요청이 있었고 해당 접수는 이미 마감됐습니다."],
    [true, "낭독극에 나온 대사를 따로 정리했습니다. 지금 받은 상담 요청의 기록에는 인증번호를 담당자에게 읽어 달라는 항목이 있습니다."],
    [true, "인증번호를 상대에게 읽어 달라는 문구가 있었지만 그 절차는 이미 끝났고, 이번 기록에는 인증번호를 담당자에게 알려 달라는 별도 항목도 있습니다."],
    [true, "인증 코드를 다른 사람에게 읽어 달라는 부탁을 받고 멈칫했어요."],
  ];
  for (const [expected, text] of samples) it(text, async () =>
    assert.equal((await analyze({ text })).fired_rules.includes("R16"), expected));
});

describe("지원금·부업 서류와 명시된 접수 주소", () => {
  const samples = [
    [true, "지원금 안내를 받았어요. 신청 서류로 통장 사본과 신분증 사진을 한꺼번에 제출해야 한다네요. 서류 접수처라고 적힌 곳은 " + external],
    [true, "재택 부업에 필요한 서류는 주민등록증 사본이랑 통장 사본이라고 했어요. 두 서류를 낼 곳은 " + external],
    [true, "부업 신청 서류에는 신분증 사진과 통장 사본이 포함돼요. 제출 주소: " + external],
    [false, "지원금 안내 자료에 신분증 사진과 통장 사본이 함께 실린 것은 사례 소개예요. 전시 일정 " + external],
    [false, "지원금 신청에는 통장 사본과 신분증 사진을 함께 제출했어요. 도서관 행사 참고 주소 " + external],
    [false, "부업 신청 서류에 신분증 사진이랑 통장 사본은 필요 없어요. 접수 주소: " + external],
    [false, "지원금 신청 서류로 신분증 사진만 제출해야 한대요. 설명 그림에는 통장 사본도 있어요. 제출 주소: " + external],
    [false, "부업 신청 서류에 신분증 사진과 통장 사본이 포함돼요. 제출 주소는 종이 양식에 있어요. 행사 참고 " + external],
    [false, "부업 신청 서류에 신분증 사진과 통장 사본이 포함돼요. 제출 주소는 https://www.gov.kr/ 이고, 참고 게시판은 " + external],
    [false, "지원금 신청 서류로 신분증 사진과 통장 사본을 제출해야 했던 절차가 종료됐어요. 자료 보관 담당자의 제출 주소: " + external],
    [false, "지원금 신청 서류에 신분증 사진과 통장 사본이 포함돼요. 다른 기관의 제출 주소: " + external],
  ];
  for (const [expected, text] of samples) it(text, async () =>
    assert.equal((await analyze({ text })).fired_rules.includes("R17"), expected));
});
describe("D54 지원금·부업 신청에 신분 자료와 통장 자료를 함께 요구", () => {
  const bundle = "SIG_DOCUMENT_BUNDLE";
  for (const text of [
    "모의 지원금 신청서 / 신분증 사본과 통장 사본을 제출하세요. " + external,
    "재택 부업 서식 / 주민등록증 사진이랑 급여받을 통장사본을 여기로 보내 주세요. " + external,
    "긴급 생계비 접수 견본. 신분증 앞면 사진과 지급받을 계좌를 아래에 올려 주세요.\n" + external,
    "지원금 연습 양식 / 통장 사본 및 신분증 사본을 첨부해 주세요. " + external,
  ]) it(text, async () => {
    const r = await analyze({ text });
    assert.equal(r.level, "위험");
    assert.ok(r.signals_code.includes(bundle) && r.fired_rules.includes("R17"));
    assert.match(r.summary, /신분.*통장/);
  });
  for (const text of [
    "지원금 안내 / 주민등록증을 지참하고 행정복지센터를 방문하세요. 안내서 " + external,
    "지원금 서식 / 신분증 사진과 통장 사본을 보내지 마세요. " + external,
    "재택 부업 안내 / 물품 배송에 쓸 주소를 입력하세요. " + external,
    "지원금 접수 / 신분증 사본을 제출하세요. 환불 계좌 내역은 별도 열람입니다. " + external,
    "지원금 신청 서류를 모두 제출했습니다. 신분증과 통장은 직접 찾아가세요. " + external,
    "지원금 신청 / 신분증 사본과 통장 사본을 제출하세요. https://www.gov.kr/ . 전시 자료 " + external,
  ]) it(text, async () => assert.ok(!(await analyze({ text })).fired_rules.includes("R17")));
  it("영수증에서 코드 신호 출처를 유지한다", () => {
    assert.deepEqual(codeOnlyFrom([bundle]), [bundle]);
    assert.ok(!AI_ALLOWED_SIGNALS.has(bundle));
  });
});

describe("D53 남에게 인증값 전달 또는 미확인 양식에 금융 비밀 입력", () => {
  for (const text of [
    "분류 연습 / 결제 인증번호만 나한테 보내 줘.",
    "문법 연습 / 원격지원 코드를 담당자에게 알려 주세요.",
    "모의 휴대폰 개통 / 본인확인 문자가 도착할 거야. 숫자 오면 바로 나한테 보내 줘.",
    "연습 항목 / 인증번호가 발송됐어. 여섯 자리 숫자가 갔을 거야. 그거 그대로 알려 줘.",
    "양식 견본 / 지갑 복구 문구(열두 단어) 입력 후 등록 " + external,
    "양식 견본 / 보안카드 번호 전체 입력하면 확인됩니다. " + external,
  ]) it(text, async () => {
    const r = await analyze({ text });
    assert.equal(r.level, "위험");
    assert.ok(r.signals_code.includes(secret) && r.fired_rules.includes("R16"));
    assert.match(r.summary, /인증|비밀/);
  });
  for (const text of [
    "본인 기기의 공식 앱에서 일회용 인증번호를 직접 입력하세요.",
    "타인에게 결제 인증번호를 보내 주지 마세요.",
    "인증번호를 입력했어. 이따가 사진을 보내 줘.",
    "인증번호가 도착했어. 저녁 식사 사진이 있지? 그거 그대로 보내 줘.",
    "본인확인 문자를 직접 입력했어. 전시 입장권은 따로 왔지? 그 번호를 알려 줘.",
    "택배 보관함 번호가 도착했어. 숫자 오면 나한테 보내 줘.",
    "보안 교육 / ‘원격지원 코드를 알려 주세요’라는 말을 들으면 통화를 끊으세요.",
    "연습 / 지갑 복구 문구는 종이에 보관하세요. 교육 자료 " + external,
    "지갑 복구 문구 입력 후 등록 https://www.gov.kr/ . 전시 안내 " + external,
    "지갑 복구 문구를 입력하지 마세요. " + external,
  ]) it(text, async () => assert.ok(!(await analyze({ text })).fired_rules.includes("R16")));
  it("AI가 단독으로 제시할 수 없는 신호로 영수증에 남긴다", () => {
    assert.ok(!AI_ALLOWED_SIGNALS.has(secret));
    assert.deepEqual(codeOnlyFrom([secret]), [secret]);
    assert.ok(!decide({ signals_final: [secret], signals_code: [] }).fired_rules.includes("R16"));
  });
});
