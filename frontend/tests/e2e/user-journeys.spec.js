import { test, expect } from '@playwright/test';

async function mailLink(request, email, path) {
  const base = process.env.E2E_MAILPIT_URL || 'http://127.0.0.1:8025';
  let id;
  await expect.poll(async () => {
    const data = await (await request.get(`${base}/api/v1/messages`)).json();
    id = data.messages.find(message => message.To.some(recipient => recipient.Address === email)
      && (path === 'verify-email' ? message.Subject.includes('email') : message.Subject.includes('пароля')))?.ID;
    return Boolean(id);
  }, { timeout: 15000 }).toBe(true);
  const message = await (await request.get(`${base}/api/v1/message/${id}`)).json();
  return message.Text.match(new RegExp(`http://127\\.0\\.0\\.1:5173/${path}#token=[A-Za-z0-9_-]+`))[0];
}
async function verifyMailbox(page, email) {
  await page.goto(await mailLink(page.request, email, 'verify-email'));
  await page.getByRole('button', { name: 'Подтвердить email', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Email подтверждён');
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Выйти', exact: true })).toBeVisible();
}

test('CSRF обязателен для входа, повреждённая сессия не даёт доступ', async ({ request }) => {
  const csrf = await request.get('/api/auth/csrf');
  expect(csrf.headers()['set-cookie']).toContain('SameSite=Strict');
  expect(csrf.headers()['set-cookie']).toContain('HttpOnly');
  expect((await request.post('/api/auth/login', { data: { email: 'nobody@e2e.invalid', password: 'wrong' } })).status()).toBe(403);
  const response = await request.get('/api/auth/me', { headers: { Cookie: 'cc-session=broken' } });
  expect(response.status()).toBe(401);
  expect(await response.json()).toEqual({ message: 'Session expired, please sign in again' });
});
test('Жалоба, решение, аудит и блокировка действующей сессии', async ({ page, browser }) => {
  const suffix = Date.now(); const email = `reporter${suffix}@e2e.invalid`;
  await page.goto('/register');
  await page.getByLabel('Имя', { exact: true }).fill(`Заявитель ${suffix}`);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Пароль', { exact: true }).fill('Report password 12345');
  await page.getByRole('button', { name: 'Создать аккаунт' }).click();
  await expect(page.getByRole('button', { name: 'Выйти', exact: true })).toBeVisible();
  await verifyMailbox(page, email);
  await page.goto('/recipes/1');
  await page.getByRole('button', { name: 'Пожаловаться', exact: true }).click();
  await page.getByLabel('Описание жалобы').fill(`Проверка жалобы в браузере ${suffix}`);
  await page.getByRole('button', { name: 'Отправить жалобу' }).click();
  await expect(page.locator('.toast')).toHaveText(/Жалоба отправлена/);
  await page.goto('/reports'); await expect(page.getByText(/Спам · Открыта/)).toBeVisible();
  const adminContext = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' });
  try {
    const admin = await adminContext.newPage(); admin.on('dialog', dialog => dialog.accept());
    await admin.goto('/login');
    await admin.getByLabel('Email', { exact: true }).fill('admin@e2e.invalid');
    await admin.getByLabel('Пароль', { exact: true }).fill(process.env.CC_E2E_ADMIN_PASSWORD);
    await admin.getByRole('button', { name: 'Войти', exact: true }).click();
    await expect(admin.getByRole('button', { name: 'Выйти', exact: true })).toBeVisible();
    await admin.goto('/admin');
    await admin.getByRole('textbox', { name: 'Административный поиск' }).fill(email);
    const report = admin.locator('article').filter({ hasText: `Заявитель ${suffix}` });
    await report.locator('textarea').fill('Проверено администратором');
    await report.getByRole('button', { name: 'Закрыть жалобу' }).click();
    await expect(report).toContainText('Закрыта');
    await page.reload(); await expect(page.getByText(/Спам · Закрыта/)).toBeVisible();
    await admin.getByRole('button', { name: 'Аудит', exact: true }).click();
    await expect(admin.getByText('REPORT_RESOLVED', { exact: true })).toBeVisible();
    await admin.getByRole('button', { name: 'Пользователи', exact: true }).click();
    await admin.getByRole('textbox', { name: 'Административный поиск' }).fill(email);
    const row = admin.locator('article').filter({ hasText: email });
    await row.getByLabel('Причина блокировки', { exact: false }).fill('Нарушение правил, E2E');
    await row.getByRole('button', { name: 'Заблокировать', exact: true }).click();
    await expect(row.getByRole('button', { name: 'Разблокировать', exact: true })).toBeVisible();
    expect((await page.request.get('/api/recipes/mine')).status()).toBe(401);
    await page.goto('/login');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Пароль', { exact: true }).fill('Report password 12345');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await row.getByRole('button', { name: 'Разблокировать', exact: true }).click();
    await expect(row.getByRole('button', { name: 'Заблокировать', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Выйти', exact: true })).toBeVisible();
  } finally { await adminContext.close(); }
});
async function image(page) {
  const data = await page.evaluate(() => { const c = document.createElement('canvas'); c.width=4; c.height=3; c.getContext('2d').fillRect(0,0,4,3); return c.toDataURL('image/png').split(',')[1]; });
  return { name: 'test.png', mimeType: 'image/png', buffer: Buffer.from(data, 'base64') };
}
test('Настройки профиля и смена пароля с повторным входом', async ({ page }) => {
  const email = `settings${Date.now()}@e2e.invalid`;
  await page.goto('/register');
  await page.getByLabel('Имя', { exact: true }).fill('Автор настроек');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Пароль', { exact: true }).fill('Current password 123');
  await page.getByRole('button', { name: 'Создать аккаунт' }).click();
  await expect(page.getByRole('button', { name: 'Выйти', exact: true })).toBeVisible();
  await verifyMailbox(page, email);
  await page.goto('/settings');
  await page.getByLabel('Аватар', { exact: true }).setInputFiles(await image(page));
  await expect(page.locator('.user-chip img')).toBeVisible();
  await page.getByLabel('Отображаемое имя').fill('Обновлённый автор');
  await page.getByRole('button', { name: 'Сохранить имя' }).click();
  await expect(page.locator('.toast')).toHaveText(/Изменения сохранены/);
  await page.reload();
  await expect(page.getByLabel('Отображаемое имя')).toHaveValue('Обновлённый автор');
  await page.getByLabel('Текущий пароль', { exact: true }).fill('Current password 123');
  await page.getByLabel('Новый пароль', { exact: true }).fill('Changed password 456');
  await page.getByRole('button', { name: 'Изменить пароль' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Пароль', { exact: true }).fill('Changed password 456');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Выйти', exact: true })).toBeVisible();
});
test('Гость открывает каталог и рецепт', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Поиск рецептов' }).fill('паста');
  await page.getByRole('button', { name: /^Найти/ }).click();
  await page.locator('.recipe-card').first().getByRole('link', { name: /Открыть рецепт:/ }).click();
  await expect(page.locator('.ingredients-panel')).toBeVisible();
  await expect(page.locator('.steps-list')).toBeVisible();
});
test('Демо-заголовок не открывает личные данные', async ({ request, page }) => {
  expect((await request.get('/api/recipes/mine', { headers: { 'X-Demo-User': '3' } })).status()).toBe(401);
  await page.goto('/create');
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/moderation');
  await expect(page).toHaveURL(/\/login$/);
});
test('Регистрация, восстановление сессии, рецепт и модерация', async ({ page }) => {
  const suffix = Date.now(); const title = `Суп браузер ${suffix}`;
  const email = `author${suffix}@e2e.invalid`;
  await page.goto('/register');
  await page.getByLabel('Имя', { exact: true }).fill('Новый автор');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Пароль', { exact: true }).fill('E2E long password 12345');
  await page.getByRole('button', { name: 'Создать аккаунт' }).click();
  await expect(page.getByRole('button', { name: 'Выйти', exact: true })).toBeVisible();
  await verifyMailbox(page, email);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Выйти', exact: true })).toBeVisible();
  await page.goto('/create');
  await page.getByLabel(/Название рецепта/).fill(title);
  await page.getByLabel(/Краткое описание/).fill('Описание настоящего авторского рецепта для браузерного теста');
  await page.getByRole('textbox', { name: 'Ингредиент 1' }).fill('Овощи — 200 г');
  await page.getByRole('textbox', { name: 'Шаг 1' }).fill('Нарезать и сварить');
  await page.getByLabel('Фотография рецепта', { exact: true }).setInputFiles(await image(page));
  await page.getByRole('button', { name: 'Отправить рецепт' }).click();
  await expect(page).toHaveURL(/\/recipes\/\d+$/);
  await expect(page.locator('.detail-cover img')).toHaveAttribute('src', /\/api\/media\//);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Войти', exact: true })).toBeVisible();
  await page.getByLabel('Email', { exact: true }).fill('admin@e2e.invalid');
  await page.getByLabel('Пароль', { exact: true }).fill(process.env.CC_E2E_ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Выйти', exact: true })).toBeVisible();
  await page.goto('/moderation');
  const item = page.locator('.moderation-item').filter({ hasText: title });
  await item.getByRole('button', { name: 'Одобрить' }).click();
  await expect(item).toHaveCount(0);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Войти', exact: true })).toBeVisible();
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Поиск рецептов' }).fill(title);
  await page.getByRole('button', { name: /^Найти/ }).click();
  await expect(page.locator('.recipe-card').filter({ hasText: title })).toBeVisible();
});

test('Письмо восстановления меняет пароль и отзывает старую сессию', async ({ page }) => {
  const email = `recover${Date.now()}@e2e.invalid`;
  await page.goto('/register');
  await page.getByLabel('Имя', { exact: true }).fill('Автор восстановления');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Пароль', { exact: true }).fill('Original password 12345');
  await page.getByRole('button', { name: 'Создать аккаунт' }).click();
  await expect(page.getByRole('button', { name: 'Выйти', exact: true })).toBeVisible();
  expect((await page.request.post('/api/recipes/1/favorite')).status()).toBe(403);
  await verifyMailbox(page, email);
  await page.goto('/forgot-password'); await page.getByLabel('Email аккаунта').fill(email);
  await page.getByRole('button', { name: 'Отправить письмо' }).click();
  await expect(page.getByRole('status')).toContainText('письмо будет отправлено');
  await page.goto(await mailLink(page.request, email, 'reset-password'));
  await page.getByLabel('Новый пароль', { exact: true }).fill('Recovered password 45678');
  await page.getByRole('button', { name: 'Сохранить новый пароль' }).click();
  await expect(page.getByRole('status')).toContainText('Старые сессии отозваны');
  expect((await page.request.get('/api/auth/me')).status()).toBe(401);
  await page.goto('/login'); await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Пароль', { exact: true }).fill('Recovered password 45678');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Выйти', exact: true })).toBeVisible();
});
