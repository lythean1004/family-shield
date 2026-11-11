# 공식 도메인 근거 카드 확대 결과 (요청서 3)

확인일: 2026-11-11 · 작성: Codex · 시작 커밋: `ab2ef08` · 요청: `docs/codex-request-cards-3.md`

## 결과

- 새 카드 **27장**: 이름 규칙 있는 카드 **0장**, 공식 도메인 제외용 **27장**. 기존 13장과 합쳐 **40장**, 새 공식 도메인 항목 **30개**.
- 기관 전체를 보류한 곳은 **0곳**. 다만 **27곳 모두 이름 규칙은 보류**했다. 이번에 확인한 공식 경고문·검색 자료에서 그 기관 이름이 들어간 가짜 호스트 모양을 충분히 입증하지 못했다. 사칭 경고가 존재한다는 사실만으로 정규식을 만들지 않았다.
- 이번 변경은 공식 주소의 불필요한 KISA 목록 포함·도메인 생성일 조회를 방지하기 위한 근거 보강이다. **새 사칭 탐지나 놓침률 개선을 달성했다는 뜻은 아니다.**
- 기존 13장 전체 내용과 이름 규칙을 시작 커밋과 대조해 동일함을 확인했다. 탐지 코드와 R11의 ‘위험’ 수준은 바꾸지 않았다.
- **서버 반영 승인 필요.** 서버 접속·배포·재시작은 하지 않았다. 승인 후 Claude Code가 반영할 대상이다. 운영 커밋도 이번 작업에서 재조회하지 않았다.

## 조사와 숫자의 의미

요청서의 A→B→C→D 순서로 공식 누리집·보안센터·소비자 경고를 찾고, 부족한 경우 공공기관 경고를 대조했다. 차단된 페이지·본문을 읽지 못한 공지는 그 제한을 기록하고 다음 대상으로 넘어갔다. 아래의 ‘근거 없음’은 **이번 조사에서 이름 규칙을 정할 근거를 확보하지 못했다**는 뜻이며, 해당 기관 사칭이나 관련 공지가 없다는 뜻이 아니다. 검색 결과의 공지 제목·날짜만 보인 경우에는 본문을 확인했다고 쓰지 않았다.

공통 대조 자료는 [KISA 카드사 사칭 경고(2026-07-16)](https://www.boho.or.kr/kr/bbs/view.do?bbsId=B0000133&menuNo=205020&nttId=72131), [KISA 금융권 유출 보상 사칭 경고(2026-10-06)](https://www.boho.or.kr/kr/bbs/view.do?bbsId=B0000133&menuNo=205020&nttId=72211), [KISA 공공기관 사칭 메일 경고(2026-09-29)](https://www.boho.or.kr/kr/bbs/view.do?bbsId=B0000133&menuNo=205020&nttId=72202)다. 익명 카드사·기관 사칭 설명을 개별 기관 이름의 증거로 전용하지 않았다. 그림·동적 게시물 등에서 가짜 호스트를 충분히 읽지 못한 경우도 규칙을 만들지 않았다.

KISA 2023·2024 입력은 **159,334행**, `toDomain` → `normalizeHost`로 만든 **서로 다른 유효 호스트 29,033개**다. 같은 호스트의 날짜·경로가 달라도 한 번만 센다.

- 표의 **‘모양 해당 없음’**은 이름 규칙으로 옮길 모양이 미확정이라 비교할 집합이 없다는 뜻이다. 임의 규칙을 만들어 센 0건으로 바꾸지 않았다.
- **‘공식 0’**은 그 카드의 공식 도메인 또는 하위 호스트와 일치하는 KISA 호스트가 0개라는 별도 측정이다. 27장 모두 0개였다. 따라서 이번 자료 재생성에서 실제로 빠지는 기존 KISA 키도 없었다.
- **Tranco 추가 R11 `0 / 0`**은 전체 100만 개 / 그중 `.kr` 4,343개에서 해당 새 카드로 늘어난 감지가 각각 0개라는 뜻이다.
- 카드 `posted_at`은 `source_url` 자료의 게시일이다. 경고문의 게시일은 아래 표와 `check_note`에 따로 기록했다. 날짜를 확인하지 못했으면 `null`이다.

## A. 공공·수사

| 기관·카드 ID 끝부분 | 공식 도메인·근거 | 사칭 자료·게시일·주소 모양 | KISA 호스트 | 이름 규칙 | Tranco 추가 R11 전체 / .kr | 결정 |
|---|---|---|---|---|---:|---|
| 금융감독원 `FSS` | `fss.or.kr` · [확인 자료](https://www.fss.or.kr/fss/main/main.do) | [자료](https://m.korea.kr/briefing/pressReleaseView.do?newsId=156784413&pWise=mSub&pWiseSub=C1) · 2026-10-06 · 금융권 개인정보 유출 보상 사칭 경고. 기관별 가짜 호스트 모양 미공개. | 모양 해당 없음 / 공식 0 | 없음 | 0 / 0 | 공식 도메인만 |
| 검찰(대검찰청 요청 대상) `SPO` | `spo.go.kr`, `kics.go.kr` · [확인 자료](https://www.spo.go.kr/site/spo/main.do) [형사사법포털 안내](https://spo.go.kr/site/highseoul/04/10404000000002018102506.jsp) | 기관별 주소 모양 근거 없음 · 기관 자체 공지 검색에서 이름이 든 가짜 호스트 원문 미확보. 공공기관 사칭 일반 경고만으로 검찰 이름 규칙을 만들지 않음. | 모양 해당 없음 / 공식 0 | 없음 | 0 / 0 | 공식 도메인만 |
| 경찰청 `POLICE` | `police.go.kr` · [확인 자료](https://ecrm.police.go.kr/minwon/crs/quick/qna) | [자료](https://www.police.go.kr/user/bbs/BD_selectBbs.do?q_bbsCode=1001&q_bbscttSn=20250421165004902) · 2025-04-21 · 교통민원24 사칭 경고는 기존 EFINE 대상. 경찰청 이름의 새 호스트 모양 근거로 전용하지 않음. | 모양 해당 없음 / 공식 0 | 없음 | 0 / 0 | 공식 도메인만 |
| 대법원·전자소송 `SCOURT` | `scourt.go.kr` · [확인 자료](https://slseobu.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000215&gubun=41&pageIndex=1&searchWord=&seqnum=17925) | [자료](https://slseobu.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000215&gubun=41&pageIndex=1&searchWord=&seqnum=17925) · 2025-07-09 · 법원 등기/영장 부서 사칭 및 링크 유도 경고. 가짜 호스트 모양 미공개. | 모양 해당 없음 / 공식 0 | 없음 | 0 / 0 | 공식 도메인만 |
| 관세청·유니패스 `CUSTOMS` | `customs.go.kr` · [확인 자료](https://www.customs.go.kr/kcs/main.do) | [자료](https://www.korea.kr/news/policyNewsView.do?newsId=148966893) · 2026-06-22 · 마약 밀수 조사 등을 빙자한 관세청 사칭·가짜 홈페이지 유도 경고. 가짜 호스트 모양 미공개. | 모양 해당 없음 / 공식 0 | 없음 | 0 / 0 | 공식 도메인만 |
| 국민연금공단 `NPS` | `nps.or.kr` · [확인 자료](https://www.nps.or.kr/gate.do) | [자료](https://www.nps.or.kr/pnsgdnc/newgdnc/getOHAE0001M1.do?hmpgBbsCd=BS20240137&hmpgCd=01&menuId=MN24000897&pageIndex=1&pstId=NE202300000000029004&searchGbu=%EC%A0%84%EC%B2%B4&searchText=%EC%8A%A4%EB%AF%B8%EC%8B%B1&sortSe=FR) · 2023-12-10 · 스미싱 예시의 모양은 단축 서비스+임의 경로. 기관 이름 라벨의 증거가 아님. 공지 게시일과 본문 예시의 연도(2025)가 달라 예시 갱신일은 미확인. | 모양 해당 없음 / 공식 0 | 없음 | 0 / 0 | 공식 도메인만 |
| 한국도로공사·하이패스 `EX` | `ex.co.kr`, `hipass.co.kr` · [확인 자료](https://www.ktdb.go.kr/www/selectTrnsportTreeView.do?key=32) [하이패스 안내](https://gonggam.korea.kr/newsContentView.es?mid=a10206000000&news_id=f818da80-ebc5-4702-93ae-9808e9ec1b81&section_id=NCCD_POLICY) | 기관별 주소 모양 근거 없음 · 통행료 사칭 관련 검색에서 기관/공공기관의 가짜 호스트 모양 원문 미확보. 언론 보도만으로 규칙을 만들지 않음. | 모양 해당 없음 / 공식 0 | 없음 | 0 / 0 | 공식 도메인만 |

## B. 은행

| 기관·카드 ID 끝부분 | 공식 도메인·근거 | 사칭 자료·게시일·주소 모양 | KISA 호스트 | 이름 규칙 | Tranco 추가 R11 전체 / .kr | 결정 |
|---|---|---|---|---|---:|---|
| KB국민은행 `KBANK` | `kbstar.com` · [확인 자료](https://obank.kbstar.com/quics?page=osecure) | [자료](https://obank.kbstar.com/quics?articleId=127403&bbsMode=view&boardId=992&page=C034274) · 2023-12-11 · 급여이체확인증 위장 악성메일 경고. 확인한 본문에는 은행 이름을 쓴 가짜 호스트 모양 없음. | 모양 해당 없음 / 공식 0 | 없음 | 0 / 0 | 공식 도메인만 |
| NH농협은행 `NHBANK` | `nhbank.com`, `nonghyup.com` · [확인 자료](https://www.nonghyup.com/complaint/protect/financeConsumerProtect.do) [NH은행 발행서](https://www.nhbank.com/upload/files/%EB%86%8D%ED%98%91%EC%9D%80%ED%96%89_10%EB%85%84%EC%82%AC_%EB%82%B4%EC%A7%80_%ED%8E%BC%EC%B9%A8.pdf) | [자료](https://www.boho.or.kr/kr/bbs/view.do?bbsId=B0000133&menuNo=205020&nttId=72211) · 2026-10-06 · 농협 자체 보안 안내 검색과 KISA 금융권 사칭 일반 경고에서 농협 이름이 든 가짜 호스트 모양 미확보. | 모양 해당 없음 / 공식 0 | 없음 | 0 / 0 | 공식 도메인만 |
| 신한은행 `SHINHANBANK` | `shinhan.com` · [확인 자료](https://img.shinhan.com/nexhpe/document/ahnlab_document.pdf) | [자료](https://img.shinhan.com/nexhpe/document/ahnlab_document.pdf) · 게시일 미확인 · 정상 주소를 hosts 변조로 가로채는 파밍 안내. 정상 주소 자체는 사칭 이름 규칙의 근거가 아님. 문서 게시일 미표시. | 모양 해당 없음 / 공식 0 | 없음 | 0 / 0 | 공식 도메인만 |
| 우리은행 `WOORIBANK` | `wooribank.com` · [확인 자료](https://www.wooribank.com/) | [자료](https://spot.wooribank.com/pot/Dream?ARTICLE_ID=22357&BOARD_ID=B00301&bbsMode=view&withyou=CQSCT0116) · 2015-07-02 · 큐싱 및 가짜 금융감독원 팝업 경고. 확인한 본문에서 우리은행 이름의 가짜 호스트 모양 미확보. | 모양 해당 없음 / 공식 0 | 없음 | 0 / 0 | 공식 도메인만 |
| 하나은행 `HANABANK` | `kebhana.com` · [확인 자료](https://www.kebhana.com/) | [자료](https://biz.hanabank.com/conts/index.do?goUrl=%2Fcont%2Fcustomer%2Fcustomer04%2Fcustomer042%2Fcustomer0421%2Findex.jsp) · 게시일 미확인 · 보안센터의 피싱 일반 예방 설명. 하나은행 이름이 든 가짜 호스트 모양 미확보. 별도 구 등록 도메인은 이번 제외 목록에 추가하지 않음. | 모양 해당 없음 / 공식 0 | 없음 | 0 / 0 | 공식 도메인만 |
| IBK기업은행 `IBK` | `ibk.co.kr` · [확인 자료](https://www.ibk.co.kr/) | [자료](https://www.ibk.co.kr/common/navigation.ibk?linkUrl=/financetech/efinance/safe/safe_main.jsp&pageId=SC00000000) · 게시일 미확인 · 공식 보안센터와 금융권 사칭 경고 검색에서 IBK 이름을 쓴 가짜 호스트 모양 미확보. 짧은 ibk 단독 규칙은 만들지 않음. | 모양 해당 없음 / 공식 0 | 없음 | 0 / 0 | 공식 도메인만 |
| 카카오뱅크 `KAKAOBANK` | `kakaobank.com` · [확인 자료](https://www.kakaobank.com/view/customer) | [자료](https://m.kakaobank.com/Notices/pages/2) · 2026-10-21 · 전화번호 사칭 스팸 문자(스미싱) 주의 공지의 제목·날짜 확인. 상세 본문/가짜 호스트 모양은 확보하지 못함. | 모양 해당 없음 / 공식 0 | 없음 | 0 / 0 | 공식 도메인만 |
| 토스뱅크 `TOSSBANK` | `tossbank.com` · [확인 자료](https://www.tossbank.com/) | 기관별 주소 모양 근거 없음 · 토스와 토스뱅크를 구분해 검색했으나 토스뱅크 자체의 가짜 호스트 모양 원문 미확보. 검색된 토스 일반 사칭 공지를 은행 규칙으로 전용하지 않음. | 모양 해당 없음 / 공식 0 | 없음 | 0 / 0 | 공식 도메인만 |

## C. 카드

| 기관·카드 ID 끝부분 | 공식 도메인·근거 | 사칭 자료·게시일·주소 모양 | KISA 호스트 | 이름 규칙 | Tranco 추가 R11 전체 / .kr | 결정 |
|---|---|---|---|---|---:|---|
| 신한카드 `SHINHANCARD` | `shinhancard.com` · [확인 자료](https://www.shinhancard.com/pconts/html/main.html) | [자료](https://www.shinhancard.com/pconts/html/helpdesk/dataRoom/MOBFM12048/1232962_1127.html) · 2025-05-09 · 카드 배송·택배 결제·자녀 사칭 경고. 이미지의 주소는 설명용 가짜 URL 표기이며 신한카드 이름을 쓴 호스트 모양 증거가 아님. | 모양 해당 없음 / 공식 0 | 없음 | 0 / 0 | 공식 도메인만 |
| 삼성카드 `SAMSUNGCARD` | `samsungcard.com` · [확인 자료](https://www.samsungcard.com/personal/main/UHPPCO0101M0.jsp) | [자료](https://biz.samsungcard.com/personal/customer-service/provention/accident/UHPPCC0354M3.jsp) · 게시일 미확인 · 금융사기 예방 안내에서 카드사 이름을 쓴 가짜 호스트 모양 미확보. 삼성전자 사칭 사례를 삼성카드 근거로 전용하지 않음. | 모양 해당 없음 / 공식 0 | 없음 | 0 / 0 | 공식 도메인만 |
| 현대카드 `HYUNDAICARD` | `hyundaicard.com` · [확인 자료](https://www.hyundaicard.com/main/site_map.hc) | [자료](https://www.hyundaicard.com/cpu/cg/CPUCG0201_02.hc?m=lstCntOp) · 게시일 미확인 · 소비자보호 공지 목록에는 사칭 경고가 있으나 현대카드 이름을 쓴 가짜 호스트 모양 원문 미확보. | 모양 해당 없음 / 공식 0 | 없음 | 0 / 0 | 공식 도메인만 |
| KB국민카드 `KBCARD` | `kbcard.com` · [확인 자료](https://card.kbcard.com/CMN/DVIEW/HOAMCXPRIZZC0002) | [자료](https://mapps.kbcard.com/SVC/DVIEW/HSEMCXCRSZZC0001) · 게시일 미확인 · KB국민카드 사칭 악성메일 주의 공지 제목 확인. 상세 본문·게시일·가짜 호스트 모양 미확보. | 모양 해당 없음 / 공식 0 | 없음 | 0 / 0 | 공식 도메인만 |
| 롯데카드 `LOTTECARD` | `lottecard.co.kr` · [확인 자료](https://www.lottecard.co.kr/app/LPCSTAC_V100.lc) | [자료](https://m.lottecard.co.kr/app/LPCSTRA_V101.lc) · 2025-09-03 · 고객센터 목록에서 롯데카드 사칭 스미싱 주의 제목·날짜 확인. 상세 본문/가짜 호스트 모양 미확보. 기존 롯데택배 카드와 구분. | 모양 해당 없음 / 공식 0 | 없음 | 0 / 0 | 공식 도메인만 |
| 우리카드 `WOORICARD` | `wooricard.com` · [확인 자료](https://pc.wooricard.com/dcpc/yh1/cid/cid01/ceointro/H1CID201S00.do) | 기관별 주소 모양 근거 없음 · 기관 자체 검색에서 가짜 호스트 모양 원문 미확보. KISA 카드사 일반 경고는 익명화되어 우리카드 전용 이름 근거가 아님. | 모양 해당 없음 / 공식 0 | 없음 | 0 / 0 | 공식 도메인만 |
| 하나카드 `HANACARD` | `hanacard.co.kr` · [확인 자료](https://www.hanacard.co.kr/OPIB0050001M.web?schID=pcd) | 기관별 주소 모양 근거 없음 · 기관 자체 검색에서 이름을 쓴 가짜 호스트 모양 미확보. 기관이 게시한 공동 예방 자료 및 KISA 일반 경고만으로 하나카드 이름을 추정하지 않음. | 모양 해당 없음 / 공식 0 | 없음 | 0 / 0 | 공식 도메인만 |
| BC카드 `BCCARD` | `bccard.com` · [확인 자료](https://www.bccard.com/app/card/MainActn.do) | 기관별 주소 모양 근거 없음 · BC 사칭 피싱메일 공지 검색 결과는 있으나 본문/게시일/가짜 호스트 모양 미확보. 짧은 bc 단독 규칙을 만들지 않음. | 모양 해당 없음 / 공식 0 | 없음 | 0 / 0 | 공식 도메인만 |

## D. 생활 서비스

| 기관·카드 ID 끝부분 | 공식 도메인·근거 | 사칭 자료·게시일·주소 모양 | KISA 호스트 | 이름 규칙 | Tranco 추가 R11 전체 / .kr | 결정 |
|---|---|---|---|---|---:|---|
| 쿠팡 `COUPANG` | `coupang.com` · [확인 자료](https://news.coupang.com/archives/46592/) | [자료](https://news.coupang.com/archives/46592/) · 2024-08-30 · 직원/판매자 사칭 선입금 유도 경고. 공식 주소는 명시하지만 가짜 호스트 모양은 공개하지 않음. | 모양 해당 없음 / 공식 0 | 없음 | 0 / 0 | 공식 도메인만 |
| 네이버페이 `NAVERPAY` | `pay.naver.com` · [확인 자료](https://help.pay.naver.com/) | [자료](https://help.pay.naver.com/faq/content.help?faqId=16897) · 게시일 미확인 · 가짜 Npay 안전결제 페이지·외부 결제 링크 사기 유형 안내. 기관 이름 라벨의 구체적인 가짜 호스트 모양 미공개. | 모양 해당 없음 / 공식 0 | 없음 | 0 / 0 | 공식 도메인만 |
| 카카오페이 `KAKAOPAY` | `kakaopay.com` · [확인 자료](https://kakaopay.com/qna/consumer/financial_info) | [자료](https://kakaopay.com/qna/consumer/financial_info) · 2024-12-11 · 카카오페이 사칭 이메일 피싱 주의 제목·날짜 확인. 상세 본문/가짜 호스트 모양 미확보. 포털 전체 kakao.com은 새 카드에 넣지 않음. | 모양 해당 없음 / 공식 0 | 없음 | 0 / 0 | 공식 도메인만 |
| 당근 `DAANGN` | `daangn.com` · [확인 자료](https://about.daangn.com/) | [자료](https://about.daangn.com/company/pr/archive/%EB%8B%B9%EA%B7%BC%EB%A7%88%EC%BC%93-%EC%95%88%EC%A0%84%ED%95%9C-c2c-%EA%B1%B0%EB%9E%98-%ED%99%98%EA%B2%BD-%EC%A1%B0%EC%84%B1-%EC%9C%84%ED%95%9C-%EC%A4%91%EA%B3%A0%EA%B1%B0%EB%9E%98-%EB%8D%B0%EC%9D%B4%ED%84%B0-%EA%B3%B5%EA%B0%9C/) · 2023-07-10 · 외부 가짜 안전결제 페이지로 유도하는 수법 설명. 구체적인 가짜 호스트 모양 미공개. 이용자가 작성한 게시물은 공식 경고 근거에서 제외. | 모양 해당 없음 / 공식 0 | 없음 | 0 / 0 | 공식 도메인만 |

## 공식 주소 범위와 남은 제한

- 대표 주소에 실제로 안내된 인증·민원·고객센터 하위 주소는 등록 도메인 아래에 포함된다. 예: 관세청 `unipass.customs.go.kr`·`ecos.customs.go.kr`, 국민연금 `edi.nps.or.kr`, KB은행 `obank.kbstar.com`, 우리은행 `spot.wooribank.com`, 하나은행 `biz.kebhana.com`, 카카오페이 `support.kakaopay.com`·`kpg-payment.kakaopay.com`. 근거의 위치·내용·확인일은 카드별 `check_note`에 기록했다.
- 검찰의 별도 포털 `kics.go.kr`, 도로공사의 통행료 `hipass.co.kr`, NH은행의 `nhbank.com`·농협 공용 `nonghyup.com`은 각각 직접 안내/발행자료로 확인했다. `nonghyup.com`이 은행만 사용하는 도메인이라는 뜻은 아니다.
- 네이버페이는 `pay.naver.com`만 새 카드에 넣었다. `naver.com`이나 `kakao.com` 전체를 이 카드들의 공식 범위로 넓히지 않았다. 기존 공용 서비스 제외 정책은 그대로다.
- 한국도로공사 대표 사이트의 직접 열기는 차단되어 국가교통DB·정부 정책 자료로 확인했다. 현대카드 사이트맵은 검색 확인 후 직접 HTML의 회사/저작권 표기로 교차 확인했다.
- BC의 별도 `.co.kr` 후보는 직접 연결 오류로 이번 목록에 넣지 않았다. 하나은행의 구 도메인, 토스 공용 고객센터, 당근의 별도 고객센터 등도 별도 등록 도메인으로 추가할 근거를 확정하지 않았다. **모바일·인증·청구서에 쓰이는 모든 별도 도메인을 망라했다는 뜻은 아니다.**
- `spo.go.kr`의 현재 첫 화면은 ‘공소청(본청)’으로 표시됐다. 요청 대상과 혼동하지 않도록 카드 이름은 ‘검찰(대검찰청 요청 대상)’로 두고 화면 표기를 메모했다.
- 공식 도메인 제외는 그 안의 이용자 게시물·판매자·거래·리디렉션의 안전을 보증하지 않는다. 기존 다른 위험 신호와 결과의 한계 안내는 유지된다.
- 새 카드 모두 `source_checked`, `terms_checked: false`. 출처 확인과 이용조건 확인·전문가 검수는 구분한다. 이용조건을 확인하지 않은 원문·이미지를 복제하지 않았다.

## 시험 결과

| 검사 | 변경 전 | 변경 후 |
|---|---:|---:|
| Tranco 상위 1,000,000개 R11 | 4 (0.0004%) | 4 (0.0004%) |
| Tranco 중 `.kr` 4,343개 R11 | 0 | 0 |
| Tranco 전체 / `.kr` R10 | 0 / 0 | 0 / 0 |
| 새 카드별 추가 R11 (27장 각각) | — | 전체 0 / `.kr` 0 |
| KISA 키 | 31,111 | 31,111 |
| KISA 단축 서비스 | 42 | 42 |

기존 R11 감지 4개는 TELEGRAM·NHIS·CJ·EPOST 각 1개로 그대로다. 이 보고서에는 해당 주소 원문을 싣지 않았다. Tranco는 인기 사이트 목록이며 무해성을 보증하지 않는다. R10은 이 목록을 KISA 생성의 제외 목록으로도 사용하므로 독립적인 정확도 검증이 아니다.

회귀 시험을 먼저 추가하고 카드 등록 전 실패 **2개**(FSS 카드 없음·FSS RDAP 제외 안 됨)를 확인했다. 등록 후 `lookalike.test.js` **19/19** 통과. 새 카드의 주소·하위 주소 90개 조합, 가짜 접미 도메인 등 합성 주소 60개, 짧은 약자·일반 단어·다른 회사 이름을 검사한다. 이름 규칙을 추가하지 않았으므로 새 규칙의 양성 사례를 만들지는 않았다. 전체 지정 명령은 **449/449 통과, 실패·건너뜀 0개**다.

최종 시험은 `git pull --rebase origin main`으로 동기화한 `e07d23f` 기반의 별도 작업 사본에서 이번 4개 파일만 적용해 실행했다. 다른 작업의 미커밋 변경은 포함하지 않았다. 사본의 `pg` 의존성 누락으로 처음 실행이 실패해, 이미 설치된 동일한 skill 의존성을 사본에 복사한 뒤 재실행했다.

실행한 명령:

```powershell
node --test packages/core/test/lookalike.test.js
node content/phishing/build-kisa.mjs data/kisa/kisa-2023.csv data/kisa/kisa-2024.csv --allow data/tranco/top-1m.csv
node --test packages/core/test/*.test.js skill/test/*.test.js eval/test/*.test.js web/src/__tests__/*.test.js
node eval/lookalike-fp.mjs data/tranco/top-1m.csv 1000000
git diff --check
```

KISA 생성 파일은 기존과 같아 커밋 차이가 없다. DB를 쓰는 별도 통합 시험·서버 시험·AI 재평가는 이번 범위에서 실행하지 않았다. 비밀값·`.env`·서버 환경 파일·`private/`·루트의 추적하지 않는 PDF를 열지 않았다. `data/`의 원본·조사 중간 파일·시험 로그는 커밋하지 않는다.

## 인계

GitHub 반영 후에도 **운영 서버에는 아직 미반영**이다. 운영자가 승인하면 Claude Code가 최신 커밋을 반영하고 서버 시험을 진행한다. 추후 기관 이름 규칙을 추가하려면 공식 경고문의 가짜 호스트 모양과 게시일을 먼저 확보하고, `.invalid` 양성·공식 주소·비슷한 정상 이름의 실패 시험 → 구현 → 카드별 Tranco 추가 0개 확인을 다시 수행한다.

