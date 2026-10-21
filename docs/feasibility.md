# 가족방패 구현 가능성 검증과 사전 준비

작성일: 2026-10-21 · 기준: docs/prd.md v0.4 · 방법: Claude Code(본 세션)와 서브에이전트 3명이 공식 문서를 나눠 조사(브라우저·PWA·Vercel / Supabase·문자 인증 / AI 모델·외부 API)하고, 운영사 PDF 2종(「지원금 사용 안내」, 「선정자 오리엔테이션」)을 대조했다. **가입·결제·코드 작성은 하지 않았다.**

## 결론

**PRD의 기능은 모두 Claude Code + Supabase + Vercel + Claude API로 구현할 수 있다.** 웹앱이라서 못 만드는 기능은 없고, 조건이 붙는 기능이 5개 있다(2장).

다만 개발을 시작하기 전에 **운영 규정 때문에 먼저 정할 것이 3가지** 있다(1장). 특히 마감이 12/18이 아니라 **12/11**이고, **11/16 중간과제**가 있다.

---

## 1. 먼저 정해야 할 것 (운영 규정과의 충돌)

| # | 확인한 사실 | 영향 | 제안 |
|---|---|---|---|
| 1 | 최종 결과물·결과보고서 제출은 **2026-12-11(금)**, 중간과제 제출은 **2026-11-16(월)**, 성과공유회는 12월 중(오리엔테이션 p.6~7) | CLAUDE.md·PRD의 마감(12/18)과 9주 일정이 맞지 않음. 실제로는 약 7주 반 | 마감을 12/11로 고치고, 11/16에 낼 1차 구현본을 기준으로 일정을 다시 짠다(5장 초안) |
| 2 | 운영사는 **실험실 포인트(aitestbed.kr의 ‘모두의 AI 바이브코딩’) 우선 사용**을 원칙으로 둔다. “기존 코드가 있어도 개발·검증은 실험실 중심”, “멘토링은 실험실의 1차 구현본을 바탕으로” 진행(p.10, 21~22) | Claude Code·Supabase·Vercel 중심 계획이 원칙과 부딪칠 수 있음 | 운영사무국에 문의(6장). 답을 받기 전까지는 **실험실 가입·바이브코딩 신청·교육 이수를 먼저 해 두고**, 1차 구현본을 실험실에도 올릴 수 있게 준비 |
| 3 | 외부 비용은 ‘AI 활용비’(AI 구독·API·클라우드)로 선결제 후 정산. 10/16~12/11 실제 이용분만 인정, **선불 충전 잔액·기존 구독 제외**, 월 구독은 12월 이내, 해외 결제는 인보이스+원화 청구내역(지원금 사용 안내 p.1~3) | Anthropic API는 선충전 방식이라 ‘사용 내역’ 증빙이 필요. 이미 쓰던 Claude 구독은 인정되지 않을 수 있음 | 결제·사용 내역을 바로 캡처해 두고, 소액만 충전 |

---

## 2. 기능별 구현 가능성

| PRD 기능 | 판단 | 조건·제약 | 확신도 |
|---|---|---|---|
| 텍스트 붙여넣기 판별, 규칙 엔진, 근거 카드 | 가능 | 일반 웹 + Edge Function | 높음 |
| AI 신호 추출(정형 JSON) – Claude Haiku 5.5 | 가능 | `output_config.format`(json_schema) 지원. 스키마에 `minLength`·`maximum` 같은 제약을 넣으면 오류 → **검증은 우리 코드에서**. 거절(`refusal`)·잘림(`max_tokens`)은 스키마를 어길 수 있어 **고정 안내로 대체** 필수 | 높음 |
| AI 신호 추출 – Gemini 3.1 Flash-Lite | 조건부 | 정식 ID `gemini-3.1-flash-lite`. **무료 등급은 입력이 제품 개선과 사람 검토에 쓰이고 개인정보 입력 금지** → 실제 부모님 문자는 결제 연결한 유료 등급만. 무료 등급은 합성 평가 세트에만. 이 모델의 정형 출력 지원은 실제 호출로 확인 필요 | 높음/중간 |
| 웹 푸시(가족 확인·알림) | 조건부 | 아이폰은 **iOS 16.4 이상 + 홈 화면 추가** 필수. 권한 요청은 버튼을 누른 뒤에만. 서버는 404·410 응답 시 구독 삭제. Deno에서는 `npm:web-push`가 실패할 수 있어 `jsr:@negrel/webpush` 등 대안을 **1주차에 작게 시험** | 높음/중간 |
| 휴대폰 문자 인증(+82) | 조건부 | Supabase 기본 업체에 한국 업체 없음 → **Send SMS Hook**(무료 요금제 가능)으로 솔라피 등 연결. 약 5초 안에 응답. 로컬은 `test_otp`로 실제 문자 없이 시험 | 높음 |
| 예비 문자(링크 없음) | 조건부 | 솔라피 개인 계정에 본인 휴대폰을 발신번호로 등록(ARS + 본인인증). 통신사 ‘번호도용문자 차단서비스’가 켜져 있으면 발송 실패 → 해지 필요. SMS 18원·LMS 45원(부가세 별도). 인증 문자는 `[가족방패]`로 시작, 광고 금지 | 중간 |
| 캡처 글자 인식(기기 안) | 조건부 | **Tesseract.js + 한글 데이터(가벼운 버전 약 1.5MB)** 추천. 브라우저 내장 TextDetector는 정식 기능이 아니어서 불가. 한글 문자 캡처 정확도·속도는 공식 자료가 없어 **실측(캡처 20건) 필요**. 인식 확인 화면(P1-a)과 “직접 붙여넣기” 대체 흐름 필수 | 중간 |
| 음성 읽어주기 | 조건부 | Web Speech API. 아이폰은 **[읽어주기] 버튼을 누른 순간에만** 동작, 무음 모드 영향. 한국어 목소리 유무는 기기마다 달라 실기기 확인 | 중간 |
| 공유 버튼으로 넣기(F4-2, P2) | 안드로이드만 | 아이폰 사파리 미지원(WebKit 요청 미해결) | 중간~높음 |
| URL 평판 조회(도메인만) | 가능 | **Google Safe Browsing v5 `hashes.search`** 추천: 해시 앞 4바이트만 보내 Google이 주소를 알 수 없음. 무료·**비상업 용도만**. 호스트만 조회하면 경로 단위 위협은 놓칠 수 있어 보조 신호로만 사용. VirusTotal 공개 API는 상업 사용 불가·하루 500건 | 높음 |
| 오프라인 번호 카드 | 가능 | 홈 화면 앱은 사파리의 7일 삭제 규칙에서 빠짐. 저장공간 부족 시 지워질 수 있어 `navigator.storage.persist()` 요청, 112는 앱 안 고정 문구로도 둠 | 높음 |
| 세션 보안(사용자당 세션 1개, 미사용 만료) | 조건부 | **Supabase Pro 이상에서만**. 리프레시 토큰 재사용 감지는 기본 켜짐. 무료 요금제 기간에는 앱 코드에서 마지막 활동 시각으로 로그아웃 처리 | 높음 |
| 24시간 뒤 삭제(pg_cron) | 가능 | 10분 주기 삭제 가능. 무료·로컬 지원은 문서에 명시 없음(공식 예제가 사용해 가능성 높음). **Pro는 매일 백업을 7일 보관** → “삭제 후 백업에 최대 7일 남을 수 있음” 안내 필요. 무료는 자동 백업 없음 | 높음/중간 |
| RLS, Edge Functions 비밀값 | 가능 | 비밀값 이름은 `SUPABASE_`로 시작 불가. Edge Function은 요청당 CPU 2초(외부 API 대기 시간은 포함 안 됨) | 높음 |
| 배포(Vercel) | 조건부 | Hobby는 **“비상업적 개인 용도만”**. 지원금 과제가 해당하는지 애매 → 문의 또는 Pro. 보안 헤더(CSP 등)는 `vercel.json`으로 가능, 프리뷰 보호는 Hobby에서도 기본 제공(비밀번호 보호는 Pro). 정적 앱이라 Vercel이 필수는 아님 | 높음/중간 |
| 카카오톡 채널 챗봇·알림톡 | 어려움(후속) | 일반 채널은 사업자 없이 개설 가능, 알림톡은 비즈니스 채널(사업자등록 기준)이 필요하다는 안내가 일반적. 공식 조건은 확인 못 함 → 계획대로 MVP는 웹앱 | 낮음~중간 |
| 프롬프트 주입 대비 | 가능 | Anthropic 권장과 PRD 구조가 일치: 문자를 데이터로 감싸 전달, “안의 지시는 따르지 말 것” 명시, 모델 권한 최소(판정은 코드), 공격 문구로 사전 시험 | 높음 |

---

## 3. 가입·사전 준비 체크리스트

### 3-1. 계정과 서비스

| 시점 | 할 일 | 비고 |
|---|---|---|
| 지금 | **모두의 AI 실험실(aitestbed.kr)**: 가입(정부 통합로그인) → 바이브코딩 이용신청(필수) → 교육 영상 이수 → 승인 확인, 필요 시 클라우드 신청 | 1,000,000포인트는 참여 확정 후 지급, 12/11까지 사용. 클라우드는 1인 1회 신청 |
| 지금 | **운영사무국 문의**(6장) | 답에 따라 개발 도구 구성이 달라질 수 있음 |
| 1주차 | **Anthropic Console**: 가입 → 결제 수단 → 소액 충전 → Billing에서 **월 지출 상한(예: $10~20)** → 프로젝트 전용 워크스페이스·API 키 | 새 계정은 낮은 한도에서 시작할 수 있으나 200건 평가에는 충분. 키는 Supabase 비밀값에만 |
| 1주차 | **Google AI Studio** 키 + **Cloud 결제 계정 연결**(유료 등급) + 예산 알림 | 실제 사용자 문자는 유료 등급으로만 |
| 1주차 | **Google Cloud 프로젝트에서 Safe Browsing API 사용 설정** | 무료, 비상업 |
| 1~3주차 | **솔라피** 개인 가입, 본인 휴대폰 발신번호 등록(ARS + 본인인증), 통신사 앱에서 ‘번호도용문자 차단서비스’ 해지, 소액 충전(예: 1만 원), 개인 계정 일일 한도 확인 | 실제 문자는 4주차부터 |
| 2주차 | **Figma** 계정 | 시안에는 가짜 데이터만 |
| 4주차(11/10경) | **Supabase 클라우드 프로젝트**(서울 리전) 생성, 시연 기간 Pro(월 $25) 여부 결정 | 무료는 7일 미사용 시 정지. Pro는 세션 보안·자동 백업 포함 |
| 4주차(11/10경) | **Vercel** 연결, Hobby/Pro 결정 | 1장 3번 정산 규칙 적용 |

### 3-2. 이 PC의 개발 환경 (2026-10-21 확인)

| 도구 | 상태 | 할 일 |
|---|---|---|
| Node.js v24, npm 11, git 2.53, GitHub CLI(로그인됨) | 준비됨 | – |
| Docker Desktop 29.8 | 설치됨, **실행 안 됨** | 실행, WSL2 엔진 확인 |
| Supabase CLI | 없음 | `npx supabase`로 사용(Node 20 이상이면 됨) |
| Vercel CLI, Deno | 없음 | 필요할 때 설치(필수 아님) |
| 메모리 | **약 7.7GB** | 로컬 Supabase는 컨테이너 여러 개를 띄워 빠듯할 수 있음. 개발 중 다른 프로그램을 줄이고, 부족하면 필요한 서비스만 띄우는 설정 검토 |

### 3-3. 시험용 기기

- 아이폰 1대(iOS 16.4 이상): 홈 화면 추가, 웹 푸시, 한국어 음성
- 중간급 안드로이드 1대: 웹 푸시, 공유 버튼, 캡처 글자 인식 속도
- 부모님용·자녀용 2대가 있어야 SC1(가족 확인) 시연 가능

### 3-4. Claude Code(본 세션 + 서브에이전트 3명)로 개발할 때의 역할

코드 작성과 테스트는 아래처럼 나눠 동시에 진행할 수 있다. 서로 같은 파일을 고치지 않도록 영역을 나누고, 본 세션이 통합과 검토를 맡는다.

| 담당 | 영역 | 주요 산출물 |
|---|---|---|
| 본 세션 | 통합, 설계 결정 기록, 코드 검토, 보안 점검, 문서 | decisions.md, 리뷰, 통합 테스트 |
| 서브에이전트 A | 프론트엔드(PWA): 화면, 서비스 워커·오프라인 카드, 웹 푸시 구독, 글자 인식, 음성 | `web/` |
| 서브에이전트 B | 백엔드(Supabase): 스키마·RLS 마이그레이션과 테스트, Edge Functions(판별·확인 요청·푸시·SMS Hook), pg_cron 삭제 | `supabase/` |
| 서브에이전트 C | AI·평가: 마스킹·출력 검증기·규칙 엔진(테스트 먼저), 시스템 프롬프트, 평가 스크립트, 평가 세트 초안 | `packages/core/`, `eval/` |

- 실제 키·계정이 필요한 작업(클라우드 배포, 실제 문자 발송, 유료 API 호출)은 사람이 키를 넣고 승인한 뒤에만 진행한다.
- 평가 세트 문장 초안은 서브에이전트가 쓸 수 있지만, 정답 검수와 실제 정상 문자(D2)는 사람이 맡는다.

### 3-5. 사람이 해야 하는 일 (Claude Code가 대신 못 함)

- 모든 가입, 본인인증, 결제, 발신번호 등록, API 키 발급과 보관(`.env`·Supabase 비밀값)
- 실기기 시험(푸시, 음성, 글자 인식), 어르신 대상 테스트와 동의서 받기
- 평가 세트 D2(실제 정상 문자) 동의·비식별 확인, 정답(level_human) 최종 검수
- 근거 카드 원문 대조, 이용조건 확인
- 운영사 증빙(영수증·사용 내역·인보이스) 정리

---

## 4. 예상 비용 (12/11까지)

| 항목 | 예상 | 확인 상태 |
|---|---|---|
| Claude Haiku 5.5 API | 평가 200건 × 여러 차례 + 시연 → 수 달러 이내 | 가격 확인(입력 $0.10, 출력 $0.50 / 100만 토큰) |
| Gemini 3.1 Flash-Lite(유료 등급) | 비교 실험 → 수 달러 이내 | 가격 확인(입력 $0.25, 출력 $1.50) |
| Safe Browsing | 무료 | 확인 |
| 솔라피 문자 | 1만 원 충전으로 충분 | 확인(SMS 18원) |
| Supabase Pro | 월 $25 × 1~2개월(선택) | 확인 |
| Vercel Pro | 선택 | **가격 미확인** |
| 실험실 포인트·클라우드 | 지원(무료) | 오리엔테이션 확인 |

모든 외부 결제는 ‘AI 활용비’로 선결제 후 정산하며, 선불 잔액은 인정되지 않는다(1장 3번).

---

## 5. 일정 조정 초안 (마감 12/11, 중간과제 11/16)

2026-10-21 사용자가 마감 12/11을 확정했고, 이 일정을 PRD 17장에 반영했다.

| 주차 | 기간 | 작업 | 산출물 |
|---|---|---|---|
| 1 | 10/21–10/26 | 실험실 가입·바이브코딩 신청·교육, 운영사무국 문의, 계정·키, Docker·로컬 Supabase, 웹 푸시(Deno) 작은 시험 | 사전 준비 완료 |
| 2 | 10/27–11/02 | Figma 핵심 화면, 로컬 스키마·RLS·테스트, 판별 파이프라인(마스킹·검증·규칙 엔진 테스트 먼저) | SC2·SC4 로컬 데모 |
| 3 | 11/03–11/09 | 평가 세트 200건 작성·검수, 모델 2개 비교, URL 평판 조회 | 첫 측정 결과 |
| 4 | 11/10–11/16 | 클라우드 Supabase·배포, 가족 연결·웹 푸시 기본 흐름, **중간과제 제출(11/16)** | 1차 구현본(SC1·SC2·SC4) |
| 5 | 11/17–11/23 | 사후 대응, 예비 문자, 캡처 글자 인식, 음성, 가족용 화면, 테스트 가족 실사용 시작 | SC3 |
| 6 | 11/24–11/30 | 멘토링 반영, 오판 신고, 보안 점검, 부모님 세대 테스트 시작 | – |
| 7 | 12/01–12/07 | 부모님 세대 20~30명 테스트, 2차 측정 | 사용성 결과 |
| 8 | 12/08–12/11 | 결과보고서, 시연 영상, **최종 제출(12/11)** | 최종 결과물 |

- 클라우드 Supabase 생성이 6주차(11/20)에서 **4주차(11/10경)**로 앞당겨진다. 이후 계속 쓰므로 무료 요금제 정지 문제는 크지 않다.
- 주당 시간이 부족하면 P1(캡처, 음성, 오판 신고, 가족용 화면) 중 신청서 핵심인 **캡처·음성**을 먼저 하고 나머지는 뒤로 미룬다.

---

## 6. 운영사무국 문의 결과 (2026-10-21 사용자 확인)

| # | 질문 | 답 / 상태 | 영향 |
|---|---|---|---|
| 1 | Claude Code·Supabase·Vercel로 개발해도 ‘실험실 포인트 우선’ 원칙에 맞는지 | 실험실 포인트는 실험 단계 용도. 필요하면 바이브코딩 월 결제 가능 | Claude Code 중심 개발 유지. 1차 구현본을 실험실에서 보여 줄 방법은 OT에서 함께 확인 |
| 2 | 실험실 포인트로 외부 LLM API 호출 가능 여부 | 안 될 것으로 예상, **10/21 OT에서 확인 예정** | 외부 API(Anthropic·Gemini) 비용은 AI 활용비로 정산하는 것을 기본으로 둠 |
| 3 | 선충전 API 크레딧 정산 증빙 | **결제 영수증으로 갈음**, 집행 전 사전 확인 후 진행 | 충전 전에 운영사무국 확인을 받고, 영수증 보관 |
| 4 | 클라우드 월 구독 정산 | **우선 결제 없이 진행 예정** | Supabase 무료, Vercel 무료(Hobby)로 시작(7장 영향 참고) |
| 5 | 중간과제(11/16) 제출물 | **1차 구현본**으로 이해 | 4주차 끝에 SC1·SC2·SC4가 동작하는 1차 구현본 |
| 6 | 기존 Claude 구독 인정 여부 | **확인 예정** | 확인 전까지 정산 대상에서 제외하고 계획 |
| 7 | 카카오 알림톡(사업자 없이) | 기술적으로 어려울 것으로 예상, **확인 예정** | 계획대로 웹앱 + 웹 푸시 + 예비 문자 |

### 무료 요금제로 시작할 때 달라지는 점

| 항목 | 무료 요금제 상태 | 대응 |
|---|---|---|
| Supabase 세션 보안(사용자당 세션 1개, 미사용 만료) | 지원 안 됨(Pro 이상) | 앱 코드에서 마지막 활동 시각을 확인해 로그아웃, 새 기기 로그인은 auth_events로 감지해 가족 알림 |
| Supabase 자동 백업 | 없음 | “24시간 뒤 삭제” 약속과는 충돌 없음. 대신 **스키마는 마이그레이션 파일(Git), 근거 카드는 저장소 파일**로 관리해 데이터 유실에 대비 |
| Supabase 일시정지(7일 미사용) | 해당 | 4주차부터 매일 쓰므로 위험 낮음. 12/11 이후 시연이 남아 있으면 정지 전 접속 |
| Vercel Hobby ‘비상업적 개인 용도’ | 지원금 과제 해당 여부 애매 | OT에서 함께 문의. 문제가 되면 다른 정적 호스팅으로 옮길 수 있게 Vercel 전용 기능은 쓰지 않음(보안 헤더만) |

---

## 7. PRD에 반영할 제안 (확정 후 반영)

| PRD 위치 | 제안 |
|---|---|
| 0장, 17장, CLAUDE.md | 마감 12/11, 중간과제 11/16, 5장 일정 |
| 13-1 캡처 글자 인식 | Tesseract.js(한글 가벼운 데이터)로 1차 결정 후보, 실측 후 decisions.md에 기록 |
| 13-1 URL 평판 조회 | Google Safe Browsing v5 `hashes.search`, 호스트만, 비상업 조건 |
| 13-1 알림 | Deno용 웹 푸시 라이브러리 시험 결과를 decisions.md에 기록 |
| 12-2 세션 | 무료 기간에는 앱 수준 미사용 로그아웃, Pro 전환 시 Supabase 설정 사용 |
| 11-2 보관 | Pro 사용 시 “백업에 최대 7일 남을 수 있음” 명시 |
| 13-2 모델 | Haiku: 스키마에 길이·범위 제약 금지(코드 검증), 거절 = AI 실패 처리. Gemini: 실제 사용자 문자는 유료 등급만, 무료 등급은 합성 평가 세트만 |
| 10장 예비 문자 | 솔라피, `[가족방패]` 접두어, 광고 금지, “요청하지 않았다면 무시하세요” |
| 19장 | 6장 문의 항목 추가 |

---

## 7-1. 대안 플랫폼 (기존 안 유지, 막힐 때만 전환)

**결정(2026-10-21):** Supabase + Vercel을 그대로 쓴다. 아래 트리거가 생길 때만 해당 부분을 대안으로 옮긴다. 서브에이전트 2명이 공식 문서로 Firebase와 Cloudflare를 조사했다(가입·결제 없음).

### 한눈에 비교

| 항목 | Supabase + Vercel (현재) | Cloudflare | Firebase |
|---|---|---|---|
| 카드 없이 시작 | 가능 | 가능(가입 시 카드 필요 여부는 미확인) | **서버 함수·휴대폰 인증 문자는 Blaze(카드 등록) 필수** |
| 호스팅 상업 이용 | Vercel Hobby는 ‘비상업적 개인 용도만’ | 무료 요금제 금지 조항 없음 | 열어 본 문서에 언급 없음 |
| DB와 권한 | Postgres + RLS | D1(SQLite), **RLS 없음 → 코드로 권한 검사** | Firestore + Security Rules(규칙 테스트 도구 있음) |
| 휴대폰 인증 | Send SMS Hook + 솔라피 | **기능 없음**(직접 구현은 보안 위험 큼) | 기본 제공(Blaze), 하루 3,000건, 한국 문자 업체 선택 불가 |
| 24시간 뒤 삭제 | pg_cron, 무료는 자동 백업 없음 | 크론 무료(계정당 5개), **D1 Time Travel이 7일 보관(끌 수 없음)** | TTL은 만료 후 ‘보통 24시간 안’ 삭제 → 예약 함수(Blaze) 병행 필요 |
| 웹 푸시 | Deno 라이브러리 실측 필요 | Web Crypto 라이브러리 실측 필요 | FCM 무료, 가장 안정적(발송 서버는 필요) |
| 로컬 개발 | Docker 필요(메모리 빠듯) | Docker 불필요(wrangler) | Docker 불필요, Java 21 이상 필요 |
| 전환 노력 | – | **호스팅만: 0.5~1일** / 전면: 30~40시간(추정) | 전면: 25~35시간(추정) |

### 전환 트리거와 갈 곳

| 상황 | 옮길 곳 | 범위 |
|---|---|---|
| 운영사나 Vercel이 지원금 과제를 Hobby의 ‘상업적 이용’으로 판단 | **Cloudflare(Workers 정적 파일 또는 Pages)** | 호스팅만. DB·인증은 Supabase 유지. CSP `connect-src`에 Supabase 주소 추가 |
| Deno에서 웹 푸시가 대안 라이브러리까지 실패 | 푸시 발송만 Vercel 함수 또는 Cloudflare Worker로, 또는 FCM 도입(발송 서버 필요) | 푸시 발송 부분만 |
| Supabase Edge Functions 한도·지연 문제 | 해당 함수만 Cloudflare Workers로(DB는 Hyperdrive 또는 Supabase API로 연결) | 함수 단위 |
| Send SMS Hook + 솔라피 연동이 1~2주차 시험에서 끝내 실패 | Firebase Auth 휴대폰 인증 검토(**Blaze·카드 필요** → 운영사 정산 확인 후) | 인증만, 나머지는 유지하는 혼합안 먼저 검토 |
| Supabase 무료 프로젝트가 정지·한도로 시연이 반복해서 끊김 | Supabase Pro($25/월)를 먼저 검토, 그래도 안 되면 Firebase 전면 전환 | 전면 전환은 마지막 수단 |

### 대안 쪽 주의점
- **Cloudflare D1**은 Time Travel이 7일 보관되어 지운 데이터가 7일간 복구 가능한 상태로 남는다. 쓰게 되면 안내 문구에 밝혀야 한다. 지역은 ‘아시아’ 힌트만 줄 수 있고 서울 보장은 없다.
- **Cloudflare Workers** 무료는 요청당 CPU 10ms(외부 API 대기 시간은 제외). 푸시 암호화·출력 검증이 그 안에 끝나는지 실측 필요.
- **Firebase** 예산 알림은 서비스를 멈추지 않는다(Cloud Functions에는 지출 상한 기능이 있음). 새 프로젝트는 문자 발송 지역이 막혀 있어 한국을 직접 허용해야 한다. Hosting 기본 주소(`*.web.app`)에서는 HSTS를 구글 값으로 덮어쓴다.
- 대안 모두 해외 처리 가능성이 있어 국외 이전 고지 검토는 똑같이 필요하다.

### 대안 조사 근거(조사자가 연 문서)
- Cloudflare: [Pages 한도](https://developers.cloudflare.com/pages/platform/limits/), [헤더](https://developers.cloudflare.com/workers/static-assets/headers/), [Workers 한도](https://developers.cloudflare.com/workers/platform/limits/), [Workers 가격](https://developers.cloudflare.com/workers/platform/pricing/), [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/), [D1 한도](https://developers.cloudflare.com/d1/platform/limits/), [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/), [D1 위치](https://developers.cloudflare.com/d1/configuration/data-location/), [Hyperdrive + Supabase](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-database-providers/supabase/), [Turnstile](https://developers.cloudflare.com/turnstile/plans/), [약관](https://www.cloudflare.com/terms/)
- Firebase: [가격](https://firebase.google.com/pricing), [Functions 시작](https://firebase.google.com/docs/functions/get-started), [예약 함수](https://firebase.google.com/docs/functions/schedule-functions), [요금 폭탄 방지](https://firebase.google.com/docs/projects/billing/avoid-surprise-bills), [Auth 한도](https://firebase.google.com/docs/auth/limits), [휴대폰 인증](https://firebase.google.com/docs/auth/web/phone-auth), [Firestore TTL](https://firebase.google.com/docs/firestore/ttl), [보안 규칙 조건](https://firebase.google.com/docs/firestore/security/rules-conditions), [위치](https://firebase.google.com/docs/firestore/locations), [FCM 웹](https://firebase.google.com/docs/cloud-messaging/js/client), [Hosting 설정](https://firebase.google.com/docs/hosting/full-config), [에뮬레이터](https://firebase.google.com/docs/emulator-suite/install_and_configure), [데이터 처리 약관](https://firebase.google.com/terms/data-processing-terms)
- 확인하지 못한 것: Cloudflare 무료 가입의 카드 필요 여부, Firebase 한국 문자 공식 요금·발신자 표시, Spark의 TTL 지원, 각 대안의 실제 CPU 시간·메모리

## 8. 확인하지 못한 것

- 한글 문자 캡처의 실제 글자 인식 정확도·속도, 아이폰 한국어 음성 기본 탑재 여부, 홈 화면 앱에서의 음성 동작
- Vercel Pro 가격, Hobby의 ‘상업적 이용’에 지원금 과제가 해당하는지
- pg_cron의 무료·로컬 지원 명시, CAPTCHA가 휴대폰 OTP에 적용되는지
- NHN Cloud·네이버 SENS의 개인 발신번호 등록 조건, 광고 없는 알림 문자의 정보통신망법상 지위(KISA 안내서 원문)
- Gemini 3.1 Flash-Lite의 정형 출력 실제 동작, Google 공식 SDK의 Deno 지원
- 카카오 오픈빌더·알림톡의 현재 공식 조건
- 무료 Supabase 프로젝트가 정지된 뒤 복원 가능한 기간(문서 간 90일/1년 불일치)

## 근거 (조사자가 실제로 연 문서)

- 운영사: 「[모두의 AI 실험실] 지원금 사용 안내」, 「모두의AI실험실_선정자오리엔테이션_공유」(저장소 폴더의 PDF)
- 웹 푸시·PWA: [WebKit 웹 푸시](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [WebKit 선언형 웹 푸시](https://webkit.org/blog/16535/meet-declarative-web-push/), [web.dev 구독](https://web.dev/articles/push-notifications-subscribing-a-user), [RFC 8030](https://www.rfc-editor.org/rfc/rfc8030), [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API), [Web Share Target](https://developer.chrome.com/docs/capabilities/web-apis/web-share-target), [WebKit 저장소 정책](https://webkit.org/blog/14403/updates-to-storage-policy/), [MDN getVoices](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/getVoices), [Tesseract.js](https://github.com/naptha/tesseract.js), [Shape Detection](https://developer.chrome.com/docs/capabilities/shape-detection)
- Vercel: [Fair use](https://vercel.com/docs/limits/fair-use-guidelines), [Deployment Protection](https://vercel.com/docs/deployment-protection), [환경변수](https://vercel.com/docs/environment-variables)
- Supabase: [Phone login](https://supabase.com/docs/guides/auth/phone-login), [Send SMS Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook), [Sessions](https://supabase.com/docs/guides/auth/sessions), [CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha), [Cron](https://supabase.com/docs/guides/cron), [Functions limits](https://supabase.com/docs/guides/functions/limits), [Secrets](https://supabase.com/docs/guides/functions/secrets), [Backups](https://supabase.com/docs/guides/platform/backups), [Pricing](https://supabase.com/pricing), [Regions](https://supabase.com/docs/guides/platform/regions), [CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), [Migrations](https://supabase.com/docs/guides/deployment/database-migrations), [@negrel/webpush](https://jsr.io/@negrel/webpush)
- 문자: [솔라피 발신번호 FAQ](https://solapi.com/guides/senderid-faq), [솔라피 공지](https://solapi.com/notices/notices-20260303-112903), [솔라피 요금](https://solapi.com/pricing)
- AI: [Claude 모델](https://platform.claude.com/docs/en/about-claude/models/overview), [Claude 가격](https://platform.claude.com/docs/en/about-claude/pricing), [정형 출력](https://platform.claude.com/docs/en/build-with-claude/structured-outputs), [데이터 보관](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention), [데이터 위치](https://platform.claude.com/docs/en/manage-claude/data-residency), [한도](https://platform.claude.com/docs/en/api/rate-limits), [탈옥 완화](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks), [Gemini 가격](https://ai.google.dev/gemini-api/docs/pricing), [Gemini 모델](https://ai.google.dev/gemini-api/docs/models), [Gemini 약관](https://ai.google.dev/gemini-api/terms)
- 링크 조회: [Safe Browsing 한도](https://developers.google.com/safe-browsing/v4/usage-limits), [Safe Browsing 레퍼런스](https://developers.google.com/safe-browsing/reference), [VirusTotal 공개 API](https://docs.virustotal.com/reference/public-vs-premium-api)
- 카카오: [채널 시작](https://kakaobusiness.gitbook.io/main/channel/start)
