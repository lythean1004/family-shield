import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { currentReceivedRequests } from "../src/received-message.js";

const oldNotice = "이전 우편 안내의 요청을 취소했습니다.";
const safeFresh = "오늘 새로 받은 도서관 안내에는 수령일 확인 요청이 적혀 있습니다.";
const find = (text, value) => [...currentReceivedRequests(text)].find(frame => frame.body === value);

describe("완료된 경우와 별도로 받은 다른 연락의 상태", () => {
  it("종료한 이전 요청과 새로 받은 다른 안내를 구별", () => {
    const frame = find(oldNotice + " " + safeFresh,safeFresh);
    assert.ok(frame);
    assert.equal(frame.previous,"");
  });
  it("별개라고 밝힌 실제 수신 내용을 새 틀로 보존", () => {
    const other = "그와 별개로 오늘 도서관에서 좌석 안내를 받았습니다.";
    assert.ok(find(oldNotice + " " + other,other));
  });
  it("새 수신 명시가 기존 안내의 뒷내용으로 붙지 않음", () => {
    const first = "동아리 담당자가 보낸 일정 문자를 받았습니다.";
    assert.equal(find(first + " " + safeFresh,first).next,"");
  });
  it("같은 이전 요청의 내용을 종료와 함께 확인", () => {
    const oldDetails = "그 안내에 들어 있는 지난 예약 시간을 다시 확인한 내용입니다.";
    assert.ok(!find(oldNotice + " " + oldDetails,oldDetails));
  });
  it("새 안내라고 적었어도 수신하지 않은 예시의 상태를 유지", () => {
    const example = "오늘 새로 받은 안내라는 예시 문구로 수령일을 구분하는 방법만 소개했습니다.";
    assert.ok(!find(oldNotice + " " + example,example));
  });
  it("과거에 받은 별도 기록을 현재 수신으로 되살리지 않음", () => {
    const past = "예전에 받은 도서관 안내에는 다른 수령일이 적혀 있었습니다.";
    assert.ok(!find(oldNotice + " " + past,past));
  });
});
