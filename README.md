# Culinary Craft — лабораторная №5 (исправленная CI/CD-версия)

> **Важно:** это доработка исходного проекта лабораторной №5, а не замена репозитория. Настройки `.git` и история Git **не включены** в ZIP и должны остаться от твоего существующего клона. Код приложения расширен небольшим, действительно проверяемым каталогом рецептов: для полноценной курсовой архитектура затем развивается отдельно.

## Что изменилось

- `backend/` — Java 21 / Spring Boot 4.1.2 / Gradle; небольшой REST API рецептов и unit + HTTP integration tests. Пока без БД, чтобы тесты были воспроизводимы в CI.
- `frontend/` — React / Vite; поиск, категории и избранное; unit + UI integration tests.
- `.github/workflows/quality-ci.yml` — проверки каждого push и PR, подробно сохраняет результаты Backend, Frontend, Metrics и итоговый Quality Gate.
- `.github/workflows/commit-check.yml` — автоматическая проверка Conventional Commits для PR.
- `.github/workflows/release.yml` — семантический тег **только коммита из `main` после успешного CI**; публикация GitHub Release. Повторный прогон того же коммита новый тег не создаёт.
- `scripts/collect_metrics.py` — подсчёт покрытия, тестов, Checkstyle/ESLint, Git-коммитов и (если доступен токен) GitHub CI/PR метрик.
- `scripts/stage_local_reports.py` — сбор локальных Java-отчётов для запуска аналитики на компьютере.
- `docs/АУДИТ_ЛР5.md` — сравнение с первоначальной лабораторной, ошибки, исправления и ограничения.
- **`GUIDE_GITHUB_RU.md`** — подробная инструкция безопасного обновления существующего репозитория через `feature` → `dev` → `main`.

## Локальный запуск в VS Code (Windows PowerShell)

Требования: **JDK 21**, **Node.js 22**, Git, Python 3.9+ (для дополнительных метрик). Gradle устанавливать не надо: есть wrapper.

```powershell
# Установить корневой Husky/commitlint (один раз)
npm ci

# Фронтенд
cd frontend
npm ci
npm run lint
npm run format:check
npm run test:ci
npm run build
npm run dev
```

Фронтенд: http://localhost:5173. Во втором терминале:

```powershell
cd backend
.\gradlew.bat clean check bootJar
.\gradlew.bat bootRun
```

Пример API: http://localhost:8080/api/recipes, поиск `?query=сыр`, категории `?category=Ужин`.

**Покрытие: где смотреть локально**

- Java: `backend/build/reports/jacoco/test/html/index.html`, XML рядом; Gradle `check` проверяет минимальное покрытие строк 50%.
- React: `frontend/reports/frontend/coverage/index.html`, JSON/LCOV рядом; `npm run test:ci` выводит проценты в консоли и проверяет минимальные 60% строк, функций, операторов.
- Java-тесты: `backend/build/reports/tests/test/index.html` и `backend/build/test-results/test/*.xml`.
- React-тесты: `frontend/reports/frontend/tests/junit.xml`.
- Статический анализ: `backend/build/reports/checkstyle/`, `frontend/reports/frontend/static/eslint.json` (для JSON нужен `npm run lint:ci`, предварительно создать папку).

Сводные метрики локально после команд выше:

```powershell
# из корня репозитория
python scripts/stage_local_reports.py
python scripts/collect_metrics.py --backend-dir reports/backend --frontend-dir frontend/reports/frontend --output-dir reports/summary --stage M5-testing
```

Итог: `reports/summary/summary.md`, `metrics.csv`, `metrics.json`, `test-cases.csv`, `static-issues.csv`, `git-commits.csv`, `stage-snapshot.csv`. Папки с генерируемыми отчётами внесены в `.gitignore`.

## GitHub Actions — где преподавателю показывать

1. **Actions → Quality CI → последний запуск → Summary**: проценты строк и ветвей, число тестов, ошибки статического анализа, коммиты и сводка по CI.
2. **Jobs → Backend**: Checkstyle, подробный список JUnit-тестов и JaCoCo coverage gate.
3. **Jobs → Frontend**: ESLint, Prettier, Vitest с покрытием, сборка Vite.
4. **Artifacts** внизу запуска: скачать `backend-quality-report`, `frontend-quality-report`, `quality-metrics-...`.
5. Внутри артефактов есть папки `tests/`, `static/`, `coverage/`, `build/` и `metrics.csv/json`.
6. **Releases**: тег/релиз, автоматически созданный только после успешного CI при слиянии в `main`.

## Этапы и история измерений

Снимок метрик собирается **на каждом push/PR**. В конце этапа запусти **Actions → Quality CI → Run workflow** на ветке `main` и выбери `M1-prototype`, `M2-infrastructure`, `M3-backend`, `M4-frontend`, `M5-testing` или `M6-release`. В артефакте `quality-metrics-.../stage-snapshot.csv` будет однозначная запись этапа, SHA и показателей. Старые этапы нельзя восстановить задним числом: их нужно замерять фактически в моменты завершения.

## Ограничения

- Это лабораторная по **процессу разработки**, а не полный бизнес-продукт из лабораторной №6. API и React здесь используются как реальные объекты тестирования; фронтенд пока на демонстрационных данных и не связан с API.
- Настройки **Settings → Rules → Rulesets** и **Settings → Actions** невозможно сохранить в исходниках; они настраиваются вручную в GitHub по `GUIDE_GITHUB_RU.md`.
- В скачанном архиве нет результатов живого GitHub Actions-прогона этой версии. Проценты появляются **после исполнения** тестов, ничего не подставляется вручную.
