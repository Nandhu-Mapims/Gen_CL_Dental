# Start frontend and backend (no Docker).
# This script invokes the real script under backend/scripts/run/ so the project has only frontend and backend folders.
& (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "backend\scripts\run\run-local.ps1") @args
