# Supabase 클라우드 연결 완료 (2026-10-27)

## 연결 상태: ✅ 성공

### 1. 마이그레이션 푸시
- 10개 파일 모두 클라우드 DB에 적용 완료
- 테이블 15개, RLS 정책, 트리거, RPC 함수 배포

### 2. 클라이언트 코드 생성
- `web/src/lib/supabase.js`: 웹 PWA용 (anon 키)
- `skill/src/supabase-client.js`: 스킬 서버용 (service_role 키)
- `skill/src/config.js`: supabase 설정 항목 추가

### 3. 환경 변수 설정
- `web/.env.local`: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY ✅
- `skill/.env.local`: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY ✅
- `.gitignore`에 이미 `.env.*` 패턴 등록됨

### 4. 연결 테스트
- 웹 → Supabase: ✅ 연결 성공 (401 permission denied는 RLS 정상 동작)
- 브라우저 콘솔: `https://sezchlnsyrdazclrbtgv.supabase.co/rest/v1/users` 호출 확인
- SQL Editor RLS 테스트: anon 역할로 users 테이블 접근 차단 확인

---

## 다음 단계

### 즉시 진행 가능
1. **confirm_requests 교체** (localStorage → Supabase)
   - `web/src/data/confirm.js` 
   - `web/src/screens/WaitScreen.jsx` (폴링)
   - `web/src/screens/FamilyDashboardScreen.jsx` (최근 24시간 목록)

2. **consent 교체** (localStorage → Supabase)
   - `web/src/data/consent.js`
   - 동의 이력 조회는 RLS로 자동 필터링

3. **스킬 서버 연결**
   - 판별 결과를 `checks` 테이블에 저장
   - 1회용 토큰 생성 (`result_tokens` RPC)

### 로그인 구현 후 진행
- Auth 흐름 (S1~S6)
- 휴대폰 인증 (Send SMS Hook + 솔라피)
- 보호자 초대 (F1)

---

## 참고

- **로컬 Supabase**: `npx supabase start` (개발용, Docker)
- **클라우드 Supabase**: `https://sezchlnsyrdazclrbtgv.supabase.co` (배포용)
- **Studio**: https://supabase.com/dashboard/project/sezchlnsyrdazclrbtgv
- **pgTAP 클라우드 테스트**: 스키마 이슈로 실패, 로컬 테스트는 38/38 통과
