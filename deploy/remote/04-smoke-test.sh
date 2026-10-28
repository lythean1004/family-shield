#!/usr/bin/env bash
# Run on the VM as fsops: end-to-end checks through local Nginx (HTTPS) to the skill server.
# Usage: ssh fs-ncp 'bash /srv/family-shield/repo/deploy/remote/04-smoke-test.sh'
set -uo pipefail

DOMAIN=familyshield.kr
R="--resolve $DOMAIN:443:127.0.0.1"
URL="https://$DOMAIN"
TOKEN=$(sudo grep '^SKILL_HEADER_TOKEN=' /etc/family-shield/skill.env | cut -d= -f2-)

code() { curl -s -o /dev/null -w '%{http_code}' $R "$@"; }

echo "GET  /                     -> $(code "$URL/")  (expect 200)"
echo "GET  /check/result (SPA)   -> $(code "$URL/check/result")  (expect 200)"
echo "GET  /icons/icon-danger.svg -> $(code "$URL/icons/icon-danger.svg")  (expect 200)"
echo "POST kakao-skill no token  -> $(code -X POST -d '{}' "$URL/api/kakao-skill")  (expect 403)"
echo "GET  /api/result bad token -> $(code "$URL/api/result?t=nope")  (expect 410)"

BODY='{"userRequest":{"utterance":"엄마 나 폰 고장나서 새 번호로 연락해. 급하게 돈 좀 보내줘","user":{"id":"deploy-smoke-test"}}}'
echo "POST kakao-skill with token:"
curl -s $R -X POST "$URL/api/kakao-skill" \
  -H "content-type: application/json" -H "x-skill-token: $TOKEN" \
  -d "$BODY" -w '\n  -> HTTP %{http_code}, %{time_total}s\n'

echo "Security headers:"
curl -sI $R "$URL/" | grep -iE '^(strict-transport|content-security|x-frame|x-content-type|referrer)' | cut -c1-90

echo "Access log never has query strings (last 3 lines):"
sudo tail -n 3 /var/log/nginx/familyshield.access.log
