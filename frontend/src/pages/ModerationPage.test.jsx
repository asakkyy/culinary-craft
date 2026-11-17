import { beforeEach, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ModerationPage from './ModerationPage';
import { api } from '../api/client';
import { useApp } from '../context/AppContext';
import { admin, anna, recipe, renderPage } from '../test/testHelpers';

vi.mock('../api/client', () => ({ api: { pending: vi.fn(), moderate: vi.fn() }, errorText: (e) => e.message }));
vi.mock('../context/AppContext', () => ({ useApp: vi.fn() }));

beforeEach(() => {
  useApp.mockReturnValue({ user: admin, dataVersion: 0, changed: vi.fn(), notify: vi.fn(), showError: vi.fn() });
  api.pending.mockResolvedValue([{ ...recipe, status: 'PENDING' }]);
  api.moderate.mockResolvedValue({ ...recipe, status: 'APPROVED' });
});

it('не пропускает обычного пользователя в модерацию', () => {
  useApp.mockReturnValue({ user: anna, dataVersion: 0 });
  renderPage(<ModerationPage />);
  expect(screen.getByText('Доступ только для модератора')).toBeInTheDocument();
  expect(api.pending).not.toHaveBeenCalled();
});

it('показывает очередь рецептов, ожидающих проверки', async () => {
  renderPage(<ModerationPage />);
  expect(await screen.findByText('Тестовый домашний суп')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Одобрить' })).toBeInTheDocument();
});

it('отправляет решение администратора на сервер', async () => {
  const user = userEvent.setup();
  renderPage(<ModerationPage />);
  await user.click(await screen.findByRole('button', { name: 'Одобрить' }));
  await waitFor(() => expect(api.moderate).toHaveBeenCalledWith(123, 'APPROVED'));
});

it('может отклонить заявку', async () => {
  const user = userEvent.setup();
  renderPage(<ModerationPage />);
  await user.click(await screen.findByRole('button', { name: 'Отклонить' }));
  expect(api.moderate).not.toHaveBeenCalled();
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Отклонить', exact: true }));
  await waitFor(() => expect(api.moderate).toHaveBeenCalledWith(123, 'REJECTED'));
});
