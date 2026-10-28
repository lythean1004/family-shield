# Update the skill server on the VM: pull main, run core + skill tests, restart only if they pass.
# Usage (PowerShell, from the repo folder):
#   powershell -ExecutionPolicy Bypass -File deploy\deploy-skill.ps1
# Push your commits to GitHub first: the VM pulls from origin/main.
$ErrorActionPreference = 'Continue'
$repo = Split-Path -Parent $PSScriptRoot
$script = Join-Path $repo 'deploy/remote/01-fetch-and-test.sh'

Write-Host '== pull + tests on the VM'
# tr on the VM side: PowerShell pipes add CRLF, bash chokes on \r
Get-Content -Raw $script | ssh -o BatchMode=yes fs-ncp "tr -d '\r' | bash -s"
if ($LASTEXITCODE -ne 0) { Write-Host 'Tests failed on the VM. The running server was NOT restarted.'; exit 1 }

Write-Host '== restart'
ssh -o BatchMode=yes fs-ncp 'sudo systemctl restart family-shield-skill; sleep 2; echo "service: $(systemctl is-active family-shield-skill)"; echo "health:  $(curl -fsS http://127.0.0.1:3000/health)"'
if ($LASTEXITCODE -ne 0) { exit 1 }
Write-Host 'Sessions and unused result links persist in the VM database. AI call limits still reset on restart.'
