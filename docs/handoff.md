# 인계 문서 (Hand-off) — 2026-10-28

다음 작업자(Codex 등)가 이 문서 하나로 이어받을 수 있게 정리했다. 먼저 `CLAUDE.md`(작업 규칙), `docs/prd.md`(v0.7), `docs/decisions.md`(D1~D36), `docs/vm-migration-plan.md`를 읽는다.

## 1. 작업 규칙 (꼭 지킬 것)

- 기능 하나 끝날 때마다 **테스트 → 커밋 → push**. (사용자 요청)
- 서버 설정을 바꾸는 작업(sudoers, 방화벽, Nginx, systemd)은 실행 전에 사용자 확인.
- 비밀값(키, 토큰, DB 비밀번호)은 화면·로그·커밋에 남기지 않는다. 서버의 `/etc/family-shield/skill.env`(권한 600)에만 둔다.
- 문자 원문은 저장하지 않는다(로그 포함). '안전' 판정 금지. 판정은 규칙 코드가 한다(AI는 신호 추출·설명만).
- 부모님 화면은 큰 글씨(본문 30px, D32)·고대비(WCAG AA, 테두리 3:1)를 유지한다. `web/src/__tests__/contrast.test.js`가 지킨다.
- 새 라이브러리는 사용자 승인 후. 승인된 것: `pg@8.23.1`, `web-push@3.6.7`(skill에 고정됨).

## 2. 현재 운영 상태

| 항목 | 상태 |
|---|---|
| 도메인 | `https://familyshield.kr` (가비아 DNS, A → 101.79.8.126). 인증서 Let's Encrypt, 2027-01-26 만료, 자동 갱신 |
| 서버 | NCP VM Rocky 8.10, 101.79.8.126. SSH 별칭 `fs-ncp`(사용자 `fsops`, 키 `~/.ssh/fs_ncp`, 접속 IP 116.39.157.89만 허용) |
| 웹 PWA | Nginx가 `/srv/family-shield/web` 정적 제공 |
| 스킬 서버 | systemd `family-shield-skill`, `127.0.0.1:3000`. Nginx가 `/api/`만 전달 |
| 카카오 | 오픈빌더 스킬 `https://familyshield.kr/api/kakao-skill`, 헤더 `x-skill-token`. 폴백·처음으로·이미 당했어요 블록 배포 완료 |
| AI | aitestbed 게이트웨이(`AI_BASE_URL`), 카카오 `gemini-3.1-flash-lite`(3초), 웹 `claude-sonnet-5-5`(8초) (D30) |
| DB (D36) | VM의 PostgreSQL 16, `127.0.0.1`만. DB `familyshield`, 앱 계정 `fs_app`. 마이그레이션 10개 적용, **pgTAP 38/38 통과(VM)** |
| 타이머 | `family-shield-purge.timer`(10분, 만료 데이터 삭제), `family-shield-backup.timer`(매일 03:30, pg_dump 7일 보관, `/srv/family-shield/backup`) |
| Supabase | **아직 코드에 남아 있음**(아래 4장 5단계). 대시보드 프로젝트 삭제는 사용자가 직접 |

`skill.env` 키 이름(값은 서버에만): `SKILL_HEADER_TOKEN, AI_API_KEY, AI_MODEL, AI_BASE_URL, AI_TIMEOUT_MS, AI_WEB_TIMEOUT_MS, PROMPT_VERSION, SKILL_HOST, SKILL_PORT, MAX_CONCURRENT, PHONE_HMAC_SECRET, WEB_BASE_URL, SAFE_BROWSING_API_KEY, URL_LOOKUP_TIMEOUT_MS, DATABASE_HOST, DATABASE_PORT, DATABASE_NAME, DATABASE_USER, DATABASE_PASSWORD`

## 3. 테스트용 API 키 (남겨 둠)

- **AI 키**: 서버 `skill.env`의 `AI_API_KEY`. Cline과 같은 aitestbed 키(별도 키 발급 불가, 확인됨). 대회 종료(12/11) 후 사용자가 disable 예정. **그 전에는 지우거나 바꾸지 말 것.**
- 키 교체가 필요하면: `powershell -ExecutionPolicy Bypass -File deploy\set-ai-key.ps1` (게이트웨이 시험 통과 시에만 반영, 이전 값은 `skill.env.bak`).
- 로컬 평가 실행은 서버에서: `ssh fs-ncp 'bash /srv/family-shield/repo/deploy/remote/06-run-eval.sh gemini-3.1-flash-lite'` (키가 PC에 없어도 됨).
- 카카오 스킬 토큰 복사: `deploy\copy-skill-token.ps1`.

## 4. 남은 작업 (순서대로, `docs/vm-migration-plan.md` 기준)

1. ~~DB 이전~~ **완료** (설치·마이그레이션·pgTAP 38·삭제/백업 타이머).
   - 확인 필요: `deploy/systemd/family-shield-backup.service`를 purge를 같은 셸에서 먼저 실행하는 방식으로 고쳐 커밋했다. 서버에는 `bash deploy/remote/14-db-timers.sh`로 다시 설치하고 `sudo systemctl start family-shield-backup.service`로 한 번 시험할 것.
2. **로그인과 가족 묶기** (초대 코드 방식, 사용자 동의함. 문자 인증은 나중)
   - `skill/`에 `/api/auth/*`: 쿠키 세션(HttpOnly, Secure, SameSite=Lax), 부모님 데모 계정(D35)
   - DB 요청마다 `set local role authenticated` + `set_config('request.jwt.claim.sub', <user id>, true)` → `auth.uid()` 호환 함수(`db/bootstrap/00_supabase_compat.sql`)가 기존 RLS를 그대로 적용
   - 초대 코드 10분 만료(F1-2), 동의 ①②③ + 기록(F1-3·4), 만 14세 확인(F1-9)
3. **가족 확인 왕복**: `web/src/data/confirm.js`·`consent.js`·`misjudge.js`의 Supabase TODO를 서버 API(`/api/confirm`, `/api/consent`, `/api/misjudge`) 호출로 교체. 3초 폴링, 응답 1회. [자세히 보기] 토큰을 메모리에서 `result_tokens` 테이블 + `redeem_result_token` RPC로 이전
4. **웹 푸시**: VAPID 키 생성 → `skill.env`(`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`), 구독 저장, 내용 없는 알림, 시험 알림(F1-6)
5. **Supabase 코드 제거** (사용자 승인됨): `web/src/lib/supabase.js`, `skill/src/supabase-client.js`, `@supabase/supabase-js` 의존성, `web/.env.local`·`skill/.env.local`의 Supabase 값, Nginx CSP의 Supabase 주소 **전부 삭제**. `git grep -i supabase -- web/src skill/src deploy/nginx` 결과 0건 확인 후 사용자에게 대시보드 삭제 안내
6. PRD·문서 갱신(D36 반영, 13장 기술 구성, 11-3 RLS 실행 위치)
7. 휴대폰 인증(SENS/솔라피)과 SC1 시연 리허설: **나중에**(사용자 결정)

병행 과제:
- **놓침률 개선**: 200건 측정 결과 39.2%(목표 5%). 놓친 31건 중 25건이 기관 사칭. 기관 사칭 코드 신호 추가 → 돈·개인정보 표현 사전 확장(평가 문장 그대로 넣지 말 것) → AI 3.5초 시험 → 재측정. 상세 `docs/eval-2026-10-28.md`
- 멘토 법률 질의: `docs/mentor-legal-questions.md` (답변 전에는 실제 사용자 데이터 운영 금지, D26)

## 5. 자주 쓰는 명령

| 목적 | 명령 (PC, 저장소 루트) |
|---|---|
| 테스트 | `node --test packages/core/test/` · `node --test skill/test/` · `cd web; npm test` · `node --test eval/test/` |
| 웹 배포 | `powershell -ExecutionPolicy Bypass -File deploy\deploy-web.ps1` |
| 스킬 배포 | push 후 `powershell -ExecutionPolicy Bypass -File deploy\deploy-skill.ps1` |
| DB 마이그레이션 | `ssh fs-ncp 'bash /srv/family-shield/repo/deploy/remote/12-migrate.sh'` |
| DB 테스트 | `ssh fs-ncp 'bash /srv/family-shield/repo/deploy/remote/13-db-test.sh'` (전부 rollback) |
| 서버 상태 | `ssh fs-ncp 'systemctl status family-shield-skill --no-pager'` · `journalctl -u family-shield-skill -n 50` |
| 되돌리기 | `docs/operations.md` |

주의: `fsops`의 비밀번호 없는 sudo는 정해진 명령 목록만 허용한다. `postgres` 사용자나 `psql` 관리자 작업은 사용자가 `ssh -t fs-ncp "sudo ..."`로 직접 실행해야 한다(sudo 비밀번호는 사용자만 앎). 앱 DB 작업은 `fs_app`으로 TCP 접속하면 sudo가 필요 없다.

## 6. 알려진 제한

- 호출 한도와 [자세히 보기] 토큰은 스킬 서버 메모리에만 있어 재시작 시 초기화(4장 3단계에서 해결).
- 근거 카드 일부(118, 1566-1188, 지급정지 기한, "진짜라면 이렇게 와요")는 `needs_review`. 원문 대조 전에는 결과 화면에 쓰지 않는다.
- 안드로이드 공유(F4-2)는 실기기 미시험.
- NCP ACG(3000번 닫기, 22번 IP 제한)는 콘솔 작업이라 미처리. firewalld가 이미 막고 있음.
