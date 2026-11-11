import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { domainSegments, findLookalikes, OFFICIAL_DOMAIN_CARDS } from "../src/lookalike.js";
import { extractCodeSignals } from "../src/extract.js";
import { decide } from "../src/rule-engine.js";
import { lookupTargets } from "../src/domain-age.js";
import { buildKeys, hostKey } from "../src/phishing-list.js";

describe("도메인 조각 나누기", () => {
  it("최상위 도메인(2단계 국가 도메인 포함)을 빼고 점·하이픈으로 나눈다", () => {
    assert.deepEqual(domainSegments("web-telegrem-q.org"), ["web", "telegrem", "q"]);
    assert.deepEqual(domainSegments("epost.kr-delivery.co.kr"), ["epost", "kr", "delivery"]);
    assert.deepEqual(domainSegments("www.Koreapost-Updatepost.com"), ["koreapost", "updatepost"]);
  });
});

describe("공식 도메인 사칭 감지 (D40 ②)", () => {
  const hit = (d) => findLookalikes([d]).map((x) => x.card_id);

  it("KISA 목록에 있던 사칭 도메인 모양을 잡는다", () => {
    assert.deepEqual(hit("koreapost-updatepost.com"), ["EV-DOM-EPOST"]);
    assert.deepEqual(hit("korpostgokr.top"), ["EV-DOM-EPOST"]);
    assert.deepEqual(hit("cjlogisticss.com"), ["EV-DOM-CJ"]);
    assert.deepEqual(hit("ilogensn.com"), ["EV-DOM-LOGEN"]);
    assert.deepEqual(hit("lotteglogisk.com"), ["EV-DOM-LOTTE"]);
    assert.deepEqual(hit("hanjin1.com"), ["EV-DOM-HANJIN"]);
    assert.deepEqual(hit("efinesks.live"), ["EV-DOM-EFINE"]);
    assert.deepEqual(hit("nhisis.xyz"), ["EV-DOM-NHIS"]);
    assert.deepEqual(hit("hometax-refund.top"), ["EV-DOM-NTS"]);
    assert.deepEqual(hit("teiegram.cyou"), ["EV-DOM-TELEGRAM"]);
    assert.deepEqual(hit("web-telegrem-q.org"), ["EV-DOM-TELEGRAM"]);
  });

  it("진짜 공식 도메인과 그 하위 주소는 잡지 않는다", () => {
    for (const d of ["epost.go.kr", "service.epost.go.kr", "www.koreapost.go.kr", "cjlogistics.com",
      "www.ilogen.com", "lotteglogis.com", "hanjin.com", "www.efine.go.kr", "nhis.or.kr",
      "hometax.go.kr", "www.gov.kr", "minwon.go.kr", "telegram.org", "t.me", "gov.kr"]) {
      assert.deepEqual(hit(d), [], d);
    }
  });

  it("한진은 이름 전체·숫자 조합만 잡고 다른 브랜드의 앞부분은 잡지 않는다", () => {
    for (const d of ["hanjin1.invalid", "hanjin2.invalid", "hanjin3.invalid", "hanjin.delivery.invalid", "hanjin-delivery.invalid"]) {
      assert.deepEqual(hit(d), ["EV-DOM-HANJIN"], d);
    }
    for (const d of ["hanjintravel.com", "www.hanjinkal.co.kr", "hanjintravel.invalid", "hanjinschool.invalid", "hanjinoneclick.co.kr"]) {
      assert.deepEqual(hit(d), [], d);
    }
  });

  it("Tranco 오탐 시험에서 걸렸던 정상 도메인은 잡지 않는다", () => {
    for (const d of ["www.gov.uk", "beian.gov.cn", "turkiye.gov.tr", "gov.uz", "gov.on.ca", "gov.wales",
      "e-gov.go.jp", "slack-gov.com", "awsdns-us-gov-05.net", "gov-static.tech",
      "telegram.com", "star-telegram.com", "telegram.im", "telegram.dog", "telegram.hr",
      "epostbank.go.kr", "epostlife.go.kr",
      "epost.de", "epost.ch", "eposten.se", "epostersonline.com", "epostoffice.gov.in", "epost-indiapost.gov.in"]) {
      assert.deepEqual(hit(d), [], d);
    }
  });

  it("gov 는 KISA 에서 본 모양(gov.무작위.일반도메인)일 때만 잡는다", () => {
    assert.deepEqual(hit("gov.aw1y.bar"), ["EV-DOM-GOV"]);
    assert.deepEqual(hit("gov.cs3a.shop"), ["EV-DOM-GOV"]);
    assert.deepEqual(hit("minwon.gov.yashwan.shop"), [], "gov 가 맨 앞이 아니면 아님");
  });

  it("go.kr 같은 공공기관 도메인은 사칭 검사에서 항상 뺀다", () => {
    assert.deepEqual(hit("hometax-new.go.kr"), []);
  });

  it("or.kr 은 공공기관 전용이 아니므로 공식 도메인이 아니면 검사한다", () => {
    assert.deepEqual(hit("nhis-event.or.kr"), ["EV-DOM-NHIS"]);
    assert.deepEqual(hit("www.nhis.or.kr"), []);
  });

  it("이름이 단어 앞부분이 아니거나 gov 로 시작하는 다른 단어면 잡지 않는다", () => {
    for (const d of ["redefine.com", "define-it.io", "governor.org", "government.nl", "zhanjing.cn",
      "naver.com", "coupang.com", "google.com", "familyshield.kr", "posttoday.com"]) {
      assert.deepEqual(hit(d), [], d);
    }
  });

  it("여러 도메인 중 사칭만 골라 낸다(중복 없이)", () => {
    const r = findLookalikes(["epost.go.kr", "koreapost-kr.top", "koreapost-kr.top"]);
    assert.deepEqual(r, [{ domain: "koreapost-kr.top", card_id: "EV-DOM-EPOST" }]);
  });

  it("통신사 이름은 관측된 문자 조합의 DNS 라벨 전체만 맞춘다", () => {
    const cases = {
      'EV-DOM-KT': ['kt-sms-vip', 'kt-sms', 'kt-text', 'ktsms', 'bg-ktsms'],
      'EV-DOM-SKT': ['skt-sms-vip', 'skt-sms', 'skt-text', 'skt12-txt'],
      'EV-DOM-LGUPLUS': ['lg-sms-vip', 'lg-sms'],
    };
    for (const [id, labels] of Object.entries(cases)) {
      for (const label of labels) {
        assert.deepEqual(hit(`${label}.invalid`), [id]);
        assert.deepEqual(hit(`notice.${label}.example.invalid`), [id]);
      }
    }
    for (const label of ['kt', 'skt', 'lg', 'kb', 'nh', 'woori', 'card', 'ktown',
      'kt-home', 'skt-bugo', 'lg-electronics', 'lguplusm', 'my-kt-sms', 'kt-sms-shop', 'skt-txt']) {
      assert.deepEqual(hit(`${label}.invalid`), [], label);
    }
    for (const domain of ['kt-sms.kt.com', 'kt-sms.olleh.com', 'skt-sms.sktelecom.com',
      'skt-sms.tworld.co.kr', 'skt-sms.sktpass.com', 'lg-sms.lguplus.com', 'lg-sms.uplus.co.kr']) {
      assert.deepEqual(hit(domain), [], domain);
    }
  });

  it("카드는 모두 근거 카드 필드를 갖는다", () => {
    assert.ok(OFFICIAL_DOMAIN_CARDS.length >= 10);
    for (const c of OFFICIAL_DOMAIN_CARDS) {
      for (const k of ["id", "name", "official_domains", "source_url", "checked_at", "scope", "terms_checked", "status"]) {
        assert.ok(k in c, `${c.id}: ${k}`);
      }
    }
  });
});

describe("공식 도메인 제외용 카드 확대 (요청서 3)", () => {
  // 기대 도메인은 조사 결과에서 고정한다. 카드 목록 자체에서 기대값을 만들지 않는다.
  const expected = {
    FSS: ["fss.or.kr"], SPO: ["spo.go.kr", "kics.go.kr"], POLICE: ["police.go.kr"],
    SCOURT: ["scourt.go.kr"], CUSTOMS: ["customs.go.kr"], NPS: ["nps.or.kr"],
    EX: ["ex.co.kr", "hipass.co.kr"], KBANK: ["kbstar.com"],
    NHBANK: ["nhbank.com", "nonghyup.com"], SHINHANBANK: ["shinhan.com"],
    WOORIBANK: ["wooribank.com"], HANABANK: ["kebhana.com"], IBK: ["ibk.co.kr"],
    KAKAOBANK: ["kakaobank.com"], TOSSBANK: ["tossbank.com"],
    SHINHANCARD: ["shinhancard.com"], SAMSUNGCARD: ["samsungcard.com"],
    HYUNDAICARD: ["hyundaicard.com"], KBCARD: ["kbcard.com"],
    LOTTECARD: ["lottecard.co.kr"], WOORICARD: ["wooricard.com"],
    HANACARD: ["hanacard.co.kr"], BCCARD: ["bccard.com"], COUPANG: ["coupang.com"],
    NAVERPAY: ["pay.naver.com"], KAKAOPAY: ["kakaopay.com"], DAANGN: ["daangn.com"],
  };
  const domains = Object.values(expected).flat();
  const allow = new Set(OFFICIAL_DOMAIN_CARDS.flatMap(c => c.official_domains));

  it("근거가 확인된 기관만 등록하고 이름 근거가 없는 카드는 탐지 규칙을 갖지 않는다", () => {
    for (const [suffix, official] of Object.entries(expected)) {
      const id = `EV-DOM-${suffix}`;
      const card = OFFICIAL_DOMAIN_CARDS.find(c => c.id === id);
      assert.ok(card, id);
      assert.deepEqual(card.official_domains, official, id);
      assert.equal(card.scope, "공식 도메인 제외용(사칭 이름 근거 없음)", id);
      for (const field of ["prefixes", "regex", "label_regex", "first_label_on_generic"]) {
        assert.equal((card[field] ?? []).length, 0, `${id}: ${field}`);
      }
    }
  });

  it("공식 주소와 하위 주소는 R11·RDAP 조회·KISA 키 생성에서 제외한다", () => {
    for (const domain of domains) {
      for (const host of [domain, `notice.${domain}`, `auth.mobile.${domain}`]) {
        assert.deepEqual(findLookalikes([host]), [], host);
        assert.deepEqual(lookupTargets([host]), [], host);
        assert.equal(buildKeys([`https://${host}/synthetic-test`], { allow }).keys.size, 0, host);
      }
    }
  });

  it("공식 이름을 덧붙인 다른 주소까지 제외하지 않는다(모두 접속하지 않는 합성 주소)", () => {
    for (const domain of domains) {
      for (const host of [`${domain}.example.invalid`, `other-${domain.replaceAll('.', '-')}.invalid`]) {
        assert.ok(lookupTargets([host]).length > 0, host);
        assert.ok(buildKeys([`https://${host}/synthetic-test`], { allow }).keys.has(hostKey(host)), host);
      }
    }
  });

  it("짧은 기관 약자·일반 단어·다른 회사 이름만으로 새 위험 신호를 만들지 않는다", () => {
    for (const label of ["kb", "nh", "ibk", "bc", "sc", "bank", "card", "pay", "kbank",
      "samsung-electronics", "hyundai-motor", "hana-tour", "lotte-shopping", "carrot-farm",
      "coupang-notice", "kakaopay123", "shinhan-card"]) {
      assert.deepEqual(findLookalikes([`${label}.invalid`]), [], label);
    }
  });
});

describe("코드 신호와 규칙", () => {
  it("문자 속 사칭 도메인이면 SIG_LOOKALIKE_DOMAIN", () => {
    const { signals } = extractCodeSignals("[국제발신] 주소 불일치로 보관 중 https://koreapost-kr.top/a 확인");
    assert.ok(signals.includes("SIG_LOOKALIKE_DOMAIN"));
  });

  it("공식 도메인 링크에는 켜지지 않는다", () => {
    const { signals } = extractCodeSignals("우체국 택배 조회 https://service.epost.go.kr/trace");
    assert.ok(!signals.includes("SIG_LOOKALIKE_DOMAIN"));
  });

  it("R11: 공식 주소 흉내 링크면 위험", () => {
    const r = decide({ signals_final: ["SIG_LINK", "SIG_LOOKALIKE_DOMAIN"] });
    assert.equal(r.level, "위험");
    assert.ok(r.fired_rules.includes("R11"));
  });
});
