#!/usr/bin/env bash
# Run on the VM as fsops. Runs eval/run.mjs on the 200-case test set with the AI key from skill.env.
# The key is loaded by systemd-run (EnvironmentFile) so it never appears in a command line or log.
# Usage: ssh fs-ncp 'bash /srv/family-shield/repo/deploy/remote/06-run-eval.sh [model] [repeat]'
#   then: ssh fs-ncp 'tail -n 20 /srv/family-shield/eval-out/<name>.log'
set -euo pipefail

MODEL="${1:-gemini-3.1-flash-lite}"
REPEAT="${2:-1}"
TIMEOUT_MS="${3:-3000}"
REPO=/srv/family-shield/repo
OUT_DIR=/srv/family-shield/eval-out
STAMP="$(date +%Y-%m-%d)"
NAME="${STAMP}-test-${MODEL}-r${REPEAT}"
mkdir -p "$OUT_DIR"

sudo systemd-run --unit="fs-eval-$(date +%H%M%S)" --uid=fsops --gid=fsops \
  --property=EnvironmentFile=/etc/family-shield/skill.env \
  --property=WorkingDirectory="$REPO" \
  --property=StandardOutput=file:"$OUT_DIR/$NAME.log" \
  --property=StandardError=file:"$OUT_DIR/$NAME.log" \
  /usr/bin/node eval/run.mjs --data eval/test.jsonl --model "$MODEL" \
    --timeout "$TIMEOUT_MS" --repeat "$REPEAT" --out "$OUT_DIR/$NAME.jsonl"

echo "started: $NAME"
echo "log:     $OUT_DIR/$NAME.log"
