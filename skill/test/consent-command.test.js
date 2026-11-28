// ‘AI 끄기’ 비슷한 말 인식(docs/plan-kakao-web-consistency.md 4장). 끄기는 넓게, 동의는 좁게
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseConsentCommand } from "../src/kakao-consent.js";

const OFF = ["AI 끄기", "ai끄기", "Ai 끄기", "AI끄기", "ＡＩ 끄기", "AI 끄기요", "AI 끄기!", "ai 끄기.", " AI  끄기 ",
  "AI 꺼줘", "AI 꺼 주세요", "ai 꺼줘요", "AI 그만", "AI 안 쓸래요", "에이아이 끄기", "인공지능 끄기",
  "AI 분석 끄기", "AI 동의 철회", "동의 철회", "AI 끄기 해 주세요"];
const AGREE = ["AI 분석에 동의해요", "ai 분석에 동의해요", "AI분석에동의해요", "AI 분석에 동의해요.", "AI 분석에 동의합니다"];
const REFUSE = ["규칙만 쓸게요", "규칙만쓸게요", "규칙만 쓸게", "규칙만"];
const NOTICE = ["AI 분석 안내", "ai분석안내", "AI 분석 안내요", "AI 끄는 법"];
const NOT = ["엄마 AI 끄기 했어?", "AI 끄기를 누르면 환급금이 지급됩니다", "동의", "네", "좋아요", "동의해요",
  "AI", "끄기", "[국세청] AI 분석 안내 대상자입니다", "AI 켜기는 어떻게 해"];

describe("parseConsentCommand", () => {
  for (const t of OFF) it(`끄기: ${JSON.stringify(t)}`, () => assert.deepEqual(parseConsentCommand(t), { granted: false }));
  for (const t of AGREE) it(`동의: ${JSON.stringify(t)}`, () => assert.deepEqual(parseConsentCommand(t), { granted: true }));
  for (const t of REFUSE) it(`규칙만: ${JSON.stringify(t)}`, () => assert.deepEqual(parseConsentCommand(t), { granted: false }));
  for (const t of NOTICE) it(`안내: ${JSON.stringify(t)}`, () => assert.deepEqual(parseConsentCommand(t), { notice: true }));
  for (const t of NOT) it(`명령 아님: ${JSON.stringify(t)}`, () => assert.equal(parseConsentCommand(t), null));
});
