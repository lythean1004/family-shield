// 카카오 확인(2026-11-28): “엄마 나 폰 액정 깨져서 임시폰이야. 신분증 사진이랑 카드 앞뒤 찍어서 보내줘”가
// 새 번호를 못 찾아 R14가 아닌 주의로 나왔다. 가족 호칭으로 시작해 자기 폰이 임시폰이라고 밝히는 것은
// 금융감독원·경찰청이 안내하는 대표 메신저피싱 수법이다. 문장은 모두 지어낸 것이다.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractCodeSignals } from "../src/extract.js";
import { decide } from "../src/rule-engine.js";
import { SIG_NEW_NUMBER } from "../src/signals.js";

const run = (text) => {
  const s = extractCodeSignals(text).signals;
  return { signals: s, ...decide({ signals_final: s, signals_code: s }) };
};

describe("가족 호칭 + 자기 폰이 임시폰이라는 진술 → 새 번호", () => {
  for (const text of [
    "엄마 나 폰 액정 깨져서 임시폰이야. 신분증 사진이랑 카드 앞뒤 찍어서 보내줘",
    "아빠 나야 휴대폰 고장나서 지금 임시폰이에요. 주민등록증 사진 좀 보내줘요",
    "엄마 폰 떨어뜨려서 수리 맡겼어 이거 임시 번호야. 앱 하나만 깔아줘",
  ]) {
    it(text, () => {
      const r = run(text);
      assert.ok(r.signals.includes(SIG_NEW_NUMBER), String(r.signals));
      assert.equal(r.level, "위험");
    });
  }
});

describe("경계: 임시폰 이야기가 자기 진술이 아니면 새 번호가 아니다", () => {
  for (const text of [
    "엄마 아빠 폰이 임시폰이야? 저녁에 통화해",
    "엄마 나 폰 수리 끝나서 원래 폰으로 돌아왔어. 임시폰은 반납했어",
    "엄마 ‘임시폰이야’라는 문자 오면 사기니까 조심해",
  ]) {
    it(text, () => assert.ok(!run(text).signals.includes(SIG_NEW_NUMBER), String(run(text).signals)));
  }
});
