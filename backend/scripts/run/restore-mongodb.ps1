# Restore MongoDB from a dump folder (relative to project root, or absolute path).
# Usage: .\restore-mongodb.ps1 [-DumpDir "mongodump-2026-02-17_1100"]
# Optional env: MONGO_HOST, MONGO_PORT, MONGO_DATABASE, MONGO_ROOT_USERNAME, MONGO_ROOT_PASSWORD

param(
  [string]$DumpDir = "mongodump-2026-02-17_1100",
  [string]$MongoHost = $(if ($env:MONGO_HOST) { $env:MONGO_HOST } else { "localhost" }),
  [int]$MongoPort = $(if ($env:MONGO_PORT) { [int]$env:MONGO_PORT } else { 27017 }),
  [string]$MongoDatabase = $(if ($env:MONGO_DATABASE) { $env:MONGO_DATABASE } else { "gen_cl_dental" }),
  [string]$MongoUser = $(if ($env:MONGO_USER) { $env:MONGO_USER } elseif ($env:MONGO_ROOT_USERNAME) { $env:MONGO_ROOT_USERNAME } else { "" }),
  [string]$MongoPassword = $(if ($env:MONGO_PASSWORD) { $env:MONGO_PASSWORD } elseif ($env:MONGO_ROOT_PASSWORD) { $env:MONGO_ROOT_PASSWORD } else { "" }),
  [string]$MongoAuthDb = $(if ($env:MONGO_AUTH_DB) { $env:MONGO_AUTH_DB } else { "admin" })
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$dumpPath = if ([System.IO.Path]::IsPathRooted($DumpDir)) { $DumpDir } else { Join-Path $root $DumpDir }

Write-Host "========================================="
Write-Host "MongoDB Restore (reset and load dump)"
Write-Host "========================================="
Write-Host ""
Write-Host "Restore Configuration:"
Write-Host "  Host: $MongoHost"
Write-Host "  Port: $MongoPort"
Write-Host "  Database: $MongoDatabase"
Write-Host "  Dump folder: $dumpPath"
Write-Host ""

if (-not (Test-Path $dumpPath)) {
  Write-Host "ERROR: Dump folder not found: $dumpPath" -ForegroundColor Red
  exit 1
}

$mongorestoreExe = $null
$mongorestoreCmd = Get-Command mongorestore -ErrorAction SilentlyContinue
if ($mongorestoreCmd) {
  $mongorestoreExe = $mongorestoreCmd.Source
} else {
  $candidatePaths = @(
    "C:\Program Files\MongoDB\Tools\100\bin\mongorestore.exe",
    "C:\Program Files (x86)\MongoDB\Tools\100\bin\mongorestore.exe",
    "C:\Program Files\MongoDB\Server\8.0\bin\mongorestore.exe",
    "C:\Program Files\MongoDB\Server\7.0\bin\mongorestore.exe",
    "C:\Program Files\MongoDB\Server\6.0\bin\mongorestore.exe"
  )
  $mongorestoreExe = $candidatePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
}
if (-not $mongorestoreExe) {
  $searchRoots = @("C:\Program Files\MongoDB", "C:\Program Files (x86)\MongoDB")
  foreach ($searchRoot in $searchRoots) {
    if (Test-Path $searchRoot) {
      $found = Get-ChildItem -Path $searchRoot -Filter "mongorestore.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($found) { $mongorestoreExe = $found.FullName; break }
    }
  }
}
if (-not $mongorestoreExe) {
  Write-Host "ERROR: mongorestore not found. Install MongoDB Database Tools." -ForegroundColor Red
  exit 1
}

$dbFolder = Join-Path $dumpPath $MongoDatabase
if (Test-Path $dbFolder) {
  $restoreTarget = $dbFolder
  $restoreDb = $MongoDatabase
} else {
  $restoreTarget = $dumpPath
  $restoreDb = $null
}

Write-Host "Using mongorestore: $mongorestoreExe"
Write-Host "Restoring from: $restoreTarget"
if ($restoreDb) { Write-Host "Target database: $restoreDb" }
Write-Host ""

$restoreArgs = @(
  "--host", $MongoHost,
  "--port", "$MongoPort",
  "--drop"
)

if ($MongoUser -and $MongoPassword) {
  $restoreArgs += @(
    "--username", $MongoUser,
    "--password", $MongoPassword,
    "--authenticationDatabase", $MongoAuthDb
  )
}

if ($restoreDb) {
  $restoreArgs += @("--db", $restoreDb, $restoreTarget)
} else {
  $restoreArgs += @("--dir", $restoreTarget)
}

& $mongorestoreExe @restoreArgs

Write-Host ""
Write-Host "========================================="
Write-Host "Restore completed successfully"
Write-Host "========================================="
Write-Host "  Database loaded from: $dumpPath"
Write-Host ""
