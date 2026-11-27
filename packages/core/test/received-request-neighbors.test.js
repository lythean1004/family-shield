import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { currentReceivedRequests } from "../src/received-message.js";

const arrival = "도서관에서 온 예약 안내를 받았습니다.";
const beforeBoundary = (intro, next) => [...currentReceivedRequests([intro,next].join(" "))][0];

describe("수신 보고의 다음 절은 같은 연락에만 연결", () => {
  it("그 연락과 별개로 시작한 새 안내는 앞 절의 보충 정보가 아님", () => {
    const frame = beforeBoundary(arrival, "그와 별개로 전시장 안내에 다른 시작 시각이 적혀 있었습니다.");
    assert.equal(frame.next, "");
  });
  it("보조사 는이 들어간 별개 연락 표시도 앞 절을 닫음", () => {
    const frame = beforeBoundary(arrival, "이와는 별개로 배송 안내에는 토요일도 가능하다고 쓰여 있었습니다.");
    assert.equal(frame.next, "");
  });
  it("다른 담당자의 안내를 앞선 요청에 붙이지 않음", () => {
    const frame = beforeBoundary(arrival, "다른 담당자의 연락에는 직원 휴게실 위치가 적혀 있었습니다.");
    assert.equal(frame.next, "");
  });
  it("같은 연락에 관한 시간 설명은 다음 절로 유지", () => {
    const next = "그 안내에 있는 예약 시간은 내일 오후입니다.";
    assert.equal(beforeBoundary(arrival,next).next,next);
  });
  it("이어 보낸 안내가 별개라고 표시되지 않으면 현재 흐름을 유지", () => {
    const next = "뒤이어 받은 문자에는 운영 시간이 연장됐다고 적혀 있었습니다.";
    assert.equal(beforeBoundary(arrival,next).next,next);
  });
  it("같은 예약 절차 종료는 앞선 수신 보고의 활성 판단에 반영", () => {
    const text = arrival + " 해당 절차는 이미 끝났습니다.";
    assert.ok(![...currentReceivedRequests(text)].some(frame => frame.body === arrival));
  });
});