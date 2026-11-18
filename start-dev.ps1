[CmdletBinding()]
param(
    [switch]$InitializeDatabase,
    [switch]$BootstrapAdmin
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'scripts/local-dev.ps1')
foreach ($path in 'compose.yaml', 'backend/gradlew.bat', 'backend/gradle/wrapper/gradle-wrapper.jar', 'frontend/package-lock.json') {
    if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot $path) -PathType Leaf)) {
        throw "Missing $path. Run start-dev.ps1 from a complete Culinary Craft checkout."
    }
}
if ($env:OS -ne 'Windows_NT') { throw 'This launcher requires Windows 10 or 11.' }

function Read-DevPassword([string]$prompt) {
    $value = Read-Host $prompt -AsSecureString
    [Net.NetworkCredential]::new('', $value).Password
}

function Get-DevPort($value, [string]$name) {
    $port = 0
    if (-not [int]::TryParse($value, [ref]$port) -or $port -lt 1 -or $port -gt 65535) {
        throw "$name must be a TCP port between 1 and 65535."
    }
    $port
}

function Invoke-DevDocker {
    # Windows PowerShell turns native stderr into errors even when it is redirected.
    $ErrorActionPreference = 'Continue'
    & docker @args 2>$null
}

function Get-ComposeContainer([string]$service) {
    $ids = @(Invoke-DevDocker compose -f compose.yaml -p $project ps -a -q $service)
    if ($LASTEXITCODE -ne 0 -or $ids.Count -gt 1) { throw "Could not identify the Compose $service container." }
    if ($ids.Count -eq 0) { return }
    $metadata = Invoke-DevDocker inspect --format '{{json .HostConfig.PortBindings}}|{{.State.Running}}' $ids[0]
    if ($LASTEXITCODE -ne 0) { throw "Could not inspect the existing $service container." }
    $bindings, $running = $metadata -split '\|', 2
    [pscustomobject]@{ Ports = ($bindings | ConvertFrom-Json); Running = $running -eq 'true' }
}

function Get-MappedPort($container, [string]$target, $configured, [int]$default, [string]$name) {
    if (-not $container) {
        if ($configured) { return (Get-DevPort $configured $name) }
        return $default
    }
    $binding = @($container.Ports.$target)
    if ($binding.Count -ne 1 -or $binding[0].HostIp -ne '127.0.0.1') {
        throw "The existing container has no single loopback mapping for $target. Check the original Compose settings."
    }
    $port = Get-DevPort $binding[0].HostPort $name
    if ($configured -and (Get-DevPort $configured $name) -ne $port) {
        throw "$name differs from the existing container's port $port. Use its original settings; containers will not be recreated."
    }
    $port
}

function Show-DevReady($state) {
    Write-Host 'Culinary Craft is ready.'
    Write-Host 'Frontend: http://127.0.0.1:5173'
    Write-Host 'Backend:  http://127.0.0.1:8080'
    Write-Host "Mailpit:  http://127.0.0.1:$($state.mailWebPort)"
    Write-Host "PostgreSQL port: $($state.postgresPort)"
    Write-Host "Logs: $devDirectory"
    Write-Host 'Stop: .\stop-dev.ps1'
    Write-Host 'First ADMIN only: stop the app, then use .\start-dev.ps1 -BootstrapAdmin.'
}

$lock = Open-DevLock
$worker = $null
$changes = @{}
$servicesToRestore = @()
$completed = $false
Push-Location -LiteralPath $PSScriptRoot
try {
    if (Test-Path -LiteralPath $devState) {
        $current = Get-Content -Raw -LiteralPath $devState | ConvertFrom-Json
        $existing = Get-DevProcess $current
        if ($existing) {
            if ($BootstrapAdmin -or -not (Test-DevReady $current.mailWebPort)) {
                throw 'A managed instance is already running. Use .\stop-dev.ps1 before restarting or bootstrapping.'
            }
            Show-DevReady $current
            $completed = $true
            return
        }
        Remove-Item -LiteralPath $devState
    }

    foreach ($tool in 'docker', 'java', 'node', 'npm.cmd') {
        if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
            throw "Missing $tool. Install Docker Desktop, JDK 17 or 21, and Node.js 22.12+ with npm, then check PATH."
        }
    }
    $java = if ($env:JAVA_HOME) { Join-Path $env:JAVA_HOME 'bin/java.exe' } else { 'java' }
    if ($env:JAVA_HOME -and -not (Test-Path -LiteralPath $java -PathType Leaf)) { throw 'JAVA_HOME does not point to a JDK.' }
    $jdkCompiler = if ($env:JAVA_HOME) { Join-Path $env:JAVA_HOME 'bin/javac.exe' } else { 'javac' }
    if (-not (Get-Command $jdkCompiler -ErrorAction SilentlyContinue) -or
        ((& $java --version | Select-Object -First 1) -notmatch '^(?:openjdk|java) (17|21)(?:[.\s]|$)')) {
        throw 'Install JDK 17 or 21 and set JAVA_HOME/PATH to that JDK.'
    }
    $nodeVersion = & node --version
    if ($nodeVersion -notmatch '^v22\.(\d+)\.\d+$' -or [int]$Matches[1] -lt 12) {
        throw 'Install Node.js 22.12 or newer in the Node 22 series.'
    }
    & npm.cmd --version *> $null
    if ($LASTEXITCODE -ne 0) { throw 'npm is unavailable. Repair the Node.js installation.' }
    $dockerHost = if ($env:DOCKER_HOST -and -not $env:DOCKER_CONTEXT) { $env:DOCKER_HOST } else {
        Invoke-DevDocker context inspect --format '{{.Endpoints.docker.Host}}'
    }
    if ($dockerHost -notmatch '^npipe:') { throw 'Switch Docker to a local Docker Desktop context before running this launcher.' }
    $engine = Invoke-DevDocker info --format '{{.OSType}}'
    if ($LASTEXITCODE -ne 0 -or $engine -ne 'linux') { throw 'Start Docker Desktop with the Linux container engine.' }
    Invoke-DevDocker compose version | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Install or update Docker Desktop with Docker Compose v2.' }

    Assert-DevPort 8080 'Spring Boot'
    Assert-DevPort 5173 'Vite'

    # Compose applies process environment precedence over .env. Read only supported values.
    $wanted = 'DB_URL','DB_USERNAME','DB_PASSWORD','POSTGRES_DB','POSTGRES_PORT','MAIL_PORT','MAILPIT_WEB_PORT','MAIL_FROM','MEDIA_ROOT','JWT_SECRET','COMPOSE_PROJECT_NAME'
    $config = @{}
    $environment = @(Invoke-DevDocker compose -f compose.yaml config --environment)
    if ($LASTEXITCODE -ne 0) { throw 'Could not read Compose settings. Check compose.yaml and .env.' }
    foreach ($line in $environment) {
        $key, $value = $line -split '=', 2
        if ($key -cin $wanted) { $config[$key] = $value }
    }
    $project = $config.COMPOSE_PROJECT_NAME
    if (-not $project) {
        $model = Invoke-DevDocker compose -f compose.yaml config --format json
        if ($LASTEXITCODE -ne 0) { throw 'Could not determine the project name from Compose.' }
        $project = ($model | Out-String | ConvertFrom-Json).name
    }
    if ($project -cnotmatch '^[a-z0-9][a-z0-9_-]*$') { throw 'Invalid Compose project name.' }
    $postgres = Get-ComposeContainer 'postgres'
    $mailpit = Get-ComposeContainer 'mailpit'

    $database = $config.POSTGRES_DB
    $requestedPort = $config.POSTGRES_PORT
    if ($config.DB_URL) {
        if ($config.DB_URL -notmatch '^jdbc:postgresql://(?:127\.0\.0\.1|localhost):(\d+)/([A-Za-z0-9_-]+)$') {
            throw 'DB_URL must identify a local PostgreSQL database (jdbc:postgresql://127.0.0.1:PORT/DB).'
        }
        $urlPort = $Matches[1]
        $urlDatabase = $Matches[2]
        if (($requestedPort -and (Get-DevPort $requestedPort 'POSTGRES_PORT') -ne (Get-DevPort $urlPort 'DB_URL port')) -or
            ($database -and $database -cne $urlDatabase)) {
            throw 'DB_URL, POSTGRES_PORT and POSTGRES_DB must refer to the same database.'
        }
        $requestedPort = $urlPort
        $database = $urlDatabase
    }
    if (-not $database) { $database = 'culinary_craft' }
    if ($database -notmatch '^[A-Za-z0-9_-]+$') { throw 'POSTGRES_DB must be a simple database name.' }
    $pgPort = Get-MappedPort $postgres '5432/tcp' $requestedPort 55432 'POSTGRES_PORT'
    $smtpPort = Get-MappedPort $mailpit '1025/tcp' $config.MAIL_PORT 1025 'MAIL_PORT'
    $webPort = Get-MappedPort $mailpit '8025/tcp' $config.MAILPIT_WEB_PORT 8025 'MAILPIT_WEB_PORT'
    if (@(8080,5173,$pgPort,$smtpPort,$webPort | Select-Object -Unique).Count -ne 5) { throw 'The five local ports must be distinct.' }
    if (-not $postgres.Running) { Assert-DevPort $pgPort 'PostgreSQL' }
    if (-not $mailpit.Running) {
        Assert-DevPort $smtpPort 'Mailpit SMTP'
        Assert-DevPort $webPort 'Mailpit web UI'
    }
    if (-not $postgres) {
        $volume = "$($project)_postgres_data"
        $volumes = @(Invoke-DevDocker volume ls -q --filter "name=$volume")
        if ($LASTEXITCODE -ne 0) { throw 'Could not verify existing Docker volumes.' }
        if ($volumes -notcontains $volume -and -not $InitializeDatabase) {
            throw "No PostgreSQL container or volume for '$project'. Set COMPOSE_PROJECT_NAME to your existing project, or explicitly run .\start-dev.ps1 -InitializeDatabase for a new database."
        }
    }

    $dbUser = if ($config.DB_USERNAME) { $config.DB_USERNAME } else { 'culinary_demo' }
    $dbPassword = if ($config.DB_PASSWORD) { $config.DB_PASSWORD } else { Read-DevPassword 'PostgreSQL password for this database' }
    if (-not $dbPassword) { throw 'Provide the current database password through DB_PASSWORD or the masked prompt.' }

    $jwtPath = Join-Path $devDirectory 'jwt.dpapi'
    $jwt = $config.JWT_SECRET
    if (-not $jwt -and (Test-Path -LiteralPath $jwtPath)) {
        try {
            $protected = (Get-Content -Raw -LiteralPath $jwtPath).Trim() | ConvertTo-SecureString
        } catch {
            throw 'Cannot unlock .local-tools/dev/jwt.dpapi for this Windows account. Provide the original JWT_SECRET.'
        }
        $jwt = [Net.NetworkCredential]::new('', $protected).Password
    }
    if (-not $jwt) {
        $bytes = [byte[]]::new(48)
        $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
        try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
        $jwt = [Convert]::ToBase64String($bytes)
        ConvertTo-SecureString $jwt -AsPlainText -Force | ConvertFrom-SecureString | Set-Content -LiteralPath $jwtPath -Encoding ASCII -NoNewline
    }
    if ($jwt -match '\s') { throw 'JWT_SECRET must be Base64 without whitespace.' }
    try { $jwtBytes = [Convert]::FromBase64String($jwt) } catch { throw 'JWT_SECRET must be Base64.' }
    if ($jwtBytes.Length -lt 32) { throw 'JWT_SECRET must contain at least 32 random bytes (Base64).' }

    $adminEmail = $null
    $adminPassword = $null
    if ($BootstrapAdmin) {
        $adminEmail = if ($env:ADMIN_EMAIL) { $env:ADMIN_EMAIL } else { Read-Host 'First ADMIN email' }
        $adminPassword = if ($env:ADMIN_PASSWORD) { $env:ADMIN_PASSWORD } else { Read-DevPassword 'First ADMIN password (16-64 ASCII characters)' }
        if ($adminEmail -notmatch '^[^@\s]+@[^@\s]+\.[^@\s]+$' -or $adminPassword -notmatch '^[\x20-\x7E]{16,64}$') {
            throw 'Provide a valid ADMIN email and a 16-64 character ASCII password.'
        }
    }

    Push-Location frontend
    try {
        if (-not (Test-Path 'node_modules/.bin/vite.cmd') -or -not (Test-Path 'node_modules/pg/package.json')) {
            & npm.cmd ci
            if ($LASTEXITCODE -ne 0) { throw 'Frontend npm ci failed.' }
        }
    } finally { Pop-Location }
    $settings = @{
        DB_URL = "jdbc:postgresql://127.0.0.1:$pgPort/$database"
        DB_USERNAME = $dbUser; DB_PASSWORD = $dbPassword; POSTGRES_PORT = "$pgPort"; POSTGRES_DB = $database
        SPRING_DATASOURCE_URL = "jdbc:postgresql://127.0.0.1:$pgPort/$database"
        SPRING_DATASOURCE_USERNAME = $dbUser; SPRING_DATASOURCE_PASSWORD = $dbPassword
        SPRING_FLYWAY_URL = "jdbc:postgresql://127.0.0.1:$pgPort/$database"
        SPRING_FLYWAY_USER = $dbUser; SPRING_FLYWAY_PASSWORD = $dbPassword
        MAIL_PORT = "$smtpPort"; MAILPIT_WEB_PORT = "$webPort"; MAIL_HOST = '127.0.0.1'
        MAIL_AUTH = 'false'; MAIL_STARTTLS = 'false'; MAIL_USERNAME = $null; MAIL_PASSWORD = $null
        MAIL_FROM = if ($config.MAIL_FROM) { $config.MAIL_FROM } else { 'culinary@localhost' }
        MEDIA_ROOT = if ($config.MEDIA_ROOT) { $config.MEDIA_ROOT } else { Join-Path $PSScriptRoot 'backend/data/media' }
        JWT_SECRET = $jwt; COOKIE_SECURE = 'false'; SERVER_PORT = '8080'; SERVER_ADDRESS = '127.0.0.1'
        PUBLIC_APP_URL = 'http://127.0.0.1:5173'; SPRING_APPLICATION_JSON = $null
        MEDIA_CLEANUP_ENABLED = 'false'
        BOOTSTRAP_ADMIN = "$([bool]$BootstrapAdmin)".ToLowerInvariant(); ADMIN_EMAIL = $adminEmail; ADMIN_PASSWORD = $adminPassword
    }
    foreach ($name in $settings.Keys) {
        $changes[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
        [Environment]::SetEnvironmentVariable($name, $settings[$name], 'Process')
    }
    if (-not $postgres.Running) { $servicesToRestore += 'postgres' }
    if (-not $mailpit.Running) { $servicesToRestore += 'mailpit' }
    Write-Host "Starting Compose project '$project' on PostgreSQL port $pgPort..."
    Invoke-DevDocker compose -f compose.yaml -p $project up -d --no-recreate --wait --wait-timeout 90 postgres mailpit | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Compose could not start. Check docker compose -p $project ps and the configured ports." }

    $dbCheck = @'
const { Client } = require('pg');
const url = new URL(process.env.DB_URL.slice(5));
const client = new Client({ host: url.hostname, port: Number(url.port), database: url.pathname.slice(1),
  user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, connectionTimeoutMillis: 5000, query_timeout: 5000 });
(async () => {
  try { await client.connect(); await client.query('select 1'); }
  catch (error) { process.exitCode = error.code === '28P01' ? 28 : 1; }
  finally { await client.end(); }
})();
'@
    Push-Location frontend
    try {
        $dbCheck | & node
        if ($LASTEXITCODE -eq 28) { throw 'PostgreSQL 28P01: use the original DB_USERNAME and DB_PASSWORD for this volume, then retry. Change the password only through your normal PostgreSQL administration process.' }
        if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL authentication or SELECT 1 failed. Check the database name, port and existing database credentials.' }
    } finally { Pop-Location }

    $workerPath = Join-Path $PSScriptRoot 'scripts/local-dev-worker.ps1'
    $workerOptions = @{
        FilePath = (Get-Process -Id $PID).Path
        ArgumentList = "-NoProfile -File `"$workerPath`" `"$devDirectory`""
        WindowStyle = 'Hidden'; PassThru = $true; WorkingDirectory = $PSScriptRoot
        RedirectStandardOutput = Join-Path $devDirectory 'worker.log'
        RedirectStandardError = Join-Path $devDirectory 'worker-error.log'
    }
    $worker = Start-Process @workerOptions
    $state = @{ pid = $worker.Id; started = $worker.StartTime.ToUniversalTime().Ticks.ToString(); mailWebPort = $webPort; postgresPort = $pgPort }
    $state | ConvertTo-Json | Set-Content -LiteralPath $devState -Encoding ASCII
    $timeout = [DateTime]::UtcNow.AddSeconds(180)
    do {
        if ($worker.HasExited) { throw "The launcher exited before startup. Check $devDirectory\worker-error.log and the application logs." }
        if (Test-DevReady $webPort) {
            Show-DevReady $state
            $completed = $true
            return
        }
        Start-Sleep -Seconds 1
    } while ([DateTime]::UtcNow -lt $timeout)
    throw "Startup timed out. Check backend.log, frontend.log and worker-error.log in $devDirectory."
} finally {
    try {
        if (-not $completed) {
            Stop-DevProcess $worker
            if ($worker -and (Test-Path -LiteralPath $devState)) { Remove-Item -LiteralPath $devState }
            if ($servicesToRestore) { Invoke-DevDocker compose -f compose.yaml -p $project stop @servicesToRestore | Out-Null }
        }
    } finally {
        foreach ($name in $changes.Keys) { [Environment]::SetEnvironmentVariable($name, $changes[$name], 'Process') }
        Pop-Location
        $lock.Dispose()
    }
}
