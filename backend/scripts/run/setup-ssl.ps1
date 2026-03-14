# Setup SSL certificates (e.g. for nginx). Paths relative to project root.
# If you add an nginx folder at project root, certificates will be created in nginx\ssl.

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$sslDir = Join-Path $root "nginx\ssl"

Write-Host "`n🔐 Setting up SSL certificates...`n" -ForegroundColor Cyan

if (-not (Test-Path $sslDir)) {
    New-Item -ItemType Directory -Path $sslDir -Force | Out-Null
    Write-Host "✅ Created directory: $sslDir" -ForegroundColor Green
}

if ((Test-Path "$sslDir\cert.pem") -and (Test-Path "$sslDir\key.pem")) {
    Write-Host "⚠️  SSL certificates already exist" -ForegroundColor Yellow
    $overwrite = Read-Host "Do you want to regenerate them? (y/N)"
    if ($overwrite -ne "y" -and $overwrite -ne "Y") {
        Write-Host "Skipping SSL certificate generation" -ForegroundColor Yellow
        exit 0
    }
}

$opensslPath = Get-Command openssl -ErrorAction SilentlyContinue
if (-not $opensslPath) {
    Write-Host "❌ OpenSSL not found. Install OpenSSL and add to PATH." -ForegroundColor Red
    exit 1
}

Write-Host "🔑 Generating self-signed SSL certificate..." -ForegroundColor Yellow

$certPath = "$sslDir\cert.pem"
$keyPath = "$sslDir\key.pem"

openssl req -x509 -nodes -days 365 -newkey rsa:2048 `
    -keyout $keyPath `
    -out $certPath `
    -subj "/C=IN/ST=State/L=City/O=Hospital/CN=localhost"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ SSL certificate generated successfully!" -ForegroundColor Green
    Write-Host "   Certificate: $certPath" -ForegroundColor Gray
    Write-Host "   Private Key: $keyPath" -ForegroundColor Gray
    Write-Host "`n⚠️  Self-signed certificate for development only." -ForegroundColor Yellow
} else {
    Write-Host "❌ Failed to generate SSL certificate" -ForegroundColor Red
    exit 1
}
