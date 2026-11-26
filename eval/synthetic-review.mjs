// 설명을 저장할 수 있는 합성 자료의 승인된 버전. 줄 끝만 통일한 뒤 내용 전체를 확인한다.
import { createHash } from "node:crypto";
import { realpathSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = realpathSync(dirname(fileURLToPath(import.meta.url)));
const approved = new Map([
  ["dev.jsonl", "b3247c9ba34a1d56921af2015a1be189064c6fb539c2771c4f2a0b892b95a9ad"],
  ["test.jsonl", "e9df033555d45f30d23820de089a26becc1aeb0e17e4209689ce238dc8ffc654"],
  ["supplement.jsonl", "b5b1e76675dda7a96f6229e96baa1bd09cf96a2932a5ea96e9b2c31208438cf8"],
  ["holdout-2026-11.jsonl", "eb193561dd1a7302acfc94e448eb45f207567d24ddb66fb230ce214e95c8fcf1"],
  ["holdout-2026-11-v2.jsonl", "d09cc64aac100f3f00e5c3e4dd9c3d54105c64b6654e9171a7fab4ae3e18923d"],
]);

export function verifySyntheticContents(dataset, text) {
  const sha256 = createHash("sha256").update(text.replace(/\r\n/g, "\n")).digest("hex");
  if (approved.get(dataset) !== sha256) throw new Error("설명 저장 대상 합성 평가 파일의 승인 버전과 다릅니다.");
  return { dataset, sha256 };
}

export function readSyntheticDataset(path) {
  const full = resolve(path);
  const dataset = basename(full);
  if (!approved.has(dataset) || full !== join(here, dataset) || realpathSync(full) !== full) {
    throw new Error("설명 저장은 승인된 저장소 합성 평가 파일만 가능합니다.");
  }
  const text = readFileSync(full, "utf8");
  return { text, source: verifySyntheticContents(dataset, text) };
}

/** 임의 데이터의 case_id나 같은 이름의 다른 파일을 표본에 섞지 않는다. */
export function approvedReviewCases(source) {
  if (!source || !approved.has(source.dataset) || approved.get(source.dataset) !== source.sha256) {
    throw new Error("--save-explanations로 만든 합성 평가 결과가 필요합니다.");
  }
  const { text } = readSyntheticDataset(join(here, source.dataset));
  return new Set(text.trim().split(/\r?\n/).map(line => JSON.parse(line).case_id));
}
