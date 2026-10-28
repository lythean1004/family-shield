# Copy the Kakao skill header token (x-skill-token) from the VM to the Windows clipboard.
# Usage: powershell -ExecutionPolicy Bypass -File deploy\copy-skill-token.ps1
# Then paste it into Open Builder: 헤더값 입력 and 테스트 헤더값 입력.
$ErrorActionPreference = 'Continue'
$line = ssh -o BatchMode=yes fs-ncp "sudo grep '^SKILL_HEADER_TOKEN=' /etc/family-shield/skill.env" 2>$null
if (-not $line) { Write-Host 'Could not read the token from the VM. Check: ssh fs-ncp'; exit 1 }
$token = ($line -split '=', 2)[1].Trim()
Set-Clipboard -Value $token
Write-Host "Copied to clipboard ($($token.Length) characters). Paste it with Ctrl+V."
