import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function adminLogin(page) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('admin@e2e.invalid');
  await page.getByLabel('Пароль', { exact: true }).fill(process.env.CC_E2E_ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page.getByRole('button', { name: /Меню аккаунта/ })).toBeVisible();
}

test('Меню аккаунта: клавиатура, закрытие снаружи и отзыв cookie при выходе', async ({ page }) => {
  await adminLogin(page);
  await page.goto('/profile');
  const menu = page.getByRole('button', { name: /Меню аккаунта/ });
  await menu.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Мой профиль' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Настройки', exact: true })).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.getByRole('menuitem', { name: 'Выйти' })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(page.getByRole('menuitem', { name: 'Мой профиль' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  await expect(page.getByRole('menu')).toHaveCount(0);
  await menu.click();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await menu.click();
  await page.getByRole('heading', { level: 1 }).click();
  await expect(page.getByRole('menu')).toHaveCount(0);
  await menu.click();
  await page.getByRole('menuitem', { name: 'Выйти' }).click();
  await expect(page.getByRole('link', { name: 'Войти', exact: true })).toBeVisible();
  expect((await page.request.get('/api/auth/me')).status()).toBe(401);
});

test('Администратор снимает рецепт с публикации отдельным действием и публикует снова', async ({ page, browser }) => {
  await adminLogin(page);
  await page.goto('/recipes/1');
  await page.getByRole('button', { name: 'Снять с публикации', exact: true }).click();
  await page.getByLabel('Причина снятия с публикации').fill('Проверка рецепта после обращения');
  await page.getByRole('dialog').getByRole('button', { name: 'Снять с публикации', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Одобрить рецепт' })).toBeVisible();
  const guest = await browser.newContext();
  try {
    expect((await guest.request.get('http://127.0.0.1:5173/api/recipes/1')).status()).toBe(404);
  } finally {
    await guest.close();
  }
  await page.getByRole('button', { name: 'Одобрить рецепт' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Опубликовать', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Снять с публикации', exact: true })).toBeVisible();
  await page.goto('/admin?section=audit');
  await expect(page.locator('tbody').getByText('Рецепт снят с публикации', { exact: true }).first()).toBeVisible();
});

test('Таблицы запрашивают фильтры, сортировку и размер страницы у сервера', async ({ page }) => {
  await adminLogin(page);
  await page.goto('/admin?section=users');
  await expect(page.locator('tbody tr').first()).toBeVisible();
  const request = page.waitForResponse(
    (r) => r.url().includes('/api/admin/users?') && r.url().includes('size=20') && r.url().includes('role=USER'),
  );
  await page.getByLabel('Роль', { exact: true }).selectOption('USER');
  await page.getByLabel('Строк на странице').selectOption('20');
  const response = await request;
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data.size).toBe(20);
  expect(data.content.every((u) => u.role === 'USER')).toBe(true);
  await expect(page.locator('.table-pagination')).toContainText(`Всего: ${data.total}`);
  await page.getByLabel('Сортировка', { exact: true }).selectOption('name,asc');
  await expect.poll(async () => page.locator('.table-scroll').getAttribute('aria-busy')).toBe('false');
});

test('Адаптивность и доступность страниц на 375, 768, 1280 и 1920 px', async ({ page, browser }) => {
  test.setTimeout(180000);
  const errors = [];
  const accessibility = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await adminLogin(page);
  const routes = [
    '/',
    '/recipes/1',
    '/profile',
    '/favorites',
    '/settings',
    '/create',
    '/recipes/1/edit',
    '/moderation',
    '/admin',
    '/admin?section=users',
    '/admin?section=audit',
    '/admin?section=storage',
    '/reports',
  ];
  for (const width of [375, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      await page.goto(route);
      await expect(page.locator('h1').first()).toBeVisible();
      if (route === '/profile') {
        await expect(page.getByRole('link', { name: 'Мои жалобы', exact: true })).toHaveCount(0);
      }
      await expect(page.getByText('Загружаем записи…', { exact: true })).toHaveCount(0);
      await expect(page.locator('.card-skeleton')).toHaveCount(0);
      // Include below-the-fold images in the layout check.
      await page.locator('img[loading="lazy"]').evaluateAll((images) =>
        images.forEach((image) => {
          image.loading = 'eager';
        }),
      );
      await expect.poll(() => page.locator('img').evaluateAll((images) => images.every((image) => image.complete))).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}: ${route}`).toBe(true);
      if (width === 1280) {
        const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
        accessibility.push(...result.violations.map((v) => ({ route, width, id: v.id, nodes: v.nodes.map((n) => n.target) })));
      }
    }
  }
  const guest = await browser.newContext({
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 375, height: 812 },
    reducedMotion: 'reduce',
  });
  try {
    const p = await guest.newPage();
    for (const width of [375, 768, 1280, 1920]) {
      await p.setViewportSize({ width, height: 900 });
      for (const route of [
        '/login',
        '/register',
        '/forgot-password',
        '/resend-verification',
        '/verify-email',
        '/reset-password',
        '/missing',
      ]) {
        await p.goto(route);
        expect(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        if (width === 375) {
          const result = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
          accessibility.push(...result.violations.map((v) => ({ route, width, id: v.id, nodes: v.nodes.map((n) => n.target) })));
        }
      }
    }
    await p.setViewportSize({ width: 375, height: 812 });
    await p.goto('/');
    await p.getByRole('button', { name: 'Основное меню' }).click();
    await expect(p.getByRole('link', { name: 'Моя кухня', exact: true }).first()).toBeVisible();
  } finally {
    await guest.close();
  }
  expect(errors).toEqual([]);
  expect(accessibility).toEqual([]);
});
