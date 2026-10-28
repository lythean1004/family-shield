# 운영 명령 모음 (familyshield.kr)

모두 PC의 PowerShell에서, 저장소 폴더(`D:\Claude Code\gongmojeon\family-shield`)에서 실행한다. VM 접속은 `~/.ssh/config`의 별칭 `fs-ncp`(키 `~/.ssh/fs_ncp`)를 쓴다.

서버 설치·설정 변경·재시작은 실행 전에 확인받는다. 2026-10-28 추가 구현은 `docs/deployment-review-2026-10-28.md` 순서로 반영한다. **현재 AI 키는 12/11까지 보존**하며 아래 교체 명령을 이번 배포에 사용하지 않는다.

## 파일이 어디 있나

| 무엇 | 위치 | 비고 |
|---|---|---|
| 스킬 서버 설정·비밀값 | **VM의** `/etc/family-shield/skill.env` | PC 탐색기에는 없다. root 600 |
| 스킬 서버 코드 | VM의 `/srv/family-shield/repo` | GitHub main을 받아 둔 것 |
| 웹 화면 파일 | VM의 `/srv/family-shield/web` | 직전 버전은 `web.old` |
| Nginx 설정 | VM의 `/etc/nginx/conf.d/familyshield.kr.conf` | 원본은 `deploy/nginx/` |

## AI 키 넣기 (AI 켜기)

```powershell
powershell -ExecutionPolicy Bypass -File deploy\set-ai-key.ps1
```

키를 붙여 넣으라는 줄이 나오면 붙여 넣고 Enter(화면에 안 보이는 것이 정상). 스크립트가 **먼저 게이트웨이에 키를 시험하고, 성공할 때만** `skill.env`의 `AI_API_KEY`·`AI_MODEL`을 바꾸고 서버를 재시작한다. 실패하면 아무것도 바뀌지 않는다. 키는 명령줄·기록에 남지 않는다.

직접 고치고 싶으면:

```powershell
ssh -t fs-ncp "sudo vi /etc/family-shield/skill.env"
ssh fs-ncp "sudo systemctl restart family-shield-skill"
```

## 업데이트

| 무엇을 | 명령 |
|---|---|
| 웹 화면 | `powershell -ExecutionPolicy Bypass -File deploy\deploy-web.ps1` |
| 스킬 서버 | 커밋을 GitHub에 push한 뒤 `powershell -ExecutionPolicy Bypass -File deploy\deploy-skill.ps1` |

두 스크립트 모두 테스트가 실패하면 배포하지 않는다. 웹은 새 파일을 다 올린 뒤 한 번에 바꾼다.

## 시연 로그인과 웹 푸시

운영자 참여 코드 발급(새 파일만 허용, 10분 만료):

```powershell
ssh fs-ncp 'bash /srv/family-shield/repo/deploy/remote/16-issue-demo-code.sh /home/fsops/demo-code.txt'
```

코드 파일은 소유자만 읽을 수 있다. 사용자가 SSH에서 직접 열어 보호자에게 전달하고 공개 로그·커밋에는 넣지 않는다. 보호자는 `/setup`에서 로그인하고 관계를 선택해 부모님 초대 코드를 만든다. 부모님은 다른 기기의 `/setup`에서 초대 코드와 만 14세 여부를 확인하고 동의 ①②③을 정한다. 시연 중에는 합성 문자만 쓴다. 로그아웃 후 기존 계정 복구는 휴대폰 인증 구현 전까지 지원하지 않는다.

**역할 선택 주의:** `/setup`의 기본값은 부모님이다. 운영자 참여 코드는 반드시 ‘사용하실 분’을 **보호자**로 바꿔 입력한다. 보호자 로그인 후 부모님 연결 없이도 설정에서 시험 알림을 보낼 수 있다. 앱 안의 ‘시험 알림 보내기’ 버튼을 누르고, 그 다음 휴대폰 알림 센터에 뜬 알림을 눌러야 클릭 확인이 저장된다. 2026-10-28 사용자 아이폰에서 수신·클릭·확인 문구·DB ACK까지 확인했다.

VAPID 설정은 승인 뒤 `15-configure-push.sh`로 추가한다. 기존 키를 재발급하지 않고 AI·DB 설정을 보존한다. 재시작 뒤 보호자 설정에서 알림을 켜고 시험 알림을 보낸다. **알림을 실제로 눌러 확인한 뒤에만 완료로 표시**된다. 전송 접수·미설정·권한 거부는 별도 상태다. 개발 서버에서는 서비스 워커가 없어 실제 푸시 시험이 되지 않는다.

## Supabase 정리

새 실행 코드·웹 의존성·로컬 설정·Nginx CSP에서 제거했다. 기존 `supabase/migrations`와 `supabase/tests`는 SQL 이력과 권한 회귀 시험이므로 유지한다. VM 배포·가족 왕복·백업·푸시 확인 후 사용자가 대시보드에서 기존 프로젝트 삭제를 진행한다. 아직 자동 삭제하지 않았다.

## 확인·복구

```powershell
ssh fs-ncp "bash /srv/family-shield/repo/deploy/remote/04-smoke-test.sh"     # 전체 점검
ssh fs-ncp "sudo journalctl -u family-shield-skill -n 30 --no-pager"          # 스킬 서버 로그
ssh fs-ncp "cd /srv/family-shield && mv web web.bad && mv web.old web"        # 웹 되돌리기
ssh fs-ncp "sudo cp -p /etc/family-shield/skill.env.bak /etc/family-shield/skill.env && sudo systemctl restart family-shield-skill"  # AI 키 바꾸기 전으로
```
