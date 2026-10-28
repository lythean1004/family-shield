#!/usr/bin/env bash
# Run on the VM as fsops. Runs eval/run.mjs on the 200-case test set with the AI key from skill.env.
# The key is read with `sudo cat` (already allowed) into this shell's environment only:
# it is never printed, never on a command line, never in the log.
# Usage: ssh fs-ncp 'bash /srv/family-shield/repo/deploy/remote/06-run-eval.sh [model] [repeat] [timeout_ms]'
#   then: ssh fs-ncp 'tail -n 20 /srv/family-shield/eval-out/<name>.log'
set -euo pipefail

MODEL="${1:-gemini-3.1-flash-lite}"
REPEAT="${2:-1}"
TIMEOUT_MS="${3:-3000}"
REPO=/srv/family-shield/repo
OUT_DIR=/srv/family-shield/eval-out
NAME="$(date +%Y-%m-%d-%H%M%S)-test-${MODEL}-t${TIMEOUT_MS}-r${REPEAT}"
mkdir -p "$OUT_DIR"
chmod 700 "$OUT_DIR"

AI_API_KEY="$(sudo cat /etc/family-shield/skill.env | sed -n 's/^AI_API_KEY=//p' | head -n1)"
AI_BASE_URL="$(sudo cat /etc/family-shield/skill.env | sed -n 's/^AI_BASE_URL=//p' | head -n1)"
[ -n "$AI_API_KEY" ] && [ "$AI_API_KEY" != "pending" ] || { echo "FAIL: no AI key in skill.env"; exit 1; }
export AI_API_KEY AI_BASE_URL

cd "$REPO"
nohup node eval/run.mjs --data eval/test.jsonl --model "$MODEL" \
  --timeout "$TIMEOUT_MS" --repeat "$REPEAT" --out "$OUT_DIR/$NAME.jsonl" \
  > "$OUT_DIR/$NAME.log" 2>&1 < /dev/null &
echo "started: $NAME (pid $!)"
echo "log:     $OUT_DIR/$NAME.log"

