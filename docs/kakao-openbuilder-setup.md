# 카카오 오픈빌더 연결 (2026-10-28)

스킬 서버는 `https://familyshield.kr/api/kakao-skill`에서 동작 중이다. 아래는 오픈빌더(https://chatbot.kakao.com)에서 사람이 할 일이다.

## 0. 헤더 토큰 값 꺼내기

토큰은 VM의 `/etc/family-shield/skill.env`(root, 600)에만 있다. 문서·저장소에 적지 않는다.

```powershell
ssh fs-ncp "sudo grep '^SKILL_HEADER_TOKEN=' /etc/family-shield/skill.env"
```

`=` 뒤의 48자리 값을 복사한다.

## 1. 스킬 등록

봇 선택 → 왼쪽 **스킬** → **스킬 목록** → 10-21 시험 때 만든 스킬을 열거나 **생성**.

| 칸 | 값 |
|---|---|
| 스킬 이름 | 가족방패 판별 |
| URL | `https://familyshield.kr/api/kakao-skill` |
| 헤더 | 키 `x-skill-token`, 값 = 0단계 토큰 |

저장한 뒤 같은 화면의 **스킬 서버로 전송**으로 시험한다. 응답에 `"version":"2.0"`이 오면 정상이다. 403이 오면 헤더 값이 틀린 것이다.

## 2. 폴백 블록에 연결

**시나리오** → **폴백 블록** → 파라미터 설정의 **스킬 선택**에서 "가족방패 판별" → 봇 응답을 **스킬데이터 사용**으로 → 저장.

## 3. 버튼 문구용 블록 (권장)

스킬이 보내는 버튼 중 "처음으로"와 "이미 당했어요"는 메시지 버튼이다. 따로 블록이 없으면 폴백으로 가서 문자 판별 대상이 된다.

| 사용자 발화 | 연결할 블록 | 내용 |
|---|---|---|
| 처음으로 | 웰컴 블록 | 기존 웰컴 문구 |
| 이미 당했어요 | 새 블록 | 112 안내 문구(E1 화면과 같은 범위, 근거 카드 확인 전이라 다른 번호는 넣지 않음) |

## 4. 배포

오른쪽 위 **배포** → **배포**. 배포 전에는 채널 채팅방에 반영되지 않는다. 봇 테스트 창은 배포 전에도 쓸 수 있다.

## 5. 시험

채널 채팅방 또는 봇 테스트에서 아래 문장을 보낸다.

```
엄마 나 폰 고장났어. 이 번호로 문자해. 급하게 50만원만 보내줘
```

기대 결과: `[⚡ 주의]` 또는 `[⚠️ 위험]`, 한계 문구, 버튼 3개(이미 당했어요 · 자세히 보기 · 처음으로). [자세히 보기]는 한 번 열면 다시 열리지 않는다(10분, 1회).

서버 쪽 확인:

```powershell
ssh fs-ncp "sudo journalctl -u family-shield-skill -n 20 --no-pager"
```

`POST /api/kakao-skill 200` 줄이 보이면 카카오 요청이 들어온 것이다. 로그에는 원문이 남지 않는다.

## 6. AI 켜기 (키 받은 뒤)

지금은 AI 없이 규칙 코드만으로 판정한다(`AI_MODEL` 빈 값). 가족 사칭·새 번호 같은 신호는 AI가 뽑으므로, 지금은 판정이 한 단계 낮게 나올 수 있다.

```bash
ssh fs-ncp
sudo vi /etc/family-shield/skill.env    # AI_API_KEY=<키>, AI_MODEL=gemini-3.1-flash-lite
sudo systemctl restart family-shield-skill
curl -s http://127.0.0.1:3000/health    # "model":"gemini-3.1-flash-lite"
```
