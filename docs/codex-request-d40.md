# Codex 작업 요청서: 링크 점검 보강(D40) 마무리

작성일: 2026-11-11 · 작성: Claude Code · 요청자: 프로젝트 운영자(1인 개발)

## 0. 저장소와 폴더

| 항목 | 값 |
|---|---|
| GitHub | https://github.com/lythean1004/family-shield (public, 기본 브랜치 `main`) |
| 로컬 폴더 (Windows) | `D:\Claude Code\gongmojeon\family-shield` |
| 서버 저장소 사본 | NCP VM `/srv/family-shield/repo` (SSH 별칭 `fs-ncp`, 사용자 `fsops`, 키 `~/.ssh/fs_ncp`, 운영자 PC IP에서만 접속) |
| 서비스 주소 | https://familyshield.kr (카카오 스킬 `https://familyshield.kr/api/kakao-skill`) |
| 마지막 커밋 | `7b6709a feat(links): lookalike official-domain detection, R11 (D40 step 2)` |
| 서버에 반영된 커밋 | `c333186` (D40 1단계까지). 2단계(`7b6709a`)는 **아직 미반영** |

**먼저 읽을 문서 (순서대로):** `CLAUDE.md` → `docs/project.md` → `docs/decisions.md`의 D40 → `docs/handoff.md`(운영 상태·명령) → 이 문서.

## 1. 반드시 지킬 규칙 (CLAUDE.md 요약)

- 비밀값(AI 키, Safe Browsing 키, 헤더 토큰, DB 비밀번호)은 서버 `/etc/family-shield/skill.env`(root 600)에만 있다. **읽거나 출력하거나 커밋하지 않는다.** `.env` 파일도 읽지 않는다.
- `private/` 폴더와 저장소 루트의 법률 질의서 PDF(추적 안 됨)는 커밋하지 않는다. `git add -A` 금지, 파일을 지정해서 add 한다.
- 문자 원문은 DB·로그 어디에도 저장하지 않는다. ‘안전’ 판정을 내지 않는다. 판정은 규칙 코드가 한다.
- **문자 속 링크에 접속하거나 단축 URL을 펼치지 않는다(D11).** 기관 공식 누리집 접속은 근거 확인용으로 허용.
- 사실 정보(기관 도메인·연락처)는 근거 카드에서만 쓴다. 모델 지식으로 채우지 않는다.
- 점수·필터·검증기는 테스트를 먼저 쓴다. 기능 하나 끝날 때마다 **테스트 → 커밋 → push**.
- **서버 상태를 바꾸는 작업(배포·재시작·설정 변경)과 파일 내려받기는 실행 전에 운영자 확인을 받는다.**
- 커밋 메시지 끝에 작성자 표시를 붙인다(예: `Co-Authored-By: ...`).
- 운영자는 전문 개발자가 아니다. 보고는 쉬운 한국어로, 바꾼 이유를 한두 문장으로.

## 2. 배경: 지금까지 한 일 (D40)

1차 멘토 의견: “붙여 넣은 문자 속 URL을 즉시 점검해 피싱 여부를 알려 달라.” 링크 접속 없이 3단계로 보강하기로 결정(D40).

| 단계 | 상태 | 핵심 파일 |
|---|---|---|
| ① KISA 피싱 목록 대조 | **완료·서버 반영** | `packages/core/src/phishing-list.js`, `content/phishing/kisa-hosts.txt`(호스트 SHA-256 앞 16자리 31,573개), `kisa-shorteners.txt`(단축 서비스 57개), `content/phishing/build-kisa.mjs` |
| ② 공식 도메인 사칭 감지 | **구현·테스트 완료, 서버 미반영, R11 수준 미확정** | `packages/core/src/lookalike.js`, `content/evidence/official-domains.json`(근거 카드 10장, 모두 `needs_review`), 신호 `SIG_LOOKALIKE_DOMAIN`, 규칙 R11(임시 ‘위험’) |
| ③ 도메인 생성일 확인 | 미착수(마지막 순서) | - |

- Google Safe Browsing 키는 2026-11-11 서버에 설정 완료(`deploy/set-safebrowsing-key.ps1`). 호스트만 조회.
- KISA 원본 CSV는 운영자 PC의 `data/kisa/`(gitignore)에만 있다. 서버·저장소에는 없다. 필요하면 공공데이터포털 15143094(~2024), 15109780(~2023)에서 다시 받는다(이용허락범위 제한 없음).
- 측정: KISA 원본 표본 1,000건 중 52% 위험·27% 단축 신호. 정상 도메인 36개 오탐 0. 2단계는 KISA 도메인 29,006개 중 2,002개(6.9%) 감지, 정상·혼동 도메인 24개 오탐 0.
- 고친 문제: KISA 원본에 공식 기관 주소(`www.nhis.or.kr`, `efine.go.kr`)와 카카오 채널(`pf.kakao.com`)이 섞여 있어, 공공·교육기관 도메인(`go.kr`, `or.kr`, `ac.kr` 등)과 대형 포털 하위 주소를 목록에서 뺐다.
- 자동 시험: 전체 382건 통과(로컬, Node 24).

## 3. 요청 작업 (순서대로)

### 작업 1. 정상 도메인 대량 오탐 시험 → R11 수준 확정
> **운영자 결정(2026-11-11):** 선택지 C(“대량 시험 후 확정”)로 진행. Tranco 목록 내려받기는 허락됨. 이유: 오경보는 놓침보다 회복이 어렵고(부모님이 다음 경고를 의심), D40·CLAUDE.md가 측정 후 확정을 요구하며, 결과보고서·멘토 설명에 쓸 숫자가 필요하다. 서버 반영은 여전히 실행 전 확인.

1. Tranco 인기 사이트 목록(상위 10만 개, https://tranco-list.eu)을 `data/tranco/`에 내려받는다(커밋 안 함, 허락됨).
2. 시험 스크립트를 `eval/`에 추가한다(예: `eval/lookalike-fp.mjs`). 두 가지를 센다.
   - `findLookalikes()`에 걸리는 도메인 수와 목록(카드별)
   - `loadPhishingListChecker()`에 걸리는 도메인 수와 목록(1단계 오탐)
3. 걸린 정상 도메인은 원인을 분류한다: 이름 규칙이 너무 넓음 / 카드의 공식 도메인 누락 / 공용 도메인 누락.
4. 고칠 때는 **테스트를 먼저** 추가한다(`packages/core/test/lookalike.test.js`, `phishing-list.test.js`). 공식 도메인을 카드에 더할 때는 해당 기관 공식 누리집에서 확인한 것만, `check_note`에 확인 내용을 적는다.
5. 결과로 R11 수준을 정한다. 기준 제안: 상위 10만 개 중 오탐이 사실상 0이면 ‘위험’ 유지, 고쳐도 남으면 ‘주의’로 낮추거나 해당 이름 규칙을 뺀다. **최종 결정은 운영자 확인 후** `docs/decisions.md` D40에 숫자와 함께 기록하고, `docs/prd.md` 9-7 R11의 `[임시]` 표시를 정리한다.

### 작업 2. 서버 반영과 카카오 확인
1. 운영자 확인 후 `powershell -ExecutionPolicy Bypass -File deploy\deploy-skill.ps1` (VM이 origin/main을 받아 core·skill 시험 통과 시에만 재시작).
2. VM에서 읽기 전용 확인(비밀값 안 읽음):
   ```
   ssh fs-ncp 'cd /srv/family-shield/repo && node --input-type=module -e "import { findLookalikes } from \"./packages/core/src/lookalike.js\"; console.log(findLookalikes([\"epost-kr.top\",\"epost.go.kr\"]))"'
   ```
3. 운영자가 카카오 채널에서 **가짜 주소**로 시험: `[시험] 우체국 택배 주소 확인 epost-kr.top` → ‘위험’ 기대. 실제 피싱 주소는 카카오 링크 미리보기가 접속할 수 있으므로 쓰지 않는다.

### 작업 3. 근거 카드 확인 보조
`content/evidence/official-domains.json` 10장은 모두 `needs_review`. 자동 확인 실패·미확인: CJ대한통운(`cjlogistics.com`), 교통민원24(`efine.go.kr`), 로젠(`ilogen.com`), 우정사업본부(`koreapost.go.kr`), 한진(`hanjin.co.kr`), 텔레그램(`telegram.me`, `t.me`). 확인 결과를 `check_note`에 적고, **운영자가 직접 확인했다고 말한 카드만** `status`를 바꾼다. ‘검수 완료’라는 표현은 쓰지 않는다.

### 작업 4. (마지막) 도메인 생성일 확인 설계
구현 전에 설계안만 만든다: 조회 방법(RDAP 등, .kr 도메인 처리), 5초 응답 제한 안에서의 시간 예산(지금 평판 조회 0.8초), 외부로 나가는 정보(도메인 이름만), 실패 시 판정을 낮추지 않는 처리, 새 결정 번호(D41). 운영자 승인 후 구현.

## 4. 자주 쓰는 명령 (로컬, 저장소 루트)

| 목적 | 명령 |
|---|---|
| 전체 시험 | `node --test packages/core/test/*.test.js skill/test/*.test.js eval/test/*.test.js web/src/__tests__/*.test.js` |
| 링크 기능 시험만 | `node --test packages/core/test/phishing-list.test.js packages/core/test/lookalike.test.js` |
| KISA 목록 다시 만들기 | `node content/phishing/build-kisa.mjs data/kisa/kisa-2023.csv data/kisa/kisa-2024.csv` |
| 스킬 서버 배포 | push 후 `powershell -ExecutionPolicy Bypass -File deploy\deploy-skill.ps1` (운영자 확인 필요) |
| 서버 상태 | `ssh fs-ncp 'systemctl status family-shield-skill --no-pager'` |

## 5. 끝나면

- `docs/worklog.md` 맨 위에 날짜별로 한 일·숫자·남은 일을 적는다.
- 운영자에게 쉬운 말로 보고: 오탐 시험 숫자, R11 결정, 서버 반영 여부, 카카오 확인 결과, 운영자가 직접 할 일.
