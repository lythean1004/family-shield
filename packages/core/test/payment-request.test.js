import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractCodeSignals } from "../src/extract.js";
import { SIG_MONEY, SIG_GIFTCARD, SIG_PREPAYMENT } from "../src/signals.js";

const has = (text, id) => extractCodeSignals(text).signals.includes(id);
describe("금융 혜택의 선입금 조건", () => {
  for (const text of [
    "모의 분류표 / 대출 심사 / 수수료 선입금 후 승인",
    "모의 분류표 / 환급 서류 / 보증료 먼저 납부해야 환급 가능",
    "모의 분류표 / 입금하면 확정 수익을 보장합니다.",
  ]) it(text, () => assert.ok(has(text, SIG_PREPAYMENT)));
  for (const text of [
    "숙소 예약표 / 예약금 선입금 후 객실 배정",
    "대출 심사 수수료는 선입금할 필요가 없습니다.",
    "피해 예방 안내. 대출 수수료 선입금 후 승인이라는 말은 사기입니다.",
    "투자설명서. 계좌에 입금하셔도 수익을 보장하지 않습니다.",
    "보증료 정산이 끝나 계좌에 대출금이 입금되었습니다.",
  ]) it(text, () => assert.ok(!has(text, SIG_PREPAYMENT)));
});

describe("송금의 목적지·금액과 실제 요청", () => {
  for (const text of [
    "견본 항목 / 연습 계좌로 좀 보내 줘.",
    "문법 예제 / 송금 한 번만 부탁해.",
    "문법 예제 / 이체 한 건만 부탁드릴게요.",
    "문법 예제 / 오천 원은 견본 표에 적힌 계정으로 부쳐 주세요.",
  ]) it(text, () => assert.ok(has(text, SIG_MONEY)));
  for (const text of [
    "계좌로 좀 보내 줬어. 수령 내역을 확인했어.",
    "모임 회비 계좌를 알려 줄게. 사진도 보내 줘.",
    "편지에 오천 원 우표를 붙여서 우편함에 부쳐 주세요.",
    "연습 계좌로 보내 주지 마세요.",
    "교육 자료의 ‘송금 한 번만 부탁해’라는 사례를 읽었어요.",
  ]) it(text, () => assert.ok(!has(text, SIG_MONEY)));
});

describe("상품권 수량과 구매 동사", () => {
  for (const text of [
    "견본 쇼핑 목록 / 기프트카드 중 이번에 나온 초록색 봄 한정판 두 장만 사 줘.",
    "견본 쇼핑 목록 / 상품권 중 포장에 축하 문구가 적혀 있는 판으로 한 장 구매 부탁.",
    "견본 쇼핑 목록 / 기프트카드는 계절이 바뀔 때마다 나오는 그림으로 세 장 사다 줘.",
  ]) it(text, () => assert.ok(has(text, SIG_GIFTCARD)));
  for (const text of [
    "기프트카드 중 이번에 나온 초록색 봄 한정판 두 장을 예전에 샀어.",
    "상품권 중 포장에 축하 문구가 적혀 있는 판으로 한 장 구매하지 마세요.",
    "상품권 안내서예요. 다음 장에 있는 엽서 두 장만 사 줘.",
  ]) it(text, () => assert.ok(!has(text, SIG_GIFTCARD)));
});
