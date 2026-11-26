import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mask } from "../src/masking.js";

describe("마스킹 - 전화번호", () => {
  it("010-XXXX-XXXX 형식을 [번호]로 바꾼다", () => {
    const { masked } = mask("010-1234-5678로 연락해");
    assert.equal(masked, "[번호]로 연락해");
  });
  it("공백 구분자도 잡는다", () => {
    const { masked } = mask("010 9876 5432");
    assert.equal(masked, "[번호]");
  });
  it("HMAC 키가 있으면 phoneHmacs에 값이 쌓인다", () => {
    const { phoneHmacs } = mask("010-0000-1111", { hmacKey: "test-key" });
    assert.equal(phoneHmacs.length, 1);
    assert.match(phoneHmacs[0], /^[0-9a-f]{16}$/);
  });
  it("HMAC 키가 없으면 phoneHmacs는 빈 배열", () => {
    const { phoneHmacs } = mask("010-0000-1111");
    assert.deepEqual(phoneHmacs, []);
  });
});

describe("마스킹 - URL", () => {
  it("https URL을 [링크]로 바꾼다", () => {
    const { masked } = mask("https://example.invalid/path?q=1 클릭");
    assert.equal(masked, "[링크] 클릭");
  });
  it("http URL도 잡는다", () => {
    const { masked } = mask("http://bit.ly/abc123");
    assert.equal(masked, "[링크]");
  });
  it("www. 로 시작하는 주소도 잡는다", () => {
    const { masked } = mask("www.evil.invalid 확인");
    assert.equal(masked, "[링크] 확인");
  });
});

describe("마스킹 - 이메일, 계좌, 카드, 주민번호", () => {
  it("이메일을 [이메일]로 바꾼다", () => {
    const { masked } = mask("user@example.com 문의");
    assert.equal(masked, "[이메일] 문의");
  });
  it("계좌번호를 [계좌]로 바꾼다", () => {
    const { masked } = mask("123-456-789012로 입금");
    assert.equal(masked, "[계좌]로 입금");
  });
  it("주민번호를 [주민번호]로 바꾼다", () => {
    const { masked } = mask("900101-1234567");
    assert.equal(masked, "[주민번호]");
  });
  it("카드번호 16자리를 [카드]로 바꾼다", () => {
    const { masked } = mask("카드번호는 1234-5678-9012-3456");
    assert.equal(masked, "카드번호는 [카드]");
  });
});

describe("마스킹 - 가족 이름", () => {
  it("등록된 이름을 [가족이름]으로 바꾼다", () => {
    const { masked } = mask("지은이가 연락했어", { familyNames: ["지은"] });
    assert.equal(masked, "[가족이름]이가 연락했어");
  });
  it("빈 이름은 무시한다", () => {
    const { masked } = mask("안녕", { familyNames: [""] });
    assert.equal(masked, "안녕");
  });
});

describe("마스킹 - 복합", () => {
  it("스킴 없는 단축 주소도 [링크]로 바꾼다", () => {
    const { masked } = mask("여기 확인 bit.ly/abc12 바로");
    assert.equal(masked, "여기 확인 [링크] 바로");
  });
  it("이메일 도메인은 [링크]가 아니라 [이메일] 전체로", () => {
    const { masked } = mask("help@bank.invalid 문의");
    assert.equal(masked, "[이메일] 문의");
  });
  it("URL 안의 숫자가 전화번호로 잘못 잡히지 않는다", () => {
    const { masked } = mask("https://x.invalid/0101234567");
    assert.equal(masked, "[링크]");
  });
  it("알림 문자(번호+계좌 혼재)를 올바르게 처리한다", () => {
    const { masked } = mask("010-1111-2222 계좌 123-456-789012 입금요청");
    assert.equal(masked, "[번호] 계좌 [계좌] 입금요청");
  });
});

// 멘토링(2026-11-26) 지적: 하이픈 없는 주민번호, 외국인등록번호, 점·국가번호·대표번호 형식 전화번호가 빠졌다.
describe("마스킹 - 주민등록번호 변형", () => {
  for (const [input, expected] of [
    ["주민번호 900101-1234567", "주민번호 [주민번호]"],
    ["주민번호 9001011234567 보내", "주민번호 [주민번호] 보내"],
    ["주민번호 900101 1234567", "주민번호 [주민번호]"],
    ["외국인 900101-5234567", "외국인 [주민번호]"],
    ["외국인 0101018234567", "외국인 [주민번호]"],
  ]) {
    it(`${input} → ${expected}`, () => assert.equal(mask(input).masked, expected));
  }
  it("날짜가 아닌 13자리 숫자는 주민번호로 보지 않는다", () => {
    assert.notEqual(mask("주문번호 1234567890123").masked, "주문번호 [주민번호]");
  });
});

describe("마스킹 - 전화번호 변형", () => {
  for (const [input, expected] of [
    ["폰 010.1234.5678", "폰 [번호]"],
    ["폰 +82 10-1234-5678", "폰 [번호]"],
    ["폰 +821012345678", "폰 [번호]"],
    ["폰 82-10-1234-5678", "폰 [번호]"],
    ["대표 1588-1234 문의", "대표 [번호] 문의"],
    ["대표 16001234", "대표 [번호]"],
    ["안심 0507-1234-5678", "안심 [번호]"],
    ["사무실 (02)123-4567", "사무실 [번호]"],
    ["사무실 (031) 123-4567", "사무실 [번호]"],
    ["인터넷 070-1234-5678", "인터넷 [번호]"],
  ]) {
    it(`${input} → ${expected}`, () => assert.equal(mask(input).masked, expected));
  }
  it("국가번호를 붙여도 같은 번호면 HMAC이 같다", () => {
    const key = "test-key";
    const a = mask("010-1234-5678", { hmacKey: key }).phoneHmacs;
    const b = mask("+82 10.1234.5678", { hmacKey: key }).phoneHmacs;
    assert.equal(a.length, 1);
    assert.deepEqual(a, b);
  });
  it("계좌번호는 여전히 [계좌]", () => {
    assert.equal(mask("123-456-789012 입금").masked, "[계좌] 입금");
  });
  it("금액·날짜는 번호로 보지 않는다", () => {
    assert.equal(mask("150만원, 2026.11.26 15:30").masked, "150만원, 2026.11.26 15:30");
  });
});
