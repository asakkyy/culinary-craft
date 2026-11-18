import { beforeEach, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage } from '../test/testHelpers';
import MediaMaintenance from './MediaMaintenance';
import { api } from '../api/client';
vi.mock('../api/client', () => ({ api: { mediaCleanup: vi.fn() }, errorText: (e) => e.message }));
beforeEach(() => {
  window.confirm = vi.fn(() => true);
});
it('требует dry-run перед очисткой и явное подтверждение', async () => {
  api.mediaCleanup.mockResolvedValueOnce({ dryRun: true, candidates: ['generated.png'], deleted: 0, failed: 0 });
  api.mediaCleanup.mockResolvedValueOnce({ dryRun: false, candidates: ['generated.png'], deleted: 1, failed: 0 });
  renderPage(<MediaMaintenance />);
  const user = userEvent.setup();
  expect(screen.getByRole('button', { name: 'Очистить неиспользуемые файлы' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Проверить без удаления' }));
  expect(api.mediaCleanup).toHaveBeenCalledWith({ dryRun: true });
  expect(await screen.findByRole('status')).toHaveTextContent('Удалено: 0');
  await user.click(screen.getByRole('button', { name: 'Очистить неиспользуемые файлы' }));
  expect(screen.getByRole('dialog', { name: 'Очистить хранилище?' })).toBeInTheDocument();
  expect(api.mediaCleanup).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole('button', { name: 'Удалить неиспользуемые файлы' }));
  expect(api.mediaCleanup).toHaveBeenLastCalledWith({ dryRun: false });
  expect(await screen.findByRole('status')).toHaveTextContent('Удалено: 1');
});
it('показывает ошибку хранилища', async () => {
  api.mediaCleanup.mockRejectedValueOnce(new Error('Хранилище недоступно'));
  renderPage(<MediaMaintenance />);
  await userEvent.setup().click(screen.getByRole('button', { name: 'Проверить без удаления' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Хранилище недоступно');
});
