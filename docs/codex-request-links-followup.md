# Codex 작업 요청서 2: 링크 점검 후속 조사와 규칙 재검토 (D40·D41 이후)

작성일: 2026-11-11 · 작성: Claude Code · 요청자: 프로젝트 운영자(1인 개발)

## 0. 저장소와 폴더

| 항목 | 값 |
|---|---|
| GitHub | https://github.com/lythean1004/family-shield (public, 기본 브랜치 `main`) |
| 로컬 폴더 (Windows) | `D:\Claude Code\gongmojeon\family-shield` |
| 서비스 | https://familyshield.kr (카카오 채널 챗봇 + 웹) |
| 시작 시점 커밋 | `dc322a7` (서버 반영 `8404620`까지) |

**먼저 읽을 문서:** `CLAUDE.md` → `docs/project.md` → `docs/decisions.md`의 D40·D41 → `docs/d41-domain-age-design.md` → 이 문서. 지난 요청서 `docs/codex-request-d40.md`(근거 카드 확인)는 완료됐다.

작업 전에 `git pull`, 커밋 직전에 `git pull --rebase`.

## 1. 반드시 지킬 규칙 (CLAUDE.md 요약)

- 비밀값(키·토큰·DB 비밀번호)은 읽거나 출력하거나 커밋하지 않는다. `.env`, 서버 `skill.env`를 열지 않는다.
- `private/` 폴더와 저장소 루트의 법률 질의서 PDF(추적 안 됨)는 커밋하지 않는다. `git add -A` 금지, 파일을 지정해서 add 한다.
- `data/`(KISA CSV, Tranco 목록, RDAP 측정 결과)는 커밋하지 않는다. 피싱 주소 원문을 저장소·문서에 그대로 적지 않는다(필요하면 도메인 끝부분이나 건수만).
- **문자 속 링크·피싱 의심 주소에 접속하지 않는다. 단축 URL을 펼치지 않는다.** 기관 공식 누리집과 공신력 있는 출처만 연다.
- 사실 정보(기관 도메인·연락처)는 근거로 확인한 것만. 모델 지식으로 채우지 않는다.
- 판정·점수·규칙은 **테스트를 먼저** 쓴다. 자동 테스트만이 아니라 아래 오탐 시험 숫자로 확인한다.
- **서버 접속·배포·재시작·설정 변경은 하지 않는다.** 서버 반영은 Claude Code가 운영자 승인 후에 한다.
- **판정 수준(위험/주의)을 바꾸거나 새 규칙을 켜는 것은 운영자 승인 전에는 커밋만 하고, 보고서에 승인 요청으로 올린다.**
- “검수 완료”라고 쓰지 않는다. 근거 카드 상태 값은 `needs_review` / `source_checked`만.
- 커밋 메시지 끝에 작성자 표시를 붙인다(예: `Co-Authored-By: ...`).
- 운영자는 전문 개발자가 아니다. 보고는 쉬운 한국어로, 숫자와 이유를 함께.

## 2. 지금 상태 요약

| 단계 | 내용 | 핵심 파일 |
|---|---|---|
| ① KISA 목록 대조(R10) | KISA 2023~2024 피싱 호스트 SHA-256 앞 16자리 31,111개, 단축 서비스 42개 | `packages/core/src/phishing-list.js`, `content/phishing/` |
| ② 공식 주소 흉내(R11, 위험) | 근거 카드 10장(모두 `source_checked`) | `packages/core/src/lookalike.js`, `content/evidence/official-domains.json` |
| ③ 도메인 생성일(R12, 위험) | RDAP 등록일 30일 이내 + 돈·개인정보·앱 설치 요구 | `packages/core/src/domain-age.js`, `content/rdap/dns.json` |
| 링크 인식 | 스킴 없는 도메인 끝부분 목록(KISA 20회 이상 87개 추가) | `packages/core/src/links.js` |

측정 도구: `eval/lookalike-fp.mjs`(Tranco 오탐), `eval/domain-age-measure.mjs`(RDAP), `content/phishing/build-kisa.mjs`(KISA 목록 다시 만들기). 기준 숫자: Tranco 100만 개 중 R11 5개(0.0005%), 한국 도메인 0개.

## 3. 요청 작업 (우선순위 순)

### 작업 1. `hanjin` 이름 규칙 재검토 (지난 확인에서 Codex가 지적)
- 문제: `hanjin` 앞부분 규칙이 한진 계열사 정상 도메인을 잡을 수 있다. Tranco에서 `hanjintravel.com` 1건, KISA 사칭 사례는 `hanjin1.com`·`hanjin2.com`·`hanjin3.com` 3건뿐.
- 할 일: 한진 공식 누리집에서 계열사 도메인 근거를 찾고, 다음 중 하나를 제안·구현한다.
  - (가) 근거가 확인된 계열사 도메인을 `official_domains`에 추가
  - (나) 이름 규칙을 좁힘(예: 택배 관련 조합만). KISA 3건은 계속 잡혀야 한다
- 같은 방식으로 다른 카드의 `prefixes`도 훑어 비슷한 위험이 있으면 보고한다(고치는 것은 근거가 있을 때만).

### 작업 2. 새 근거 카드 후보 조사와 추가 (관세청, 금융감독원, 주요 은행·카드사·통신사)
- **먼저 KISA 목록에서 실제로 사칭된 이름을 센다**: `data/kisa/*.csv`의 호스트에서 기관 이름 조각 빈도(예: kb, nh, woori, shinhan, card, uplus, kt, customs 등). 지난 측정에서 `nh` 113, `kt` 26, `lg` 8, `card` 8, `woori` 3, `uplus` 3 등이 나왔다. 원문 주소는 문서에 적지 말고 건수와 예시 모양만.
- 사칭 사례가 있는 기관부터 카드 후보로 삼는다. 각 기관 **공식 누리집에서** 공식 도메인(모바일·인증·고객센터 별도 도메인 포함)을 확인해 카드를 만든다(`status: source_checked`, 근거는 `check_note`).
- 이름 규칙은 KISA 사례를 잡되 짧은 이름(`kb`, `nh`, `kt`, `lg`)은 오탐 위험이 크다. 조각 전체 일치·조합 조건 등으로 좁히고, **반드시 테스트 먼저**.
- 카드마다 오탐 시험을 돌린다: `node eval/lookalike-fp.mjs data/tranco/top-1m.csv 1000000`. **추가 기준(제안):** Tranco 100만 개에서 새 카드로 늘어난 R11이 0~2개이고, 한국 도메인(.kr)에서 0개. 넘으면 규칙을 더 좁히거나 카드를 보류한다.
- 카드를 추가하면 `content/phishing/build-kisa.mjs`를 다시 실행해 공식 도메인이 KISA 목록에서 빠지게 한다:
  `node content/phishing/build-kisa.mjs data/kisa/kisa-2023.csv data/kisa/kisa-2024.csv --allow data/tranco/top-1m.csv`
- 운영자 승인 전이므로 카드 추가 커밋은 하되, 보고서에 “서버 반영 승인 필요”로 표시한다.

### 작업 3. 운영 중 신호 횟수 세기 설계·구현 (원문 없이)
- 목적: R12 등 링크 신호의 실제 효과를 운영 중에 확인(과거 자료로는 증명 불가, D41).
- 지금 스킬 서버 로그·DB에 무엇이 남는지 먼저 확인한다(`skill/src/`, 원문·도메인 이름은 남기지 않는 것이 원칙).
- 제안: 판별마다 **신호 ID·발동 규칙·조회 성공/실패·지연시간만** 하루 단위 건수로 집계(메모리 또는 기존 기록 구조). 문자 원문·도메인 이름·사용자 식별자 금지.
- 설계를 문서로 먼저 쓰고(`docs/` 새 파일), 구현은 테스트 먼저. 저장 방식이 DB 변경을 요구하면 구현하지 말고 설계만 올린다.

### 작업 4. 남은 링크 인식 누락 24건 분석
- KISA 스킴 없는 항목 1,975건 중 아직 링크로 못 알아보는 24건의 유형을 분류한다(끝부분, 숫자 IP, 한글 도메인 등). 끝부분 추가로 해결되는 것은 테스트와 함께 추가하고, 일반 문장 오인식 위험(버전 번호·소수 등)을 테스트로 막는다.

## 4. 끝나면

1. 전체 시험: `node --test packages/core/test/*.test.js skill/test/*.test.js eval/test/*.test.js web/src/__tests__/*.test.js`
2. 오탐 시험 숫자(작업 1·2·4 전후 비교)
3. `docs/worklog.md` 맨 위에 날짜·한 일·숫자·남은 일
4. 운영자에게 쉬운 말로 보고:
   - 작업별 결과와 숫자
   - **승인이 필요한 것**(새 카드 반영, 규칙 수준 변경, 서버 반영)
   - 근거를 못 찾은 것과 이유
