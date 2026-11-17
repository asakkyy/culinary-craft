# Culinary Craft

Учебное приложение: React 18/Vite + Spring Boot 3.5.7 + PostgreSQL 17.
Рецепты, отзывы, избранное и аккаунты сохраняются в PostgreSQL. Ветка
`feature/accounts-and-moderation` реализует этап I — Auth & Security.
Редактирование профиля, аватары, загрузка фотографий, жалобы, административные
блокировки и аудит пока не реализованы. Не считайте весь сектор завершённым.

## Аккаунты и сессия

Новая миграция V3 расширяет существующую таблицу пользователей, сохраняя ID и
все связи. Старые пользователи имеют статус LEGACY без email и пароля; войти
под ними нельзя. Новые ID начинаются с 1001. Регистрация не передаёт новым
аккаунтам старые рецепты и всегда создаёт USER, даже если клиент прислал роль.
Заголовок `X-Demo-User` больше не аутентифицирует запросы.

API: `POST /api/auth/register` (201), `POST /api/auth/login`, `GET /api/auth/me`,
`POST /api/auth/logout`, `GET /api/auth/csrf`. Формы доступны на `/register`,
`/login` и через кнопку аккаунта. Защищённые маршруты направляют гостя на вход.
Пароль регистрации: 12–64 символа и не более 72 байт UTF-8; BCrypt cost 12.
Email уникален без учёта регистра. API не возвращает хеши.

JWT подписывается HS256 библиотекой Nimbus/Spring Security, живёт 30 минут,
проверяет issuer `culinary-craft`, audience `culinary-browser`, подпись и время.
Хранится только в HttpOnly SameSite=Strict cookie `/api`, не в localStorage.
Каждый запрос проверяет статус аккаунта и token_version в БД. Выход отзывает
все ранее выданные сессии аккаунта. Refresh token пока не реализован.
POST/PUT/DELETE требуют CSRF: клиент получает маскированный токен через
`/api/auth/csrf` и передаёт его в `X-XSRF-TOKEN`; JWT cookie не отменяет CSRF.

До `bootRun` в том же PowerShell задайте случайный ключ (не коммитьте его):

```powershell
$keyBytes = New-Object byte[] 48
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($keyBytes)
$rng.Dispose()
$env:JWT_SECRET = [Convert]::ToBase64String($keyBytes)
$env:COOKIE_SECURE = 'false' # Только локальный HTTP; по умолчанию true, нужен HTTPS.
```

Сохраняйте ключ в защищённом окружении для перезапусков. Смена ключа отзывает
все JWT. Без JWT_SECRET backend намеренно не запускается. Для первого ADMIN
однократно включите `BOOTSTRAP_ADMIN=true`, задайте `ADMIN_EMAIL` и
`ADMIN_PASSWORD` (16–64 символа, для BCrypt используйте ASCII). Не публикуйте
эти значения и не вводите пароль в отслеживаемые файлы. Инициализация защищена
транзакционной advisory lock и создаёт новый ADMIN только при отсутствии
активного администратора; существующие USER не повышаются. Затем уберите
bootstrap-переменные из окружения. Публичного API назначения ADMIN нет.

Ограничения этого этапа: нет подтверждения email, восстановления пароля,
ограничителя попыток входа и пользовательского управления сессиями. Статус
BLOCKED уже учитывается валидатором JWT, но API/UI блокировки относится к этапу IV.
Не выставляйте учебный сервер в Интернет без дальнейшей защиты.

JUnit генерирует случайный JWT_SECRET только для тестового процесса. Playwright
генерирует собственный ключ и пароль bootstrap-admin и требует отдельный
`E2E_DB_URL`. Он не должен указывать на пользовательскую БД. Для каждого
локального E2E-прогона используйте свежую тестовую базу; CI получает свежий service.
Например, перед `npm.cmd run test:e2e` задайте JDBC URL отдельной базы в
`$env:E2E_DB_URL`. Настоящие ключи и пароли не нужны в GitHub Secrets для тестов.

## Окружение

- Windows, PowerShell, Git, JDK 17 или 21, Node.js 22 и npm.
- Docker Desktop с запущенным Linux engine и Docker Compose v2.
- Python 3 нужен только для скриптов сводных метрик.
- Gradle устанавливать отдельно не нужно: используется wrapper из `backend/`.

В PowerShell можно использовать `npm.cmd`/`npx.cmd`, если политика выполнения
блокирует `npm.ps1`. Все команды ниже начинаются из корня репозитория.

## Локальный запуск

```powershell
npm.cmd ci                           # Husky и commitlint, однократно
docker compose up -d --wait postgres
docker compose ps
```

PostgreSQL доступен только на `127.0.0.1:5432`. Данные лежат в именованном Docker
volume `postgres_data`. В первом терминале:

```powershell
Set-Location backend
.\gradlew.bat bootRun
```

Во втором терминале из корня:

```powershell
Set-Location frontend
npm.cmd ci
npm.cmd run dev
```

Открыть http://127.0.0.1:5173. Проверка backend:

```powershell
Invoke-RestMethod http://127.0.0.1:8080/api/health
```

`storage` теперь возвращает `POSTGRESQL`; остальные ключи health и контракт
рецептов сохранены. Без работающей БД backend не запускается.

## Переменные окружения

| Переменная | По умолчанию | Назначение |
| --- | --- | --- |
| `DB_URL` | `jdbc:postgresql://127.0.0.1:5432/culinary_craft` | JDBC URL backend |
| `DB_USERNAME` | `culinary_demo` | Пользователь backend и Compose |
| `DB_PASSWORD` | `culinary_demo_local` | Явно демонстрационный локальный пароль |
| `POSTGRES_DB` | `culinary_craft` | Имя создаваемой Compose базы |
| `POSTGRES_PORT` | `5432` | Локальный порт Compose |

Переопределять переменные можно в PowerShell перед запуском Compose и backend:

```powershell
$env:POSTGRES_PORT = '5433'
$env:DB_URL = 'jdbc:postgresql://127.0.0.1:5433/culinary_craft'
# При необходимости задайте DB_USERNAME и DB_PASSWORD локально в этом терминале.
docker compose up -d --wait postgres
Set-Location backend
.\gradlew.bat bootRun
```

При смене имени базы или порта меняйте также `DB_URL`. Переменные окружения
передаются дочерним процессам, но не другим уже открытым терминалам. Compose
читает `.env`; Spring Boot сам по себе этот файл не читает. `.env` исключён из Git.
Настройки `POSTGRES_*` создают пользователя и базу только при первом запуске с
пустым volume: изменение переменных не меняет пароль уже существующей БД.
Демонстрационные значения подходят только для локальной учебной среды.

## Схема и миграции

Выбран Flyway: для небольшой схемы удобны обычные SQL-миграции, которые можно
прочитать и объяснить на защите. Spring Boot применяет их перед проверкой JPA.
Hibernate настроен на `ddl-auto=validate`, а не создание или изменение таблиц.

- `V1__create_persistence_schema.sql`: пользователи, рецепты, упорядоченные
  ингредиенты/шаги/теги, отзывы и избранное; внешние ключи, CHECK, UNIQUE и индексы.
- `V2__seed_demo_content.sql`: три прежних демо-пользователя, десять рецептов
  (восемь опубликованы), исходные отзывы и избранное.

Миграции выполняются один раз, их история хранится в `flyway_schema_history`.
Повторный старт не восстанавливает удалённые рецепты и не перезаписывает изменения.
Уже применённые миграции не редактируют: следующие изменения оформляют как `V3`,
`V4` и т. д. Данные старого in-memory процесса автоматически перенести невозможно.

Записи сервисов транзакционны. Изменение, удаление, модерация, отзыв и переключение
избранного блокируют строку рецепта на время транзакции. Отзывы и избранное имеют
уникальные пары пользователя и рецепта; удаление рецепта удаляет связанные записи.
Существующие DTO и REST-маршруты сохранены. Фильтрация, сортировка и пагинация пока
остаются в Java после чтения рецептов из БД: этого достаточно для учебного объёма;
SQL-пагинация и оптимизация количества запросов относятся к следующему улучшению.

## Проверка сохранения данных

1. Под Анной создайте рецепт, под Мариной одобрите его.
2. Добавьте рецепт в избранное и оставьте отзыв; запомните URL рецепта.
3. Остановите backend через Ctrl+C и снова выполните `.\gradlew.bat bootRun`.
4. Откройте тот же URL: рецепт, рейтинг, отзыв и избранное должны сохраниться.
5. Можно остановить PostgreSQL через `docker compose stop postgres`, затем
   запустить его через `docker compose up -d --wait postgres` и повторить проверку.

`docker compose down` сохраняет volume. Не используйте `down -v` для обычной
остановки: этот флаг удаляет данные базы.

## Автоматические проверки

Backend из `backend/`:

```powershell
.\gradlew.bat clean check bootJar
.\gradlew.bat test --tests 'com.culinarycraft.api.RecipeApiIntegrationTest'
```

JUnit использует Testcontainers с настоящим `postgres:17-alpine`, production
миграции и отдельные временные базы. Docker должен работать; локальный Compose
для JUnit не требуется. Тесты не переключаются на H2 и не пропускаются без Docker.
Версия Testcontainers закреплена на 1.21.4 через BOM Spring Boot: она исправляет
несовместимость Docker API 1.32 из версии 1.21.3 с новыми Docker engines в CI.
Сервисные/API-тесты изолированы откатом транзакций; отдельные тесты проверяют
конкурентные записи, ограничения БД, каскадное удаление и два последовательных
старта Spring-приложения с одной базой.

Frontend из `frontend/`:

```powershell
npm.cmd run lint
npm.cmd run test:ci
npm.cmd run build
```

E2E: сначала из корня запустите PostgreSQL, затем из `frontend/`:

```powershell
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

Playwright сам запускает backend/frontend и использует настоящую БД. Он создаёт
рецепт в выбранной локальной базе; для изоляции можно задать отдельный Compose
project/базу и соответствующий `DB_URL`. Не используйте серверы другого проекта
на 8080/5173. В CI JUnit использует Testcontainers, а E2E — отдельный PostgreSQL service.

Пороги сохранены: JaCoCo — 35% строк; Vitest — 30% строк/выражений/функций.
Отчёты: `backend/build/reports/`, `frontend/reports/frontend/`,
`frontend/playwright-report/`. Quality Gate по-прежнему требует успешных backend,
frontend, E2E и metrics. Release workflow не изменён.

Подход к миграциям и тестовым контейнерам соответствует
[документации Spring Boot](https://docs.spring.io/spring-boot/3.5/how-to/data-initialization.html)
и [service connections](https://docs.spring.io/spring-boot/3.5/reference/testing/testcontainers.html).
