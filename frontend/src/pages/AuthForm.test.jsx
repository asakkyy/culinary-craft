import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import AuthForm from './AuthForm';
import { api } from '../api/client';
import { useApp } from '../context/AppContext';
import { renderPage } from '../test/testHelpers';
vi.mock('../api/client', () => ({ api: { register: vi.fn() }, errorText: e => e.message }));
vi.mock('../context/AppContext', () => ({ useApp: vi.fn() }));
const login = vi.fn(); const logout = vi.fn();
beforeEach(() => {
  login.mockReset();
  useApp.mockReturnValue({ user: null, login, logout });
});
it.each([
  [undefined, 'USER', false, 'Каталог'],
  ['//example.invalid/path', 'USER', true, 'Каталог'],
  ['/\\example.invalid/path', 'USER', true, 'Каталог'],
  ['/l%6fgin', 'USER', true, 'Каталог'],
  ['/admin?section=users', 'ADMIN', true, 'Администрирование'],
  ['/profile', 'USER', true, 'Профиль'],
])('после входа выбирает внутренний маршрут для %s', async (from, role, emailVerified, destination) => {
  login.mockResolvedValueOnce({ role, emailVerified });
  render(
    <MemoryRouter initialEntries={[{ pathname: '/login', search: '?from=https://example.invalid', state: { from } }]}>
      <Routes>
        <Route path="/login" element={<AuthForm />} />
        <Route path="/" element={<h1>Каталог</h1>} />
        <Route path="/admin" element={<h1>Администрирование</h1>} />
        <Route path="/profile" element={<h1>Профиль</h1>} />
      </Routes>
    </MemoryRouter>,
  );
  expect(screen.queryByRole('link', { name: 'Подтвердить email' })).not.toBeInTheDocument();
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email'), 'author@example.test');
  await user.type(screen.getByLabelText('Пароль'), 'fixture password');
  await user.click(screen.getByRole('button', { name: 'Войти', exact: true }));
  expect(await screen.findByRole('heading', { name: destination })).toBeVisible();
});
it('регистрирует аккаунт и выполняет вход', async () => {
  renderPage(<AuthForm register/>); const user = userEvent.setup();
  await user.type(screen.getByLabelText('Имя'), 'Новый автор');
  await user.type(screen.getByLabelText('Email'), 'author@example.test');
  await user.type(screen.getByLabelText('Пароль'), 'a long password 123');
  await user.click(screen.getByRole('button', { name: 'Создать аккаунт' }));
  expect(api.register).toHaveBeenCalledWith(expect.objectContaining({ name: 'Новый автор' }));
  expect(login).toHaveBeenCalledWith({ email: 'author@example.test', password: 'a long password 123' });
});
it('выводит ошибку входа', async () => {
  login.mockRejectedValueOnce(new Error('Неверный пароль'));
  renderPage(<AuthForm/>); const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email'), 'author@example.test');
  await user.type(screen.getByLabelText('Пароль'), 'incorrect');
  await user.click(screen.getByRole('button', { name: 'Войти', exact: true }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Неверный пароль');
});
it('выполняет выход', async () => {
  useApp.mockReturnValue({ user: { name: 'Автор' }, logout }); renderPage(<AuthForm/>);
  await userEvent.setup().click(screen.getByRole('button', { name: 'Выйти' }));
  expect(logout).toHaveBeenCalled();
});
it('показывает ограничение попыток и возвращает кнопку в рабочее состояние', async () => {
  login.mockRejectedValueOnce(new Error('Слишком много попыток входа. Повторите через 10 минут'));
  renderPage(<AuthForm/>); const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email'), 'author@example.test');
  await user.type(screen.getByLabelText('Пароль'), 'incorrect');
  await user.click(screen.getByRole('button', { name: 'Войти', exact: true }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Слишком много попыток');
  expect(screen.getByRole('button', { name: 'Войти', exact: true })).toBeEnabled();
});
