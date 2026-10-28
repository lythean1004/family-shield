#!/usr/bin/env bash
# Run on the VM as fsops. Reads the AI key (line 1) and model (line 2) from stdin,
# tests the key against the gateway, and only then writes it to skill.env and restarts.
# Called by deploy/set-ai-key.ps1 so the key never appears in a command line or history.
set -euo pipefail

ENV_FILE=/etc/family-shield/skill.env
UNIT=family-shield-skill

IFS= read -r KEY || true
IFS= read -r MODEL || true
KEY="$(printf '%s' "${KEY:-}" | tr -d '[:space:]')"
MODEL="$(printf '%s' "${MODEL:-}" | tr -d '[:space:]')"
MODEL="${MODEL:-gemini-3.1-flash-lite}"
[ -n "$KEY" ] || { echo "FAIL: key is empty, nothing changed"; exit 1; }

BASE="$(sudo grep '^AI_BASE_URL=' "$ENV_FILE" | cut -d= -f2- || true)"
BASE="${BASE:-https://gateway.aitestbed.kr/v1/chat/completions}"

umask 077
HDR="$(mktemp /dev/shm/fs-hdr.XXXXXX)"
TMP="$(mktemp /dev/shm/fs-env.XXXXXX)"
OUT="$(mktemp /dev/shm/fs-out.XXXXXX)"
trap 'rm -f "$HDR" "$TMP" "$OUT"' EXIT
# header via file so the key is not visible in the process list
printf 'Authorization: Bearer %s\n' "$KEY" > "$HDR"

echo "testing key with model $MODEL ..."
CODE="$(curl -s -m 20 -o "$OUT" -w '%{http_code}' "$BASE" \
  -H @"$HDR" -H 'content-type: application/json' \
  -d "{\"model\":\"$MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"ping\"}],\"max_tokens\":5}" || echo 000)"
if [ "$CODE" != "200" ]; then
  echo "FAIL: gateway answered HTTP $CODE, skill.env NOT changed"
  head -c 300 "$OUT"; echo
  exit 1
fi
echo "key OK (HTTP 200)"

sudo cp -p "$ENV_FILE" "$ENV_FILE.bak"
sudo cat "$ENV_FILE" | while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    AI_API_KEY=*) printf 'AI_API_KEY=%s\n' "$KEY" ;;
    AI_MODEL=*)   printf 'AI_MODEL=%s\n' "$MODEL" ;;
    *)            printf '%s\n' "$line" ;;
  esac
done > "$TMP"
sudo install -m 600 -o root -g root "$TMP" "$ENV_FILE"

sudo systemctl restart "$UNIT"
sleep 2
echo "service: $(systemctl is-active "$UNIT")"
echo "health:  $(curl -fsS http://127.0.0.1:3000/health)"
echo "backup of previous file: $ENV_FILE.bak"
