import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { inspectLinkCandidates, parseLinkCandidate, linksForRiskChecks } from "../src/link-candidates.js";
import { extractCodeSignals } from "../src/extract.js";
import { shortUrlKey } from "../src/short-urls.js";
import { decide } from "../src/rule-engine.js";

describe("전체 후보 파서: 정상·합성 입력과 추상 상태", () => {
  it("정상 URL의 호스트·기본 포트를 URL 파서와 같게 읽는다", () => {
    for (const raw of ["HTTPS://www.gov.kr:443/portal/main", "http://www.gov.kr:80/", "sample.invalid/guide"]) {
      const c = parseLinkCandidate(raw);
      const expected = new URL(raw.includes("://") ? raw : `https://${raw}`);
      assert.equal(c.complete, true);
      assert.equal(c.host, expected.hostname);
      assert.equal(c.port, expected.port);
    }
  });
  it("정상 안내의 괄호·링크 반복을 모두 읽고 이메일은 후보로 넣지 않는다", () => {
    const scan = inspectLinkCandidates("안내 (https://www.gov.kr/portal/main), https://www.gov.kr/portal/main 문의 help@example.com");
    assert.equal(scan.complete, true);
    assert.equal(scan.candidates.length, 2);
    assert.ok(scan.candidates.every((c) => c.host === "www.gov.kr"));
  });
  it("정상 경로 안의 문장부호도 후보 전체에 남긴다", () => {
    for (const raw of ["https://www.gov.kr/portal/(guide)/main", "https://www.gov.kr/portal/guide,summary"]) {
      const scan = inspectLinkCandidates(`안내 ${raw}`);
      assert.equal(scan.complete, true);
      assert.equal(scan.candidates.length, 1);
      assert.equal(scan.candidates[0].raw, raw);
      assert.equal(scan.candidates[0].host, "www.gov.kr");
    }
  });
  it("비어 있거나 문자열이 아닌 후보는 완전한 구문이 아니다", () => {
    for (const raw of ["", null, undefined]) assert.equal(parseLinkCandidate(raw).complete, false);
  });
  it("미지원 자료명·주소가 구분되지 않는 상태는 공식 예외에 쓰지 않는다", () => {
    const scan = inspectLinkCandidates("참고 문서 example.test");
    assert.equal(scan.complete, false);
  });
  it("후보 해석 실패 상태라도 기존 위험 검사 링크를 삭제하지 않는다", () => {
    const legacy = ["https://sample.invalid/guide", "https://example.invalid/help"];
    const unknown = { complete: false, candidates: [{ raw: "판단 불가 상태", complete: false, host: "" }] };
    assert.deepEqual(linksForRiskChecks(legacy, unknown), legacy);
    assert.deepEqual(linksForRiskChecks(legacy, { complete: true, candidates: [] }), legacy);
  });
  it("입력 완결성 보류는 기존 도메인·목록 일치·위험 판정을 제거하지 않는다", () => {
    const text = "안내 https://sample.invalid/guide https://example.invalid/help";
    const options = { shortUrlKeys: new Set([shortUrlKey("https://sample.invalid/guide")]) };
    const before = extractCodeSignals(text, options);
    const after = extractCodeSignals(text, { ...options, inputComplete: false });
    assert.deepEqual(after.domains, before.domains);
    assert.deepEqual(after.signals, before.signals);
    assert.equal(decide({ signals_final: after.signals, signals_code: after.signals }).level, "위험");
  });
});
