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
import { createSignalMetrics } from './signal-metrics.js';

const cfg = loadConfig(process.env);
if (!cfg.ok) {
  console.error(`스킬 서버 설정 오류: 환경 변수가 없음 → ${cfg.missing.join(", ")}`);
  process.exit(1);
}
const { config } = cfg;

const signalMetrics = createSignalMetrics({ emit: row => console.log(JSON.stringify(row)) });
const handler = makeHandler({ ...config, signalMetrics });
const server = createServer(handler);
const metricsTimer = setInterval(() => signalMetrics.flush(), 60000);
metricsTimer.unref();
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  // Finish in-flight analyses before flushing the last daily fragment.
  const deadline = setTimeout(() => process.exit(1), 30000);
  deadline.unref();
  server.close(async () => {
    clearInterval(metricsTimer);
    try { await handler.close(); }
    finally { clearTimeout(deadline); }
  });
}
process.once('SIGTERM', stop);
process.once('SIGINT', stop);

server.listen(config.port, config.host, () => {
  console.log(`스킬 서버 시작: http://${config.host}:${config.port}/api/kakao-skill`);
  console.log(`모델: ${config.ai.model}  AI 시간 제한: ${config.ai.timeoutMs}ms`);
  console.log(`헬스체크: http://${config.host}:${config.port}/health`);
});

server.on("error", (err) => {
  console.error(`서버 오류: ${err.message}`);
  process.exit(1);
});
