# PowerShell Skills - Reusable utilities

function Kill-ExpoServer {
    Write-Host "Stopping Expo/Node processes..." -ForegroundColor Yellow
    $nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
    if ($nodeProcesses) {
        $nodeProcesses | Stop-Process -Force
        Write-Host "Killed $($nodeProcesses.Count) Node.js process(es)" -ForegroundColor Green
    }
}

Set-Alias -Name kill-expo -Value Kill-ExpoServer -Force -Scope Global

function Test-TypeScript {
    Write-Host "Running TypeScript checks..." -ForegroundColor Cyan
    npx tsc --noEmit
    if ($LASTEXITCODE -eq 0) {
        Write-Host "OK TypeScript compilation successful" -ForegroundColor Green
    } else {
        Write-Host "ERROR TypeScript errors found" -ForegroundColor Red
    }
}

Set-Alias -Name ts-check -Value Test-TypeScript -Force -Scope Global

function Start-WebDev {
    Kill-ExpoServer
    Write-Host "`nStarting web development server..." -ForegroundColor Cyan
    npm run web
}

Set-Alias -Name dev-web -Value Start-WebDev -Force -Scope Global

function Start-DevSession {
    Write-Host "Starting development session..." -ForegroundColor Cyan
    Test-TypeScript
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Skipping server due to errors" -ForegroundColor Yellow
        return
    }
    Start-WebDev
}

Set-Alias -Name dev-session -Value Start-DevSession -Force -Scope Global

Write-Host "Skills loaded: kill-expo, ts-check, dev-web, dev-session" -ForegroundColor Green
