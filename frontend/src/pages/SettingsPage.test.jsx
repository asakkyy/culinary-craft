import { beforeEach, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsPage from './SettingsPage';
import { renderPage } from '../test/testHelpers';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';
vi.mock('../context/AppContext', () => ({ useApp: vi.fn() }));
vi.mock('../api/client', () => ({ api: { profileName: vi.fn(), profileEmail: vi.fn(), profilePassword: vi.fn() }, errorText: e => e.message }));
const refreshUser = vi.fn(); const forgetUser = vi.fn();
beforeEach(() => useApp.mockReturnValue({ user: { name: 'Author', email: 'owner@example.test' }, refreshUser, forgetUser, notify: vi.fn() }));
it('сохраняет имя и обновляет текущего пользователя', async () => {
  renderPage(<SettingsPage/>); const user = userEvent.setup();
  await user.clear(screen.getByLabelText('Отображаемое имя')); await user.type(screen.getByLabelText('Отображаемое имя'), 'New author');
  await user.click(screen.getByRole('button', { name: 'Сохранить имя' }));
  expect(api.profileName).toHaveBeenCalledWith({ name: 'New author' }); expect(refreshUser).toHaveBeenCalled();
});
it('после смены пароля завершает сессию', async () => {
  renderPage(<SettingsPage/>); const user = userEvent.setup();
  await user.type(screen.getByLabelText('Текущий пароль'), 'current password 123');
  await user.type(screen.getByLabelText('Новый пароль'), 'new password 456');
  await user.click(screen.getByRole('button', { name: 'Изменить пароль' }));
  expect(api.profilePassword).toHaveBeenCalledWith({ currentPassword: 'current password 123', newPassword: 'new password 456' });
  expect(forgetUser).toHaveBeenCalled();
});
it('показывает отказ смены email', async () => {
  api.profileEmail.mockRejectedValueOnce(new Error('Текущий пароль неверен'));
  renderPage(<SettingsPage/>); const user = userEvent.setup();
  await user.type(screen.getByLabelText('Пароль для смены email'), 'wrong');
  await user.click(screen.getByRole('button', { name: 'Сохранить email' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Текущий пароль неверен');
});
