# Codex 작업 요청서 4: 웹 화면 디자인 교체 (시안 B 맑은 블루) + 고대비 스위치

작성일: 2026-11-26 · 작성: Claude Code · 요청자: 프로젝트 운영자(1인 개발)

## 0. 저장소와 폴더

| 항목 | 값 |
|---|---|
| GitHub | https://github.com/lythean1004/family-shield (public, 기본 브랜치 `main`) |
| 로컬 폴더 (Windows) | `D:\Claude Code\gongmojeon\family-shield` |
| 작업 폴더 | `web/` (Vite + React, 정적 배포 PWA) |
| 고칠 파일 | `web/src/index.css`, `web/src/App.css`, `web/src/screens/HomeScreen.jsx`, `web/src/screens/SettingsScreen.jsx`, `web/src/main.jsx`, 새 파일 `web/src/data/contrast-pref.js`, `web/src/__tests__/contrast.test.js`, 새 테스트 `web/src/__tests__/contrast-pref.test.js`, `docs/screen-spec.md`(2장 토큰), 결과 보고 `docs/design-b-review.md`(새 파일), `docs/worklog.md` |
| 시작 시점 | `18837c3` (동의 문구 v4 배포본) |
| 시안 | `docs/design/mockup-2026-11-26.html`의 **B. 맑은 블루** (브라우저로 열면 보임. 위쪽 [고대비로 보기] 스위치가 고대비 모드 예시) |

**먼저 읽을 문서:** `CLAUDE.md` → `docs/project.md` → `docs/screen-spec.md` 2장(토큰) → `docs/frontend-structure.md` → 시안 HTML → 이 문서.
작업 전 `git pull`, 커밋 직전 `git pull --rebase`.

## 1. 왜 바꾸나

운영자 의견: 지금 화면은 굵은 테두리와 원색 위주의 고대비라 "어른용이라 너무 단순하고 딱딱해" 보인다. 고대비가 꼭 기본일 이유는 없으니, **기본은 부드럽고 요즘 앱 같은 화면(시안 B)**, 필요한 사람은 **[고대비로 보기] 스위치**로 지금과 비슷한 화면을 쓰게 한다.

## 2. 반드시 지킬 규칙

- **보이는 모양만 바꾼다.** 화면 순서·라우트·판별 로직·문구·API 호출·동의 흐름은 바꾸지 않는다. `packages/`, `skill/`, `content/`는 건드리지 않는다.
- 판정 문구와 의미·한계 안내 문구(project.md)는 글자 그대로 둔다. ‘안전’ 같은 새 판정 표현, “검수 완료” 표시를 넣지 않는다.
- **글자 대비는 낮추지 않는다.** 본문·버튼 글자는 배경 대비 4.5:1 이상, 입력창·스위치·초점 테두리 같은 비텍스트는 3:1 이상(WCAG 2.x AA). 부드럽게 보이는 것은 배경·모서리·그림자·여백으로 만든다.
- 부모님 화면 글자 크기(`.mode-parent` 150%)와 터치 크기(`--touch-min` 48px, `--btn-min` 64px)는 줄이지 않는다.
- **외부 CDN에서 글꼴·스크립트를 불러오지 않는다**(제3자에게 접속 기록이 남음). Pretendard를 쓰려면 npm 패키지(`pretendard`, OFL)로 설치해 번들에 넣고, 어렵거나 용량이 크면(woff2 서브셋 포함 400KB 초과) 시스템 글꼴을 유지한다. 시안의 jsdelivr 링크는 시안 전용이다.
- 비밀값·`.env`를 열지 않는다. 서버 접속·배포를 하지 않는다(배포는 Claude Code가 운영자 승인 후).
- `private/`, `data/`는 커밋하지 않는다. `git add -A` 금지, 고친 파일만 add.
- 고대비 선택 로직은 **테스트를 먼저** 쓴다(실패 확인 → 구현).
- 커밋은 작게(아래 작업 단위별). 메시지 끝에 작성자 표시. 보고는 쉬운 한국어로.

## 3. 요청 작업

### 작업 1. 색·모양 토큰 교체 (`web/src/index.css`)

`:root` 토큰을 아래 값으로 바꾼다. 대비는 Claude Code가 미리 계산했다(괄호 안 숫자). `contrast.test.js`가 같은 쌍을 다시 검사한다.

| 토큰 | 지금 | 새 값 | 확인한 대비 |
|---|---|---|---|
| `--c-bg` | `#ffffff` | `#f3f5f9` (연회색 바탕) | |
| `--c-surface` | `#f5f6f8` | `#ffffff` (흰 카드) | |
| `--c-bg-raised` | `#eef1f5` | `#e8ecf3` (눌림·칩 배경) | |
| `--c-border` | `#7b8490` | `#7d8794` (입력창·스위치 테두리 전용) | 바탕 3.34 / 흰색 3.64 |
| `--c-border-soft` | `#c4c9d0` | `#e3e7ee` (장식 구분선) | |
| `--c-text` | `#111418` | `#191f28` | 바탕 15.2 |
| `--c-text-sub` | `#3f4650` | `#4e5968` | 바탕 6.52 / 카드 7.11 / 위험 배경 6.23 |
| `--c-action` | `#1a56db` | `#2a5bd7` | 바탕 5.38 |
| `--c-action-text` | `#ffffff` | `#ffffff` | (흰 글자/파랑 버튼 4.5 이상인지 테스트로 확인) |
| `--c-danger` | `#b42318` | `#c0261f` | 위험 배경 5.20 / 흰 글자 5.94 |
| `--c-danger-bg` | `#fdecea` | `#fdecec` | |
| `--c-caution` / `-bg` | `#9a4a00` / `#fff4e5` | `#9a5300` / `#fff3e0` | 5.30 |
| `--c-check` / `-bg` | `#1f4f99` / `#eaf1fb` | `#2a57c7` / `#e8efff` | 5.54 |
| `--c-focus` | `#1a56db` | `#2a5bd7` | |

모양 토큰:
- `--radius-btn: 16px`, `--radius-card: 22px`, `--radius-inner`는 중첩 공식(카드 반지름 − 안쪽 간격)에 맞게 다시 계산.
- 새 토큰 `--shadow-card: 0 2px 10px rgba(25,31,40,.06)`, `--radius-pill: 999px`.
- 기존 `@media (prefers-contrast: more)` 블록은 작업 3의 고대비 토큰으로 합친다.

### 작업 2. 부품 모양 교체 (`web/src/App.css`)

시안 B를 기준으로 클래스별 모양만 바꾼다. 클래스 이름은 유지한다(JSX를 덜 건드리기 위해).

| 부품 | 지금 | 바꿀 모양 |
|---|---|---|
| `.action-btn--primary` | 파랑 채움 + 테두리 | 파랑 채움, 테두리 없음, 둥근 16px |
| `.action-btn--danger` | 빨강 채움 | **연한 빨강 배경(`--c-danger-bg`) + 빨강 글자**, 테두리 없음 (위험 화면 안의 주 버튼은 지금처럼 채움 유지: `.screen--danger` 안에서는 기존 모양) |
| `.action-btn--secondary` | 흰 바탕 + 파랑 테두리 | **흰 카드형 목록 버튼**: 흰 배경, 그림자 `--shadow-card`, 글자 `--c-text`, 왼쪽 정렬, 오른쪽에 `›` (CSS `::after`, `aria-hidden` 효과 위해 content만 사용) |
| `.verdict-banner` | 진한 테두리 | 테두리 없음, 판정별 연한 배경 + 진한 판정 글자, 둥근 22px. 아이콘 원은 판정 색 채움 + 흰 `!` |
| `.signal-list__item` | 회색 줄 목록 | 칩 모양(알약, `--c-bg-raised` 배경, `--c-text-sub` 글자) 가로 줄바꿈. 화면 읽기 순서는 그대로 |
| `.call-btn`, `.contact-card`, `.dashboard-card`, `.demo-list__btn`, `.quiz-choice`, `.misjudge__choice`, `.settings-section` | 회색 배경 + 테두리 | 흰 카드 + `--shadow-card`, 테두리 없음 |
| `.limit-notice`, `.no-link-footer`, `.settings-note` | | `--c-bg-raised` 배경의 둥근 상자, 작은 글자 |
| TopNav(`.top-nav` 계열, `components/TopNav.jsx`의 클래스) | 아래 진한 선 + 테두리 버튼 | 바탕과 같은 색, 아래 선 없음, 로고 앞에 파랑 둥근 사각형(CSS 장식), [메뉴]는 알약 칩 |
| `.input-textarea`, `.settings-toggle` | | **테두리 유지**(`--c-border`, 3:1). 입력창은 흰 배경, 둥근 16px |

`:focus-visible` 초점 테두리는 모든 부품에서 그대로 보여야 한다(그림자에 가리지 않게 `outline-offset` 확인).

### 작업 3. 고대비 스위치

**동작**
1. 값은 `'auto' | 'high' | 'normal'`. 기본 `'auto'`.
2. `'auto'`이면 휴대폰·PC의 “대비 높이기”(`prefers-contrast: more`) 또는 강제 색(`forced-colors: active`)이 켜져 있을 때 고대비, 아니면 시안 B.
3. 사용자가 스위치를 누르면 `'high'` 또는 `'normal'`로 저장한다. 이 기기 `localStorage`의 키 `fs-contrast`에만 저장(서버로 보내지 않음, 개인정보 아님).
4. 적용은 `<html data-contrast="high">` 속성으로 한다. 처음 그릴 때 깜빡임이 없도록 `main.jsx`에서 React 렌더 전에 적용한다.

**코드**
- `web/src/data/contrast-pref.js`: 순수 함수로 만든다.
  - `readPref(storage)` → 저장값, 없거나 이상하면 `'auto'`
  - `resolveContrast(pref, { prefersMore, forcedColors })` → `'high' | 'normal'`
  - `nextPref(current)`: 스위치를 누르면 지금 보이는 상태의 반대로 (`'high'` ↔ `'normal'`)
  - `applyContrast(doc, mode)`: `data-contrast` 설정
- 테스트 `web/src/__tests__/contrast-pref.test.js` 먼저: 저장값 없음/이상한 값/`high`/`normal`, auto + 대비 높이기, auto + 강제 색, 저장소 예외(사생활 모드에서 `localStorage` 오류) 시 `'auto'`로 동작.

**고대비 토큰** (`index.css`의 `[data-contrast="high"]` 블록): 지금 배포본에 가깝게.
- `--c-bg #ffffff`, `--c-surface #ffffff`, `--c-text #000000`, `--c-text-sub #111418`, `--c-border #111418`, `--c-action #0a3fbf`, `--c-danger #a00000`, `--c-danger-bg #ffffff`, `--c-caution #7a3d00`, `--c-caution-bg #ffffff`, `--c-check #0a3fbf`, `--c-check-bg #ffffff`, `--shadow-card none`.
- 이 모드에서는 카드·버튼·판정 배너에 2px 진한 테두리(판정 배너는 판정 색 3px)를 다시 그린다. 시안 HTML의 `body.hc` 부분 참고.
- `contrast.test.js`에 고대비 토큰 쌍도 검사하도록 추가(같은 PAIRS를 고대비 블록에서 한 번 더). 고대비 모드는 본문 7:1 이상 목표.

**스위치 위치**
- 홈 화면: 맨 아래 [설정] 글자 링크 옆에 `고대비로 보기` 글자 버튼(켜져 있으면 `기본 화면으로 보기`). `aria-pressed` 사용.
- 설정 화면: 기존 `.settings-toggle-row` 모양으로 “고대비로 보기” 한 줄 추가, 설명 “글자와 테두리를 더 진하게 보여 줘요. 이 기기에만 저장돼요.”

### 작업 4. 홈 화면 첫 부분 (`HomeScreen.jsx`)

- 제목 `가족방패`는 TopNav 로고가 이미 보여 주므로, 화면 위쪽을 **흰 안내 카드**로 바꾼다: 굵은 제목 + 지금 두 문장(문구 그대로). 화면 읽기용 `h1`은 유지(카드 안 제목을 `h1`로).
- 버튼 순서·문구·이동 경로는 그대로. 모양만 작업 2를 따른다(공식 번호 = 파랑 채움, 이미 눌렀어요 = 연한 빨강, 예시·퀴즈 = 흰 목록 버튼).
- 시안 아래쪽의 ‘위험/주의/확인 필요’ 작은 칩 줄은 **넣지 않는다**(설명 없이 보이면 혼란).

### 작업 5. 확인과 기록

1. `cd web && npm test` 모두 통과, `npm run build` 성공.
2. `npm run dev`로 띄워 **휴대폰 크기(375×812)** 에서 아래 화면을 기본/고대비 두 모드로 캡처한다: 홈 `/`, 예시 목록 `/demo`, 예시 결과(“딸이라고 하는 문자”), 공식 번호 `/contacts`, 이미 당했어요 `/help`, 설정 `/settings`, 퀴즈 `/quiz`. 캡처는 커밋하지 말고 `docs/design-b-review.md`에 어떤 화면을 봤고 무엇이 깨졌는지(글자 넘침, 겹침, 초점 테두리 안 보임 등)만 적는다.
3. 키보드 Tab으로 홈 → 예시 결과까지 이동해 초점이 항상 보이는지 확인.
4. `docs/screen-spec.md` 2장 토큰 표를 새 값으로 고치고, 고대비 스위치를 한 줄로 기록. `docs/worklog.md`에 날짜·한 일·남은 일.

## 4. 커밋 단위 (예시)

1. `test(web): contrast preference resolver` → 2. `feat(web): contrast switch (auto/high/normal)` → 3. `style(web): design B tokens + contrast test` → 4. `style(web): design B components` → 5. `style(web): home intro card` → 6. `docs: design B review, screen-spec tokens, worklog`

## 5. 하지 않을 것

- 배포·서버 접속, 카카오 챗봇 문구 변경
- 새 화면·새 기능·문구 수정(오타를 발견하면 보고서에만 적는다)
- 다크 모드, 애니메이션 추가, 아이콘 라이브러리 추가
- 외부 CDN 글꼴·이미지

## 6. 끝나면 보고할 것 (`docs/design-b-review.md`)

- 바꾼 파일과 커밋 목록
- 테스트 수(전/후)와 대비 검사 결과(가장 낮은 쌍과 값)
- 화면 확인 표: 화면 × (기본/고대비) × 문제 여부
- 글꼴을 Pretendard로 바꿨는지, 번들 크기 변화(`npm run build` 출력의 js/css/폰트 크기 전후)
- 결정이 필요한 점(예: 위험 버튼을 연한 빨강으로 바꾼 것이 충분히 눈에 띄는지)
