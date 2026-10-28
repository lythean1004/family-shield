#!/usr/bin/env bash
# Run on the VM as fsops: fetch latest code into /srv/family-shield/repo and run core + skill tests.
# Usage (from Windows): Get-Content -Raw deploy/remote/01-fetch-and-test.sh | ssh fs-ncp "tr -d '\r' | bash -s"
set -euo pipefail

REPO_URL="https://github.com/lythean1004/family-shield.git"
DEST="/srv/family-shield/repo"

if [ ! -d "$DEST/.git" ]; then
  git clone --depth 1 "$REPO_URL" "$DEST"
else
  git -C "$DEST" fetch --depth 1 origin main
  git -C "$DEST" reset --keep origin/main
fi
echo "commit: $(git -C "$DEST" log --oneline -1)"
echo "node: $(node -v)"

echo "== core tests"
(cd "$DEST/packages/core" && node --test test/*.test.js 2>&1 | grep -E '^# (tests|pass|fail)|^. (tests|pass|fail) ' || true)

echo "== skill tests"
(cd "$DEST/skill" && node --test test/*.test.js 2>&1 | grep -E '^# (tests|pass|fail)|^. (tests|pass|fail) ' || true)
