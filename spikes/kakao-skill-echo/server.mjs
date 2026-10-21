// 카카오 챗봇 스킬 연결 시험용 서버 (일회성, 앱 코드 아님)
// - 받은 글은 저장·기록하지 않는다. 글자 수와 처리 시간만 돌려준다.
// - 요청 헤더 x-skill-token 이 시작 시 출력된 토큰과 같을 때만 답한다.
import http from "node:http";
import crypto from "node:crypto";

const PORT = Number(process.env.PORT ?? 3000);
const TOKEN = process.env.SKILL_TEST_TOKEN ?? crypto.randomBytes(16).toString("hex");
const MAX_BODY = 64 * 1024;

function kakaoText(text) {
  return { version: "2.0", template: { outputs: [{ simpleText: { text } }] } };
}

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

export function buildReply(payload, elapsedMs) {
  const utterance = payload?.userRequest?.utterance;
  if (typeof utterance !== "string") {
    return kakaoText("시험 응답: 메시지를 읽지 못했어요.");
  }
  const chars = [...utterance].length;
  return kakaoText(`시험 응답: ${chars}자를 받았어요. (서버 처리 ${elapsedMs}ms, 내용은 저장하지 않습니다)`);
}

const server = http.createServer((req, res) => {
  const started = Date.now();
  if (req.method === "GET" && req.url === "/health") return send(res, 200, { ok: true });
  if (req.method !== "POST" || req.url !== "/api/kakao-skill") return send(res, 404, { error: "not found" });
  if (req.headers["x-skill-token"] !== TOKEN) return send(res, 403, { error: "forbidden" });

  let size = 0;
  const chunks = [];
  req.on("data", (c) => {
    size += c.length;
    if (size > MAX_BODY) req.destroy();
    else chunks.push(c);
  });
  req.on("end", () => {
    let payload;
    try {
      payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      return send(res, 400, { error: "bad json" });
    }
    send(res, 200, buildReply(payload, Date.now() - started));
    // 원문 없이 상태만 기록
    console.log(`${new Date().toISOString()} 200 ${Date.now() - started}ms`);
  });
});

server.listen(PORT, () => {
  console.log(`시험용 스킬 서버 실행 중: http://localhost:${PORT}/api/kakao-skill`);
  if (!process.env.SKILL_TEST_TOKEN) console.log(`이번 실행의 헤더 토큰(x-skill-token): ${TOKEN}`);
});
