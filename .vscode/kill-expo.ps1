# Kill Expo/Metro processes before debugging
Write-Host "Stopping any running Expo/Node processes..." -ForegroundColor Yellow

# Kill node processes (Expo/Metro bundler)
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    $nodeProcesses | Stop-Process -Force
    Write-Host "Killed $($nodeProcesses.Count) Node.js process(es)" -ForegroundColor Green
} else {
    Write-Host "No Node.js processes found" -ForegroundColor Gray
}

# Kill Expo CLI processes
$expoProcesses = Get-Process -Name "expo" -ErrorAction SilentlyContinue
if ($expoProcesses) {
    $expoProcesses | Stop-Process -Force
    Write-Host "Killed Expo process(es)" -ForegroundColor Green
}

Write-Host "Ready to start debugging!" -ForegroundColor Green
