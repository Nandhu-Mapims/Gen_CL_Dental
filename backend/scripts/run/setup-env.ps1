# Setup .env file with auto-generated JWT secret (writes to backend folder)
Write-Host "`n📝 Setting up .env file...`n" -ForegroundColor Cyan

$backendDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$envPath = Join-Path $backendDir ".env"

# Check if .env exists
if (Test-Path $envPath) {
    Write-Host "⚠️  .env file already exists" -ForegroundColor Yellow
    $overwrite = Read-Host "Do you want to update JWT_SECRET? (y/N)"
    if ($overwrite -ne "y" -and $overwrite -ne "Y") {
        Write-Host "Skipping .env setup" -ForegroundColor Yellow
        exit 0
    }
} else {
    Write-Host "Creating new .env file..." -ForegroundColor Yellow
    @"
# MongoDB Configuration
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=changeme
MONGO_DATABASE=gen_cl_dental
MONGO_HOST=mongodb
MONGO_PORT=27017

# JWT Secret (Will be auto-generated)
JWT_SECRET=your-super-secret-jwt-key-generate-a-random-string-here-min-32-chars

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# API URL for Frontend Build
API_URL=http://localhost:5000/api

# Node Environment
NODE_ENV=production

# Port Configuration
PORT=5000
"@ | Out-File -FilePath $envPath -Encoding utf8
    Write-Host "✅ Created .env at $envPath" -ForegroundColor Green
}

# Generate JWT secret
Write-Host "🔑 Generating JWT secret..." -ForegroundColor Yellow
$jwtSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})

# Update JWT_SECRET in .env
$content = Get-Content $envPath
$newContent = $content | ForEach-Object {
    if ($_ -match "^JWT_SECRET=") {
        "JWT_SECRET=$jwtSecret"
    } else {
        $_
    }
}
$newContent | Out-File -FilePath $envPath -Encoding utf8

Write-Host "✅ JWT_SECRET generated and updated in .env" -ForegroundColor Green
Write-Host "`n⚠️  IMPORTANT: Update the following values in .env:" -ForegroundColor Yellow
Write-Host "   - MONGO_ROOT_PASSWORD (change from 'changeme')" -ForegroundColor White
Write-Host "   - CORS_ORIGIN (your production domain)" -ForegroundColor White
Write-Host "   - API_URL (your production API URL)" -ForegroundColor White
