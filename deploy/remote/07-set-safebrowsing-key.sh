#!/usr/bin/env bash
# Run on the VM as fsops. Reads the Google Safe Browsing API key (line 1) from stdin,
# tests it with one hashes.search call, and only then writes it to skill.env and restarts.
# Called by deploy/set-safebrowsing-key.ps1 so the key never appears in a command line or history.
set -euo pipefail

ENV_FILE=/etc/family-shield/skill.env
UNIT=family-shield-skill
URL='https://safebrowsing.googleapis.com/v5/hashes:search?hashPrefixes=AAAAAA%3D%3D'

IFS= read -r KEY || true
KEY="$(printf '%s' "${KEY:-}" | tr -d '[:space:]')"
[ -n "$KEY" ] || { echo "FAIL: key is empty, nothing changed"; exit 1; }

umask 077
HDR="$(mktemp /dev/shm/fs-hdr.XXXXXX)"
TMP="$(mktemp /dev/shm/fs-env.XXXXXX)"
OUT="$(mktemp /dev/shm/fs-out.XXXXXX)"
trap 'rm -f "$HDR" "$TMP" "$OUT"' EXIT
# header via file so the key is not visible in the process list
printf 'X-Goog-Api-Key: %s\n' "$KEY" > "$HDR"

echo "testing key with one Safe Browsing lookup (dummy prefix, no URL sent) ..."
CODE="$(curl -s -m 20 -o "$OUT" -w '%{http_code}' -H @"$HDR" "$URL" || echo 000)"
if [ "$CODE" != "200" ]; then
  echo "FAIL: Safe Browsing answered HTTP $CODE, skill.env NOT changed"
  head -c 300 "$OUT"; echo
  exit 1
fi
echo "key OK (HTTP 200)"

sudo cp -p "$ENV_FILE" "$ENV_FILE.bak"
FOUND=0
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    SAFE_BROWSING_API_KEY=*) printf 'SAFE_BROWSING_API_KEY=%s\n' "$KEY"; FOUND=1 ;;
    *)                       printf '%s\n' "$line" ;;
  esac
done < <(sudo cat "$ENV_FILE") > "$TMP"
[ "$FOUND" = 1 ] || printf 'SAFE_BROWSING_API_KEY=%s\n' "$KEY" >> "$TMP"
sudo install -m 600 -o root -g root "$TMP" "$ENV_FILE"

sudo systemctl restart "$UNIT"
sleep 2
echo "service: $(systemctl is-active "$UNIT")"
echo "health:  $(curl -fsS http://127.0.0.1:3000/health)"
echo "backup of previous file: $ENV_FILE.bak"
