param(
  [string]$MongoHost = $(if ($env:MONGO_HOST) { $env:MONGO_HOST } else { "localhost" }),
  [int]$MongoPort = $(if ($env:MONGO_PORT) { [int]$env:MONGO_PORT } else { 27017 }),
  [string]$MongoDatabase = $(if ($env:MONGO_DATABASE) { $env:MONGO_DATABASE } else { "gen_cl_dental" }),
  [string]$MongoUser = $(if ($env:MONGO_USER) { $env:MONGO_USER } elseif ($env:MONGO_ROOT_USERNAME) { $env:MONGO_ROOT_USERNAME } else { "" }),
  [string]$MongoPassword = $(if ($env:MONGO_PASSWORD) { $env:MONGO_PASSWORD } elseif ($env:MONGO_ROOT_PASSWORD) { $env:MONGO_ROOT_PASSWORD } else { "" }),
  [string]$MongoAuthDb = $(if ($env:MONGO_AUTH_DB) { $env:MONGO_AUTH_DB } else { "admin" }),
  [string]$OutDir = "",
  [string]$MongodumpPath = ""
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not $OutDir) { $OutDir = Join-Path $root "mongodb-backup-full" }

Write-Host "========================================="
Write-Host "MongoDB Backup (Update backup files)"
Write-Host "========================================="
Write-Host ""
Write-Host "Backup Configuration:"
Write-Host "  Host: $MongoHost"
Write-Host "  Port: $MongoPort"
Write-Host "  Database: $MongoDatabase"
Write-Host "  Output: $OutDir/$MongoDatabase"
Write-Host ""

$mongodumpCmd = Get-Command mongodump -ErrorAction SilentlyContinue
$mongodumpExe = $null

if ($mongodumpCmd) {
  $mongodumpExe = $mongodumpCmd.Source
} else {
  $candidatePaths = @(
    "C:\Program Files\MongoDB\Tools\100\bin\mongodump.exe",
    "C:\Program Files (x86)\MongoDB\Tools\100\bin\mongodump.exe",
    "C:\Program Files\MongoDB\Server\8.0\bin\mongodump.exe",
    "C:\Program Files\MongoDB\Server\7.0\bin\mongodump.exe",
    "C:\Program Files\MongoDB\Server\6.0\bin\mongodump.exe"
  )
  $mongodumpExe = $candidatePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
}

if ($MongodumpPath -and (Test-Path $MongodumpPath)) {
  $mongodumpExe = $MongodumpPath
}

if (-not $mongodumpExe) {
  $searchRoots = @("C:\Program Files\MongoDB", "C:\Program Files (x86)\MongoDB")
  foreach ($searchRoot in $searchRoots) {
    if (Test-Path $searchRoot) {
      $found = Get-ChildItem -Path $searchRoot -Filter "mongodump.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($found) {
        $mongodumpExe = $found.FullName
        break
      }
    }
  }
}

if (-not $mongodumpExe) {
  throw "mongodump command not found. Install MongoDB Database Tools and add to PATH, or run with -MongodumpPath."
}

Write-Host "Using mongodump: $mongodumpExe"

if (-not (Test-Path $OutDir)) {
  New-Item -ItemType Directory -Path $OutDir | Out-Null
}

$dumpArgs = @(
  "--host", $MongoHost,
  "--port", "$MongoPort",
  "--db", $MongoDatabase,
  "--out", $OutDir
)

if ($MongoUser -and $MongoPassword) {
  $dumpArgs += @(
    "--username", $MongoUser,
    "--password", $MongoPassword,
    "--authenticationDatabase", $MongoAuthDb
  )
}

& $mongodumpExe @dumpArgs

Write-Host ""
Write-Host "========================================="
Write-Host "Backup completed successfully"
Write-Host "========================================="
Write-Host "  Location: $OutDir/$MongoDatabase"
Write-Host ""
