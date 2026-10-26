# 연결 현황 (2026-10-27)

어디까지 실제로 연결됐고, 어디가 가짜 저장소·대기 상태인지 한곳에 정리한다.

## 1. 연결 완료

| 구간 | 내용 | 확인 |
|---|---|---|
| 판별 코어 `packages/core` | 마스킹·코드 신호·규칙 엔진(R1~R10)·요약 문구·파이프라인·1회용 토큰·URL 평판 | core 테스트 |
| 카카오 스킬 서버 `skill/` | 판별 → 결과 문구, [자세히 보기] → `/check/result?t=` 1회용 토큰, `GET /api/result` | skill 테스트, 로컬 왕복 |
| 웹 PWA `web/` | 부모님 판별 흐름(P2~P8), 보호자 C2·C3, 공식 번호, 데모, 설정, 퀴즈 | web 테스트 62, `vite build` |
| 로컬 Supabase DB | 마이그레이션 10개, RLS 전체, 1회용 토큰 RPC, 만료 삭제 함수 | pgTAP 38/38 |

## 2. 기기 안 가짜 저장소 (Supabase 연결 시 교체)

| 파일 | 지금 | 바꿀 대상 |
|---|---|---|
| `web/src/data/confirm.js` | localStorage 확인 요청(F5-3 요청 종류, F5-10 `listRecent`) | `confirm_requests` 테이블 + 폴링 |
| `web/src/data/consent.js` | localStorage 동의(F5-9) | `circle_members` 동의 컬럼 + RLS |
| `web/src/data/misjudge.js` | localStorage 오판 기록(F4-13) | 별도 동의 후 마스킹 문장만 저장 |
| `web/src/screens/FamilyDashboardScreen.jsx` | 같은 기기 요청만 표시 | 로그인 보호자에게 온 요청만(RLS) |
| `web/src/screens/QuizScreen.jsx` | 점수는 화면에서만 | `is_practice=true` 기록(F7-2) |

웹에는 아직 `createClient` 호출이 없다. `@supabase/supabase-js`는 설치만 되어 있다.

## 3. Supabase 연결 후 진행 (보류)

S1~S6, F1, F2-2/S4, F2-3, F3-2, F3-4, F4-3, F1-5/7, F5-2/F5-4(VAPID 웹 푸시), 퀴즈 재연습·전후 비교.

## 4. 사람이 확인할 것

- F2-5 `normalNote` 문구: 공식 원문 대조 전(needs_review). 자동 수집 실패 내역은 `contacts.js` 주석.
- 대검찰청 → 공소청 개편: 공식 번호(02-3480-2000)와 명칭 재확인.
- F4-2 공유 수신: 안드로이드에서 PWA 설치 후 실제 공유로 시험.
