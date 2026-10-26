# NCP 서버 배정에 따른 계획 변경 검토 (D29 초안)

작성일: 2026-10-26 · 상태: **D29 B안 확정, PRD v0.6 반영 완료(2026-10-26 사용자 승인)**. 도메인 미보유(필요 시 구매), VM Node 버전 상향은 개발 완료 후
관련 문서: docs/ncp-check.md(10-23 사전 점검), docs/prd.md v0.5, docs/decisions.md

## 0. 요약

- **D29는 아직 내려지지 않은 결정이다.** `docs/ncp-check.md` 4행에 "지원 조건(크레딧 사용처, NCP 서비스 필수 여부)을 받으면 7장을 채우고 D29로 결정한다"라고만 예약돼 있다. decisions.md, prd.md 6장에는 D29가 없다(D28이 마지막).
- 10-23 검토는 "NCP를 쓴다면 Cloud Functions + API Gateway"를 전제로 했다. **실제로 배정된 것은 Rocky Linux 8.10 VM 1대(공인 IP)**이므로 전제가 바뀐다.
- 결론: **카카오 스킬 서버는 배정받은 NCP VM에서 운영할 수 있다.** Cloud Functions보다 이 프로젝트에 더 잘 맞는다(코어를 그대로 실행, 콜드 스타트 없음, 포장 작업 불필요). 단, **HTTPS용 도메인 1개**가 필요하다.
- 권장 D29: **"스킬 서버와 웹(PWA) 정적 호스팅은 NCP VM, DB·인증·RLS는 Supabase 유지"** (아래 3장 B안).

## 1. 배정받은 자원

| 항목 | 값 | 이 프로젝트에서 의미 |
|---|---|---|
| 클라우드 | NAVER Cloud, KR-1 (풀 NAVER034) | 카카오·Supabase 서울 리전과 가까움 |
| 공인 IP | 101.79.8.126 | 스킬 서버·웹 주소. 도메인 A 레코드 대상 |
| 내부 IP | 192.168.0.40 | VPC 내부용. 지금은 쓸 일 없음 |
| OS 이미지 | rocky-8.10-base | RHEL 8 계열. dnf, firewalld, SELinux |
| 노출 포트(ACG) | 22, 80, 443, 3000 | 3000은 닫아야 함(아래 5장) |
| 인스턴스 ID / 자원 ID | 146484053 / 1470 | 운영사무국 문의 시 사용 |
| 확인 안 된 것 | vCPU·메모리·디스크, 제공 기간(12/11 이후 유지 여부), 비용 부담 주체 | 운영사무국에 확인 필요 |

서버 기본 세팅(sudo 사용자, SSH 키, firewalld, fail2ban, SELinux 유지, Node, Nginx, certbot)은 앞 단계에서 진행했다. 실제 적용 상태는 6장 점검표로 다시 확인한다.

## 2. 카카오 스킬 서버를 NCP VM에서 돌릴 수 있나

### 2-1. 카카오 스킬 서버 요건과 VM 충족 여부

| 카카오 요건 (출처: kakaobusiness.gitbook.io, 10-21 직접 시험) | VM에서 | 비고 |
|---|---|---|
| 인터넷에서 닿는 공개 주소 | **충족** | 공인 IP 101.79.8.126, 80/443 열림 |
| HTTPS 주소 | **도메인 필요** | 도메인 + Let's Encrypt로 해결. IP만으로 정식 인증서를 받는 방법은 확인 필요 → 도메인 권장 |
| POST JSON 요청을 받아 JSON으로 답함 | **충족** | spikes/kakao-skill-echo/server.mjs가 이미 이 형태(Node `http`) |
| **5초 안에 응답** | **충족(여유 큼)** | 항상 켜진 프로세스라 콜드 스타트 없음. 10-21 시험 서버 처리 9ms |
| 폴백 블록에 스킬 연결 | 서버 위치와 무관 | 오픈빌더에서 스킬 URL만 바꾸면 됨 |

**판단: 가능.** 10-21에 로컬 PC + 임시 터널로 성공한 구조에서, 터널 대신 VM의 Nginx가 HTTPS를 받아 `127.0.0.1:3000`의 Node 스킬 서버로 넘기는 구조로 바뀔 뿐이다.

### 2-2. 구조

```
부모님 카카오톡 ─ 채널 채팅방 ─ 카카오 오픈빌더(폴백 블록)
        │ POST https://<도메인>/api/kakao-skill  (헤더 x-skill-token)
        ▼
NCP VM 101.79.8.126 (Rocky 8.10)
  ├ Nginx :443  TLS 종료, 요청 본문 크기 제한, 본문은 로그에 남기지 않음
  │   ├ /api/kakao-skill → 127.0.0.1:3000 (Node 스킬 서버, systemd)
  │   └ /               → /srv/family-shield/web (PWA 정적 파일)   ※ B안일 때
  └ Node 스킬 서버: 헤더 토큰 검사 → packages/core(마스킹·코드 신호·규칙) → AI(시간 예산 안에서) → 카카오 응답 JSON
        │ HTTPS (VM은 공인 IP가 있어 NAT Gateway 불필요)
        ▼
  Supabase(클라우드, 서울): Auth·DB·RLS·Cron(24시간 삭제)  /  AI 제공사 API
```

### 2-3. Cloud Functions(10-23 검토안)와 비교

| 항목 | NCP VM (배정됨) | NCP Cloud Functions + API Gateway | Supabase Edge Function (PRD v0.5) |
|---|---|---|---|
| 추가 비용 | 배정 자원 안에서 (조건 확인 필요) | 함수·API Gateway 별도 요금 | 무료 한도 |
| 코어 사용 | **ESM 그대로 실행** (Node 24 로컬과 같은 환경 구성 가능) | CJS 진입 파일 + `import()` 포장 | Deno로 실행, import 경로 조정 |
| 콜드 스타트 | 없음 | 50~200ms | 있음 |
| HTTPS 주소 | 도메인 + certbot 필요 | 자동 발급 | 자동 발급 |
| 비밀값 보관 | 서버 파일(권한 600) | 액션 파라미터 암호화 | Edge Function Secrets |
| 운영 부담 | **OS 패치·보안·장애 대응을 직접** | 낮음 | 낮음 |
| 장애 시 | VM 1대가 멈추면 스킬 중단 | 관리형 | 관리형 |

VM의 단점은 "직접 관리"다. 1인 개발 조건이므로 6장의 운영 루틴을 최소한으로 고정하고, VM이 멈추면 웹 입구로 안내하는 대체 경로(PRD 18장 기존 대응)를 유지한다.

### 2-4. VM에서 지켜야 할 원칙 (PRD 5장·11-2와 연결)

1. **원문을 로그에 남기지 않는다.** Nginx 기본 access log는 본문을 남기지 않지만, `$request_body`를 쓰는 log_format은 금지한다. Node는 `console.log`에 상태 코드·처리 시간만 남긴다(spike와 같은 방식). journald·`/var/log`에 utterance가 남지 않는지 배포 후 확인한다.
2. **헤더 토큰 검사**: 오픈빌더 스킬 설정의 헤더 값(`x-skill-token`)과 서버 값이 다르면 403. 카카오 발신 IP 목록은 공식 문서에서 확인하지 못했으므로, IP 제한 대신 토큰으로 막는다.
3. **비밀값**(카카오 토큰, HMAC 키, AI 키, Supabase service key)은 `/etc/family-shield/skill.env`(root 소유, 600)에 두고 systemd `EnvironmentFile`로 읽는다. 저장소에는 `.env.example`만 둔다.
4. **요청 크기 제한**: Nginx `client_max_body_size 64k`, Node도 64KB 상한(spike와 같음).
5. **호출 한도**: 사용자별 한도(F4-9)는 Supabase `rate_limits`로, Nginx `limit_req`로 IP 단위 폭주를 한 번 더 막는다.

## 3. 선택지 (D29 후보)

| 안 | NCP VM | Supabase | Vercel | 장점 | 단점 |
|---|---|---|---|---|---|
| A. 최소 | 카카오 스킬 서버만 | Auth·DB·RLS·Cron·웹 푸시 발송 | PWA 정적 배포 | PRD 변경 최소, Vercel 무료 그대로 | 배포처 3곳 관리 |
| **B. 권장** | **스킬 서버 + PWA 정적 호스팅 + 웹 푸시 발송 작업** | Auth·DB·RLS·Cron | 사용 안 함 | 배포처 2곳, 도메인 하나(같은 출처라 CSP·쿠키 단순), Vercel 상업 이용 해석 문제(D19) 해소, "NCP 사용" 범위가 명확 | 정적 호스팅·보안 헤더를 Nginx로 직접 설정 |
| C. 전면 이전 | VM에 PostgreSQL까지 | 사용 안 함 | 사용 안 함 | 한 곳에서 관리 | Supabase Auth(휴대폰 OTP)·RLS의 `auth.uid()`·자동 API를 다시 만들어야 함. ncp-check.md 4장 추정 25~40시간. 백업·패치 부담. **11/16 중간과제 일정상 비권장** |

**B안을 권장하는 이유**
- 이미 끝난 판별 코어·마이그레이션·RLS(15개 테이블)를 그대로 쓴다.
- 웹 푸시(VAPID) 발송은 Node `web-push` 라이브러리를 VM에서 돌리면 PRD 1주차의 "웹 푸시(Deno) 작은 시험"을 Node로 바꿔 진행할 수 있다(라이브러리 추가는 승인 후).
- 24시간 삭제는 Supabase `pg_cron`을 그대로 쓴다(VM cron은 VM이 멈추면 삭제도 멈추므로 쓰지 않음).

## 4. D29 결정 초안 (승인 시 decisions.md·PRD 6장에 추가)

| 항목 | 내용 |
|---|---|
| 결정 | 배정받은 NCP VM(Rocky 8.10, KR-1, 101.79.8.126)을 **카카오 스킬 서버와 웹(PWA) 정적 호스팅**에 쓴다. DB·인증·RLS·삭제 Cron은 **Supabase 유지**. Vercel은 쓰지 않는다. NCP Cloud Functions·API Gateway는 쓰지 않는다 |
| 이유 | 실제 배정 자원이 VM. 코어를 포장 없이 실행, 5초 제한에 여유, 배포처 단순화, Vercel 상업 이용 해석 문제 해소 |
| 대안 | A안(스킬만 VM), C안(DB까지 이전, 25~40시간), Cloud Functions(10-23 검토안) |
| 조건 | 도메인 1개 확보, 운영사무국에 자원 사양·제공 기간·비용 부담 확인 |
| 상태 | **확정(2026-10-26 사용자 승인)** |

## 5. 서버에서 바꿔야 할 것 (앞 단계 세팅과의 차이)

| 항목 | 앞 단계 세팅 | 이 프로젝트 기준 |
|---|---|---|
| 앱 | 일반 Node 앱 `/srv/apps/myapp` | 스킬 서버 `/srv/family-shield/skill` + 정적 파일 `/srv/family-shield/web` |
| 바인딩 | 127.0.0.1:3000 | 같음 (바꾸지 않음) |
| ACG 3000 | 열림 | **닫기**. 외부는 443만 |
| Nginx | `/` 전체를 3000으로 프록시 | `/api/kakao-skill`만 프록시, 나머지는 정적 파일 + SPA 폴백(`try_files $uri /index.html`) |
| 로그 | 기본 | 본문 로깅 금지 확인, 보관 기간 짧게(logrotate 7일) |
| 보안 헤더 | 없음 | CSP(외부 스크립트 금지), HSTS, X-Content-Type-Options, Referrer-Policy (PRD 12-3) |
| 비밀값 | Environment= | `EnvironmentFile=/etc/family-shield/skill.env` (600) |
| Node | appstream 20 | 로컬은 Node 24. **VM도 22 이상으로 맞추는 것을 권장**(NodeSource 또는 nvm). 결정 후 진행 |

## 6. 운영 사용자가 확인할 점검표 (개발 전, 서버에서)

```bash
cat /etc/redhat-release; nproc; free -h; df -h /
node -v; nginx -v; getenforce
sudo firewall-cmd --list-services
sudo ss -lntp | grep -E ':80|:443|:3000'
sudo sshd -T | grep -E 'permitrootlogin|passwordauthentication'
```

- [ ] 사양(vCPU·메모리·디스크) 기록
- [ ] root 로그인·비밀번호 로그인 꺼짐
- [ ] ACG에서 22는 내 IP만, 3000 삭제
- [ ] 도메인 확보 → A 레코드 101.79.8.126 → certbot 발급
- [ ] 스냅샷 1회 생성

## 7. PRD 수정안 (승인 후 반영, 지금은 고치지 않음)

PRD는 v0.5 → **v0.6**. 바뀌는 곳만 적는다.

| 위치 | 현재 | 수정안 |
|---|---|---|
| 0장 문서 정보 | 결과물: 카카오 챗봇 + PWA | 같음 + "운영 인프라: NCP VM(스킬·웹) + Supabase(DB·인증)" 한 줄 |
| 0장 아래 | v0.4에서 바뀐 점 | **"v0.5에서 바뀐 점(NCP 배정)"** 표 추가: 호스팅, 스킬 서버 위치, Vercel 제외 |
| 6장 결정 표 | D28까지 | **D29 추가**(4장). D19는 "Vercel Hobby" 부분을 "D29로 변경" 표시 |
| 12-3 위협 | 비밀키는 Edge Functions Secrets에만 | "스킬 서버 비밀값은 VM의 권한 600 환경 파일, DB용 키는 Supabase Secrets" + **"VM 침해" 위협 행 추가**(SSH 키만, fail2ban, 자동 보안 업데이트, 로그에 원문 없음) |
| 12-3 개발 도구 행 | Vercel 프리뷰에 실제 데이터 금지 | "VM에 시험 데이터만, 실제 사용자 데이터는 D26 법률 검토 후" |
| 13-1 스택 | 배포: Vercel | 배포: **NCP VM(Nginx 정적 + Node 스킬 서버, systemd)**. 백엔드는 Supabase 유지 |
| 13-3 구조 그림 | 스킬 함수(Supabase Edge Function) | 스킬 서버(**NCP VM의 Node**). 개발·시험: 로컬 + cloudflared → **NCP VM의 시험 경로로 바로 연결** 가능 |
| 13-3 5초 제한 | 코드 판정 먼저, AI 약 3초 | 같음. 콜드 스타트가 없어 예산 여유가 생긴 점 추가 |
| 16장 비기능 | 가용성 | "VM 1대 장애 시 스킬 중단 → 웹 입구 안내, 스냅샷으로 복구" 추가 |
| 17장 일정 | 2주차: 스킬 골격(로컬 + 임시 터널) / 4주차: Vercel 배포, 스킬을 클라우드 함수로 | 2주차: 스킬 골격을 **NCP VM에 바로 배포**(시험 채널만) / 4주차: **Supabase 클라우드 생성 + VM에 PWA 배포**, 휴대폰 인증 등 |
| 18장 리스크 | - | "VM 운영 부담(1인)", "제공 기간 종료(12/11 이후)", "도메인 확보 지연" 추가 |
| 19장 확인 사항 | - | 운영사무국: VM 사양·기간·비용, NCP 사용 표기 의무, 추가 NCP 서비스(SENS·CLOVA) 크레딧 여부 |

함께 고칠 문서: `CLAUDE.md` 기술 스택(배포 줄), `README.md` 기술 구성 표, `docs/setup-plan.md`(Vercel 설정 → VM 설정), `docs/decisions.md`(D29 행), `docs/ncp-check.md`(맨 위에 "VM 배정으로 1장 권장안은 이 문서로 대체" 표시).

## 8. 승인 요청 사항

1. D29를 **B안**(VM: 스킬 + PWA 정적, Supabase 유지, Vercel 제외)으로 확정할지
2. 도메인: 보유 도메인 사용 / 새로 구매 / 다른 방법
3. VM의 Node 버전을 22 이상으로 올릴지
4. 위 7장 PRD v0.6 수정안을 그대로 반영할지 (승인 후 문서만 수정, 코드는 별도 승인)
