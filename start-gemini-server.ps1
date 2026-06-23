param(
  [int]$Port = 8126,
  [string]$Model = "gpt-5.5"
)

$ErrorActionPreference = "Stop"

$nodePath = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if (-not (Test-Path -LiteralPath $nodePath)) {
  $nodePath = "node"
}

$secureKey = Read-Host "Paste OpenAI API key" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
try {
  $plainKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

if (-not [string]::IsNullOrWhiteSpace($plainKey)) {
  $env:OPENAI_API_KEY = $plainKey
} else {
  Remove-Item Env:\OPENAI_API_KEY -ErrorAction SilentlyContinue
}
$env:OPENAI_MODEL = $Model
$env:PORT = [string]$Port

Write-Host "Starting ChatGPT local test server..."
Write-Host "Model: $Model"
Write-Host "Student page: http://127.0.0.1:$Port/student.html"
Write-Host "Teacher room: http://127.0.0.1:$Port/teacherroom.html"
Write-Host "Art room: http://127.0.0.1:$Port/game-art.html"
Write-Host "Broadcast room: http://127.0.0.1:$Port/game-broadcast.html"
Write-Host "Press Ctrl+C to stop."

& $nodePath server.js
