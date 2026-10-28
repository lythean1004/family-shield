# VM 이전 계획 (D36)

작성일: 2026-10-28 · 결정: D36(docs/decisions.md) · 승인: VM 확정, `pg`·`web-push` 추가, 휴대폰 인증·시연은 중간과제 뒤

## 목표

저장되는 데이터를 모두 운영사 배정 NCP VM(한국, 101.79.8.126) 안에만 둔다. Supabase는 쓰지 않는다.

## 구조

```
브라우저(PWA) ── HTTPS ──> Nginx :443 ──> Node 서버 127.0.0.1:3000
                                            ├ /api/kakao-skill  (기존)
                                            ├ /api/auth/*       (새: 쿠키 세션)
                                            ├ /api/circle/*     (새: 초대 코드·동의)
                                            ├ /api/confirm/*    (새: 확인 요청 왕복)
                                            └ /api/push/*       (새: 웹 푸시 구독)
                                                 │ pg (127.0.0.1:5432, 외부 포트 없음)
                                                 ▼
                                            PostgreSQL 16
                                              - 기존 마이그레이션 10개
                                              - auth.uid() = 요청마다 서버가 넣는 사용자 id
                                              - RLS 정책 27개 그대로
systemd timer: 1시간마다 purge_expired(), 매일 pg_dump 백업(7일)
```

권한 정책을 살리는 방법: 서버가 요청마다 트랜잭션을 열고 `SET LOCAL ROLE authenticated` + `set_config('request.jwt.claim.sub', <user id>, true)`를 넣는다. VM DB의 `auth.uid()`는 이 값을 읽는다. Supabase와 같은 방식이라 pgTAP 38개를 그대로 돌릴 수 있다.

## 일정

| 단계 | 기간 | 할 일 | 끝 조건 |
|---|---|---|---|
| 1 DB | 10/29~31 | PostgreSQL 16 설치, `auth` 호환 스키마(uid 함수, users, 역할), 마이그레이션 적용, pgTAP, purge·백업 timer | pgTAP 38/38, purge 실행 기록 |
| 2 로그인·가족 | 11/01~05 | 쿠키 세션, 데모 계정(D35), 초대 코드(10분, 시도 제한), 동의 ①②③ 화면·기록, 만 14세 확인 | 부모님·보호자 두 계정이 한 그룹으로 묶임 |
| 3 확인 왕복 | 11/06~09 | confirm/consent/misjudge를 서버 API로, 3초 폴링, 응답 1회, 1회용 토큰 DB 이전 | 휴대폰 두 대로 요청 → 응답 → 부모님 화면 반영 |
| 4 웹 푸시 | 11/10~12 | VAPID 키(skill.env), 구독 저장, 시험 알림, 알림 본문에 내용 없음 | 자녀 휴대폰에 알림 도착 |
| 5 정리 | 11/13 | 웹에서 supabase-js 제거, CSP에서 Supabase 주소 제거, 문서 갱신, Supabase 프로젝트 삭제(재확인 후) | 외부 DB 호출 0 |
| 제출 | 11/16 | 중간과제 | |
| 이후 | 11/17~ | 휴대폰 인증(SENS 발신번호 등록), 시연 리허설 | |

## 하지 않는 것

- DB 포트(5432)를 인터넷에 열지 않는다.
- 법률 검토(docs/mentor-legal-questions.md) 전에는 실제 사용자 데이터를 넣지 않는다(D26). 개발·시험 데이터만.
