#!/usr/bin/env bash
# Run on the VM as fsops: write skill.env (only if missing), install systemd unit, restart, health check.
# Usage: ssh fs-ncp 'bash /srv/family-shield/repo/deploy/remote/02-skill-service.sh'
set -euo pipefail

ENV_FILE=/etc/family-shield/skill.env
REPO=/srv/family-shield/repo
UNIT=family-shield-skill

# Never overwrite an existing config: it may already hold real keys.
if sudo grep -q '^SKILL_HEADER_TOKEN=.' "$ENV_FILE" 2>/dev/null; then
  echo "skill.env: exists, kept as is"
else
  TOKEN=$(openssl rand -hex 24)
  HMAC=$(openssl rand -hex 32)
  sudo tee "$ENV_FILE" >/dev/null <<EOF
# Family Shield skill server config. root:root 600, read by systemd EnvironmentFile.
# After editing: sudo systemctl restart family-shield-skill

# Kakao Open Builder skill header "x-skill-token" must match this value
SKILL_HEADER_TOKEN=${TOKEN}

# aitestbed.kr gateway (D30). AI_MODEL empty = rules-only mode, no AI call.
# To enable AI: set AI_API_KEY to the real key and AI_MODEL=gemini-3.1-flash-lite
AI_API_KEY=pending
AI_MODEL=
AI_BASE_URL=https://gateway.aitestbed.kr/v1/chat/completions
AI_TIMEOUT_MS=3000
AI_WEB_TIMEOUT_MS=8000
PROMPT_VERSION=v1

SKILL_HOST=127.0.0.1
SKILL_PORT=3000
MAX_CONCURRENT=8
PHONE_HMAC_SECRET=${HMAC}

# [자세히 보기] button target
WEB_BASE_URL=https://familyshield.kr

# Google Safe Browsing v5 key. Empty = no URL reputation lookup.
SAFE_BROWSING_API_KEY=
URL_LOOKUP_TIMEOUT_MS=800
EOF
  echo "skill.env: created with new random SKILL_HEADER_TOKEN and PHONE_HMAC_SECRET"
fi
sudo chown root:root "$ENV_FILE"
sudo chmod 600 "$ENV_FILE"

sudo install -m 644 "$REPO/deploy/systemd/$UNIT.service" "/etc/systemd/system/$UNIT.service"
sudo systemctl daemon-reload
sudo systemctl enable "$UNIT" >/dev/null 2>&1
sudo systemctl restart "$UNIT"
sleep 2

echo "service: $(systemctl is-active "$UNIT")"
echo "health: $(curl -fsS http://127.0.0.1:3000/health)"
sudo journalctl -u "$UNIT" -n 5 --no-pager
