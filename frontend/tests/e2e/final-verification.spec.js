import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import { database } from './database';

const password = () => process.env.CC_E2E_ADMIN_PASSWORD;
const mailpit = process.env.E2E_MAILPIT_URL || 'http://127.0.0.1:8025';
let marker;
let people;
let administrator;
let administratorCookies;
async function mutate(request, path, data, method = 'post') {
  const csrf = await (await request.get('/api/auth/csrf')).json();
  return request[method](path, { data, headers: { 'X-XSRF-TOKEN': csrf.token } });
}
async function login(page, email) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Пароль', { exact: true }).fill(password());
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page.getByRole('button', { name: /Меню аккаунта/ })).toBeVisible();
}
async function inbox(request, email) {
  const all = await (await request.get(mailpit + '/api/v1/messages')).json();
  return all.messages.filter((message) => message.To.some((to) => to.Address === email));
}
async function verificationLink(request, email) {
  let messages;
  await expect
    .poll(
      async () => {
        messages = await inbox(request, email);
        return messages.length;
      },
      { timeout: 15000 },
    )
    .toBeGreaterThan(0);
  const message = await (await request.get(mailpit + '/api/v1/message/' + messages[0].ID)).json();
  const link = message.Text.match(/http:\/\/127\.0\.0\.1:5173\/verify-email#token=[A-Za-z0-9_-]+/)?.[0];
  if (!link) throw new Error('Local verification link was not found');
  return link;
}
test.beforeAll(async ({ request }) => {
  marker = 'Audit-' + randomUUID().slice(0, 8);
  administrator = 'moderator-' + randomUUID() + '@e2e.invalid';
  people = await database(async (client) => {
    const users = await client.query(
      `insert into demo_users(name,role,initials,subtitle,email,password_hash,status,token_version,registered_at,updated_at,email_verified_at)
      select $1 || ' ' || lpad(n::text,3,'0'), 'USER','А','', $2 || n || '@e2e.invalid',password_hash,'ACTIVE',0,
      current_timestamp - n*interval '1 hour',current_timestamp,current_timestamp
      from demo_users cross join generate_series(1,55) n where email='admin@e2e.invalid' returning id,name,email`,
      [marker, marker.toLowerCase()],
    );
    await client.query('update demo_users set email=$1 where id=$2', [
      'long'.repeat(50) + '.' + marker.toLowerCase() + '@e2e.invalid',
      users.rows[0].id,
    ]);
    users.rows[0].email = 'long'.repeat(50) + '.' + marker.toLowerCase() + '@e2e.invalid';
    await client.query(
      `insert into recipe_reports(reporter_id,recipe_id,recipe_title,reason,description,status,created_at)
      select id,1,repeat('Длинное название рецепта ',3),'OTHER',repeat('Описание нарушения. ',40),'OPEN',current_timestamp - interval '2 days'
      from demo_users where name like $1`,
      [marker + '%'],
    );
    // A separate test administrator keeps the real login limits independent of the other suites.
    await client.query(
      `insert into demo_users(name,role,initials,subtitle,email,password_hash,status,token_version,registered_at,updated_at,email_verified_at)
      select 'Модератор проверки','ADMIN','М','',$1,password_hash,'ACTIVE',0,current_timestamp,current_timestamp,current_timestamp
      from demo_users where email='admin@e2e.invalid'`,
      [administrator],
    );
    return users.rows;
  });
  const session = await mutate(request, '/api/auth/login', { email: administrator, password: password() });
  expect(session.ok()).toBe(true);
  administratorCookies = (await request.storageState()).cookies;
});

test('V01 — email: явная отправка, другая вкладка, повторный вход и смена адреса', async ({ page, context }) => {
  test.setTimeout(60000);
  const identity = randomUUID();
  const email = identity + '-email@e2e.invalid';
  await page.goto('/register');
  await page.getByLabel('Имя', { exact: true }).fill('Проверка подтверждения');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Пароль', { exact: true }).fill(password());
  await page.getByRole('button', { name: 'Создать аккаунт' }).click();
  await expect(page).toHaveURL(/resend-verification/);
  expect(await inbox(page.request, email)).toHaveLength(0);
  await page.reload();
  await expect(page.getByLabel('Email аккаунта')).toHaveValue(email);
  expect(await inbox(page.request, email)).toHaveLength(0);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Войти', exact: true })).toBeVisible();
  await login(page, email);
  await expect(page).toHaveURL(/:5173\/$/);
  await expect(page.getByRole('link', { name: 'Подтвердить email', exact: true })).toHaveCount(0);
  expect(await inbox(page.request, email)).toHaveLength(0);
  await page.goto('/profile');
  await page.getByRole('link', { name: 'Отправить письмо для подтверждения' }).click();
  await page.getByRole('button', { name: 'Отправить письмо', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Отправить письмо', exact: true })).toBeDisabled();
  const link = await verificationLink(page.request, email);
  expect((await (await mutate(page.request, '/api/auth/verification/request', { email })).json()).message).toContain('Если адрес');
  expect(await inbox(page.request, email)).toHaveLength(1);
  const old = await context.newPage();
  await old.goto('/resend-verification');
  await page.goto(link);
  await page.getByRole('button', { name: 'Подтвердить email', exact: true }).click();
  await expect(page).toHaveURL(/profile$/);
  await old.bringToFront();
  await expect(old).toHaveURL(/profile$/);
  await old.close();
  for (const route of ['/verify-email', '/resend-verification']) {
    await page.goto(route);
    await expect(page).toHaveURL(/profile$/);
  }
  await page.goto('/login');
  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Войти', exact: true })).toBeVisible();
  await login(page, email);
  expect((await (await page.request.get('/api/auth/me')).json()).emailVerified).toBe(true);
  const replacement = identity + '-replacement@e2e.invalid';
  await page.goto('/settings');
  await page.getByLabel('Новый email').fill(replacement);
  await page.getByLabel('Пароль для смены email').fill(password());
  await page.getByRole('button', { name: 'Сохранить email' }).click();
  await expect(page.locator('.settings-page .info-note')).toContainText('не подтверждён');
  expect(await inbox(page.request, replacement)).toHaveLength(0);
  expect((await mutate(page.request, '/api/recipes/1/favorite')).status()).toBe(403);
  await page.goto('/resend-verification');
  await page.getByRole('button', { name: 'Отправить письмо', exact: true }).click();
  await page.goto(await verificationLink(page.request, replacement));
  await page.getByRole('button', { name: 'Подтвердить email', exact: true }).click();
  await expect(page).toHaveURL(/profile$/);
  const current = await (await page.request.get('/api/auth/me')).json();
  expect(current.email).toBe(replacement);
  expect(current.emailVerified).toBe(true);
});

test('V02 — старый email, logout и одноразовость ссылок проверяются сервером', async ({ page, browser }) => {
  const identity = randomUUID();
  const email = identity + '-old@e2e.invalid';
  const replacement = identity + '-new@e2e.invalid';
  expect((await mutate(page.request, '/api/auth/register', { name: 'Устаревшие ссылки', email, password: password() })).status()).toBe(201);
  await mutate(page.request, '/api/auth/login', { email, password: password() });
  await mutate(page.request, '/api/auth/verification/request', { email });
  const oldLink = await verificationLink(page.request, email),
    token = new URLSearchParams(new URL(oldLink).hash.slice(1)).get('token');
  await mutate(page.request, '/api/account/email', { email: replacement, currentPassword: password() }, 'put');
  await mutate(page.request, '/api/account/email', { email, currentPassword: password() }, 'put');
  expect((await mutate(page.request, '/api/auth/verification/confirm', { token })).status()).toBe(400);
  await mutate(page.request, '/api/account/email', { email: replacement, currentPassword: password() }, 'put');
  await mutate(page.request, '/api/auth/verification/request', { email: replacement });
  const beforeLogout = await verificationLink(page.request, replacement);
  await mutate(page.request, '/api/auth/logout');
  await page.goto(beforeLogout);
  await page.getByRole('button', { name: 'Подтвердить email', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('недействительна');
  // A public request made after logout binds its link to the current session version.
  const finalEmail = identity + '-guest@e2e.invalid';
  await mutate(page.request, '/api/auth/login', { email: replacement, password: password() });
  await mutate(page.request, '/api/account/email', { email: finalEmail, currentPassword: password() }, 'put');
  await mutate(page.request, '/api/auth/logout');
  await mutate(page.request, '/api/auth/verification/request', { email: finalEmail });
  const guestLink = await verificationLink(page.request, finalEmail);
  const guest = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' });
  try {
    const p = await guest.newPage();
    await p.goto(guestLink);
    await p.getByRole('button', { name: 'Подтвердить email', exact: true }).click();
    await expect(p).toHaveURL(/login$/);
    await expect(p.locator('main').getByRole('status')).toContainText('Email подтверждён');
    const raw = new URLSearchParams(new URL(guestLink).hash.slice(1)).get('token');
    expect((await mutate(p.request, '/api/auth/verification/confirm', { token: raw })).status()).toBe(400);
  } finally {
    await guest.close();
  }
});

test('V03 — жалоба без описания, дубликат, отказ, приватность и аудит', async ({ page, browser }) => {
  await login(page, people[1].email);
  await page.goto('/recipes/1');
  await page.getByRole('button', { name: 'Пожаловаться', exact: true }).click();
  await page.getByRole('button', { name: 'Отправить жалобу' }).click();
  await expect(page.getByRole('dialog')).toContainText('Модератор рассмотрит');
  await page.getByRole('button', { name: 'Понятно' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Пожаловаться', exact: true }).click();
  await page.getByRole('button', { name: 'Отправить жалобу' }).click();
  await expect(page.getByRole('alert')).toContainText('уже рассматривается');
  const own = (await (await page.request.get('/api/reports')).json()).content.find((r) => r.reason === 'SPAM');
  expect(own.description).toBe('');
  const admin = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' });
  try {
    const p = await admin.newPage();
    await admin.addCookies(administratorCookies);
    await p.goto('/admin?section=reports&search=' + people[1].email);
    const row = p
      .locator('tbody tr')
      .filter({ hasText: '#' + own.id })
      .first();
    await row.getByRole('button', { name: 'Рассмотреть' }).click();
    await p.getByLabel('Решение', { exact: true }).selectOption('REJECTED');
    await p.getByLabel(/Комментарий к жалобе/).fill('Служебная заметка теста');
    await p.getByRole('button', { name: 'Сохранить решение' }).click();
    await p.getByRole('button', { name: 'Подтвердить решение' }).click();
    await expect(p.getByRole('dialog')).toHaveCount(0);
    expect((await (await p.request.get('/api/recipes/1')).json()).status).toBe('APPROVED');
    const audit = await (await p.request.get('/api/admin/audit?action=REPORT_REJECTED')).json();
    expect(audit.content.some((e) => e.targetId === own.id)).toBe(true);
  } finally {
    await admin.close();
  }
  const response = await (await page.request.get('/api/reports/' + own.id)).json();
  expect(response.status).toBe('REJECTED');
  expect(response.moderatorComment).toBeNull();
  expect((await page.request.get('/api/admin/users')).status()).toBe(403);
});

test('V04 — реальные 55 пользователей, размеры 10/20/50, фильтры, сортировка и reload', async ({ page }) => {
  await page.context().addCookies(administratorCookies);
  await page.goto('/admin?section=users&search=' + marker + '&role=USER&sort=name,asc');
  await expect(page.locator('tbody tr')).toHaveCount(10);
  await expect(page.locator('.table-pagination')).toContainText('Всего: 55');
  const first = await page.locator('tbody tr').allTextContents();
  await page.getByRole('button', { name: 'Далее', exact: true }).click();
  await expect(page).toHaveURL(/page=1/);
  await expect(page.locator('tbody tr').first()).not.toContainText(first[0]);
  for (const size of [20, 50, 10]) {
    await page.getByLabel('Строк на странице').selectOption(String(size));
    await expect(page.locator('tbody tr')).toHaveCount(size);
  }
  await page.reload();
  await expect(page.getByRole('searchbox')).toHaveValue(marker);
  await expect(page.getByLabel('Роль', { exact: true })).toHaveValue('USER');
  await expect(page.locator('tbody tr')).toHaveCount(10);
  await page.getByLabel('Сортировка', { exact: true }).selectOption('name,asc');
  const rows = await (await page.request.get('/api/admin/users?search=' + marker + '&role=USER&sort=name,asc&size=50')).json();
  expect(rows.content.map((u) => u.name)).toEqual([...rows.content.map((u) => u.name)].sort());
  await page.getByLabel('Роль', { exact: true }).selectOption('ADMIN');
  await expect(page.locator('tbody tr')).toHaveCount(0);
  await expect(page.getByText('Записей не найдено')).toBeVisible();
});

test('V05 — создание, редактирование, фотографии и избранное через реальные API', async ({ page, browser }) => {
  await login(page, people[4].email);
  await page.goto('/create');
  const title = 'Авторский рецепт ' + marker;
  await page.getByLabel(/Название рецепта/).fill(title);
  await page.getByLabel(/Краткое описание/).fill('Проверяем сохранение изменений, фотографию и публикацию авторского рецепта');
  await page.getByRole('textbox', { name: 'Ингредиент 1' }).fill('Овощи — 200 г');
  await page.getByRole('textbox', { name: 'Шаг 1' }).fill('Подготовить и приготовить овощи');
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 20;
    c.height = 20;
    c.getContext('2d').fillRect(0, 0, 20, 20);
    return c.toDataURL().split(',')[1];
  });
  const file = { name: 'test.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') };
  await page.getByLabel('Фотография рецепта', { exact: true }).setInputFiles(file);
  await page.getByRole('button', { name: 'Отправить рецепт' }).click();
  await expect(page).toHaveURL(/recipes\/\d+$/);
  const id = page.url().split('/').pop();
  const image = await page.locator('.detail-cover img').getAttribute('src');
  const guest = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' });
  expect((await guest.request.get(image)).status()).toBe(404);
  await guest.close();
  const admin = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' });
  await admin.addCookies(administratorCookies);
  try {
    expect((await mutate(admin.request, '/api/recipes/' + id + '/moderate', { status: 'APPROVED' })).status()).toBe(200);
    await page.reload();
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(page.getByRole('button', { name: 'В избранном', exact: true })).toBeVisible();
    await page.goto('/favorites');
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    await page.goto('/recipes/' + id + '/edit');
    await page.getByLabel(/Название рецепта/).fill(title + ' — новая версия');
    await page.getByLabel('Фотография рецепта', { exact: true }).setInputFiles(file);
    await page.getByRole('button', { name: 'Сохранить изменения' }).click();
    await expect(page).toHaveURL(new RegExp('recipes/' + id + '$'));
    await expect(page.getByRole('heading', { level: 1 })).toContainText('новая версия');
    expect(await page.locator('.detail-cover img').getAttribute('src')).not.toBe(image);
    expect((await (await page.request.get('/api/recipes/' + id)).json()).status).toBe('PENDING');
    await mutate(admin.request, '/api/recipes/' + id + '/moderate', { status: 'APPROVED' });
    const audit = await (await admin.request.get('/api/admin/audit?action=RECIPE_APPROVED')).json();
    expect(audit.content.some((e) => e.targetId === Number(id))).toBe(true);
  } finally {
    await admin.close();
  }
});

test('V06 — сложные состояния, контраст, семантика, меню и диалоги на четырёх ширинах', async ({ page }) => {
  test.setTimeout(120000);
  const runtime = [];
  page.on('pageerror', (e) => runtime.push(e.message));
  await page.context().addCookies(administratorCookies);
  for (const width of [375, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/admin?section=users&search=' + marker + '&size=50');
    await expect(page.locator('tbody tr')).toHaveCount(50);
    expect(
      await page
        .locator('tbody tr')
        .first()
        .evaluate((row) => row.getBoundingClientRect().height),
    ).toBeLessThan(300);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(accessibility.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual([]);
    await page.goto('/admin?section=reports&status=OPEN&sort=createdAt,asc&search=' + marker);
    if (width === 375) {
      for (const size of [20, 50, 10]) {
        await page.getByLabel('Строк на странице').selectOption(String(size));
        await expect(page.locator('tbody tr')).toHaveCount(size);
      }
      await expect(page.locator('.table-pagination')).toContainText('Всего: 55');
      await page.getByRole('button', { name: 'Далее', exact: true }).click();
      await expect(page).toHaveURL(/page=1/);
      await expect(page.locator('tbody tr')).toHaveCount(10);
      await page.reload();
      await expect(page.getByLabel('Фильтр статуса', { exact: true })).toHaveValue('OPEN');
      await expect(page.getByLabel('Сортировка', { exact: true })).toHaveValue('createdAt,asc');
    }
    await page.getByRole('button', { name: 'Рассмотреть', exact: true }).first().click();
    await page.getByText('Загружаем сведения о рецепте…', { exact: true }).waitFor({ state: 'hidden' });
    const dialog = page.getByRole('dialog');
    expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    const modalA11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(modalA11y.violations.map((v) => v.id)).toEqual([]);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /Меню аккаунта/ }).click();
    await expect(page.getByRole('menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.route('**/api/admin/reports?**', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Тестовый сервер временно недоступен' }),
      }),
    );
    await page.reload();
    await expect(page.getByRole('alert')).toBeVisible();
    await page.unroute('**/api/admin/reports?**');
  }
  await page.goto('/');
  await page.locator('#catalog').scrollIntoViewIfNeeded();
  const y = await page.evaluate(() => scrollY);
  await page.getByLabel('Сортировка:').selectOption('quick');
  expect(await page.evaluate(() => scrollY)).toBeGreaterThanOrEqual(y - 10);
  expect(runtime).toEqual([]);
});

test('V07 — отсутствие фото, ошибка изображения, пустые таблицы и восстановление после ошибки отзывов', async ({ page }) => {
  await login(page, people[6].email);
  const recipe = await (await page.request.get('/api/recipes/1')).json();
  await page.route('**/api/recipes/1', (route) =>
    route.fulfill({ json: { ...recipe, title: 'Очень длинное название домашнего рецепта '.repeat(2), imageUrl: '' } }),
  );
  for (const width of [375, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/recipes/1');
    await expect(page.locator('.detail-cover .cover-fallback')).toBeVisible();
    if (width === 375) {
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      expect(result.violations.map((violation) => violation.id)).toEqual([]);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.unroute('**/api/recipes/1');
  await page.route('**/api/recipes/1', (route) => route.fulfill({ json: { ...recipe, imageUrl: '/images/intentionally-missing.png' } }));
  await page.route('**/api/recipes/1/reviews', (route) => route.fulfill({ status: 503, json: { message: 'Отзывы временно недоступны' } }));
  await page.reload();
  await expect(page.locator('.detail-cover img')).toBeHidden();
  await expect(page.getByRole('alert')).toContainText('Отзывы временно недоступны');
  await page.unroute('**/api/recipes/1/reviews');
  await page.getByRole('button', { name: 'Повторить загрузку отзывов' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.unroute('**/api/recipes/1');
  await page.goto('/login');
  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Войти', exact: true })).toBeVisible();
  await page.context().addCookies(administratorCookies);
  await page.route('**/api/admin/**', (route) => route.fulfill({ json: { content: [], total: 0, page: 0, size: 10, totalPages: 0 } }));
  for (const section of ['reports', 'users', 'audit']) {
    await page.goto('/admin?section=' + section);
    await expect(page.getByText('Записей не найдено')).toBeVisible();
    await expect(page.locator('.table-pagination')).toContainText('Всего: 0');
  }
});
