# Supabase CLI 연동 가이드

작성: 2026-10-27 · 환경: Windows + Docker Desktop + npx supabase 2.122.0

---

## 현재 상태

- **로컬 Supabase 작동 중**: `supabase/` 디렉터리, 마이그레이션 10개, pgTAP 38/38 통과.
- **웹·스킬에는 Supabase 클라이언트 연결 안 됨**: `@supabase/supabase-js` 설치만, `createClient()` 호출 없음.
- **가짜 저장소**: `web/src/data/{confirm,consent,misjudge}.js`는 브라우저 localStorage/sessionStorage만 사용.

클라우드 프로젝트는 **배포 시점(4주차 11/10경, 실제 휴대폰 테스트 시작)에 생성**할 예정.  
무료 요금제는 7일 이상 사용하지 않으면 일시정지되므로 미리 만들지 않음.

---

## 필요한 것

### 1. Supabase CLI 설치 (완료)
- Windows: `npx supabase` (로컬 캐시, 버전 고정 불필요)
- 또는 Scoop: `scoop install supabase`
- 현재: `npx supabase --version` → 2.122.0

### 2. Docker Desktop 실행 (완료)
- `docker info --format '{{.ServerVersion}}'` → 29.8.1
- Supabase는 Postgres·PostgREST·GoTrue·Realtime·Storage·Kong 등을 컨테이너로 실행.

### 3. Supabase 클라우드 계정 (4주차에 생성)
- https://supabase.com/dashboard 에서 무료 가입.
- **리전 선택 시 서울(ap-northeast-2)**.
- 프로젝트 이름: `family-shield` (또는 원하는 이름).

### 4. 환경 변수 준비 (4주차)
클라우드 프로젝트를 만든 뒤, **Project Settings → API**에서 아래 값을 복사:
- `SUPABASE_URL` (예: `https://abcd1234.supabase.co`)
- `SUPABASE_ANON_KEY` (공개 키, 프론트엔드에서 사용)
- `SUPABASE_SERVICE_ROLE_KEY` (비밀 키, 서버 전용, 커밋 금지)

---

## 연결 순서

### 1단계: 로컬 Supabase 확인
```powershell
cd D:\Claude Code\gongmojeon\family-shield
npx supabase start
```
- Studio: http://127.0.0.1:54323
- API URL: http://127.0.0.1:54321
- 이미 실행 중이면 "services already running" 메시지.

### 2단계: 클라우드 프로젝트 생성 (4주차)
Supabase Dashboard(https://supabase.com/dashboard)에서:
1. **New Project** 클릭
2. **리전: Seoul (ap-northeast-2)** 선택
3. Database Password 생성 (기록해 둘 것)
4. **Create project** (생성 1~2분 소요)

### 3단계: CLI에서 클라우드 프로젝트 연결
```powershell
npx supabase login
# 브라우저에서 인증 완료 후 토큰 자동 저장

npx supabase link --project-ref <your-project-ref>
# project-ref는 Dashboard URL에서 확인: https://supabase.com/dashboard/project/<project-ref>
# 또는 Project Settings → General → Reference ID
```

연결 후 `.git/config`에 `[supabase]` 섹션이 추가되거나, `supabase/.temp/` 아래에 링크 정보가 저장됨.

### 4단계: 마이그레이션 푸시
```powershell
npx supabase db push
# supabase/migrations/*.sql 파일을 클라우드 DB에 순서대로 실행
# 경고: 이미 있는 테이블이 있으면 충돌 가능. 새 프로젝트에서 진행.
```

성공하면 클라우드 DB에 로컬과 같은 스키마가 생성됨.

### 5단계: 환경 변수 설정

#### 웹 PWA (`web/.env.local` 생성, 커밋 금지)
```bash
VITE_SUPABASE_URL=https://abcd1234.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
- Vite는 `import.meta.env.VITE_*` 형태로 접근.
- 이 키들은 프론트엔드에 노출되므로 RLS로 보호해야 함.

#### 스킬 서버 (`skill/.env.local` 또는 `skill.env`, 커밋 금지)
```bash
SUPABASE_URL=https://abcd1234.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
- `SERVICE_ROLE_KEY`는 RLS를 우회하므로 서버에만 두고, 절대 프론트엔드·로그·커밋에 넣지 않음.

### 6단계: 코드에서 클라이언트 생성

#### 웹 (`web/src/lib/supabase.js` 신규)
```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase 환경 변수가 설정되지 않았습니다. web/.env.local을 확인하세요.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

#### 스킬 서버 (`skill/src/supabase-client.js` 신규)
```javascript
import { createClient } from '@supabase/supabase-js'
import { config } from './config.js'

const supabaseUrl = config.supabaseUrl
const supabaseKey = config.supabaseServiceRoleKey

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase 환경 변수가 설정되지 않았습니다. skill/.env.local을 확인하세요.')
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
})
```

`skill/src/config.js`에 환경 변수 추가:
```javascript
export const config = {
  // 기존 항목...
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
}
```

### 7단계: 가짜 저장소 교체

| 파일 | 교체 내용 |
|---|---|
| `web/src/data/confirm.js` | `localStorage` → `supabase.from('confirm_requests').insert/select` + 폴링 |
| `web/src/data/consent.js` | `localStorage` → `circle_members` 동의 컬럼 조회(RLS) |
| `web/src/screens/WaitScreen.jsx` | 3초 폴링 → `confirm_requests` 조회 |
| `web/src/screens/FamilyDashboardScreen.jsx` | 같은 기기만 → RLS로 내 요청만 |

교체 시 RLS 정책이 작동하는지 테스트 필수.

### 8단계: RLS 작동 확인
```powershell
# 로컬에서 RLS 테스트 (pgTAP)
npx supabase test db

# 클라우드에서도 같은 마이그레이션·테스트가 적용됐는지 확인
npx supabase db push
npx supabase test db --db-url "postgresql://postgres:[DB_PASSWORD]@db.[project-ref].supabase.co:5432/postgres"
```

---

## 주의사항

1. **`.env.local` 파일은 `.gitignore`에 이미 등록됨.** 커밋하지 말 것.
2. **로컬 Supabase는 개발용, 클라우드는 배포용.** 클라우드에 테스트 데이터를 넣지 말 것.
3. **RLS 정책이 없으면 anon 역할은 아무것도 볼 수 없음(기본 거부).** 웹에서 조회 실패 시 RLS 먼저 확인.
4. **Service Role Key는 서버 전용.** 프론트엔드·로그·오류 리포트에 절대 노출 금지.
5. **마이그레이션 순서는 파일명 타임스탬프로 결정.** 기존 파일을 수정하지 말고, 새 마이그레이션 추가.

---

## 유용한 명령어

```powershell
# 로컬 Supabase 시작
npx supabase start

# 로컬 Supabase 중지
npx supabase stop

# 로컬 DB 초기화 (마이그레이션 다시 실행)
npx supabase db reset

# 로컬 Studio 열기
start http://127.0.0.1:54323

# 클라우드와 마이그레이션 차이 확인
npx supabase db diff

# 클라우드에 마이그레이션 푸시
npx supabase db push

# 클라우드에서 현재 상태를 마이그레이션으로 생성 (주의)
npx supabase db pull

# RLS 테스트 실행
npx supabase test db
```

---

## 다음 단계

1. 클라우드 프로젝트 생성 (4주차 11/10경)
2. `npx supabase link`
3. `npx supabase db push`
4. `.env.local` 설정
5. `web/src/lib/supabase.js`, `skill/src/supabase-client.js` 생성
6. `confirm.js`, `consent.js` 등을 Supabase 호출로 교체
7. RLS 테스트로 권한 확인
8. 웹·스킬 서버를 클라우드 DB와 연결해 실제 왕복 확인

---

**결론**: Supabase CLI는 이미 준비됐고, 로컬 DB도 작동 중입니다. 클라우드 프로젝트를 만들고 `link` + `db push`만 하면 즉시 연결할 수 있습니다.
