/**
 * 카카오 해외 AI 분석(국외 이전) 동의 (D59, docs/compliance-plan-2026-11.md 2단계)
 *
 * - 동의 기록이 없거나 거절했으면 AI를 부르지 않고 규칙만 판정한다. 판별은 막지 않는다(멘토 Q4).
 * - 저장: 카카오 사용자 키의 비밀키 HMAC, 동의 여부, 문구 버전, 시각만(A안). 원래 키는 저장하지 않는다.
 * - 저장소가 없거나 오류면 가장 보수적으로 ‘동의 없음’으로 본다.
 * - 안내문은 보수적 가정(compliance-plan 0장)을 따른다. 확인되지 않은 것은 ‘확인 중’과 가장 넓은 값으로 적는다.
 */
import { createHmac } from "node:crypto";

export const KAKAO_CONSENT_VERSION = "kakao-2026-11-28-v1";

/** 버튼 문장과 같은 글을 보내면 명령으로 처리한다(정확히 같을 때만). */
export const KAKAO_CONSENT_COMMANDS = {
  notice: "AI 분석 안내",
  agree: "AI 분석에 동의해요",
  refuse: "규칙만 쓸게요",
  off: "AI 끄기",
};

export const KAKAO_AI_NOTICE = [
  "[AI 분석 안내]",
  "가족방패는 문자를 먼저 규칙으로 확인해요. 동의하시면 AI도 함께 봐서 놓치는 사기 문자가 줄어요.",
  "",
  "• 보내는 것: 전화번호·계좌·카드·주민번호·이메일·링크 주소를 가린 문장. 가린 뒤에도 이름 같은 정보가 남을 수 있어요.",
  "• 받는 곳: 모두의 AI 실험실 중계 서버 → Alrouter(아토리서치(주)) → Google. Google은 미국 등 해외에서 처리해요(정확한 국가는 확인 중).",
  "• 언제·어떻게: 문자를 보낼 때마다 암호화된 통신으로 보내요.",
  "• 왜·얼마나: 사기 신호를 찾고 설명을 쓰려고요. 중계 서버는 7일 뒤 지워요. 해외 회사의 보관 기간과 학습 이용 여부는 확인 중이며, 최대 2년 보관될 수 있어요.",
  "• 동의하지 않아도 규칙으로 확인해 드려요. 다만 놓치는 문자가 늘 수 있어요.",
  "",
  `언제든 ‘${KAKAO_CONSENT_COMMANDS.off}’라고 보내면 그만둘 수 있어요. 가족방패는 문자 원문을 저장하지 않아요.`,
].join("\n");

export const KAKAO_RULES_ONLY_NOTE =
  `※ 지금은 규칙으로만 확인했어요. AI도 함께 보게 하려면 [${KAKAO_CONSENT_COMMANDS.notice}]를 눌러 주세요.`;

export const KAKAO_CONSENT_REPLY = {
  agreed: `동의를 기록했어요. 다음에 보내는 문자부터 AI가 함께 봐요. 방금 확인한 문자는 다시 보내 주세요.\n그만두려면 ‘${KAKAO_CONSENT_COMMANDS.off}’라고 보내 주세요.`,
  refused: `알겠어요. 앞으로 규칙으로만 확인해요. 마음이 바뀌면 [${KAKAO_CONSENT_COMMANDS.notice}]를 눌러 주세요.`,
  unavailable: "지금은 동의를 기록하지 못했어요. 규칙으로만 확인해요. 잠시 뒤 다시 시도해 주세요.",
};

/** 카카오 사용자 키 → 비밀키 HMAC-SHA256(64자 hex). 키나 비밀값이 없으면 null. */
export function kakaoUserHash(botUserKey, secret) {
  if (!botUserKey || !secret) return null;
  return createHmac("sha256", secret).update(`kakao-consent:${botUserKey}`).digest("hex");
}

/** DB 저장소: private.kakao_consents(service_role만). get → true | false | null(기록 없음) */
export function createDbKakaoConsentStore(db, secret) {
  return {
    async get(botUserKey) {
      const hash = kakaoUserHash(botUserKey, secret);
      if (!hash) return null;
      return db.service(async (tx) => {
        const { rows: [row] } = await tx.query(
          "select overseas_ai from private.kakao_consents where user_hash=$1 and text_version=$2", [hash, KAKAO_CONSENT_VERSION]);
        return row ? row.overseas_ai : null;
      });
    },
    async set(botUserKey, granted) {
      const hash = kakaoUserHash(botUserKey, secret);
      if (!hash) throw new Error("no key");
      await db.service((tx) => tx.query(
        `insert into private.kakao_consents(user_hash,overseas_ai,text_version,updated_at) values($1,$2,$3,now())
         on conflict (user_hash) do update set overseas_ai=excluded.overseas_ai, text_version=excluded.text_version, updated_at=now()`,
        [hash, Boolean(granted), KAKAO_CONSENT_VERSION]));
    },
  };
}

/** 시험용 메모리 저장소 */
export function createMemoryKakaoConsentStore() {
  const map = new Map();
  return {
    async get(botUserKey) { return botUserKey && map.has(botUserKey) ? map.get(botUserKey) : null; },
    async set(botUserKey, granted) { if (!botUserKey) throw new Error("no key"); map.set(botUserKey, Boolean(granted)); },
  };
}

/** 동의 상태: "granted" | "refused" | "unknown". 오류·저장소 없음은 "unknown"(AI 안 부름). */
export async function readKakaoConsent(store, botUserKey) {
  if (!store || !botUserKey) return "unknown";
  try {
    const v = await store.get(botUserKey);
    return v === true ? "granted" : v === false ? "refused" : "unknown";
  } catch {
    return "unknown";
  }
}

/** 동의 명령이면 { granted?: boolean, notice?: true }, 아니면 null */
export function parseConsentCommand(utterance) {
  const t = String(utterance ?? "").trim();
  if (t === KAKAO_CONSENT_COMMANDS.notice) return { notice: true };
  if (t === KAKAO_CONSENT_COMMANDS.agree) return { granted: true };
  if (t === KAKAO_CONSENT_COMMANDS.refuse || t === KAKAO_CONSENT_COMMANDS.off) return { granted: false };
  return null;
}
