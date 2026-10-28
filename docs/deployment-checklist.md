# 배포 체크리스트 (2026-10-27)

> **이 문서는 이전 설계의 보관본이다. 실행 절차로 사용하지 않는다.** 2026-10-28 D36으로 DB·인증·백업을 VM으로 이전했다. 현재 상태는 `docs/handoff.md`, 이번 반영 순서는 `docs/deployment-review-2026-10-28.md`, 평상시 운영은 `docs/operations.md`를 따른다. 아래 Supabase 연결·환경 변수·Auth 단계는 폐기되었다.

작성일: 2026-10-27
상태: 진행 중
목표: NCP VM + Supabase Cloud + 카카오 스킬 서버 연동

## 현재 상태

✅ **완료된 작업**
- [x] 로컬 개발 환경 (Supabase Docker, Node 24)
- [x] 판별 코어 (core 150 tests)
- [x] 카카오 스킬 서버 로컬 (skill 33 tests)
- [x] 웹 PWA (web 62 tests, build 통과)
- [x] DB 마이그레이션 10개 (pgTAP 38 tests)
- [x] localStorage → Supabase 교체 준비 (fallback 구현)
- [x] NCP VM 배정 (101.79.8.126, Rocky 8.10)
- [x] VM 보안 세팅 (SSH 키, firewalld, fail2ban)

## 배포 단계

### 1. Supabase Cloud 연결 ✅

**현재 상태: 완료 (2026-10-27)**

- [x] 프로젝트 생성 (Seoul ap-northeast-2)
- [x] 로컬 프로젝트 연결 (`supabase link`)
- [x] 마이그레이션 푸시 (`supabase db push`)
- [x] 웹 클라이언트 생성 (`web/src/lib/supabase.js`)
- [x] 스킬 서버 클라이언트 생성 (`skill/src/supabase-client.js`)
- [x] 환경 변수 설정 (`.env.local` 파일들)

**다음 작업: Auth 구현 후 RLS 활성화**

---

### 2. 카카오 챗봇 스킬 서버 배포 (NCP VM)

**목표: VM에서 스킬 서버 실행, 카카오 오픈빌더 연결**

#### 2-1. 도메인 구매 및 DNS 설정 ⏳

**필요한 도메인: familyshield.kr (가비아)**

- [ ] 가비아에서 도메인 구매
- [ ] DNS 설정: A 레코드 → 101.79.8.126
- [ ] DNS 전파 확인 (`nslookup familyshield.kr`)

**예상 비용:** ~15,000원/년

#### 2-2. VM에 Nginx + SSL 설정 ⏳

**Nginx 설정 파일:** `/etc/nginx/conf.d/family-shield.conf`

```nginx
# 스킬 서버 (Node.js 3000 포트)
upstream skill_server {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name familyshield.kr www.familyshield.kr;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name familyshield.kr www.familyshield.kr;

    ssl_certificate /etc/letsencrypt/live/familyshield.kr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/familyshield.kr/privkey.pem;

    # 보안 헤더
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # 카카오 스킬 엔드포인트
    location /api/kakao-skill {
        proxy_pass http://skill_server;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 본문 크기 제한 (5MB)
        client_max_body_size 5m;
        
        # 타임아웃 (카카오 5초 제한)
        proxy_connect_timeout 5s;
        proxy_send_timeout 5s;
        proxy_read_timeout 5s;
    }

    # 웹 정적 파일 (PWA)
    location / {
        root /srv/family-shield/web;
        try_files $uri $uri/ /index.html;
        
        # PWA 캐시 설정
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
        
        location = /index.html {
            add_header Cache-Control "no-cache";
        }
    }
}
```

**설치 및 설정:**
```bash
# Nginx 설치
sudo dnf install -y nginx

# Let's Encrypt 인증서 발급
sudo dnf install -y certbot python3-certbot-nginx
sudo certbot --nginx -d familyshield.kr -d www.familyshield.kr

# 설정 테스트 및 재시작
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx
```

- [ ] Nginx 설정 테스트: `sudo nginx -t`
- [ ] HTTPS 접속 테스트: `curl https://familyshield.kr`
- [ ] 방화벽 확인: `sudo firewall-cmd --list-services`


#### 2-3. 스킬 서버 배포 ⏳

**저장소 클론 및 의존성 설치:**
```bash
# VM에서 작업
cd /srv/family-shield
sudo -u fsops git clone https://github.com/lythean1004/family-shield.git .

# 의존성 설치
cd skill && npm install --production
cd ../packages/core && npm install --production
```

**환경 변수 설정:** `/etc/family-shield/skill.env`
```bash
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
AI_API_URL=https://aitestbed.kr/v1
AI_API_KEY=<your-api-key>
AI_MODEL_FAST=gemini-3.1-flash-lite
KAKAO_SKILL_TOKEN=<random-token>
NODE_ENV=production
PORT=3000
```

- [ ] 환경 변수 파일 생성 및 권한 600

#### 2-4. systemd 서비스 설정 ⏳

```bash
sudo systemctl daemon-reload
sudo systemctl enable family-shield-skill
sudo systemctl start family-shield-skill
sudo journalctl -u family-shield-skill -f
```

#### 2-5. 카카오 오픈빌더 연결 ⏳

- [ ] 스킬 URL: `https://familyshield.kr/api/kakao-skill`
- [ ] 헤더: `x-skill-token`
- [ ] 테스트 메시지 발송

---

### 3. 웹 PWA 배포 ⏳

```bash
cd web && npm run build
rsync -avz --delete dist/ fsops@101.79.8.126:/srv/family-shield/web/
```

- [ ] 브라우저 접속: `https://familyshield.kr`

---

### 4. Auth 구현 (다음 단계)

- [ ] Supabase Auth 설정
- [ ] SMS 연동
- [ ] RLS 활성화

---

## 비용: ~15,000원/년 (도메인)
