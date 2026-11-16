<#
.SYNOPSIS
  Safe import of this complete Lab 6+7 prototype into an EXISTING Git repository.
  IMPORTANT: only changes a NEW feature branch; preserves .git and a backup branch.
.EXAMPLE
  .\scripts\migrate-to-existing-repo.ps1 -RepoPath "D:\projects\culinary-craft"
  .\scripts\migrate-to-existing-repo.ps1 -RepoPath "D:\projects\culinary-craft" -Apply
#>
param(
    [Parameter(Mandatory = $true)][string] $RepoPath,
    [string] $BaseBranch = 'dev',
    [switch] $Apply
)
$ErrorActionPreference = 'Stop'
$source = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$target = (Resolve-Path $RepoPath).Path
$srcFull = [IO.Path]::GetFullPath($source).TrimEnd('\','/')
$dstFull = [IO.Path]::GetFullPath($target).TrimEnd('\','/')
$srcPrefix = $srcFull + [IO.Path]::DirectorySeparatorChar
$dstPrefix = $dstFull + [IO.Path]::DirectorySeparatorChar
if ($srcFull.Equals($dstFull, [StringComparison]::OrdinalIgnoreCase) -or
    $srcFull.StartsWith($dstPrefix, [StringComparison]::OrdinalIgnoreCase) -or
    $dstFull.StartsWith($srcPrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Папки исходника и Git-репозитория не должны совпадать или находиться одна внутри другой.'
}
if (-not (Test-Path (Join-Path $target '.git'))) { throw "В $target нет .git. Укажите корень клонированного репозитория." }
if (-not (Test-Path (Join-Path $source 'frontend/src/App.jsx'))) { throw 'Не найден прототип frontend/src/App.jsx.' }
$gitRoot = (& git -C $target rev-parse --show-toplevel).Trim()
if ($LASTEXITCODE -ne 0 -or ([IO.Path]::GetFullPath($gitRoot).TrimEnd('\','/') -ne [IO.Path]::GetFullPath($target).TrimEnd('\','/'))) {
    throw 'Нужен именно корень репозитория, а не вложенная папка.'
}
$state = & git -C $target status --porcelain --untracked-files=all
if ($LASTEXITCODE -ne 0) { throw 'Не удалось получить git status.' }
if ($state) { throw "В репозитории есть незакоммиченные или новые файлы. Сначала сохраните их.\n$state" }
$backup = 'backup/lab7-before-prototype'
$feature = 'feature/lab7-prototype-tests'
$existing = & git -C $target branch --list $backup $feature
if ($existing) { throw "Ветки $backup или $feature уже существуют. Не перезаписываем их; выберите другой репозиторий или переименуйте ветки вручную." }
Write-Host "ИСТОЧНИК:  $source"
Write-Host "РЕПОЗИТОРИЙ: $target"
Write-Host "БАЗОВАЯ ВЕТКА: $BaseBranch"
Write-Host "БУДЕТ СОЗДАНА РЕЗЕРВНАЯ ВЕТКА: $backup"
Write-Host "ИМПОРТ ТОЛЬКО В: $feature"
Write-Host 'Старые backend/frontend/scripts и workflows заменяются только В НОВОЙ ВЕТКЕ; существующие docs и другие файлы остаются.'
Write-Host 'Папка .git, dev/main и история коммитов остаются без изменений.'
if (-not $Apply) {
    Write-Host 'Это предварительный просмотр. Для применения повторите команду с -Apply.'
    exit 0
}
& git -C $target fetch origin
if ($LASTEXITCODE -ne 0) { throw 'git fetch завершился с ошибкой.' }
& git -C $target switch $BaseBranch
if ($LASTEXITCODE -ne 0) { throw "Не удалось перейти в $BaseBranch" }
& git -C $target pull --ff-only origin $BaseBranch
if ($LASTEXITCODE -ne 0) { throw 'Не удалось обновить базовую ветку без merge. Остановлено.' }
if (& git -C $target status --porcelain --untracked-files=all) { throw 'Рабочая копия изменилась после pull.' }
& git -C $target branch $backup
if ($LASTEXITCODE -ne 0) { throw 'Не удалось создать резервную ветку.' }
& git -C $target switch -c $feature
if ($LASTEXITCODE -ne 0) { throw 'Не удалось создать feature-ветку.' }
& git -C $target rm -r --ignore-unmatch -- backend frontend scripts .github/workflows .husky
if ($LASTEXITCODE -ne 0) { throw 'Не удалось подготовить замену каталогов приложения в feature-ветке.' }
$excluded = @('.git', 'node_modules', 'dist', 'build', '.gradle', '.local-tools', 'reports', 'coverage', 'test-results', 'playwright-report', '__pycache__')
$robocopyArgs = @($source, $target, '/E', '/R:1', '/W:1', '/NFL', '/NDL', '/XD') + $excluded + @('/XF', '*.pyc')
& robocopy @robocopyArgs | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy: ошибка копирования $LASTEXITCODE" }
& git -C $target add -A
if ($LASTEXITCODE -ne 0) { throw 'git add не выполнен.' }
& git -C $target diff --cached --check
if ($LASTEXITCODE -ne 0) { throw 'git diff обнаружил проблемы форматирования.' }
& git -C $target diff --cached --stat
Write-Host ''
Write-Host 'Готово: изменения подготовлены ТОЛЬКО в новой feature-ветке.'
Write-Host 'Ещё не выполнены коммит, push или merge. Проверьте дифф и запускайте тесты.'
Write-Host 'После npm install в frontend добавьте сформированный package-lock.json.'
