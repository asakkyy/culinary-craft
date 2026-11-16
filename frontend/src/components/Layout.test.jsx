
import { beforeEach, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import Layout from './Layout';
import { useApp } from '../context/AppContext';
import { admin, anna, renderPage } from '../test/testHelpers';

vi.mock('../context/AppContext', () => ({
  useApp: vi.fn(),
}));

beforeEach(() => {
  useApp.mockReturnValue({
    user: anna,
    users: [anna, admin],
    pickerOpen: false,
    setPickerOpen: vi.fn(),
    pickUser: vi.fn(),
    toast: null,
  });
});

it('показывает навигацию по каталогу, профилю и избранному', () => {
  // Сначала отрисовываем компонент
  renderPage(
    <Layout>
      <h1>Тестовая страница</h1>
    </Layout>
  );

  // Ищем главное меню после отрисовки
  const navigation = screen.getByRole('navigation', {
    name: 'Основная навигация',
  });

  expect(navigation).toBeInTheDocument();

  // Проверяем ссылки внутри главного меню
  expect(
    within(navigation).getByRole('link', { name: 'Рецепты' })
  ).toHaveAttribute('href', '/');

  expect(
    within(navigation).getByRole('link', { name: 'Моя кухня' })
  ).toHaveAttribute('href', '/profile');

  expect(
    within(navigation).getByRole('link', { name: 'Избранное' })
  ).toHaveAttribute('href', '/favorites');
});

it('не показывает раздел модерации обычному пользователю', () => {
  renderPage(
    <Layout>
      <h1>Страница</h1>
    </Layout>
  );

  expect(
    screen.queryByRole('link', { name: 'Модерация' })
  ).not.toBeInTheDocument();
});

it('открывает раздел модерации для администратора', () => {
  useApp.mockReturnValue({
    user: admin,
    users: [anna, admin],
    pickerOpen: false,
    setPickerOpen: vi.fn(),
    pickUser: vi.fn(),
    toast: null,
  });

  renderPage(
    <Layout>
      <h1>Страница</h1>
    </Layout>
  );

  expect(
    screen.getByRole('link', { name: 'Модерация' })
  ).toHaveAttribute('href', '/moderation');
});

it('открывает окно выбора демонстрационной роли', async () => {
  const setPickerOpen = vi.fn();

  useApp.mockReturnValue({
    user: anna,
    users: [anna, admin],
    pickerOpen: false,
    setPickerOpen,
    pickUser: vi.fn(),
    toast: null,
  });

  const user = userEvent.setup();

  renderPage(
    <Layout>
      <h1>Страница</h1>
    </Layout>
  );

  await user.click(
    screen.getByRole('button', { name: /Анна/ })
  );

  expect(setPickerOpen).toHaveBeenCalledWith(true);
});
