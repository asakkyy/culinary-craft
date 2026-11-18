$devRoot = Split-Path -Parent $PSScriptRoot
$devDirectory = Join-Path $devRoot '.local-tools/dev'
$devState = Join-Path $devDirectory 'run.json'

function Open-DevLock {
    [IO.Directory]::CreateDirectory($devDirectory) | Out-Null
    try {
        [IO.File]::Open((Join-Path $devDirectory 'lock'), 'OpenOrCreate', 'ReadWrite', 'None')
    } catch {
        throw 'Another start-dev or stop-dev command is active, or .local-tools/dev is not writable.'
    }
}

function Get-DevProcess($state) {
    if (-not $state) { return }
    $process = Get-Process -Id $state.pid -ErrorAction SilentlyContinue
    if ($process) {
        # Keep this process handle open so the PID cannot be reused during stop.
        $null = $process.Handle
        if (-not $process.HasExited -and $process.StartTime.ToUniversalTime().Ticks.ToString() -eq $state.started) { $process }
    }
}

function Stop-DevProcess($process) {
    if ($process -and -not $process.HasExited) {
        $process.Kill()
        if (-not $process.WaitForExit(10000)) { throw 'The managed process did not stop within 10 seconds.' }
    }
}

function Get-DevResponse([string]$path) {
    try {
        Invoke-WebRequest -UseBasicParsing -Uri $path -TimeoutSec 2 -ErrorAction Stop
    } catch {
        return $null
    }
}

function Test-DevReady([int]$mailPort) {
    $backend = Get-DevResponse 'http://127.0.0.1:8080/api/health'
    if (-not $backend) { return $false }
    $health = $backend.Content | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($health.status -ne 'UP' -or $health.storage -ne 'POSTGRESQL') { return $false }
    $frontend = Get-DevResponse 'http://127.0.0.1:5173/'
    if (-not $frontend -or $frontend.Content -notmatch '/@vite/client') { return $false }
    return [bool](Get-DevResponse "http://127.0.0.1:$mailPort/api/v1/info")
}

function Assert-DevPort([int]$port, [string]$service) {
    $listeners = [Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
    if ($listeners.Port -contains $port) {
        throw "Port $port for $service is already in use. Stop the service that owns it yourself or, for Docker services, use the existing Compose port settings."
    }
}
