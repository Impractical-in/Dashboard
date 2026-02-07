$ErrorActionPreference = "SilentlyContinue"
$pidFile = Join-Path $PSScriptRoot ".dashboard-server.pid"
$ollamaPidFile = Join-Path $PSScriptRoot ".dashboard-ollama.pid"

if (Test-Path $pidFile) {
  $pidValue = Get-Content -Path $pidFile | Select-Object -First 1
  if ($pidValue -match '^\d+$') {
    Stop-Process -Id ([int]$pidValue) -Force
    Write-Host "Stopped dashboard server PID=$pidValue"
  }
  Remove-Item -Path $pidFile -Force -ErrorAction SilentlyContinue
} else {
  Write-Host "No dashboard PID file found."
}

if (Test-Path $ollamaPidFile) {
  $ollamaPid = Get-Content -Path $ollamaPidFile | Select-Object -First 1
  if ($ollamaPid -match '^\d+$') {
    Stop-Process -Id ([int]$ollamaPid) -Force
    Write-Host "Stopped script-started Ollama PID=$ollamaPid"
  }
  Remove-Item -Path $ollamaPidFile -Force -ErrorAction SilentlyContinue
} else {
  Write-Host "No script-started Ollama PID file found."
}
