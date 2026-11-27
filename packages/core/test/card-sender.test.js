import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractCodeSignals } from "../src/extract.js";
import { decide } from "../src/rule-engine.js";
import { SIG_AGENCY_IMPERSONATION } from "../src/signals.js";

describe("기관 명의의 미확인 납부·인증 경로", () => {
  const outside = "https://form.invalid/";
  const tagged = text => extractCodeSignals(text).signals.includes(SIG_AGENCY_IMPERSONATION);
  for (const text of [
    "국세청 징수과 안내\n압류 예정 안내 양식 / 납부 및 이의신청",
    "[정부24] 신청 서식 / 본인인증(성명·휴대폰 인증번호) 후 지급",
    "[KB국민은행] 견본 / 보안카드 번호 전체 입력 후 신청",
  ]) it(text, () => assert.ok(tagged(text + " " + outside)));
  for (const text of [
    "국세청 징수과 안내\n공개 전시 일정과 장소",
    "[정부24] 지원금 신청 교육자료 / 일회용 번호를 입력하지 마세요.",
    "[KB국민은행] 보안카드 번호 전체 입력을 요구한 사례에 주의하세요.",
    "[KB국민은행] 보안카드 보관 방법 안내",
    "독서회에서 국세청의 압류 예정 안내와 이의신청 절차를 설명합니다.",
  ]) it(text, () => assert.ok(!tagged(text + " " + outside)));
  it("공식 주소만 안내한 기관 서식에는 외부 경로 신호가 없다", () => {
    assert.ok(!tagged("[정부24] 서식 / 본인인증(휴대폰 인증번호) 후 지급 https://www.gov.kr/"));
  });
});

describe("확인된 기관·서비스 이름과 기한부 신청 조건", () => {
  const link = "https://forms.invalid/demo";
  const tagged = text => extractCodeSignals(text).signals.includes(SIG_AGENCY_IMPERSONATION);
  for (const text of [
    `[정부24] 서식 예시 / 교육 이용권 미신청자, 신청 마감 임박. 신청하기 ${link}`,
    `[SKT] 견본 / 고객님께 지급된 공연 쿠폰은 오늘 소멸 예정. 쿠폰 받기 ${link}`,
    `에너지바우처 신청 안내 서식 / 지원금 수령은 전용 앱 설치 후 신청 가능. ${link}`,
    `(교통범칙금) 모의 양식 / 미납분 조회 시 카드번호로 본인인증 필수. ${link}`,
    `[교통범칙금] 모의 양식 / 조회 시 본인인증(성명, 연락처, 카드번호) ${link}`,
    `[현대카드] 개인별 도서 쿠폰 소멸 예정. 금요일까지 받기 ${link}`,
  ]) it(text, () => assert.ok(tagged(text)));
  for (const text of [
    `[SKT] (광고) 공연 쿠폰 오늘 소멸 예정. 쿠폰 받기 ${link} 무료 수신거부`,
    `[SKT] 고객님의 쿠폰 소멸 내역입니다. 목록 보기 ${link}`,
    `[정부24] 신청 마감일 변경 공고. 일정 보기 ${link}`,
    `에너지바우처 사업 설명회 자료를 게시했습니다. ${link}`,
    `(교통범칙금) 모의 양식 / 카드번호로 본인인증하지 마세요. ${link}`,
    `학교 독서회에서 에너지바우처 신청 사례를 소개합니다. ${link}`,
    "[정부24] 교육 이용권 미신청자, 신청 마감. 신청하기 https://www.gov.kr/",
  ]) it(text, () => assert.ok(!tagged(text)));
});

describe("확인되지 않은 주소에서 반송·거래 취소를 처리하는 발신 주장", () => {
  const outside = "https://review.invalid/box";
  const tagged = text => extractCodeSignals(text).signals.includes(SIG_AGENCY_IMPERSONATION);
  for (const text of [
    `우체국택배: 모의 배송 서식 / 주소지 불일치로 반송 예정. ${outside}`,
    `[CJ대한통운] 시험 필드 / 주소 오류로 반송됩니다. ${outside}`,
    `[우체국소포] 시험 필드 / 주소 불일치로 배달 보류. 내일까지 처리하지 않으면 반송 예정입니다. ${outside}`,
    `[현대카드] 모의 승인 내역 / 결제 취소를 원하시면 여기에서 처리. ${outside}`,
  ]) it(text, () => assert.ok(tagged(text)));
  for (const text of [
    `[CJ대한통운] 배송이 끝났습니다. 배송 조회 ${outside}`,
    `[현대카드] 결제 취소가 완료되었습니다. ${outside}`,
    `[현대카드] 사칭 주의. 결제 취소를 원하시면 여기를 누르라는 문구입니다. ${outside}`,
    `[동네 그림교실] 도록 주소 오류로 반송됩니다. ${outside}`,
    "[우체국] 주소지 불일치로 반송 예정입니다.",
  ]) it(text, () => assert.ok(!tagged(text)));
});

describe("근거 카드의 발신자 표기와 외부 주소", () => {
  const link = "https://catalog.invalid/spring";
  for (const title of [
    "[Web발신]\n[현대카드] 행사 주소 변경 신청서",
    "전북은행입니다. 주소 정정 양식",
    "CJ대한통운 배송 안내. 수령지 수정 접수",
    "[정부24] 주소 변경 신청서",
  ]) it(title, () => {
    const { signals } = extractCodeSignals(`${title} ${link}`);
    assert.ok(signals.includes(SIG_AGENCY_IMPERSONATION));
    assert.ok(decide({ signals_final: signals, signals_code: signals }).fired_rules.includes("R6"));
  });

  for (const text of [
    `자료실에서 전북은행 사례를 소개했습니다. ${link}`,
    `[동네 독서회] 전시 목록 ${link}`,
    `[현대카드] 사칭 문자 예방 교육입니다. 접속하지 마세요. 예시 ${link}`,
    "[전북은행] 고객 설명회는 목요일입니다.",
    `[현대카드동호회] 이번 달 전시 목록 ${link}`,
    `[Web발신]\n[현대카드] 전시 일정 ${link}`,
    `전북은행입니다. 자료 목록 ${link}`,
    `CJ대한통운 배송 안내. 물건 조회 ${link}`,
    `[정부24] 주소 변경 완료 내역 ${link}`,
    `[전북은행] 주소를 수정하지 마세요. 교육자료 ${link}`,
    `[전북은행] 문자로 주소 변경 신청하지 마세요. 안내 자료 ${link}`,
    `[현대카드] 외부 주소에서 주소 수정 요청은 사칭일 수 있습니다. 안내 자료 ${link}`,
  ]) it(text, () => assert.ok(!extractCodeSignals(text).signals.includes(SIG_AGENCY_IMPERSONATION)));
});
