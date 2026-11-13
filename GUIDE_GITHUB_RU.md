# Безопасное обновление существующего репозитория culinary-craft

Это подробная инструкция для **Windows, VS Code, PowerShell**. Твоя история коммитов, `.git`, существующие ветки и удалённый `origin` сохраняются. **Не делай `git init` заново, не удаляй `.git`, не делай `git push --force`, не копируй ZIP поверх `main` без отдельной ветки.**

## 0. Подготовка и резервная точка

1. Скачай архив с исправленным проектом и распакуй его, например, в `D:\Downloads\culinary-craft-lab5-fixed`.
2. Открой в VS Code **свой существующий локальный репозиторий** `culinary-craft`, который раньше уже был подключён к `https://github.com/asakkyy/culinary-craft`.
3. В терминале PowerShell в корне своего репозитория выполни:

```powershell
git status
git remote -v
git branch -a
git fetch origin --prune
```

Убедись, что есть `origin`, `main`, `dev` и нет незакоммиченных нужных изменений. Если `git status` показывает изменения, **не стирай их**: сделай отдельную резервную копию каталога или сначала закончи текущую работу отдельным коммитом. Инструкция ниже предполагает чистое состояние.

Создай резервную ветку от текущего состояния, затем переходи в `dev`:

```powershell
git branch backup/lab5-before-quality
git switch dev
git pull --ff-only origin dev
git switch -c feature/lab5-quality
```

Если `git switch dev` говорит, что локальной ветки нет, используй `git switch -c dev --track origin/dev`, после чего выполняй `git switch -c feature/lab5-quality`. Если `git pull --ff-only` отказывается из-за расхождения истории, не применяй `reset --hard`: сначала изучи `git log --oneline --graph --all -20`.

## 1. Скопировать исходники без повреждения .git

В открытом корне **существующего** репозитория (не внутри папки ZIP) выполни:

```powershell
$src = 'D:\Downloads\culinary-craft-lab5-fixed'  # измени на свой путь к распакованному ZIP
$dst = (Get-Location).Path
robocopy $src $dst /E /XD .git node_modules build dist .gradle reports __pycache__ /XF *.pyc
if ($LASTEXITCODE -gt 7) { throw "Ошибка Robocopy: $LASTEXITCODE" }
```

**Важно:** `robocopy /E` копирует новые и изменённые файлы, но **не удаляет** файлы, удалённые в исправленной версии. Поэтому **удали только** три устаревших workflow и дублирующий Java-тест:

```powershell
Remove-Item '.github\workflows\auto-tag.yml' -ErrorAction SilentlyContinue
Remove-Item '.github\workflows\backend-ci.yml' -ErrorAction SilentlyContinue
Remove-Item '.github\workflows\frontend-ci.yml' -ErrorAction SilentlyContinue
Remove-Item 'backend\src\test\java\com\culinarycraft\backend\BackendApplicationTests.java' -ErrorAction SilentlyContinue
Remove-Item 'backend\src\test\java\backend\BackendApplicationTests.java' -ErrorAction SilentlyContinue
```

Если оставишь `auto-tag.yml`, **два** механизма могут одновременно создать тег. Если оставишь старые CI-файлы, будешь получать дублирующиеся workflow с противоречивыми настройками.

Убедись, что всё правильно:

```powershell
git status --short
git diff --stat
git diff --check
```

Никакие папки `.git` или твои удалённые ветки не затрагиваются. Не нужно копировать `node_modules`, `build`, `.gradle`: они автоматически восстановятся.

## 2. Проверка локально

Нужны JDK **21** (`java -version`), Node.js **22** (`node -v`) и npm (`npm -v`). Из корня:

```powershell
npm ci
cd frontend
npm ci
npm run lint
npm run format:check
npm run test:ci
npm run build
cd ..\backend
.\gradlew.bat clean check bootJar
cd ..
```

Если JDK 17 — установить/выбрать JDK 21, не понижать toolchain Gradle. Если npm зависит от интернета — сначала разреши ему скачать зависимости, версия из `package-lock.json` должна совпасть. Если `npm ci` выдаёт ошибку, **не коммить**, сначала исправь её.

Локально открой HTML-отчёты:

- `backend\build\reports\jacoco\test\html\index.html`
- `backend\build\reports\tests\test\index.html`
- `frontend\reports\frontend\coverage\index.html`

Чтобы получить сводку метрик **на своём ПК**:

```powershell
python scripts/stage_local_reports.py
python scripts/collect_metrics.py --backend-dir reports/backend --frontend-dir frontend/reports/frontend --output-dir reports/summary --stage M5-testing
```

Получишь `reports\summary\summary.md`, таблицу `metrics.csv`, детализацию `test-cases.csv`, `static-issues.csv`. Это генерируемые файлы, они правильно игнорируются Git. Метрики GitHub API могут показать `N/A` локально — это нормально без токена.

## 3. Коммит и Pull Request в dev

Убедись, что в VS Code активна **`feature/lab5-quality`**, а не `main`:

```powershell
git branch --show-current
git add -A
git diff --cached --check
git diff --cached --stat
git commit -m "feat(ci): add quality reports and gated releases"
git push -u origin feature/lab5-quality
```

На коммите сработают локальные Husky `pre-commit` и `commit-msg`. Они могут занять время: сначала React-тесты и линтер, затем Gradle. Если ошибка — исправь её, повтори `git add -A` и `git commit`. Не используй `--no-verify` только ради того, чтобы пропустить проверки.

Открой `https://github.com/asakkyy/culinary-craft/pulls` → **New pull request**. Выбери:

- **base:** `dev`
- **compare:** `feature/lab5-quality`

Подожди завершения `Quality CI` и `Commit Check`. Открой **Actions → Quality CI → Summary**: там должна быть сводная таблица. Внизу раздела **Artifacts** должны появиться:

- `backend-quality-report` — `static/checkstyle`, `tests`, `coverage`, `build` (JAR);
- `frontend-quality-report` — `static`, `tests`, `coverage`, `build/dist`;
- `quality-metrics-...` — `summary.md`, `metrics.csv/json`, `test-cases.csv`, `static-issues.csv`, `stage-snapshot.csv`, `git-commits.csv`.

Если проверки красные, разверни упавший job, исправь локально и сделай **новый** коммит `fix(ci): ...` в ту же ветку. GitHub обновит PR автоматически. После зелёных проверок используй **Squash and merge** (сообщение squash в Conventional Commits, например `feat(ci): improve quality monitoring`).

## 4. Подготовить main к обязательным проверкам

Когда новый `Quality CI` хотя бы раз отработает, GitHub начнёт предлагать его check name в ruleset. В настройках репозитория (нужны права владельца) открой:

**Settings → Rules → Rulesets → New ruleset → New branch ruleset**.

Имя, например, `protect-main`; Target branches → включить `main`. Включи:

1. `Require a pull request before merging`.
2. `Require status checks to pass` → выбрать **`Quality Gate`** из Quality CI и **`Conventional Commits`** из Commit Check (иногда в списке они отображаются в формате `Workflow / Job`; выбирай фактические названия последнего прогона).
3. `Block force pushes` и `Restrict deletions`.
4. Опционально `Require branches to be up to date before merging`.

Сохрани активный ruleset. Для `dev` можно создать отдельное правило, тоже требующее PR/Quality Gate. **Не включай неизвестные bypass-права**, которые позволяют себе обходить все проверки, если хочешь показать реальную защиту преподавателю.

Если бесплатный тариф или тип репозитория не позволяет применить требуемую настройку, нужно прямо сообщить преподавателю о фактическом ограничении: наличие YAML не заменяет ruleset. В публичных репозиториях GitHub Free правила обычно доступны. [Документация GitHub Rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository).

## 5. Перенос dev → main и выпуск релиза

После merge первой PR открой **второй PR**:

- **base:** `main`
- **compare:** `dev`

Дождись успешных `Quality CI` и `Commit Check`, затем смержи PR. После этого GitHub выполнит три действия:

1. `Quality CI` на `main`: Checkstyle/JUnit/JaCoCo, ESLint/Prettier/Vitest, собирает JAR и dist, выводит метрики.
2. `Quality Gate` завершается успехом только если все нужные части прошли.
3. **После** успешного push-CI в `main` запускается отдельный `Release (main only, after green CI)` и создаёт новую версию `vX.Y.Z` (major от BREAKING CHANGE/`!`, minor от `feat:`, иначе patch), аннотированный тег и GitHub Release.

Посмотри `Actions → Release (main only, after green CI)` и `Code → Releases`. При повторном запуске CI **на том же** коммите новый тег не создаётся.

### Что означает «тег только из main»

Workflow жёстко проверяет: событие `push`, ветка `main`, исходный репозиторий, зелёный CI и равенство протестированного SHA с текущим HEAD `origin/main`. Поэтому **автоматический** релиз не может уйти с `dev` или непроверенного кода. Но владелец репозитория по-прежнему технически может вручную создать `git tag` на другой ветке. Для строгого серверного запрета нужны отдельные **tag rulesets** с допустимыми создателями, не блокирующие `github-actions[bot]`.

Рекомендую сначала проверить автоматический релиз. Затем в **Settings → Rules → Rulesets → New tag ruleset** для `v*` включить запрет удаления и обновления тегов. Пункт **Restrict creations** включай только если можешь настроить разрешение для того участника/приложения, от имени которого workflow создаёт тег; иначе **сломается сам автоматический релиз**. Серверный запрет ручных тегов не следует обещать без отдельно проверенного правила доступа.

Если `release.yml` падает с `403 Resource not accessible by integration`, зайди в **Settings → Actions → General → Workflow permissions**, проверь доступность `contents: write` для workflow и правила репозитория. В исходниках уже указан минимально необходимый `contents: write` именно для release job; не требуется персональный токен в коде.

## 6. Снимки метрик в конце этапов

После завершения каждой вехи по графику:

1. Открой **Actions → Quality CI**.
2. Нажми **Run workflow**.
3. Выбери ветку `main` и `stage = M1...M6` по соответствующему этапу.
4. После запуска скачай `quality-metrics-...` и сохрани `stage-snapshot.csv` как доказательство замера на дату этапа.

Метрики не создаются задним числом для уже прошедших этапов. Для отчёта можно добавить отдельную таблицу план/факт и скриншоты этих запусков. Не надо вручную придумывать якобы прошлые проценты покрытия.

## 7. Чек-лист демонстрации преподавателю

Покажи: историю PR `feature → dev → main`; активный ruleset с required checks; зелёный `Quality CI` с 4 jobs; Summary с покрытием; backend и frontend test logs; скачанные `test-cases.csv` и `static-issues.csv`; JaCoCo/Vitest `index.html`; JAR/dist в Artifacts; `git-commits.csv` и `stage-snapshot.csv`; автоматический GitHub Release из `main`.

**Откат, если что-то пошло не так:** ничего не форсить. Пока не смерджено, исправления изолированы в `feature/lab5-quality`. Можно вернуться в `dev` командой `git switch dev`; резервная ветка `backup/lab5-before-quality` указывает на исходный локальный коммит. Если PR уже смержен, использовать штатный **Revert** в GitHub (создаёт новый коммит) вместо переписывания истории.
