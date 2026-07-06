# MindSense Full Stack Startup Script
# Starts both the ML API (port 8000) and Frontend (port 8080)

Write-Host "🚀 Starting MindSense Stack..." -ForegroundColor Cyan
Write-Host ""

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$mlDir = Join-Path $projectRoot "ml"

# Start ML API in background
Write-Host "📊 Starting ML API (port 8000)..." -ForegroundColor Yellow
$mlProcess = Start-Process powershell -ArgumentList {
    Set-Location $args[0]
    . .\.venv\Scripts\Activate.ps1
    python predict_api.py --host 127.0.0.1 --port 8000
} -ArgumentList $mlDir -PassThru -NoNewWindow

Write-Host "✓ ML API started (PID: $($mlProcess.Id))" -ForegroundColor Green
Write-Host ""

# Wait for ML API to be ready
Write-Host "⏳ Waiting for ML API to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Test ML API health
$maxRetries = 10
$retries = 0
$apiReady = $false

while ($retries -lt $maxRetries -and -not $apiReady) {
    try {
        $response = Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -ErrorAction Stop
        $apiReady = $true
        Write-Host "✓ ML API is ready!" -ForegroundColor Green
    }
    catch {
        $retries++
        if ($retries -lt $maxRetries) {
            Write-Host "⏳ Waiting... ($retries/$maxRetries)" -ForegroundColor Gray
            Start-Sleep -Seconds 2
        }
    }
}

if (-not $apiReady) {
    Write-Host "⚠️  ML API did not start in time. Check logs." -ForegroundColor Red
}

Write-Host ""
Write-Host "🌐 Starting Frontend Dev Server (port 8080)..." -ForegroundColor Yellow
Set-Location $projectRoot

# Start Frontend
npm run dev

# Cleanup when done
Write-Host ""
Write-Host "🛑 Stopping all services..." -ForegroundColor Yellow
Stop-Process -Id $mlProcess.Id -ErrorAction SilentlyContinue
Write-Host "✓ All services stopped." -ForegroundColor Green
