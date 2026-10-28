# 운영 명령 모음 (familyshield.kr)

모두 PC의 PowerShell에서, 저장소 폴더(`D:\Claude Code\gongmojeon\family-shield`)에서 실행한다. VM 접속은 `~/.ssh/config`의 별칭 `fs-ncp`(키 `~/.ssh/fs_ncp`)를 쓴다.

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

## 확인·복구

```powershell
ssh fs-ncp "bash /srv/family-shield/repo/deploy/remote/04-smoke-test.sh"     # 전체 점검
ssh fs-ncp "sudo journalctl -u family-shield-skill -n 30 --no-pager"          # 스킬 서버 로그
ssh fs-ncp "cd /srv/family-shield && mv web web.bad && mv web.old web"        # 웹 되돌리기
ssh fs-ncp "sudo cp -p /etc/family-shield/skill.env.bak /etc/family-shield/skill.env && sudo systemctl restart family-shield-skill"  # AI 키 바꾸기 전으로
```
