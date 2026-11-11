# Codex 작업 요청서: 공식 도메인 근거 카드 확인 (D40 ②)

작성일: 2026-11-11 · 작성: Claude Code · 요청자: 프로젝트 운영자(1인 개발)

> **Codex가 맡는 일은 근거 카드 확인 하나뿐이다.** 오탐 시험, 판정 수준(R11) 확정, 서버 반영, 도메인 생성일 설계는 Claude Code가 같은 저장소에서 동시에 진행한다. 충돌을 피하려고 Codex는 아래 3장의 파일·필드만 고친다.

## 0. 저장소와 폴더

| 항목 | 값 |
|---|---|
| GitHub | https://github.com/lythean1004/family-shield (public, 기본 브랜치 `main`) |
| 로컬 폴더 (Windows) | `D:\Claude Code\gongmojeon\family-shield` |
| 확인할 파일 | `content/evidence/official-domains.json` (근거 카드 10장) |
| 서비스 주소 | https://familyshield.kr |

**먼저 읽을 문서:** `CLAUDE.md` → `docs/project.md` → `docs/decisions.md`의 D40 → 이 문서.

작업 전에 `git pull`로 최신을 받고, 커밋 직전에 다시 `git pull --rebase` 한다(Claude Code가 다른 파일을 동시에 고치고 있음).

## 1. 반드시 지킬 규칙 (CLAUDE.md 요약)

- 비밀값(키·토큰·DB 비밀번호)은 읽거나 출력하거나 커밋하지 않는다. `.env`, 서버 `skill.env`를 열지 않는다.
- `private/` 폴더와 저장소 루트의 법률 질의서 PDF(추적 안 됨)는 커밋하지 않는다. `git add -A` 금지, 파일을 지정해서 add 한다.
- **사실 정보는 근거로 확인한 것만 쓴다. 모델이 알고 있는 지식으로 도메인을 채우지 않는다.**
- **피싱 의심 주소에는 접속하지 않는다.** 확인을 위해 여는 것은 기관 공식 누리집과 공신력 있는 출처뿐이다.
- 전문가 검수 전에는 “검수 완료”라고 쓰지 않는다. 카드 상태 값은 아래 3장의 것만 쓴다.
- 서버 접속·배포·재시작은 하지 않는다(이번 일에 필요 없음).
- 커밋 메시지 끝에 작성자 표시를 붙인다(예: `Co-Authored-By: ...`).
- 운영자는 전문 개발자가 아니다. 보고는 쉬운 한국어로.

## 2. 배경

1차 멘토 의견(“붙여 넣은 문자 속 URL을 즉시 점검”)으로 링크 점검을 보강했다(D40). 2단계는 링크 도메인 앞부분에 기관·택배사 이름이 있는데 그 기관의 **공식 도메인이 아니면** ‘공식 주소 흉내’(`SIG_LOOKALIKE_DOMAIN`)로 본다. 카드의 `official_domains`는 **진짜 주소를 사칭으로 잘못 보지 않게 빼는 목록**이라, 빠진 공식 도메인이 있으면 진짜 기관 링크가 ‘위험’으로 나온다. 그래서 공식 도메인을 정확하고 빠짐없이 확인하는 일이 중요하다.

## 3. 요청 작업: 근거 카드 10장 확인

### 카드별 확인할 것

| ID | 기관 | 지금 공식 도메인 | 자동 확인 결과(Claude Code, 2026-11-11) |
|---|---|---|---|
| EV-DOM-EPOST | 우체국(우정사업본부) | epost.go.kr, koreapost.go.kr | epost 제목 ‘인터넷우체국’ / koreapost 200 응답, 제목 없음. 우체국예금·보험(epostbank.go.kr 등) go.kr 도메인은 코드에서 항상 제외되므로 더하지 않아도 됨 |
| EV-DOM-CJ | CJ대한통운 | cjlogistics.com | 응답 없음 |
| EV-DOM-LOGEN | 로젠택배 | ilogen.com | 200 응답, 제목 없음 |
| EV-DOM-LOTTE | 롯데택배 | lotteglogis.com | 제목 ‘롯데글로벌로지스’ |
| EV-DOM-HANJIN | 한진택배 | hanjin.com, hanjin.co.kr | hanjin.com 제목 확인 / hanjin.co.kr 미확인 |
| EV-DOM-EFINE | 경찰청 교통민원24 | efine.go.kr | 307 응답만 |
| EV-DOM-NHIS | 국민건강보험공단 | nhis.or.kr | 제목 ‘국민건강보험’ |
| EV-DOM-NTS | 국세청·홈택스 | nts.go.kr, hometax.go.kr | 둘 다 제목 확인 |
| EV-DOM-GOV | 정부 기관 | gov.kr, go.kr | gov.kr 제목 ‘정부24’ |
| EV-DOM-TELEGRAM | 텔레그램 | telegram.org, telegram.me, t.me | telegram.org 제목 확인 / 나머지 미확인 |

### 추가 확인 대상 (2026-11-11 정상 도메인 시험에서 사칭으로 걸린 도메인)
Tranco 인기 사이트 시험에서 아래 도메인이 사칭으로 걸렸다. **접속하지 말고**, 해당 기관 공식 누리집 안의 안내(계열사·해외 법인 목록 등)에서 공식 도메인인지 확인한다. 공식이면 그 카드의 `official_domains`에 근거와 함께 더하고, 아니면 보고서에 “공식 근거 없음”으로 적는다.
- `cjlogistics.co.th` (CJ대한통운 태국 법인으로 보임) → EV-DOM-CJ
- `hanjintravel.com` (한진 계열 여행사로 보임) → EV-DOM-HANJIN
- `koreapost.com`, `tn-nhis.com`, `telegrem.store` → 사칭 의심. 공식 근거가 없으면 그대로 둔다

### 확인 방법
1. 각 기관의 공식 누리집을 열어 기관 이름·운영 주체(누리집 아래쪽 저작권 표시, 회사 소개 등)를 확인한다.
2. 그 기관이 실제로 쓰는 **다른 공식 도메인**이 있는지 확인한다. 예: 택배 조회 전용 주소, 모바일 주소, 예전 주소. 근거는 그 기관 누리집 안의 안내나 공공기관 자료만 인정한다.
3. 가능하면 두 번째 출처로 교차 확인한다(예: 공공기관 누리집 목록, 기관 공식 앱의 개발사 웹사이트 표기).
4. 이용조건(이 카드 내용을 서비스에 인용해도 되는지)을 확인할 수 있으면 `terms_checked`를 갱신한다. 확인하지 못하면 `false`로 둔다.

### 고쳐도 되는 것 (이 파일의 이 필드만)
- `check_note`: 확인한 날짜, 연 주소, 본 내용(예: “2026-11-12 epost.go.kr 하단 ‘우정사업본부’ 표기 확인”)
- `status`: `needs_review`(확인 못 함) → `source_checked`(공식 출처에서 기관·도메인을 확인함). **다른 값은 쓰지 않는다.**
- `source_url`, `posted_at`, `checked_at`, `terms_checked`
- `official_domains`에 **더하기**: 근거를 찾은 공식 도메인만, `check_note`에 근거 주소와 함께. 빼기는 하지 않고 운영자에게 보고만 한다.

### 고치지 않는 것
- `prefixes`, `exact`, `regex`(이름 규칙)와 코드·테스트 파일. 이름 규칙이 잘못됐다고 보이면 보고서에만 적는다(Claude Code가 오탐 시험과 함께 고친다).
- 새 카드 추가. 필요해 보이는 기관(은행, 카드사, 통신사 등)은 보고서에 후보로만 적는다.

### 끝나면
1. `node --test packages/core/test/lookalike.test.js`로 시험이 그대로 통과하는지 확인한다(공식 도메인을 더했다면 특히).
2. 파일 하나만 add 해서 커밋하고 push 한다.
3. 운영자에게 쉬운 말로 보고: 카드별 결과(확인함 / 확인 못 함과 이유), 더한 공식 도메인과 근거, 이름 규칙에 대한 의견, 새 카드 후보.
