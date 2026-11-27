#!/usr/bin/env bash
# Run on the VM as fsops. Runs eval/run.mjs on the 200-case test set with the AI key from skill.env.
# The key is read with `sudo cat` (already allowed) into this shell's environment only:
# it is never printed, never on a command line, never in the log.
# Usage: ssh fs-ncp 'bash /srv/family-shield/repo/deploy/remote/06-run-eval.sh [model] [repeat] [timeout_ms] [data] [prompt] [temperature]'
#   data: eval/test.jsonl (default) or eval/supplement.jsonl
#   prompt: v1 (default) or v2 · temperature: empty (model default) or a number such as 0
#   then: ssh fs-ncp 'tail -n 20 /srv/family-shield/eval-out/<name>.log'
set -euo pipefail

MODEL="${1:-gemini-3.1-flash-lite}"
REPEAT="${2:-1}"
TIMEOUT_MS="${3:-3000}"
DATA="${4:-eval/test.jsonl}"
PROMPT="${5:-v1}"
TEMP="${6:-}"
case "$DATA" in eval/*.jsonl) ;; *) echo "FAIL: data must be eval/*.jsonl"; exit 1 ;; esac
case "$PROMPT" in v[0-9]) ;; *) echo "FAIL: prompt must be v1..v9"; exit 1 ;; esac
case "$TEMP" in ""|0|0.[0-9]|1) ;; *) echo "FAIL: temperature must be empty, 0, 0.x or 1"; exit 1 ;; esac
TEMP_ARGS=()
[ -n "$TEMP" ] && TEMP_ARGS=(--temperature "$TEMP")
SET="$(basename "$DATA" .jsonl)"
REPO=/srv/family-shield/repo
OUT_DIR=/srv/family-shield/eval-out
NAME="$(date +%Y-%m-%d-%H%M%S)-${SET}-${MODEL}-t${TIMEOUT_MS}-r${REPEAT}-${PROMPT}${TEMP:+-temp$TEMP}"
mkdir -p "$OUT_DIR"
chmod 700 "$OUT_DIR"

AI_API_KEY="$(sudo cat /etc/family-shield/skill.env | sed -n 's/^AI_API_KEY=//p' | head -n1)"
AI_BASE_URL="$(sudo cat /etc/family-shield/skill.env | sed -n 's/^AI_BASE_URL=//p' | head -n1)"
[ -n "$AI_API_KEY" ] && [ "$AI_API_KEY" != "pending" ] || { echo "FAIL: no AI key in skill.env"; exit 1; }
export AI_API_KEY AI_BASE_URL

cd "$REPO"
nohup node eval/run.mjs --data "$DATA" --model "$MODEL" \
  --timeout "$TIMEOUT_MS" --repeat "$REPEAT" --prompt "$PROMPT" "${TEMP_ARGS[@]}" \
  --out "$OUT_DIR/$NAME.jsonl" \
  > "$OUT_DIR/$NAME.log" 2>&1 < /dev/null &
echo "started: $NAME (pid $!)"
echo "log:     $OUT_DIR/$NAME.log"
