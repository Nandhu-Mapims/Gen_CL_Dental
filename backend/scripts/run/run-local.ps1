param(
  [switch]$InstallDeps
)

$ErrorActionPreference = "Stop"

# When this script lives in backend/scripts/run/, project root is two levels above backend
$backendDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$root = Split-Path -Parent $backendDir
$frontendDir = Join-Path $root "frontend"

if (-not (Test-Path $backendDir)) {
  throw "Backend folder not found at: $backendDir"
}

if (-not (Test-Path $frontendDir)) {
  throw "Frontend folder not found at: $frontendDir"
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js is not installed or not in PATH."
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "npm is not installed or not in PATH."
}

Write-Host "Starting local services (no Docker)..." -ForegroundColor Cyan
Write-Host "MongoDB must already be running on localhost:27017" -ForegroundColor Yellow

if ($InstallDeps) {
  Write-Host "Installing backend dependencies..." -ForegroundColor Cyan
  Push-Location $backendDir
  npm install
  Pop-Location

  Write-Host "Installing frontend dependencies..." -ForegroundColor Cyan
  Push-Location $frontendDir
  npm install
  Pop-Location
}

# Start backend in a dedicated terminal window.
$backendCmd = "Set-Location `"$backendDir`"; npm run dev"
Start-Process powershell -ArgumentList @("-NoExit", "-Command", $backendCmd)

# Start frontend in a dedicated terminal window.
$frontendCmd = "Set-Location `"$frontendDir`"; npm run dev"
Start-Process powershell -ArgumentList @("-NoExit", "-Command", $frontendCmd)

Write-Host ""
Write-Host "Backend starting at http://localhost:5000" -ForegroundColor Green
Write-Host "Frontend starting at http://localhost:5173" -ForegroundColor Green
Write-Host ""
Write-Host "Tip: Run with -InstallDeps for first-time setup." -ForegroundColor DarkGray
