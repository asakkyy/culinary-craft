import { test, expect } from '@playwright/test';

/** These scenarios drive a real browser against the real Spring Boot prototype. */
test('Гость может искать, фильтровать и открывать карточку рецепта', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cc-demo-user', 'guest'));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Что приготовим/ })).toBeVisible();
  await page.getByRole('textbox', { name: 'Поиск рецептов' }).fill('паста');
  await page.getByRole('button', { name: /^Найти/ }).click();
  await expect(page.locator('.recipe-card').first()).toBeVisible();
  await page.locator('.recipe-card').first().getByRole('link', { name: /Открыть рецепт:/ }).click();
  await expect(page.locator('.ingredients-panel')).toBeVisible();
  await expect(page.locator('.steps-list')).toBeVisible();
});

test('Гость не может добавлять рецепты и просматривать модерацию', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cc-demo-user', 'guest'));
  await page.goto('/create');
  await expect(page.getByRole('heading', { name: 'Авторизуйся в демо-режиме' })).toBeVisible();
  await page.goto('/moderation');
  await expect(page.getByRole('heading', { name: 'Доступ только для модератора' })).toBeVisible();
});

test('Автор создаёт рецепт, администратор его одобряет, гость видит публикацию', async ({ page }) => {
  const title = `Суп проверка браузера ${Date.now()}`;
  await page.addInitScript(() => {
    if (!localStorage.getItem('cc-demo-user')) localStorage.setItem('cc-demo-user', '1');
  });
  await page.goto('/create');
  await page.getByLabel(/Название рецепта/).fill(title);
  await page.getByLabel(/Краткое описание/).fill('Оригинальный и невероятно вкусный рецепт супа на каждый день');
  await page.getByRole('textbox', { name: 'Ингредиент 1' }).fill('Овощи — 200 г');
  await page.getByRole('textbox', { name: 'Шаг 1' }).fill('Нарезать и сварить овощи');
  await page.getByRole('button', { name: 'Отправить рецепт' }).click();
  await expect(page).toHaveURL(/\/recipes\/\d+$/);
  await expect(page.getByText('Ожидает проверки')).toBeVisible();

  await page.getByRole('button', { name: /Анна/ }).click();
  await page.getByRole('dialog', { name: 'Выбор роли' }).getByRole('button', { name: /Марина Волкова/ }).click();
  await page.goto('/moderation');
  const item = page.locator('.moderation-item').filter({ hasText: title });
  await expect(item).toBeVisible();
  await item.getByRole('button', { name: 'Одобрить' }).click();
  await expect(item).toHaveCount(0);

  await page.goto('/');
  await page.getByRole('textbox', { name: 'Поиск рецептов' }).fill(title);
  await page.getByRole('button', { name: /^Найти/ }).click();
  await expect(page.locator('.recipe-card').filter({ hasText: title })).toBeVisible();
});
