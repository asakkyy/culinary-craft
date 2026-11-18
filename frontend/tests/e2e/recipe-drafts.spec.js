import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { database } from './database';

let accounts;
let editorCookies;

test.beforeAll(async ({ request }) => {
  accounts = await database(async (client) => {
    const identities = ['editor', 'draft-a', 'draft-b'].map((name) => `${name}-${randomUUID()}@e2e.invalid`);
    const result = await client.query(
      `insert into demo_users(name, role, initials, subtitle, email, password_hash, status, token_version, registered_at, updated_at, email_verified_at)
       select 'Автор черновика', 'USER', 'А', '', identity, password_hash, 'ACTIVE', 0, now(), now(), now()
       from demo_users cross join unnest($1::text[]) identity where email='admin@e2e.invalid'
       returning email`,
      [identities],
    );
    expect(result.rowCount).toBe(3);
    return identities;
  });
  await login(request, 0);
  editorCookies = (await request.storageState()).cookies;
});

async function post(request, path, data) {
  const csrf = await (await request.get('/api/auth/csrf')).json();
  return request.post(path, { data, headers: { 'X-XSRF-TOKEN': csrf.token } });
}

async function login(request, account) {
  const response = await post(request, '/api/auth/login', {
    email: accounts[account],
    password: process.env.CC_E2E_ADMIN_PASSWORD,
  });
  expect(response.ok()).toBe(true);
}

const title = (page) => page.getByLabel(/Название рецепта/);
const send = (page) => page.getByRole('button', { name: 'Отправить рецепт' });

async function restore(page) {
  const dialog = page.getByRole('dialog', { name: 'Найден черновик' });
  await expect(dialog.locator('time')).toBeVisible();
  await dialog.getByRole('button', { name: 'Восстановить черновик' }).click();
}

function acceptReload(page) {
  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('beforeunload');
    await dialog.accept();
  });
}

const recipeData = {
  title: 'Овощной рецепт',
  description: 'Домашний рецепт с овощами для проверки редактора',
  category: 'Супы',
  prepMinutes: 30,
  servings: 2,
  difficulty: 'Легко',
  ingredients: ['Овощи'],
  steps: ['Нарезать овощи'],
  tags: ['Домашнее'],
};

async function fillRecipe(page, name) {
  await title(page).fill(name);
  await page.getByLabel(/Краткое описание/).fill(recipeData.description);
  await page.getByLabel('Ингредиент 1').fill(recipeData.ingredients[0]);
  await page.getByLabel('Шаг 1').fill(recipeData.steps[0]);
}

test('после перезагрузки и повторного открытия вкладки восстанавливает новый рецепт', async ({ page, context }) => {
  await context.addCookies(editorCookies);
  await page.goto('/create');
  await title(page).fill('Черновик нового рецепта');
  await page.getByLabel('Ингредиент 1').fill('Лук');
  await expect(page.getByText('Черновик сохранён', { exact: true })).toBeVisible();
  acceptReload(page);
  await page.reload();
  await restore(page);
  await expect(title(page)).toHaveValue('Черновик нового рецепта');
  await expect(page.getByLabel('Ингредиент 1')).toHaveValue('Лук');
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto('/create');
  await restore(reopened);
  await expect(title(reopened)).toHaveValue('Черновик нового рецепта');
});

test('подтверждение ухода из редактирования сохраняет черновик для возврата', async ({ page }) => {
  await page.context().addCookies(editorCookies);
  const response = await post(page.request, '/api/recipes', recipeData);
  expect(response.ok()).toBe(true);
  const recipe = await response.json();
  const edit = `/recipes/${recipe.id}/edit`;
  await page.goto(`/recipes/${recipe.id}`);
  await page.getByRole('link', { name: 'Редактировать' }).click();
  await title(page).fill('Новое название перед уходом');
  await page.getByRole('link', { name: 'Отмена', exact: true }).click();
  await page.getByRole('dialog', { name: 'Выйти из редактора?' }).getByRole('button', { name: 'Сохранить черновик и выйти' }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole('heading', { name: 'Автор черновика', level: 1 })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`${edit}$`));
  await restore(page);
  await expect(title(page)).toHaveValue('Новое название перед уходом');
  expect((await (await page.request.get(`/api/recipes/${recipe.id}`)).json()).title).toBe(recipeData.title);
  await page.getByRole('button', { name: 'Удалить черновик' }).click();
  const discard = page.getByRole('dialog', { name: 'Удалить черновик?' });
  await expect(discard).toBeVisible();
  await page.evaluate(() => history.back());
  const leave = page.getByRole('dialog', { name: 'Выйти из редактора?' });
  await expect(leave).toBeVisible();
  await expect(page.locator('dialog[open]')).toHaveCount(1);
  await leave.getByRole('button', { name: 'Отмена' }).click();
  await discard.getByRole('button', { name: 'Отмена' }).click();
  await expect(title(page)).toHaveValue('Новое название перед уходом');
});

test('после выхода второй аккаунт не видит черновик первого в том же браузере', async ({ page }) => {
  await login(page.request, 1);
  await page.goto('/create');
  await title(page).fill('Черновик первого автора');
  await page.getByRole('button', { name: /Меню аккаунта/ }).click();
  await page.getByRole('menuitem', { name: 'Выйти' }).click();
  await expect(page.getByRole('link', { name: 'Войти', exact: true })).toBeVisible();
  await login(page.request, 2);
  await page.goto('/create');
  await expect(title(page)).toHaveValue('');
  await expect(page.getByRole('dialog', { name: 'Найден черновик' })).toHaveCount(0);
  await login(page.request, 1);
  await page.goto('/create');
  await restore(page);
  await expect(title(page)).toHaveValue('Черновик первого автора');
});

test('успешная отправка удаляет черновик и открывает сохранённый рецепт', async ({ page }) => {
  await page.context().addCookies(editorCookies);
  await page.goto('/create');
  await fillRecipe(page, 'Домашний рецепт из черновика');
  await expect(page.getByText('Черновик сохранён', { exact: true })).toBeVisible();
  await send(page).click();
  await expect(page).toHaveURL(/\/recipes\/\d+$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Домашний рецепт из черновика');
  await page.goto('/create');
  await expect(title(page)).toHaveValue('');
  await expect(page.getByRole('dialog', { name: 'Найден черновик' })).toHaveCount(0);
});

test('если POST рецепта завершился ошибкой, черновик остаётся после перезагрузки', async ({ page }) => {
  await page.context().addCookies(editorCookies);
  await page.goto('/create');
  await fillRecipe(page, 'Черновик после ошибки API');
  await page.route('**/api/recipes', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({ status: 503, json: { message: 'Сохранение временно недоступно' } })
      : route.fallback(),
  );
  await send(page).click();
  await expect(page.getByRole('alert')).toHaveText('Сохранение временно недоступно');
  acceptReload(page);
  await page.reload();
  await restore(page);
  await expect(title(page)).toHaveValue('Черновик после ошибки API');
});
