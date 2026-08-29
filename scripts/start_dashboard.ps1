# TikTok Live Booster - Mission Control Launcher
Write-Host "============================================================" -ForegroundColor Magenta
Write-Host "    TIKTOK LIVE BOOSTER • MISSION CONTROL DASHBOARD         " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Magenta

$rootDir = Split-Path -Parent $PSScriptRoot

# 1. Start Backend API on Port 3005
Write-Host "[1/2] Starting Backend API on http://localhost:3005 ..." -ForegroundColor Yellow
Start-Process -FilePath "node" -ArgumentList "backend/server.js" -WorkingDirectory $rootDir -WindowStyle Hidden

# 2. Start Frontend App on Port 5173
Write-Host "[2/2] Starting Frontend UI on http://localhost:5173 ..." -ForegroundColor Yellow
Set-Location "$rootDir\frontend"
Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev -- --open" -WorkingDirectory "$rootDir\frontend"

Write-Host "`n[SUCCESS] Dashboard is active! Opening browser..." -ForegroundColor Green
Write-Host "URL: http://localhost:5173" -ForegroundColor Cyan
