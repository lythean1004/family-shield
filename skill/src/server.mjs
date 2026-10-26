/**
 * 스킬 서버 진입점 (PRD 13-3, D29)
 *
 * 실행:
 *   node skill/src/server.mjs
 *
 * 운영에서는 systemd가 `/etc/family-shield/skill.env`를 주입한다.
 * 개발에서는 `.env.skill.local`을 dotenv 없이 수동으로 export하거나
 *   node --env-file=.env.skill.local skill/src/server.mjs  (Node 20.6+)
 */
import { createServer } from "node:http";
import { loadConfig } from "./config.js";
import { makeHandler } from "./handler.js";

const cfg = loadConfig(process.env);
if (!cfg.ok) {
  console.error(`스킬 서버 설정 오류: 환경 변수가 없음 → ${cfg.missing.join(", ")}`);
  process.exit(1);
}
const { config } = cfg;

const server = createServer(makeHandler(config));

server.listen(config.port, config.host, () => {
  console.log(`스킬 서버 시작: http://${config.host}:${config.port}/api/kakao-skill`);
  console.log(`모델: ${config.ai.model}  AI 시간 제한: ${config.ai.timeoutMs}ms`);
  console.log(`헬스체크: http://${config.host}:${config.port}/health`);
});

server.on("error", (err) => {
  console.error(`서버 오류: ${err.message}`);
  process.exit(1);
});
