import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CHECK_LEVEL_TEXT } from "../src/fixed-text.js";

describe("정해 둔 문장", () => {
  it("확인 필요 문장은 '안전'이라고 말하지 않고 공식 번호 확인을 권한다", () => {
    assert.equal(CHECK_LEVEL_TEXT, "눈에 띄는 사기 신호는 없었어요. 그래도 공식 번호로 확인하면 확실해요.");
    assert.ok(!/안전|문제없|괜찮/.test(CHECK_LEVEL_TEXT));
  });
});
