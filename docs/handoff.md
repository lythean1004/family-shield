# 인계 문서 (Hand-off) — 2026-10-28

다음 작업자(Codex 등)가 이 문서 하나로 이어받을 수 있게 정리했다. 먼저 `CLAUDE.md`(작업 규칙), `docs/prd.md`(v0.8), `docs/decisions.md`(D1~D39), `docs/vm-migration-plan.md`를 읽는다.

**이어서 할 일:** 사용자가 서버 반영·성능 평가를 승인했고, **5180658을 VM에 배포 완료**했다. HTTPS 합성 가족 왕복·VM 권한 시험·아이폰 푸시 클릭 확인까지 통과했다. AI 3초/3.5초 비교는 완료. 이후 사용자 요청으로 기관·전화 유도 표현을 더 보완한 **6a71c5a는 별도 폴더 검증 완료, 추가 서버 반영 확인 대기**다. 후보의 AI 3초·200건 1회 놓침률은 21.5%(목표 5% 미달), 오경보 1.7%. 세부 수치는 `docs/eval-2026-10-28.md`를 따른다. 로컬 작업 폴더는 `D:\Claude Code\gongmojeon\family-shield`, GitHub `lythean1004/family-shield`의 main이다.

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
| DB (D36) | VM의 PostgreSQL 16, `127.0.0.1`만. DB `familyshield`, 앱 계정 `fs_app`. 마이그레이션 15개 + 부트스트랩 1개 적용, **권한 시험 38/38 통과(VM)** |
| 타이머 | `family-shield-purge.timer`(10분, 만료 데이터 삭제), `family-shield-backup.timer`(매일 03:30, pg_dump 7일 보관, `/srv/family-shield/backup`) |
| 웹 푸시 | VAPID 설정·배포 완료. **사용자 아이폰에서 알림 수신·클릭 확인**, 서버 확인 시간 2026-10-28 22:08:57 KST |
| Supabase | 실행 참조·의존성·로컬 설정·CSP 제거 및 VM 배포 완료. 대시보드 프로젝트 삭제는 사용자가 직접, 아직 삭제 안 함 |

`skill.env` 키 이름(값은 서버에만): `SKILL_HEADER_TOKEN, AI_API_KEY, AI_MODEL, AI_BASE_URL, AI_TIMEOUT_MS, AI_WEB_TIMEOUT_MS, PROMPT_VERSION, SKILL_HOST, SKILL_PORT, MAX_CONCURRENT, PHONE_HMAC_SECRET, WEB_BASE_URL, SAFE_BROWSING_API_KEY, URL_LOOKUP_TIMEOUT_MS, DATABASE_HOST, DATABASE_PORT, DATABASE_NAME, DATABASE_USER, DATABASE_PASSWORD`

## 3. 테스트용 API 키 (남겨 둠)

- **AI 키**: 서버 `skill.env`의 `AI_API_KEY`. Cline과 같은 aitestbed 키(별도 키 발급 불가, 확인됨). 대회 종료(12/11) 후 사용자가 disable 예정. **그 전에는 지우거나 바꾸지 말 것.**
- 키 교체가 필요하면: `powershell -ExecutionPolicy Bypass -File deploy\set-ai-key.ps1` (게이트웨이 시험 통과 시에만 반영, 이전 값은 `skill.env.bak`).
- 로컬 평가 실행은 서버에서: `ssh fs-ncp 'bash /srv/family-shield/repo/deploy/remote/06-run-eval.sh gemini-3.1-flash-lite'` (키가 PC에 없어도 됨).
- 카카오 스킬 토큰 복사: `deploy\copy-skill-token.ps1`.

## 4. 구현 완료와 남은 반영 (`docs/vm-migration-plan.md` 기준)

1. ~~DB 이전~~ **완료** (설치·마이그레이션·pgTAP 38·삭제/백업 타이머).
   - 백업 개선: `deploy/remote/db-backup.sh`가 삭제 실패 시 백업을 중단하고, 완성된 임시 덤프만 최종 파일로 옮긴다. VM 서비스 재설치·백업 생성·덤프 목록 검사 완료. 로컬 PG16에서는 별도 DB 복원도 성공.
2. **로그인과 가족 묶기 — 구현·배포·HTTPS 검증 완료** (문자 인증은 나중)
   - `skill/`에 `/api/auth/*`: 쿠키 세션(HttpOnly, Secure, SameSite=Lax), 부모님 데모 계정(D35)
   - DB 요청마다 `set local role authenticated` + `set_config('request.jwt.claim.sub', <user id>, true)` → `auth.uid()` 호환 함수(`db/bootstrap/00_supabase_compat.sql`)가 기존 RLS를 그대로 적용
   - 초대 코드 10분 만료(F1-2), 동의 ①②③ + 기록(F1-3·4), 만 14세 확인(F1-9)
   - D37: 운영자 1회용 참여 코드 → 보호자 로그인 → 부모님 초대 코드. `/setup`에서 진행. 시연 동의 변경은 현재 부모님 로그인으로 허용하며 휴대폰 재인증 미구현을 기록한다.
3. **가족 확인 왕복 — 구현·배포·HTTPS 검증 완료**: confirm/consent/misjudge를 VM API로 교체. 3초 폴링, 지정 보호자 응답 1회, 동의 철회·가족 제외·만료 시 접근 중단. 토큰은 DB에서 원자적으로 1회 소비한다. 결과는 서버 서명으로 위조를 막는다.
   - D38: ③ 확인 기록 미동의 시 요청마다 별도 동의. 요청 기록 최대 24시간(삭제 주기 최대 10분 지연, 백업 최대 7일)을 안내하고 버전·시간 저장. ③ 동의 자체는 변경하지 않는다.
   - ③ 동의자는 웹 판별 때 원문 없는 기록을 24시간 저장하고 이후 요청에서 재사용한다. 미동의·철회 상태에서는 판별만으로 가족 기록을 만들지 않는다. 자동 시험 324/324·DB 권한 38/38 통과.
   - 합성 입력으로 분리된 부모님·보호자 브라우저 왕복과 390px 가로 넘침 없음 확인. 실기기 시연과 구분한다.
4. **웹 푸시 — 배포·아이폰 실기기 확인 완료**: VAPID 설정 도구, 본문 없는 알림, 구독 소유권 검사, 시험 알림 클릭 확인. 22:08:51 전송·22:08:57 클릭 ACK 모두 HTTP 200, DB `test_confirmed_at` 기록과 사용자 화면 확인. 전송 업체 접수만으로 “시험 완료”라 하지 않는다.
   - D39: 이번 시연은 부모님이 직접 확인 요청을 보낼 때만 알림. 자동 위험 알림 제외. 동의 ① 문구 v2에 반영.
5. **Supabase 코드 제거 — 완료**: 두 클라이언트·웹 의존성·로컬 환경 변수·CSP 참조 삭제. `git grep -i supabase -- web/src skill/src deploy/nginx` 0건. 기존 SQL 이력과 시험 경로는 체크섬 보존을 위해 유지. 프로젝트 삭제는 VM 반영·확인 뒤 사용자가 직접 한다.
6. **문서 갱신**: PRD v0.8, D37~D39, 운영 명령·VM 이전 계획·배포 검토서에 실제 검증 결과 반영. AI 비교 평가 수치는 완료 후 추가.
7. 휴대폰 인증(SENS/솔라피)과 SC1 시연 리허설: **나중에**(사용자 결정)

병행 과제:
- **놓침률 목표 미달**: 첫 보완 5180658의 AI 3초 40.5%, 3.5초 35.4%(각 200건×3회). 추가 후보 6a71c5a는 3초 21.5%(200건×1회, 반복 일관성 미측정). AI 없는 대체 경로는 89.9% → 74.7% → 44.3%, 오경보 0%. 조건을 섞어 비교하지 않는다. 목표 5%는 아직 달성하지 않았으며 운영 시간 제한은 3초 유지. 상세 `docs/eval-2026-10-28.md`.
- 멘토 법률 질의: `docs/mentor-legal-questions.md` (답변 전에는 실제 사용자 데이터 운영 금지, D26)

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

## 6. 알려진 제한

- AI 호출 한도는 프로세스 메모리에 있어 재시작 시 초기화. 세션·코드 시도 제한·1회용 결과 토큰은 새 코드에서 DB로 이전했다.
- 시연 로그인은 복구용 휴대폰 인증이 없다. 로그아웃 후 새 참여 코드를 발급하면 새 계정·가족이 된다. 사용자당 한 기기 제한, 위험 판정의 자동 전체 보호자 알림, 예비 문자는 아직 구현하지 않았다.
- 카카오 봇 사용자와 웹 가족 계정의 연결은 아직 없다. 가족 요청은 웹에서 부모님으로 로그인한 상태로 판별한 결과를 쓴다.
- 근거 카드 일부(118, 1566-1188, 지급정지 기한, "진짜라면 이렇게 와요")는 `needs_review`. 원문 대조 전에는 결과 화면에 쓰지 않는다.
- 안드로이드 공유(F4-2)는 실기기 미시험.
- NCP ACG(3000번 닫기, 22번 IP 제한)는 콘솔 작업이라 미처리. firewalld가 이미 막고 있음.
