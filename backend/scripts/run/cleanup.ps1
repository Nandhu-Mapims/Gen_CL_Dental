# Cleanup script to remove unwanted files and directories (paths relative to project root)
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Write-Host "🧹 Cleaning up unwanted files and directories...`n" -ForegroundColor Cyan

$removed = @()
$failed = @()

$targets = @(
    (Join-Path $root "frontend\dist"),
    (Join-Path $root "mongodb-backup"),
    (Join-Path $root "mongodb-backup-full")
)

foreach ($path in $targets) {
    $name = $path.Replace("$root\", "")
    if (Test-Path $path) {
        try {
            Remove-Item -Path $path -Recurse -Force
            $removed += $name
            Write-Host "✅ Removed $name" -ForegroundColor Green
        } catch {
            $failed += $name
            Write-Host "❌ Failed to remove $name : $_" -ForegroundColor Red
        }
    } else {
        Write-Host "ℹ️  $name not found (already removed)" -ForegroundColor Gray
    }
}

Write-Host "`n📊 Cleanup Summary:" -ForegroundColor Cyan
if ($removed.Count -gt 0) {
    Write-Host "   Removed: $($removed.Count) item(s)" -ForegroundColor Green
    $removed | ForEach-Object { Write-Host "   - $_" -ForegroundColor Gray }
}
if ($failed.Count -gt 0) {
    Write-Host "   Failed: $($failed.Count) item(s)" -ForegroundColor Red
    $failed | ForEach-Object { Write-Host "   - $_" -ForegroundColor Gray }
}
if ($removed.Count -eq 0 -and $failed.Count -eq 0) {
    Write-Host "   No items to remove" -ForegroundColor Yellow
}
Write-Host "`n✅ Cleanup completed!`n" -ForegroundColor Green
