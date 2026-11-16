# Запуск backend через Gradle Wrapper проекта, без глобального Gradle.
$ErrorActionPreference = 'Stop'
$backend = Join-Path (Split-Path -Parent $PSScriptRoot) 'backend'
Push-Location $backend
try {
    & .\gradlew.bat bootRun
    exit $LASTEXITCODE
} finally { Pop-Location }
