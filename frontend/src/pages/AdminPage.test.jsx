import { beforeEach, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminPage from './AdminPage';
import ReportsPage from './ReportsPage';
import ReportForm from '../components/ReportForm';
import { renderPage } from '../test/testHelpers';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';
vi.mock('../context/AppContext', () => ({ useApp: vi.fn() }));
vi.mock('../api/client', () => ({ api: { report: vi.fn(), myReports: vi.fn(), adminReports: vi.fn(), adminUsers: vi.fn(), adminAudit: vi.fn(), reportDecision: vi.fn(), blockUser: vi.fn() }, errorText: e => e.message }));
const report = { id: 7, recipeId: 1, recipeTitle: 'Суп', reporterName: 'Автор', reason: 'SPAM', status: 'OPEN', description: 'Подробная причина жалобы', createdAt: '2026-01-01' };
beforeEach(() => {
  useApp.mockReturnValue({ user: { id: 3, role: 'ADMIN' }, requireUser: () => true, notify: vi.fn() });
  api.myReports.mockResolvedValue({ content: [report], totalPages: 1 });
  api.adminReports.mockResolvedValue({ content: [report], totalPages: 1 });
  api.adminUsers.mockResolvedValue({ content: [{ id: 10, name: 'Пользователь', email: 'user@example.test', status: 'ACTIVE', role: 'USER' }], totalPages: 1 });
  window.confirm = vi.fn(() => true);
});
it('отправляет жалобу', async () => {
  renderPage(<ReportForm recipeId={1}/>); const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Пожаловаться' }));
  await user.type(screen.getByLabelText('Описание жалобы'), 'Подробная причина жалобы');
  await user.click(screen.getByRole('button', { name: 'Отправить жалобу' }));
  expect(api.report).toHaveBeenCalledWith(1, { reason: 'SPAM', description: 'Подробная причина жалобы' });
});
it('показывает собственные жалобы и статус', async () => {
  renderPage(<ReportsPage/>); expect(await screen.findByText(/Спам · Открыта/)).toBeInTheDocument();
});
it('сохраняет решение администратора', async () => {
  renderPage(<AdminPage/>); const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Комментарий к жалобе 7'), 'Проверено модератором');
  await user.click(screen.getByRole('button', { name: 'Закрыть жалобу' }));
  expect(api.reportDecision).toHaveBeenCalledWith(7, { status: 'RESOLVED', comment: 'Проверено модератором' });
});
it('запрашивает подтверждение перед блокировкой', async () => {
  renderPage(<AdminPage/>); const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Пользователи' }));
  await user.type(await screen.findByLabelText('Причина блокировки 10'), 'Нарушение правил');
  await user.click(screen.getByRole('button', { name: 'Заблокировать' }));
  expect(window.confirm).toHaveBeenCalled(); expect(api.blockUser).toHaveBeenCalledWith(10, { reason: 'Нарушение правил' });
});
