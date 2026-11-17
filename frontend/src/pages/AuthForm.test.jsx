import { beforeEach, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuthForm from './AuthForm';
import { api } from '../api/client';
import { useApp } from '../context/AppContext';
import { renderPage } from '../test/testHelpers';
vi.mock('../api/client', () => ({ api: { register: vi.fn() }, errorText: e => e.message }));
vi.mock('../context/AppContext', () => ({ useApp: vi.fn() }));
const login = vi.fn(); const logout = vi.fn();
beforeEach(() => { useApp.mockReturnValue({ user: null, login, logout }); });
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
