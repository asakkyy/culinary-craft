# AGENTS.md — Culinary Craft

> Постоянные инструкции для Codex и других coding-агентов, работающих с этим репозиторием.
> Последняя сверка с рабочей веткой `feature/postgresql-persistence`: 17.11.2026.
> Обновление ветки `feature/profiles-media-moderation`: этапы II–IV — профили, медиа, администрация.
> Старые упоминания демо-входа ниже относятся к историческому интерфейсу:
> X-Demo-User больше не доверяется. Актуальные правила этого этапа описаны ниже и в README.

## Аккаунты: актуальные правила этапа I

- Spring Security и Nimbus JWT; одна схема входа — HttpOnly cookie, CSRF обязателен.
- JWT_SECRET обязателен, Base64 минимум 32 случайных байта; COOKIE_SECURE=true по умолчанию.
- Новый V3 расширяет demo_users. Старые ID сохранены, LEGACY не имеют паролей.
- /api/auth/register, login, me, logout, csrf; регистрация всегда USER, BCrypt cost 12.
- Каждый JWT проверяется по статусу и token_version в БД; logout отзывает все сессии.
- Первый ADMIN создаётся только через BOOTSTRAP_ADMIN/ADMIN_EMAIL/ADMIN_PASSWORD.
- Клиент не хранит токен в localStorage; удалён выбор демо-ролей, добавлены формы и защита маршрутов.
- Playwright требует E2E_DB_URL отдельной свежей БД, сам генерирует тестовые секреты.
- Реализованы настройки `/settings`, аватары, фото рецептов, собственные жалобы `/reports`
  и панель `/admin` (жалобы, пользователи, аудит; повторное использование модерации).
- V4 создаёт media_files, V5 — жалобы/аудит и данные блокировки. V1–V3 не изменять.
- ProfileService принимает только ID из JWT; смена email требует пароля, смена пароля отзывает JWT.
- MediaService хранит метаданные в БД, ImageStorage — PNG на диске MEDIA_ROOT (по умолчанию backend/data/media).
  Только PNG/JPEG до 5 МБ, 4096px/12MP, повторное кодирование. UUID вместо пользовательских имён.
  При rollback новый файл удаляется; старый — после commit. Не удаляй пользовательские файлы в тестах.
- Фото неопубликованного рецепта доступно только автору/ADMIN; изменение фото возвращает PENDING.
- AdministrationService: типизированные жалобы, уникальные активные причины, максимум 5 в час,
  приватность заявителя, блокировка строки для решений. Внутренние комментарии скрыты от заявителя.
- Списки администрирования используют SQL-фильтрацию/пагинацию (максимум 50), DTO PageView.
- Блокировка/разблокировка меняют token_version. Запрещены самоблокировка и потеря последнего ADMIN.
- AuditService пишет административные события в той же транзакции; публичных изменений аудита нет.
- Тесты используют Testcontainers и временный MEDIA_ROOT; E2E_DB_URL только отдельной свежей БД.
- Поля status/avatar_url/updated_at/token_version — основа следующих этапов.
> Если содержимое этого файла расходится с текущим кодом, конфигурацией или заданием пользователя, сначала проверь актуальные файлы и сообщи о расхождении. Не выдавай старое описание за текущее состояние.

## 1. Контекст и цель проекта

**Culinary Craft** — учебный полнофункциональный прототип кулинарного веб-приложения (справочник и сообщество рецептов) для дисциплины «Конструирование программного обеспечения».

GitHub: https://github.com/asakkyy/culinary-craft

Типичное локальное расположение на Windows: `D:\projects\culinary-craft-lab7`. Это пример пути пользователя, а не абсолютное требование; определи действительный корень по `.git` и содержимому рабочей папки.

Разработка выполнялась поэтапно:
- **ЛР №5 — инфраструктура разработки:** Git и ветвление, Conventional Commits, Husky/commitlint, GitHub Actions, проверки качества, сбор метрик, теги и GitHub Releases.
- **ЛР №6 — прототип приложения:** React UI + Spring Boot REST API, каталог, подробная карточка рецепта, профиль, избранное, отзывы, создание/редактирование и модерация.
- **ЛР №7 — автоматизированное тестирование:** JUnit 5, Spring Boot Test/MockMvc, Vitest, React Testing Library, Playwright, JaCoCo/V8 coverage, HTML/XML/JSON/CSV отчёты и CI quality gate.

Учебное приложение использует настоящую авторизацию Spring Security/JWT и PostgreSQL. Для production ещё нужны эксплуатационное усиление, подтверждение email, восстановление доступа и ограничение попыток входа; не называй учебный сервер полностью production-ready.

Главные цели будущих изменений:
1. Продолжать развивать **существующий** проект, а не создавать ещё один «Culinary Craft» с нуля.
2. Сохранять работоспособность всех уже реализованных функций.
3. Поддерживать воспроизводимые сборки, тесты, Git-историю и объяснимость изменений для защиты лабораторных/курсовой.
4. Выполнять конкретные задания пользователя; новые технологии и крупные архитектурные переделки — только при явном запросе.

## 2. Актуальный технологический стек

Проверяй версии по реальным `build.gradle`, `package.json`, lock-файлам и workflow — они важнее старых отчётов.

| Часть | Текущее состояние |
| --- | --- |
| Backend | Java, Spring Boot **3.5.7**, Gradle (Groovy DSL), Spring Web, Validation, Spring Data JPA |
| Java compatibility | `sourceCompatibility`/`targetCompatibility`: **Java 17**; GitHub CI использует **JDK 21** |
| Backend test/quality | JUnit 5, Spring Boot Test, MockMvc, Testcontainers PostgreSQL, Checkstyle, JaCoCo |
| Frontend | React **18**, React Router **6**, Vite **6**, JavaScript/JSX |
| Frontend API/state | Axios, React Context (`AppContext`), HttpOnly JWT cookie + CSRF |
| Frontend test/quality | Vitest **3**, React Testing Library, Playwright + Chromium, ESLint, Prettier, V8 coverage |
| Automation | GitHub Actions, Husky, Commitlint, Python-скрипты метрик |
| Storage | PostgreSQL **17**, Spring Data JPA, SQL-миграции Flyway; локально Docker Compose |
| Auth | Spring Security/Nimbus JWT, BCrypt, роли USER/ADMIN, статус и token_version в БД |

Числа версий здесь — снимок текущего состояния, а не указание запрещать целевые обновления, если пользователь явно запросит миграцию.

## 3. Карта репозитория

Ориентируйся на реальную структуру рабочей ветки:

```text
culinary-craft/
├── AGENTS.md                         # этот файл
├── README.md                         # актуальный запуск PostgreSQL, backend, frontend и проверки
├── compose.yaml                      # локальный PostgreSQL и постоянный Docker volume
├── package.json                      # корневые Husky / commitlint
├── commitlint.config.js
├── .husky/
│   ├── pre-commit
│   └── commit-msg
├── .github/workflows/
│   ├── quality-ci.yml                # backend, frontend, E2E, metrics, Quality Gate
│   ├── commit-check.yml              # проверка Conventional Commits на PR
│   └── release.yml                   # тег и GitHub Release после green CI на main
├── backend/
│   ├── build.gradle
│   ├── gradlew / gradlew.bat
│   ├── config/checkstyle/checkstyle.xml
│   └── src/
│       ├── main/java/com/culinarycraft/
│       │   ├── CulinaryCraftApplication.java
│       │   ├── api/                   # RecipeController, DemoController, обработка ошибок
│       │   ├── config/                # CORS
│       │   ├── model/                 # Recipe, RecipeRequest/View, Review, DemoUser
│       │   ├── persistence/           # JPA entities, Spring Data repositories, RecipeStore
│       │   └── service/               # RecipeService, DemoUserService
│       ├── main/resources/application.properties
│       ├── main/resources/db/migration/ # Flyway: схема и однократные демо-данные
│       └── test/java/com/culinarycraft/
│           ├── api/RecipeApiIntegrationTest.java
│           └── service/               # RecipeServiceTest, RecipeScenariosTest
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── playwright.config.js
│   ├── index.html
│   ├── src/
│   │   ├── App.jsx / main.jsx
│   │   ├── api/client.js
│   │   ├── context/AppContext.jsx
│   │   ├── components/               # Layout, RecipeCard, CoverImage
│   │   ├── pages/                    # Catalog, Recipe, Profile, Editor, Moderation
│   │   └── test/                     # helpers и настройка тестов
│   └── tests/e2e/user-journeys.spec.js
└── scripts/                           # метрики, версии релиза, утилиты запуска
```

Файлы `*.test.jsx` расположены рядом с компонентами/страницами. Не предполагай наличие старых исходников `backend/src/main/java/backend/`: они относились к предыдущей самостоятельной реализации ЛР5 и после интеграции не должны вновь появляться.

## 4. Архитектура и потоки данных

Схема: браузер → React/Vite → Axios API client → `/api/*` → Spring MVC controllers → транзакционные сервисы → JPA/RecipeStore → PostgreSQL.

**Frontend**
- `App.jsx` объявляет маршруты.
- `Layout.jsx` содержит общую навигацию, аватар и доступ к форме входа/выхода.
- `context/AppContext.jsx` хранит текущего пользователя, состояние сессии, уведомления и сигнал обновления данных.
- `api/client.js` — **единая точка HTTP-запросов**. Axios использует `/api` и CSRF для мутаций; X-Demo-User не отправляется и не доверяется.
- В режиме разработки Vite проксирует `/api` на `http://127.0.0.1:8080`.
- Не дублируй базовые URL, HTTP-логику и обработку ошибок в страницах без необходимости.

Маршруты приложения: `/`, `/recipes/:id`, `/recipes/:id/edit`, `/create`, `/profile`, `/favorites`, `/moderation`, а также страница 404.

**Backend**
- `CulinaryCraftApplication` — главный `@SpringBootApplication`, пакет `com.culinarycraft`.
- `api/RecipeController` — HTTP-контракт рецептов, валидация `@Valid` у входящих данных.
- `api/DemoController` — `/api/health` и исторический список только LEGACY (не список реальных аккаунтов).
- `service/RecipeService` — основная бизнес-логика; операции записи транзакционны и блокируют строку рецепта через `PESSIMISTIC_WRITE`.
- `persistence/RecipeStore` — преобразование JPA entities в существующие records; репозитории обеспечивают хранение рецептов, отзывов и избранного.
- `service/DemoUserService` — роли и проверки доступа для RecipeService; текущий ID поступает из проверенного JWT, не из заголовка.
- Flyway создаёт схему и однократно добавляет начальные данные. Hibernate использует `ddl-auto=validate`; не заменяй миграции автоматическим `update`/`create`.
- Поиск, сортировка и пагинация пока выполняются сервисом в Java после чтения рецептов; это ограничение учебного объёма, не SQL-пагинация.
- `model/` — Java records, request/view-модели.
- `api/ApiErrorHandler` — формат ошибок API.

Не смешивай HTTP-слой и бизнес-логику: новые проверки и правила предметной области размещай в сервисах, а тестируй на соответствующем уровне.

## 5. Текущее поведение и бизнес-правила

Роли: USER/ADMIN. Исторические пользователи LEGACY без возможности входа:
- ID `1` — **Анна Петрова**, `USER`.
- ID `2` — **Максим Еремин**, `USER`.
- ID `3` — **Марина Волкова**, `ADMIN`.
- Гость — без действующей cookie-сессии. X-Demo-User не даёт прав.
- Новые аккаунты создаются регистрацией; первый ADMIN — только серверной bootstrap-инициализацией из окружения.

Жизненный цикл рецепта:
- Создание пользователем → `PENDING`.
- Модератор (`ADMIN`) может установить `APPROVED` либо `REJECTED` для ожидающего рецепта.
- Публичный каталог содержит **только `APPROVED`**.
- Черновик/неопубликованный рецепт доступен его автору или администратору; для посторонних — 404.
- Изменение рецепта автором/администратором снова отправляет рецепт на модерацию (`PENDING`).
- Удаление и редактирование разрешены владельцу либо администратору.
- Избранное и отзывы доступны выбранному пользователю; гость не может менять данные.
- Избранное и отзывы разрешены только для опубликованных рецептов.
- Один пользователь может оставить **не более одного отзыва на рецепт**.
- Рейтинг вычисляется из отзывов; поиск, категории, сортировка и пагинация реализованы сервером.
- Данные, включая созданные рецепты, отзывы и избранное, **сохраняются после перезапуска backend и PostgreSQL** при сохранении Docker volume.
- Начальные данные добавляются миграцией один раз. Не восстанавливай их при каждом запуске и не меняй уже применённые миграции: добавляй следующую версию.
- Уникальные пары в БД запрещают повторный отзыв/избранное; внешние ключи и каскадное удаление очищают связанные данные рецепта.

Существующие категории: `Завтраки`, `Основные блюда`, `Десерты`, `Салаты`, `Супы`, `Напитки`. Если меняешь категории, синхронно обновляй валидацию backend, UI и тесты.

## 6. REST API — сохранять совместимость

Базовый адрес локально: `http://127.0.0.1:8080`.

| Метод | Endpoint | Назначение |
| --- | --- | --- |
| GET | `/api/health` | статус прототипа |
| GET | `/api/users/demo` | список демо-пользователей |
| GET | `/api/recipes` | каталог (`search`, `category`, `sort`, `page`, `size`) |
| GET | `/api/recipes/{id}` | карточка |
| GET | `/api/recipes/mine` | собственные рецепты |
| GET | `/api/recipes/favorites` | избранное |
| GET | `/api/recipes/pending` | очередь модерации (ADMIN) |
| POST | `/api/recipes` | создать рецепт |
| PUT | `/api/recipes/{id}` | редактировать |
| DELETE | `/api/recipes/{id}` | удалить |
| POST | `/api/recipes/{id}/favorite` | переключить избранное |
| GET | `/api/recipes/{id}/reviews` | отзывы |
| POST | `/api/recipes/{id}/reviews` | оставить отзыв |
| POST | `/api/recipes/{id}/moderate` | принять/отклонить (`{"status":"APPROVED"}` или `REJECTED`) |

Каталог возвращает объект с `content`, `total`, `page`, `size`, `totalPages`. По умолчанию `page=0`, `size=6`; сервис ограничивает размер страницы максимумом 30.

Тела создания и изменения — `RecipeRequest` с ограничениями Jakarta Validation. **Не ломай существующие имена полей и эндпоинтов** без согласования с пользователем и соответствующего обновления клиента/тестов.

## 7. Среда и локальные команды (Windows PowerShell)

Предпочтительная среда пользователя: **Windows + VS Code + PowerShell**.
Предпосылки: JDK 17 или 21, Node.js 22, npm, Git, Docker Desktop с Linux engine и Compose v2; Python 3 при работе с метриками. Для Gradle используется wrapper из `backend/`, отдельная установка Gradle не нужна. Если PowerShell блокирует `npm.ps1`, используй `npm.cmd` и `npx.cmd`.

Перед backend из корня запусти PostgreSQL:
```powershell
docker compose up -d --wait postgres
```
Переменные backend: `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`. Compose также использует `POSTGRES_DB` и `POSTGRES_PORT`; при изменении порта/имени базы синхронно меняй `DB_URL`. Значения по умолчанию в `compose.yaml` — только локальные демонстрационные. Инструкции и особенности существующего volume находятся в README. Не используй `docker compose down -v` для обычной остановки: это удаляет данные.

Из корня репозитория (однократная установка корневых git hooks):
```powershell
npm ci
```

Backend — запуск в собственном терминале:
```powershell
cd backend
.\gradlew.bat bootRun
```

Frontend — в **другом** терминале:
```powershell
cd frontend
npm install
npm run dev
```

Открыть `http://127.0.0.1:5173`. Backend health: `http://127.0.0.1:8080/api/health`.

В некоторых версиях проекта frontend lock-файл мог отличаться от backend/root. Если `frontend/package-lock.json` есть и соответствует `package.json`, для воспроизводимой установки предпочтительно `npm ci`; если его нет, сначала `npm install`, а потом отдельно решить вопрос о включении lock-файла в репозиторий.

## 8. Проверки и критерии готовности

**Backend** (из `backend/`):
```powershell
.\gradlew.bat clean check bootJar
```
Эта команда включает JUnit integration tests, Checkstyle, JaCoCo coverage verification и сборку JAR. JUnit использует Testcontainers с настоящим PostgreSQL 17 и production Flyway-миграциями; нужен запущенный Docker, Compose для этих тестов не требуется. Без Docker тесты должны завершаться ошибкой, а не пропускаться. Сервисные/API-тесты изолируются rollback; отдельные проверки используют committed transactions, проверяют конкурентные записи, ограничения и повторный старт приложения с той же БД.
- Java coverage: минимальный порог **35% строк** в `backend/build.gradle`.
- JUnit HTML: `backend/build/reports/tests/test/index.html`
- JaCoCo HTML: `backend/build/reports/jacoco/test/html/index.html`
- Checkstyle: `backend/build/reports/checkstyle/`

Для диагностики конкретного интеграционного теста:
```powershell
.\gradlew.bat test --tests "com.culinarycraft.api.RecipeApiIntegrationTest"
```
При ошибке `Unable to find a @SpringBootConfiguration` проверь пакет теста и главный класс `com.culinarycraft.CulinaryCraftApplication` вместо сокрытия ошибки отключением тестов.

**Frontend** (из `frontend/`):
```powershell
npm run lint
npm run test:ci
npm run build
```
- Vitest использует jsdom и React Testing Library; JUnit XML: `frontend/reports/frontend/tests/vitest-junit.xml`.
- HTML coverage: `frontend/reports/frontend/coverage/index.html`.
- Порог coverage в `vite.config.js`: **30% lines/statements/functions**.

**End-to-end Playwright** (из `frontend/`):
```powershell
npx playwright install chromium
npm run test:e2e
```
- Конфигурация автоматически запускает backend (`bootRun`) и frontend (`npm run dev`) по необходимости.
- Перед E2E нужен PostgreSQL: локально `docker compose up -d --wait postgres`, в CI отдельный service в job `e2e`. E2E записывает данные в выбранную БД.
- Проверяет реальный браузер и реальные HTTP-запросы.
- Если уже работающие серверы на 8080/5173 принадлежат другому проекту, закрой их перед тестированием.
- HTML-отчёт: `frontend/playwright-report/index.html`; JUnit XML: `frontend/reports/frontend/tests/playwright-junit.xml`.
- Ключевые пользовательские сценарии: поиск/открытие рецепта гостем, запрет гостю на создание/модерацию, создание автором → одобрение админом → публикация.

Проверки должны соответствовать изменению: маленькая правка документации не требует безусловно часового E2E, но изменение API, маршрута, бизнес-правил или роли требует подходящих unit/integration/component/E2E проверок. Перед PR в `main` ориентируйся на **все обязательные CI jobs**.

**Не скрывай красные тесты**, не убирай их из конфигурации и не понижай coverage-пороги ради зелёной сборки. Сообщай о невозможности запустить тесты и о причинах (нет JDK, Node, доступа в сеть и т. д.). Не выдумывай фактическое число пройденных тестов или проценты покрытия.

## 9. Git, ветки, Pull Requests, CI/CD

Основные ветки: `main` (интегрированная проверенная версия) и `dev` (разработка). Функциональные ветки: `feature/*`, исправления: `fix/*`, техработы: `chore/*`, тесты: `test/*`, документация: `docs/*` (если принята такая схема).

**Важно:** после интеграционного PR `feature/lab7-integrate-main -> main` ветка `dev` могла отставать/расходиться с `main`. Исторический PR `dev -> main` был заменён интеграционным PR. **Не повторяй его merge автоматически.**

Перед предложением новой ветки:
1. Запроси/проверь `git status`, текущую ветку, `git fetch origin`.
2. Сравни `origin/main` и `origin/dev`; не предполагай, что они синхронизированы.
3. Если `dev` расходится с `main`, предложи безопасную синхронизацию через PR **без** force push, либо временно создавай отдельную feature-ветку от актуального `main` по согласованию.
4. Не переключай ветки при конфликтующих незакоммиченных изменениях; ничего не сбрасывай молча.

**Никогда без отдельного явного разрешения пользователя:**
- создавать Git-коммиты, делать `git push`, создавать/сливать/закрывать PR;
- делать `git reset --hard`, `git clean -fd`, `git push --force`, опасный rebase;
- удалять ветки, теги, релизы, пользовательские файлы;
- менять branch protection/rulesets, отключать CI, обходить Husky или git hooks;
- устанавливать новые сервисы или изменять существенную архитектуру.

Обычные правки рабочих файлов разрешены, если пользователь **прямо поручил реализацию**, но сначала оцени масштаб и покажи итоговый diff.

Conventional Commits:
- `feat: add ...`
- `fix(backend): ...`
- `test(frontend): ...`
- `docs: ...`
- `refactor: ...`
- `chore: ...`
- Для удаления устаревших Markdown-файлов обычно `docs: ...`, но сохраняй `README.md` и этот `AGENTS.md` без отдельного решения пользователя.

CI:
- `.github/workflows/quality-ci.yml` запускается на push, PR и вручную; jobs `backend`, `frontend`, `e2e`, `metrics`, `quality-gate`.
- `backend` запускает PostgreSQL через Testcontainers; `e2e` получает отдельный PostgreSQL service. Все прежние обязательные проверки и пороги сохранены.
- `.github/workflows/commit-check.yml` контролирует формат PR-коммитов.
- `.github/workflows/release.yml` реагирует на **успешный Quality CI от push в `main`**, сверяет SHA с текущим `main`, затем создаёт семантический тег и GitHub Release через `scripts/next_release.py`.
- Артефакты могут включать `backend-quality-report`, `frontend-quality-report`, `browser-e2e-report`, `quality-metrics-*`.
- Не утверждай, что релиз появился, пока не проверил соответствующий GitHub Actions run и Releases.

Если меняешь CI, оцени последствия для Quality Gate, публикуемых отчётов, правил веток и релизов. Не упрощай pipelines только ради быстрого прохождения.

## 10. Правила изменения кода

- Сначала осмотри **только относящиеся к задаче файлы**, затем внеси минимальные необходимые изменения.
- Не пересоздавай проект, не переносись без запроса на TypeScript/Next.js/Angular, Java 21-only, JWT, PostgreSQL, Docker или микросервисы.
- Поддерживай текущие API-маршруты, DTO, правила ролей, HTTP-коды, состояния `PENDING`/`APPROVED`/`REJECTED`.
- Для backend соблюдай текущие Java-пакеты `com.culinarycraft.*`; не возвращай старый пакет `backend.*` из ЛР5.
- Для frontend придерживайся существующего React Router/Context/Axios подхода и интерфейса. Используй доступные компоненты, а не дублируй их.
- Добавляй/корректируй тесты рядом с новой логикой. Для API-изменений проверь и client, и backend.
- Не форматируй весь репозиторий при локальном изменении; избегай нерелевантных diff.
- Не меняй настройки линтеров/покрытия/релиза без технического обоснования.
- Не добавляй в Git `node_modules/`, `build/`, `backend/bin/`, `dist/`, HTML-отчёты тестов, `.env`, секреты и токены. Перед коммитом проверяй `.gitignore` и `git diff --cached`.
- Любые внешние изображения, пользовательские данные, постоянное хранение и загрузку файлов согласовывай отдельно.

## 11. Как отвечать владельцу проекта

Язык взаимодействия: **русский**. Пользователь обычно работает через VS Code на Windows и ценит пошаговые объяснения, точные PowerShell-команды и полные примеры для защиты лабораторных.

При реализации задачи сообщай:
1. Что было изменено и зачем.
2. Какие файлы затронуты (пути).
3. Как запустить и проверить результат **на Windows**.
4. Какие проверки реально выполнены, с результатом, а какие не удалось запустить.
5. На что обратить внимание при демонстрации преподавателю.
6. Какие Git-действия ещё нужны; выполняй их только по явному разрешению.

Для больших фич сначала дай краткий план и риски; для простой правки — действуй без лишней бюрократии. Если требования неполны, предлагай консервативное решение, не ломающее текущий код.

## 12. Первое знакомство Codex с репозиторием

По запросу пользователя «изучи проект»:
- Открой `AGENTS.md`, затем связанные с вопросом файлы `README.md`, Gradle/npm, CI, frontend/backend.
- `README.md` описывает PostgreSQL и локальный запуск: **проверяй реальный код, а не слепо доверяй описанию**.
- Прочитай `git status`, текущую ветку и последние коммиты; не изменяй их.
- Кратко опиши архитектуру и обнаруженные технические риски.
- Без прямого поручения **не меняй код, не создавай коммиты и не отправляй изменения**.

Это действующий учебный проект. Цель агента — аккуратно помогать его развивать, сохраняя уже выполненные лабораторные, тесты и GitHub CI/CD.
