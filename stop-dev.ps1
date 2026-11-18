$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'scripts/local-dev.ps1')
$lock = Open-DevLock
try {
    if (Test-Path -LiteralPath $devState) {
        $state = Get-Content -Raw -LiteralPath $devState | ConvertFrom-Json
        Stop-DevProcess (Get-DevProcess $state)
        Remove-Item -LiteralPath $devState
    }
    Write-Host 'Culinary Craft application processes are stopped. PostgreSQL and Mailpit remain available.'
} finally {
    $lock.Dispose()
}
