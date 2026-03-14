# MongoDB Migration Script - Import to Hostinger
# Run backup first from project root or: .\backup-mongodb.ps1 (in this folder)
# Default BackupPath is project-root/mongodb-backup-full/mrd_audit

param(
    [Parameter(Mandatory=$true)]
    [string]$HostingerHost,

    [Parameter(Mandatory=$false)]
    [string]$HostingerPort = "27017",

    [Parameter(Mandatory=$false)]
    [string]$MongoUser = "admin",

    [Parameter(Mandatory=$true)]
    [string]$MongoPassword,

    [Parameter(Mandatory=$false)]
    [string]$DatabaseName = "mrd_audit",

    [Parameter(Mandatory=$false)]
    [string]$BackupPath = "",

    [switch]$DropExisting = $false
)

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not $BackupPath) { $BackupPath = Join-Path $root "mongodb-backup-full\mrd_audit" }

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "MongoDB Data Import to Hostinger" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $BackupPath)) {
    Write-Host "[ERROR] Backup directory not found: $BackupPath" -ForegroundColor Red
    Write-Host "   Run .\backup-mongodb.ps1 first (in backend\scripts\run\), or set -BackupPath." -ForegroundColor Yellow
    exit 1
}

Write-Host "Import Configuration:" -ForegroundColor Cyan
Write-Host "   Host: $HostingerHost" -ForegroundColor Gray
Write-Host "   Port: $HostingerPort" -ForegroundColor Gray
Write-Host "   Database: $DatabaseName" -ForegroundColor Gray
Write-Host "   Backup Path: $BackupPath" -ForegroundColor Gray
if ($DropExisting) {
    Write-Host "   [WARNING] Will DROP existing collections before import!" -ForegroundColor Red
}
Write-Host ""

$restorePath = Resolve-Path $BackupPath
$restoreCommand = "mongorestore --host $HostingerHost --port $HostingerPort --username $MongoUser --password `"$MongoPassword`" --authenticationDatabase admin --db $DatabaseName"

if ($DropExisting) {
    $restoreCommand += " --drop"
}

$restoreCommand += " `"$restorePath`""

Write-Host "Starting import..." -ForegroundColor Yellow
Write-Host ""

try {
    Invoke-Expression $restoreCommand
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "=========================================" -ForegroundColor Cyan
        Write-Host "Import Successful!" -ForegroundColor Green
        Write-Host "=========================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "MongoDB data has been successfully imported." -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "[ERROR] Import failed. Check the error messages above." -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host ""
    Write-Host "[ERROR] Error during import: $_" -ForegroundColor Red
    exit 1
}
