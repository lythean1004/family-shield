# 가족방패 인계 · 2026-11-27

작업 폴더는 `D:\Claude Code\gongmojeon\family-shield`, GitHub 브랜치는 `lythean1004/family-shield:main`이다. 먼저 [프로젝트 기준](project.md), [PRD v0.8](prd.md), [결정 D40~D49](decisions.md), [연결 현황과 규칙표 차이](integration-status.md)를 읽는다.

**서버에 반영된 마지막 커밋은 11월 27일 요청서 기록상 `14a6d9d`다.** 이후 GitHub에는 공식 링크 보완 `a43fe79`, 링크·카드 후보 조사 `81dcd7b`, 고정 보류 세트 `60a3951`과 평가 `11251c4`, 설명 표본·고정 안내 `0fbb459`·`6ae102e`가 올라갔다. 현재 VM의 커밋·서비스 상태는 이번에 실측하지 않았다. [작업 요청서](codex-request-next-dev.md)

## 1. 작업 규칙 (꼭 지킬 것)

- 기능 하나 끝날 때마다 **테스트 → 커밋 → push**. (사용자 요청)
- 서버 설정을 바꾸는 작업(sudoers, 방화벽, Nginx, systemd)은 실행 전에 사용자 확인.
- 비밀값(키, 토큰, DB 비밀번호)은 화면·로그·커밋에 남기지 않는다. 서버의 `/etc/family-shield/skill.env`(권한 600)에만 둔다.
- 문자 원문은 저장하지 않는다(로그 포함). '안전' 판정 금지. 판정은 규칙 코드가 한다(AI는 신호 추출·설명만).
- 부모님 화면은 큰 글씨(본문 30px, D32)·고대비(WCAG AA, 테두리 3:1)를 유지한다. `web/src/__tests__/contrast.test.js`가 지킨다.
- 새 라이브러리는 사용자 승인 후. 승인된 것: `pg@8.23.1`, `web-push@3.6.7`(skill에 고정됨).

## 2. 운영 구성과 확인 시점

| 항목 | 구성과 가장 최근 근거 |
|---|---|
| 웹·스킬 | 운영 도메인 `familyshield.kr`. Nginx가 웹 정적 파일과 `/api/`를 제공하고 systemd 스킬 서비스는 VM의 `127.0.0.1:3000`을 사용한다. 카카오 경로는 `/api/kakao-skill`. 11/26 웹·스킬 배포 기록이 있다. |
| VM | Rocky Linux 8.10, SSH 별칭 `fs-ncp`, 계정 `fsops`, 저장소 `/srv/family-shield/repo`, 웹 `/srv/family-shield/web`. 현재 인증서·방화벽·ACG 상태는 확인 필요. |
| AI | aitestbed 중계. 카카오 Gemini Flash Lite 3초, 웹 Claude Sonnet 8초(D30). 웹은 해외 AI 동의에 따르며 일부 건강 안내는 규칙만으로 처리한다. |
| 저장·예약 작업 | VM PostgreSQL 16, 로컬 바인딩, DB `familyshield`·앱 계정 `fs_app`. 11/11 기록상 부트스트랩 1개와 마이그레이션 16개 적용, 운영 권한 시험 38/38. 만료 데이터 삭제 10분, 백업 매일 03:30, 보관 7일. 최신 백업 성공·복구 여부는 확인 필요. |
| 가족 확인·푸시 | 보호자 참여 코드 → 부모님 초대 코드. 로그인한 부모님의 수동 확인 요청·보호자 응답 및 VAPID 푸시 구현. 10/28 합성 계정 HTTPS 왕복, 사용자 아이폰 시험 알림 수신·탭·ACK까지 확인. |
| 운영 범위 | 합성 시나리오 사용(D43). 종료 안내 계획은 11/27 및 12/10, 마감은 12/11(D44). 실제 공지 게시 여부는 확인 필요. [종료 계획](shutdown-plan.md) |

`skill.env` 키 이름(값은 서버에만): `SKILL_HEADER_TOKEN, AI_API_KEY, AI_MODEL, AI_BASE_URL, AI_TIMEOUT_MS, AI_WEB_TIMEOUT_MS, PROMPT_VERSION, SKILL_HOST, SKILL_PORT, MAX_CONCURRENT, PHONE_HMAC_SECRET, WEB_BASE_URL, SAFE_BROWSING_API_KEY, URL_LOOKUP_TIMEOUT_MS, DATABASE_HOST, DATABASE_PORT, DATABASE_NAME, DATABASE_USER, DATABASE_PASSWORD, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT`. 선택 키 `AI_WEB_MODEL`의 코드 기본값은 `claude-sonnet-5-5`.

## 3. 테스트용 키와 운영자용 명령

- AI 키는 12/11까지 서버에 유지하고 대회 종료 후 운영자가 비활성화할 계획이다. 교체 도구는 `deploy/set-ai-key.ps1`, 카카오 스킬 토큰 도구는 `deploy/copy-skill-token.ps1`이다.
- 규칙만 평가할 때는 로컬의 `node eval/run.mjs --no-ai`를 사용한다. 보류 자료를 AI로 3회 평가하는 운영자용 명령은 [보류 세트 보고서](eval-holdout-2026-11.md)에 있다.

## 4. 현재 판정과 운영자 인계

| 결정 | 코드에 반영된 내용 |
|---|---|
| D40·D41 | 국내 피싱 호스트 목록, 근거 카드 기반 사칭 감지, RDAP 생성일(30일 이내)과 요구 신호의 조합. RDAP 제한 2.5초. |
| D42·D43 | 카카오·웹의 결과 한계 안내를 통일. 사용성 검증은 합성 시나리오로 진행하고 실제 문자 운영은 별도 검토 대상으로 둔다. |
| D44 | 단순 건강 안내는 AI 호출을 건너뛰고 그 외 건강 표현은 추가 마스킹한다. 종료 뒤 개인정보·동의 기록·DB 백업을 파기하고 비식별 통계·코드·문서를 남기는 계획이다. |
| D45·D46 | 가족 사칭·상품권 또는 돈과 압박이 겹치면 R13 위험. R4 통화 회피와 R13의 압박은 코드가 찾은 신호를 쓴다. |
| D47·D48·D49 | 모든 링크가 공식 주소이면 링크만으로 주의를 내지 않는다. D48은 단축 주소 전체 키 일치와 주소 속임수를 추가했다. D49는 모든 링크가 공식일 때 R7의 돈·비밀·재촉을 코드에서 확인한다. 확인 필요이고 모든 링크가 공식일 때만 공식 안내 문단을 표시한다. `a43fe79`에서 불완전 후보나 잘린 입력의 공식 예외를 보류했다. |

링크 결과를 확인할 때는 **KISA 호스트 목록 → 단축 주소 목록 → 공식 주소 → 사칭 감지 → 생성일 → Safe Browsing** 순서로 각 근거를 읽는다. 다음은 점검 순서이며 실제 외부 조회의 실행 순서는 [파이프라인](../packages/core/src/pipeline.js)과 [스킬 연결](../skill/src/handler.js)을 따른다.

1. KISA 호스트 키 31,111개(공용 서비스·공식 주소 제외)와 대조한다. 자동 단축 서비스 키 42개와의 호스트 일치만으로는 단축 신호다.
2. 단축 주소의 서비스·경로 키 20,425개 중 일치하는 항목이 있으면 R10 위험이다. 링크를 펼치지 않는다.
3. 공식 도메인 카드 40장과 포털 등 정확한 호스트 카드 4장의 범위를 본다. 완결성 보강본은 전체 후보·실제 URL 호스트가 확인될 때만 예외를 허용한다.
4. 근거 카드의 사칭 신호 또는 주소 앞부분 속임수는 R11 위험이다. 공식 예외를 보류해도 기존 위험 검사 입력을 유지한다.
5. 등록 도메인만 RDAP 생성일 조회 대상으로 삼는다. 조건에 맞는 새 도메인과 돈·개인정보·앱 설치 요구가 함께 있어야 R12 위험이다.
6. Google Safe Browsing은 호스트 표현 해시의 앞 4바이트로 조회하고 반환된 전체 해시와 비교한다. Google이 위험을 표시한 경우에만 해당 출처를 붙인다. 코드에서 KISA 호스트 대조와 Google 조회는 같은 평판 조회기로 합치고, 생성일 조회와 AI 작업도 겹쳐 실행한다. [설계·평가 근거](link-review-2026-11.md)

| 평가와 조건 | 놓침 | 오경보 | 해석 |
|---|---:|---:|---|
| 11/12 운영 기록, Gemini 3초, 기존 200건 × 3회 | 18/237 = 7.6% | 7/363 = 1.9% | 3회 일치 82.0%, 시간 초과 13.0%. 목표 5% 미달 |
| D46, 기록된 AI 결과 4회분 재계산 | 8.1% (위험 320회 기준) | 2/490 = 0.4% | 표현 선정을 위해 본 자료 재사용. 새 AI 실측과 분모가 다름 |
| 11/27 보류 60건 1판, 규칙만, 사람 기대 | 30/32 = 93.8% | 0/28 = 0.0% | 위험 사례는 비작동 피해 요약. 기성 문자 또는 AI 성능의 추정치로 쓰기 어려움 |
| 보류 60건 2판, 규칙만, 사람 기대 | 29/31 = 93.5% | 0/29 = 0.0% | 법원 사칭 1건의 사람 기대를 ‘주의’로 조정. 예측은 1판과 60건 모두 동일 |
| 같은 예측을 규칙 기대와 비교 (1·2판) | 26/28 = 92.9% | 0/32 = 0.0% | 두 판본의 규칙 기대는 동일 |

11/12 측정은 [당일 작업 기록](worklog.md), 11/27 분자·분모와 원인은 [보류 세트 평가](eval-holdout-2026-11.md)에 있다. 설명을 사람이 검토할 때는 [합성 자료 전용 표본과 사용법](explanation-review-2026-11.md)을 쓴다.

## 5. 자주 쓰는 명령

| 목적 | 명령 (PC, 저장소 루트) |
|---|---|
| 테스트 | `node --test packages/core/test/*.test.js skill/test/*.test.js eval/test/*.test.js web/src/__tests__/*.test.js` (Node 24는 디렉터리 대신 glob 사용) |
| 로컬 DB 통합 시험 | 로컬 PG16의 `127.0.0.1:55432` 시험 DB를 준비한 뒤 `$env:FS_DB_TEST='1'`을 설정하고 위 테스트 실행. VM에서는 실행하지 않음 |
| 보호자 코드 발급 | `ssh fs-ncp 'bash /srv/family-shield/repo/deploy/remote/16-issue-demo-code.sh /home/fsops/demo-code.txt'` (10분, 새 파일, 코드 자체는 출력하지 않음) |
| 웹 배포 | `powershell -ExecutionPolicy Bypass -File deploy\deploy-web.ps1` |
| 스킬 배포 | push 후 `powershell -ExecutionPolicy Bypass -File deploy\deploy-skill.ps1` |
| DB 마이그레이션 | `ssh fs-ncp 'bash /srv/family-shield/repo/deploy/remote/12-migrate.sh'` |
| DB 테스트 | `ssh fs-ncp 'bash /srv/family-shield/repo/deploy/remote/13-db-test.sh'` (전부 rollback) |
| 서버 상태 | `ssh fs-ncp 'systemctl status family-shield-skill --no-pager'` · `journalctl -u family-shield-skill -n 50` |
| 되돌리기 | `docs/operations.md` |

주의: `fsops`의 비밀번호 없는 sudo는 정해진 명령 목록만 허용한다. `postgres` 사용자나 `psql` 관리자 작업은 사용자가 `ssh -t fs-ncp "sudo ..."`로 직접 실행해야 한다(sudo 비밀번호는 사용자만 앎). 앱 DB 작업은 `fs_app`으로 TCP 접속하면 sudo가 필요 없다.

## 6. 확인이 필요한 일

- 1차 은행 8곳의 대표 주소를 카드에 반영했다. 다른 금융·생활 후보의 추가 여부는 기관별 주소와 용도를 확인한 뒤 결정한다. [은행별 근거와 대조 결과](link-review-2026-11.md#1차-반영한-은행-대표-주소-8곳)
- 운영자가 평가 정답이 갈린 4건을 검토했고 PRD 9-7의 6행을 현재 코드와 맞췄다. 추가 표현이나 규칙을 검토할 때는 별도 평가 자료를 사용한다. [보류 세트 2판과 규칙표 반영 내역](integration-status.md)
- 서버 기록과 기기 상태가 필요한 항목은 이번에 확인하지 않았다. 옛 클라우드 프로젝트의 콘솔 삭제 여부, NCP ACG, 안드로이드 공유, SC1 실기기 리허설, 종료 공지 게시 여부가 여기에 해당한다.
- 실제 문자 운영에는 D43의 운영사 서면 자료·제3자 정보 처리 검토·동의 및 방침·시험 운영 계획 확인이 필요하다. 휴대폰 재인증과 카카오-웹 가족 계정 연결도 후속이다.
- 호출 한도·동시성 일부는 프로세스 메모리라 재시작 시 초기화된다. 자료 확인 대기인 예방 카드는 `needs_review` 표시를 따른다.

로컬 시험은 코어 447/447, 스킬 94/94, 웹 174/174, 별도 평가 도구 11/11이다.

**서버 반영 승인 필요(배포 안 함)**
