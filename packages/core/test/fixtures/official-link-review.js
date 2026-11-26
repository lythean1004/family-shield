// 로컬 교차 시험용. 정상 기관 주소·예약된 .invalid·example 이메일만 쓰고 접속하지 않는다.
const official = "https://www.gov.kr/portal/main";
export const officialLinkReviewCases = [
  { id: "normal", name: "정상 공식 링크 1개", text: `안내 ${official}`, level: "확인필요", notice: true },
  { id: "repeat", name: "같은 공식 링크 반복", text: `${official} 다시 ${official}`, level: "확인필요", notice: true },
  { id: "mixed", name: "공식·미등록 합성 링크 혼합", text: `${official} 참고 https://sample.invalid/guide`, level: "주의", notice: false },
  { id: "email", name: "정상 이메일만", text: "문의 help@example.com 또는 john.doe@example.org", level: "확인필요", notice: false },
  { id: "official-email", name: "공식 링크·정상 이메일", text: `${official} 문의 help@example.com`, level: "확인필요", notice: true },
  { id: "money", name: "공식 링크·송금 요구", text: `${official} 오늘 50만원 입금해 주세요`, level: "주의", notice: false },
  { id: "info", name: "기관 주장·개인정보 요구", text: `[국세청] 인증번호를 알려주세요. ${official}`, level: "위험", notice: false },
  { id: "app", name: "기관 주장·설치 요구", text: `[국세청] 앱 설치하세요. ${official}`, level: "위험", notice: false },
  { id: "called", name: "전화 받은 뒤 공식 링크", text: `안내 ${official}`, parentInputs: { called_before: true }, level: "위험", notice: false },
  { id: "agency-mixed", name: "기관 주장·혼합 링크", text: `[국세청] 안내 ${official} 참고 https://sample.invalid/guide`, level: "위험", notice: false },
];
