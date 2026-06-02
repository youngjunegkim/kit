param(
  [int]$Port = 8126,
  [string]$Model = "gemini-2.5-flash"
)

$ErrorActionPreference = "Stop"

$nodePath = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if (-not (Test-Path -LiteralPath $nodePath)) {
  $nodePath = "node"
}

$secureKey = Read-Host "Paste Gemini API key, or press Enter to enter it in the browser" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
try {
  $plainKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

$env:AI_PROVIDER = "gemini"
if (-not [string]::IsNullOrWhiteSpace($plainKey)) {
  $env:GEMINI_API_KEY = $plainKey
} else {
  Remove-Item Env:\GEMINI_API_KEY -ErrorAction SilentlyContinue
}
$env:GEMINI_MODEL = $Model
$env:PORT = [string]$Port

Write-Host "Starting Gemini chatbot server..."
Write-Host "Model: $Model"
Write-Host "URL: http://127.0.0.1:$Port/teacherroom.html"
Write-Host "Press Ctrl+C to stop."

& $nodePath server.js
