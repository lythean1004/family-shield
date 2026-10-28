# Put the aitestbed AI key on the VM without typing it into any command.
# Usage (PowerShell, from the repo folder):
#   powershell -ExecutionPolicy Bypass -File deploy\set-ai-key.ps1
#   powershell -ExecutionPolicy Bypass -File deploy\set-ai-key.ps1 -Model gemini-3.1-flash-lite
param([string]$Model = 'gemini-3.1-flash-lite')

$ErrorActionPreference = 'Continue'
$secure = Read-Host 'aitestbed API key (paste, it stays hidden)' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }

if ([string]::IsNullOrWhiteSpace($key)) { Write-Host 'Key is empty. Nothing changed.'; exit 1 }

"$key`n$Model`n" | ssh -o BatchMode=yes fs-ncp "tr -d '\r' | bash /srv/family-shield/repo/deploy/remote/05-set-ai-key.sh" 2>&1 |
  ForEach-Object { "$_" }
$code = $LASTEXITCODE
$key = $null
if ($code -eq 0) { Write-Host "`nDone. AI is on ($Model)." } else { Write-Host "`nFailed (exit $code). The old settings are still in place." }
exit $code
