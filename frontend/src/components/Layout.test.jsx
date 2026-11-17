import { beforeEach, expect, it, vi } from 'vitest';
import { screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Layout from './Layout';
import { useApp } from '../context/AppContext';
import { admin, anna, renderPage } from '../test/testHelpers';
vi.mock('../context/AppContext', () => ({ useApp: vi.fn() }));
const logout = vi.fn();
const showError = vi.fn();
beforeEach(() => {
  useApp.mockReturnValue({ user: anna, pickerOpen: false, setPickerOpen: vi.fn(), toast: null, logout, showError });
});
it('показывает каталог, профиль и избранное без личных жалоб', () => {
  renderPage(
    <Layout>
      <h1>Страница</h1>
    </Layout>,
  );
  const nav = screen.getByRole('navigation', { name: 'Основная навигация' });
  expect(within(nav).getByRole('link', { name: 'Рецепты' })).toHaveAttribute('href', '/');
  expect(within(nav).getByRole('link', { name: 'Моя кухня' })).toHaveAttribute('href', '/profile');
  expect(within(nav).getByRole('link', { name: 'Избранное' })).toHaveAttribute('href', '/favorites');
  expect(screen.queryByText('Мои жалобы')).not.toBeInTheDocument();
});
it('не показывает управление обычному пользователю', async () => {
  renderPage(<Layout />);
  await userEvent.click(screen.getByRole('button', { name: /Меню аккаунта/ }));
  expect(screen.queryByRole('menuitem', { name: 'Администрирование' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Управление' })).not.toBeInTheDocument();
});
it('открывает администрирование для ADMIN', async () => {
  useApp.mockReturnValue({ user: admin, logout });
  renderPage(<Layout />);
  expect(screen.getByRole('link', { name: 'Управление' })).toHaveAttribute('href', '/admin');
  await userEvent.click(screen.getByRole('button', { name: /Меню аккаунта/ }));
  expect(screen.getByRole('menuitem', { name: 'Администрирование' })).toHaveAttribute('href', '/admin');
});
it('открывает настоящее меню аккаунта и закрывает Escape с возвратом фокуса', async () => {
  renderPage(<Layout />);
  const user = userEvent.setup();
  const button = screen.getByRole('button', { name: /Меню аккаунта/ });
  await user.click(button);
  expect(button).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('menuitem', { name: 'Мой профиль' })).toHaveFocus();
  await user.keyboard('{ArrowDown}');
  expect(screen.getByRole('menuitem', { name: 'Настройки' })).toHaveFocus();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(button).toHaveFocus();
});
it('закрывает меню снаружи и выполняет logout', async () => {
  renderPage(
    <Layout>
      <h1>Содержимое</h1>
    </Layout>,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /Меню аккаунта/ }));
  fireEvent.pointerDown(screen.getByText('Содержимое'));
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /Меню аккаунта/ }));
  await user.click(screen.getByRole('menuitem', { name: 'Выйти' }));
  expect(logout).toHaveBeenCalledOnce();
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});
it('показывает гостю вход и регистрацию', () => {
  useApp.mockReturnValue({ user: null });
  renderPage(<Layout />);
  expect(screen.getByRole('link', { name: 'Войти' })).toHaveAttribute('href', '/login');
  expect(screen.getByRole('link', { name: 'Регистрация' })).toHaveAttribute('href', '/register');
});
