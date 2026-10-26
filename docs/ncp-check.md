# 네이버클라우드(NCP) 부분 사용 점검

확인일 2026-10-23. 지원 조건 문서를 받기 전에 공식 문서로 확인할 수 있는 것만 정리했다.
지원 조건(크레딧 사용처, NCP 서비스 필수 여부)을 받으면 7장을 채우고 D29로 결정한다.

## 1. 결론 요약

| 질문 | 답 | 근거 |
|---|---|---|
| 카카오 스킬 서버를 NCP에서 돌릴 수 있나 | **가능.** Cloud Functions **웹 액션** + API Gateway **HTTP 방식 트리거**로 공개 HTTPS 주소가 생김 | 2-1, 2-2 |
| 판별 코어를 그대로 쓸 수 있나 | **가능(포장만 필요).** 런타임 Node.js 22, 코어는 외부 의존성 없음·`node:crypto`만 사용. 단 ESM 직접 지원 여부는 미확인 → CJS 진입 파일에서 `import()`로 불러오는 방식으로 우회 | 2-3 |
| 카카오 5초 제한에 맞나 | 맞음. 컨테이너 생성 50~200ms, 이후 재사용. 액션 타임아웃은 4.5초 정도로 짧게 잡아 카카오보다 먼저 끝냄 | 2-1 |
| DB를 Supabase로 두고 NCP 함수에서 접속 가능한가 | 가능. **VPC에 연결하지 않은 액션**은 외부 인터넷으로 나감(Slack 샘플). VPC 서브넷에 연결하면 외부로 나가려면 **NAT Gateway(유료)**가 필요 | 2-4 |
| 인증 문자를 SENS로 | 가능하나 **발신번호 등록은 서류 인증만**(영업일 3~4일). 솔라피의 ARS 본인인증보다 느림 | 3 |
| NCP PostgreSQL에 pg_cron이 있나 | **있음**(콘솔 설치, 재시작 필요, `cdb_admin` 스키마). pgcrypto·uuid-ossp·pg_trgm은 사용자가 직접 설치 가능 | 4 |

**권장(B안의 확장, 가칭 B')**: DB·인증·RLS·웹 푸시는 Supabase 유지. 아래 중 지원 조건이 허락하는 것만 NCP로 돌린다.

1. 카카오 스킬 함수 → NCP Cloud Functions(웹 액션) + API Gateway
2. 인증·예비 문자 → SENS (Supabase Send SMS Hook에서 호출)
3. (선택) AI 신호 추출 → CLOVA Studio(HyperCLOVA X)를 비교 후보로 추가
4. (선택) 캡처 인식 실패 시 대안 → CLOVA OCR (D24 동의 흐름 유지)

이렇게 하면 코드 변경은 "스킬 함수 진입 파일 + 배포 방법"뿐이고, 판별 코어·DB·RLS는 그대로다.

## 2. Cloud Functions (스킬 서버 후보)

### 2-1. 제한 사양 (cloudfunctions-spec)

| 항목 | 값 | 우리에게 의미 |
|---|---|---|
| 리전 | 한국 KR-1/KR-2 | 카카오·Supabase 서울과 가까움 |
| 런타임 | Node.js 22(`nodejs:22`), Python 3.13 등. Node 6~16은 2025-09-18 지원 종료 | 로컬은 Node 24 → 코어가 Node 24 전용 기능을 안 쓰는지 확인함(아래 2-3) |
| timeout | 기본 60초, 500~300000ms | 스킬 액션은 4500ms 정도로 설정 |
| memory | 128~1024MB, 기본 128 | 코어는 가벼움. 128~256MB로 시작 |
| 파라미터(요청) 최대 | **1MB** (API Gateway는 10MB지만 함수 연동 시 1MB) | 카카오 요청은 수 KB라 문제 없음 |
| 결과(응답) 최대 | 1MB | 문제 없음 |
| 동시 실행 | 네임스페이스당 1000 | 충분 |
| 코드 크기 | 38MB | 충분 |
| 컨테이너 | 첫 실행 50~200ms, 일정 시간 재사용(pre-warming) | 5초 제한에 여유 |
| 로그 | Cloud Log Analytics에 저장 | **원문을 로그에 남기지 않는 규칙(PRD 11-2)을 그대로 지켜야 함** |

### 2-2. 공개 주소 만드는 법 (cloudfunctions-apigateway-vpc)

- 액션 타입을 **웹 액션**으로 만들면 API Gateway 트리거가 **HTTP 방식**으로 생긴다(일반 액션은 Webhook 방식, POST만, 응답 형태 제한).
- 주소: `https://{product_id}.apigw.ntruss.com/{api}/{stage}/{resource}` (HTTPS).
- HTTP 방식은 **최대 1분**까지 응답, 넘으면 202. 카카오는 5초라 무관.
- 인증 옵션: NONE / IAM / IAM+AUTHORIZATION, API Key. 카카오는 IAM 서명을 못 하므로 **NONE + 우리 헤더 토큰 검사**(PRD 13-3과 동일). API Gateway 구독 방식이 '보호-승인필요'면 호출 불가 → '공개-자율구독'으로.
- 응답 형식: `{ statusCode, headers, body }`. 요청 본문은 `__ow_body`(base64), 헤더는 `__ow_headers`로 들어옴('HTTP 원문 사용' 설정 시).
- API Gateway는 **별도 요금**.

### 2-3. 판별 코어를 올리는 방법

- 코어는 ESM(`"type": "module"`), 외부 패키지 없음, `node:crypto`만 import. Node 24 전용 문법(RegExp.escape, Iterator 헬퍼, Set 연산 등) 사용 없음을 검색으로 확인.
- NCP 샘플은 모두 CommonJS(`exports.main`). ESM 직접 지원은 문서에 없음 → **CJS 진입 파일에서 `await import('./core/...js')`**로 감싸거나, 나중에 번들러를 쓴다.
  - 로컬 확인(2026-10-23): `exports.main = async (params) => { await import(extract.js), await import(rule-engine.js) }` 형태의 CJS 파일에서 코어를 불러와 `extractCodeSignals`, `decide`를 얻는 것까지 성공. NCP 실제 업로드는 8장에서 시험.
- 업로드: `zip` 후 콘솔 업로드(또는 API/CLI). 비밀 값(HMAC 키, 카카오 헤더 토큰, AI 키)은 **액션 디폴트 파라미터 암호화** 기능에 둔다.

### 2-4. 네트워크

- VPC에 연결하지 않은 액션: 외부 인터넷 호출 가능(Slack Webhook 샘플).
- VPC Private Subnet에 연결한 액션: 외부로 나가려면 NAT Gateway + 라우팅 필요(troubleshoot-network). NCP Cloud DB(VPC 전용)를 쓰면서 AI API도 부르면 NAT Gateway 비용이 생긴다.
- 따라서 **DB를 Supabase에 두는 한 VPC 연결 불필요**.

## 3. SENS (문자)

- SMS/LMS/MMS, 알림톡·브랜드 메시지(카카오 채널 + 템플릿 검수), 메일을 한 서비스로 제공. 한국 리전.
- **발신번호 등록 = 서류 인증**(이름, 번호, 필요 서류 PDF/JPG/PNG 10MB 이내) → NCP 관리자 승인, **영업일 3~4일**. 갱신 시 '통신서비스 이용증명원'(1개월 이내 발급) 요구. 개인 회원 가능 여부와 필요 서류 목록은 콘솔에서 확인 필요.
- KISA 소명 요청 시 3일 안에 제출 의무. 광고 문자는 080 수신거부 표기 의무(우리 인증·예비 문자는 광고 아님).
- 요금표는 포털 페이지가 스크립트로 그려져 자동으로 읽지 못함 → 콘솔/요금 계산기에서 확인 필요.
- 연동: Supabase **Send SMS Hook**(Edge Function)에서 SENS API 호출(HMAC-SHA256 서명 헤더). Deno `crypto.subtle`로 구현 가능.
- 솔라피와 비교: 솔라피는 ARS + 본인인증으로 즉시 등록, SMS 18원. SENS는 크레딧으로 낼 수 있다면 유리.

## 4. Cloud DB for PostgreSQL (전면 이전 시에만 해당)

- VPC 전용(Classic 미지원). 한국·싱가포르·일본.
- 콘솔 설치 확장: pgvector, pg_stat_statements, passwordcheck, postgres_fdw, PostGIS, **pg_cron**(재시작 필요, `cdb_admin` 스키마).
- 사용자가 직접 설치: btree_gin, btree_gist, citext, cube, dict_int, fuzzystrmatch, hstore, intarray, isn, lo, ltree, **pg_trgm, pgcrypto**, seg, tablefunc, tcn, tsm_system_rows, tsm_system_time, unaccent, **uuid-ossp**.
- 24시간 삭제(PRD 11-2)는 pg_cron 또는 **Cloud Functions Cron 트리거**로 대체 가능.
- 그래도 Supabase Auth(휴대폰 OTP), RLS의 `auth.uid()`, 자동 REST API, Realtime은 없으므로 C안의 비용(25~40시간)은 그대로.

## 5. 기타 NCP 후보

| 서비스 | 쓸 곳 | 메모 |
|---|---|---|
| CLOVA Studio (HyperCLOVA X) | AI 신호 추출 비교 후보 | 한국어 강점. 구조화 출력·요금·데이터 보관 정책은 미확인. 이용량 제어 정책 문서 있음 |
| CLOVA OCR | 캡처 인식 실패 시 대안(D24) | 이미지가 서버로 가므로 동의 흐름 필수 |
| Cloud Functions Cron 트리거 | 24시간 삭제 작업 | Supabase pg_cron 대신 쓸 필요는 없음 |

## 6. 카카오 쪽에서 함께 확인한 것

- 스킬 응답 제한 **5초**(고정). 콜백을 쓰면 `useCallback: true`로 먼저 답하고 `callbackUrl`로 나중에 POST. 콜백 URL은 1회용, 개요에는 5분 유효로 적혀 있으나 오류표에는 "1분 이내 요청 필요" → **1분으로 가정**.
- 콜백은 봇 테스트 화면에서 동작하지 않고 배포 후 시험해야 함.
- NCP 함수는 응답을 돌려준 뒤 계속 실행된다는 보장이 없음(OpenWhisk 구조) → 콜백을 쓸 경우 **비동기 액션(blocking=false)을 따로 호출**하는 구조가 필요. MVP는 콜백 없이 5초 안에 처리(PRD 13-3 유지).

## 7. 지원 조건 문서를 받으면 확인할 것

1. 크레딧을 어떤 서비스에 쓸 수 있는가(Cloud Functions, API Gateway, SENS, CLOVA Studio, CLOVA OCR 각각)
2. NCP 서비스 사용이 **필수**인가, 필수라면 최소 범위는("일부 기능 사용"으로 충족되는가)
3. 크레딧 기간·금액, 초과 시 결제 수단(카드 등록 필요 여부)
4. 개인(비사업자) 계정으로 SENS 발신번호·CLOVA Studio 이용 가능 여부
5. 결과물 발표 시 NCP 사용 표기 의무

## 8. 직접 시험할 것 (계정 생긴 뒤, 각 30분 이내)

1. Node 22 웹 액션에 CJS 진입 파일 + ESM 코어 `import()` 업로드 → 실행 확인
2. API Gateway HTTP 트리거 주소를 카카오 폴백 블록 스킬로 연결 → 채팅방 응답 확인(헤더 토큰 포함)
3. 첫 호출·재사용 호출 응답 시간 측정(5초 예산 중 몇 ms인지)
4. 액션에서 Supabase(서울) REST 호출 지연 측정
5. 로그에 원문이 남지 않는지 Cloud Log Analytics에서 확인

## 출처

- guide.ncloud-docs.com: cloudfunctions-overview, -spec, -spec-runtime, -info, -actioncreate-vpc, -apigateway-vpc, -faq, -troubleshoot(-network, -invocation), sens-overview, sens-spec, sens-callingno, sens-smspolicy, clouddbforpostgresql-overview, -spec, -postgresqlextension, clovastudio-overview
- github.com/NaverCloudPlatform/cloud-functions (samples/nodejs: rest-api 웹 액션, cache README의 `nodejs:22`)
- kakaobusiness.gitbook.io: 스킬 만들기, 콜백 개발 가이드
- 요금(Cloud Functions, API Gateway, SENS, CLOVA Studio)은 포털 페이지가 스크립트로 그려져 확인하지 못함

