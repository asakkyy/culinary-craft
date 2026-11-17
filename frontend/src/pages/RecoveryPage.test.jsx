import { beforeEach, expect, it, vi } from 'vitest';
import { screen, render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import RecoveryPage from './RecoveryPage';
import { api } from '../api/client';
import { renderPage } from '../test/testHelpers';
import { useApp } from '../context/AppContext';
vi.mock('../context/AppContext', () => ({ useApp: vi.fn() }));
const forgetUser = vi.fn();
vi.mock('../api/client', () => ({
  api: { requestPassword: vi.fn(), requestVerification: vi.fn(), verifyEmail: vi.fn(), resetPassword: vi.fn() },
  errorText: (e) => e.message,
}));
beforeEach(() => {
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
  useApp.mockReturnValue({ forgetUser });
});
it('запрашивает восстановление и показывает нейтральное подтверждение', async () => {
  api.requestPassword.mockResolvedValueOnce({ message: 'Если адрес подходит, письмо будет отправлено' });
  renderPage(<RecoveryPage mode="forgot" />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email аккаунта'), 'author@example.test');
  await user.click(screen.getByRole('button', { name: 'Отправить письмо' }));
  expect(api.requestPassword).toHaveBeenCalledWith({ email: 'author@example.test' });
  expect(await screen.findByRole('status')).toHaveTextContent('Если адрес подходит');
});
it('подтверждает email только после явного нажатия и удаляет токен из URL', async () => {
  window.history.replaceState(null, '', '/verify-email#token=secret');
  renderPage(<RecoveryPage mode="verify" />);
  expect(window.location.hash).toBe('');
  expect(api.verifyEmail).not.toHaveBeenCalled();
  await userEvent.setup().click(screen.getByRole('button', { name: 'Подтвердить email' }));
  expect(api.verifyEmail).toHaveBeenCalledWith({ token: 'secret' });
  expect(await screen.findByRole('status')).toHaveTextContent('Email подтверждён');
});
it('восстанавливает пароль по токену', async () => {
  window.history.replaceState(null, '', '/reset-password#token=reset-secret');
  renderPage(<RecoveryPage mode="reset" />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Новый пароль'), 'A new password 12345');
  await user.click(screen.getByRole('button', { name: 'Сохранить новый пароль' }));
  expect(api.resetPassword).toHaveBeenCalledWith({ token: 'reset-secret', password: 'A new password 12345' });
  expect(forgetUser).toHaveBeenCalled();
  expect(await screen.findByRole('status')).toHaveTextContent('Старые сессии отозваны');
});
it('показывает истёкшую ссылку и доступ к повторной отправке', async () => {
  window.history.replaceState(null, '', '/verify-email#token=expired');
  api.verifyEmail.mockRejectedValueOnce(new Error('Ссылка истекла'));
  renderPage(<RecoveryPage mode="verify" />);
  await userEvent.setup().click(screen.getByRole('button', { name: 'Подтвердить email' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Ссылка истекла');
  expect(screen.getByRole('link', { name: 'Повторить подтверждение' })).toHaveAttribute('href', '/resend-verification');
});
it('не отправляет письмо при открытии, отправляет по кнопке и сохраняет задержку', async () => {
  useApp.mockReturnValue({ user: { email: 'author@example.test', emailVerified: false } });
  api.requestVerification.mockResolvedValue({ message: 'Если адрес подходит, письмо будет отправлено' });
  const view = renderPage(<RecoveryPage mode="resend" />);
  expect(api.requestVerification).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Отправить письмо' }));
  expect(api.requestVerification).toHaveBeenCalledWith({ email: 'author@example.test' });
  expect(screen.getByRole('button', { name: 'Отправить письмо' })).toBeDisabled();
  view.unmount();
  renderPage(<RecoveryPage mode="resend" />);
  expect(api.requestVerification).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Отправить письмо' })).toBeDisabled();
});
it('перенаправляет подтверждённый аккаунт из обоих экранов подтверждения', () => {
  useApp.mockReturnValue({ user: { emailVerified: true } });
  render(
    <MemoryRouter initialEntries={['/resend-verification']}>
      <Routes>
        <Route path="/resend-verification" element={<RecoveryPage mode="resend" />} />
        <Route path="/profile" element={<h1>Профиль</h1>} />
      </Routes>
    </MemoryRouter>,
  );
  expect(screen.getByRole('heading', { name: 'Профиль' })).toBeInTheDocument();
  expect(api.requestVerification).not.toHaveBeenCalled();
});
it('обновляет аккаунт с сервера и переводит в профиль после подтверждения', async () => {
  const refreshUser = vi.fn().mockResolvedValue();
  useApp.mockReturnValue({ user: { emailVerified: false }, refreshUser });
  window.history.replaceState(null, '', '/verify-email#token=single-use');
  render(
    <MemoryRouter initialEntries={['/verify-email']}>
      <Routes>
        <Route path="/verify-email" element={<RecoveryPage mode="verify" />} />
        <Route path="/profile" element={<h1>Профиль</h1>} />
      </Routes>
    </MemoryRouter>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Подтвердить email' }));
  expect(await screen.findByRole('heading', { name: 'Профиль' })).toBeInTheDocument();
  expect(refreshUser).toHaveBeenCalledOnce();
});
