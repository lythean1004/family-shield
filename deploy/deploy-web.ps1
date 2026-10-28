# Build the PWA on this PC and publish it to the VM (/srv/family-shield/web).
# Usage (PowerShell, from the repo folder):
#   powershell -ExecutionPolicy Bypass -File deploy\deploy-web.ps1
# Publishing is atomic: files go to web.new, then swap, so visitors never see a half copy.
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location (Join-Path $repo 'web')

Write-Host '== tests'
node --test src/__tests__/*.test.js | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Host 'Web tests failed. Nothing deployed.'; exit 1 }

Write-Host '== build'
npm run build | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Host 'Build failed. Nothing deployed.'; exit 1 }

$tgz = Join-Path $env:TEMP 'fs-web-dist.tgz'
tar -czf $tgz -C dist .
scp -q -o BatchMode=yes $tgz fs-ncp:/tmp/fs-web-dist.tgz
Remove-Item -LiteralPath $tgz

$remote = @'
set -e
B=/srv/family-shield
rm -rf $B/web.new && mkdir -p $B/web.new
tar -xzf /tmp/fs-web-dist.tgz -C $B/web.new && rm /tmp/fs-web-dist.tgz
find $B/web.new -type d -exec chmod 755 {} + ; find $B/web.new -type f -exec chmod 644 {} +
test -f $B/web.new/index.html
rm -rf $B/web.old; mv $B/web $B/web.old; mv $B/web.new $B/web
echo "published: $(ls $B/web/assets | tr '\n' ' ')"
'@
$remote | ssh -o BatchMode=yes fs-ncp "tr -d '\r' | bash -s"
if ($LASTEXITCODE -ne 0) { Write-Host 'Publish failed. The previous version is still live.'; exit 1 }

$code = (Invoke-WebRequest -Uri 'https://familyshield.kr/' -UseBasicParsing -TimeoutSec 15).StatusCode
Write-Host "https://familyshield.kr -> $code"
Write-Host 'Rollback if needed: ssh fs-ncp "cd /srv/family-shield && mv web web.bad && mv web.old web"'
