param(
  [int]$Port = 8080,
  [string]$Model = "llama3.2:3b",
  [switch]$OpenBrowser = $true,
  [switch]$ForceRestart,
  [switch]$PullModelIfMissing = $true
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $PSScriptRoot ".dashboard-server.pid"
$ollamaPidFile = Join-Path $PSScriptRoot ".dashboard-ollama.pid"
$serverScript = Join-Path $PSScriptRoot "server.js"

function Get-PortProcessId {
  param([int]$CheckPort)
  $line = netstat -ano | Select-String ":$CheckPort" | Select-String "LISTENING" | Select-Object -First 1
  if (-not $line) { return $null }
  return (($line -split "\s+")[-1])
}

function Test-OllamaApi {
  try {
    $null = Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/tags" -Method Get -TimeoutSec 2
    return $true
  } catch {
    return $false
  }
}

function Wait-Until {
  param(
    [scriptblock]$Condition,
    [int]$TimeoutSeconds = 20,
    [int]$StepMs = 300
  )
  $max = [Math]::Ceiling(($TimeoutSeconds * 1000) / $StepMs)
  for ($i = 0; $i -lt $max; $i++) {
    if (& $Condition) { return $true }
    Start-Sleep -Milliseconds $StepMs
  }
  return $false
}

function Get-LanIps {
  $ips = @()
  try {
    $ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
      Where-Object {
        $_.IPAddress -and
        $_.IPAddress -ne "127.0.0.1" -and
        $_.IPAddress -notlike "169.254.*" -and
        $_.PrefixOrigin -ne "WellKnown"
      } |
      Select-Object -ExpandProperty IPAddress -Unique
  } catch {
    $ips = @()
  }
  if (-not $ips -or $ips.Count -eq 0) {
    $matches = ipconfig | Select-String -Pattern "IPv4 Address[^\:]*:\s*([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)"
    $ips = @($matches | ForEach-Object { $_.Matches[0].Groups[1].Value } |
      Where-Object { $_ -and $_ -ne "127.0.0.1" -and $_ -notlike "169.254.*" } |
      Select-Object -Unique)
  }
  return $ips
}

$existingPid = Get-PortProcessId -CheckPort $Port
if ($existingPid) {
  if ($ForceRestart) {
    Stop-Process -Id $existingPid -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
  } else {
    Write-Host "Port $Port is already in use by PID $existingPid."
    Write-Host "Use -ForceRestart to replace it with script_test runtime."
    exit 1
  }
}

if (-not (Test-OllamaApi)) {
  Write-Host "Ollama API not reachable. Starting local Ollama service..."
  $ollamaProc = Start-Process ollama -ArgumentList "serve" -PassThru -WindowStyle Hidden
  Set-Content -Path $ollamaPidFile -Value $ollamaProc.Id
}

$ollamaReady = Wait-Until -Condition { Test-OllamaApi } -TimeoutSeconds 25
if (-not $ollamaReady) {
  Write-Host "Ollama failed to start on http://127.0.0.1:11434"
  exit 1
}

$tags = Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/tags" -Method Get
$modelNames = @($tags.models | ForEach-Object { $_.name })
if ($modelNames -notcontains $Model) {
  if ($PullModelIfMissing) {
    Write-Host "Model '$Model' not found. Pulling model now (this may take time)..."
    & ollama pull $Model
  } else {
    Write-Host "Model '$Model' not found. Start with -PullModelIfMissing or pull manually: ollama pull $Model"
    exit 1
  }
}

$env:PORT = "$Port"
$env:DASHBOARD_AGENT_MODEL = $Model

$serverProc = Start-Process node -ArgumentList $serverScript -WorkingDirectory $root -PassThru
Set-Content -Path $pidFile -Value $serverProc.Id

$healthy = Wait-Until -Condition {
  try {
    $h = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -Method Get -TimeoutSec 2
    return ($h.ok -eq $true)
  } catch {
    return $false
  }
} -TimeoutSeconds 15

if (-not $healthy) {
  Write-Host "Dashboard server failed health check on port $Port"
  exit 1
}

Write-Host ""
Write-Host "Dashboard stack started successfully"
Write-Host "Server PID: $($serverProc.Id)"
if (Test-Path $ollamaPidFile) {
  Write-Host "Ollama PID: $(Get-Content $ollamaPidFile | Select-Object -First 1)"
} else {
  Write-Host "Ollama PID: existing external process"
}
Write-Host ""
Write-Host "Open on this machine:"
Write-Host "  http://localhost:$Port"

$ips = Get-LanIps
if ($ips.Count -gt 0) {
  Write-Host ""
  Write-Host "Open from LAN devices:"
  foreach ($ip in $ips) {
    Write-Host "  http://$ip`:$Port"
  }
} else {
  Write-Host ""
  Write-Host "No LAN IPv4 detected automatically."
}

Write-Host ""
Write-Host "Note: Allow Node.js through Windows Firewall for private networks if other devices cannot connect."

if ($OpenBrowser) {
  Start-Process "http://localhost:$Port"
}
