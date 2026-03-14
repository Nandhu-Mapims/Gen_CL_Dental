# Restore dump into a NEW MongoDB database.
# Usage: .\restore-to-new-db.ps1 [-DumpDir "mongodump-2026-02-17_1100"] [-NewDbName "mrd_audit_new"]
# DumpDir is relative to project root unless an absolute path is given.

param(
  [string]$DumpDir = "mongodump-2026-02-17_1100",
  [string]$NewDbName = "mrd_audit_new",
  [string]$SourceDbInDump = "mrd_audit",
  [string]$MongoHost = $(if ($env:MONGO_HOST) { $env:MONGO_HOST } else { "localhost" }),
  [int]$MongoPort = $(if ($env:MONGO_PORT) { [int]$env:MONGO_PORT } else { 27017 }),
  [string]$MongoUser = $(if ($env:MONGO_USER) { $env:MONGO_USER } elseif ($env:MONGO_ROOT_USERNAME) { $env:MONGO_ROOT_USERNAME } else { "" }),
  [string]$MongoPassword = $(if ($env:MONGO_PASSWORD) { $env:MONGO_PASSWORD } elseif ($env:MONGO_ROOT_PASSWORD) { $env:MONGO_ROOT_PASSWORD } else { "" }),
  [string]$MongoAuthDb = $(if ($env:MONGO_AUTH_DB) { $env:MONGO_AUTH_DB } else { "admin" })
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$dumpPath = if ([System.IO.Path]::IsPathRooted($DumpDir)) { $DumpDir } else { Join-Path $root $DumpDir }
$sourceDbFolder = Join-Path $dumpPath $SourceDbInDump

Write-Host "========================================="
Write-Host "MongoDB Restore → NEW database"
Write-Host "========================================="
Write-Host ""
Write-Host "  Dump folder:      $dumpPath"
Write-Host "  Source DB in dump: $SourceDbInDump"
Write-Host "  NEW database:    $NewDbName"
Write-Host "  Host:            $MongoHost`:$MongoPort"
Write-Host ""

if (-not (Test-Path $sourceDbFolder)) {
  Write-Host "ERROR: Source DB folder not found: $sourceDbFolder" -ForegroundColor Red
  exit 1
}

$mongorestoreExe = $null
$mongorestoreCmd = Get-Command mongorestore -ErrorAction SilentlyContinue
if ($mongorestoreCmd) { $mongorestoreExe = $mongorestoreCmd.Source }
else {
  @(
    "C:\Program Files\MongoDB\Tools\100\bin\mongorestore.exe",
    "C:\Program Files (x86)\MongoDB\Tools\100\bin\mongorestore.exe",
    "C:\Program Files\MongoDB\Server\8.0\bin\mongorestore.exe",
    "C:\Program Files\MongoDB\Server\7.0\bin\mongorestore.exe",
    "C:\Program Files\MongoDB\Server\6.0\bin\mongorestore.exe"
  ) | ForEach-Object { if (Test-Path $_) { $mongorestoreExe = $_; return } }
}
if (-not $mongorestoreExe) {
  foreach ($searchRoot in @("C:\Program Files\MongoDB", "C:\Program Files (x86)\MongoDB")) {
    if (Test-Path $searchRoot) {
      $f = Get-ChildItem -Path $searchRoot -Filter "mongorestore.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($f) { $mongorestoreExe = $f.FullName; break }
    }
  }
}
if (-not $mongorestoreExe) {
  Write-Host "ERROR: mongorestore not found. Install MongoDB Database Tools." -ForegroundColor Red
  exit 1
}

Write-Host "Using: $mongorestoreExe"
Write-Host ""

$restoreArgs = @(
  "--host", $MongoHost,
  "--port", "$MongoPort",
  "--db", $NewDbName,
  "--drop",
  $sourceDbFolder
)

if ($MongoUser -and $MongoPassword) {
  $restoreArgs = @(
    "--host", $MongoHost,
    "--port", "$MongoPort",
    "--username", $MongoUser,
    "--password", $MongoPassword,
    "--authenticationDatabase", $MongoAuthDb,
    "--db", $NewDbName,
    "--drop",
    $sourceDbFolder
  )
}

& $mongorestoreExe @restoreArgs

Write-Host ""
Write-Host "========================================="
Write-Host "New database created successfully"
Write-Host "========================================="
Write-Host "  Database name: $NewDbName"
Write-Host ""
Write-Host "To connect your app to this database, set in backend .env:"
Write-Host "  MONGO_URI=mongodb://localhost:27017/$NewDbName"
if ($MongoUser -and $MongoPassword) {
  Write-Host "  (or with auth: MONGO_URI=mongodb://${MongoUser}:****@${MongoHost}:${MongoPort}/$NewDbName`?authSource=$MongoAuthDb)"
}
Write-Host ""
