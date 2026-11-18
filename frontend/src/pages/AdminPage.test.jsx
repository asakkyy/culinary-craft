import { beforeEach, it, expect, vi } from 'vitest';
import { screen, within, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminPage from './AdminPage';
import ReportsPage from './ReportsPage';
import ReportForm from '../components/ReportForm';
import { renderPage } from '../test/testHelpers';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';
vi.mock('../context/AppContext', () => ({ useApp: vi.fn() }));
vi.mock('../api/client', () => ({
  api: {
    one: vi.fn().mockResolvedValue({ category: 'Супы', ownerName: 'Автор рецепта', status: 'APPROVED' }),
    report: vi.fn(),
    myReports: vi.fn(),
    adminReports: vi.fn(),
    adminUsers: vi.fn(),
    adminAudit: vi.fn(),
    reportDecision: vi.fn(),
    blockUser: vi.fn(),
    unblockUser: vi.fn(),
  },
  errorText: (e) => e.message,
}));
const report = {
  id: 7,
  recipeId: 1,
  recipeTitle: 'Суп',
  reporterId: 10,
  reporterName: 'Автор',
  reason: 'SPAM',
  status: 'OPEN',
  description: 'Подробная причина жалобы',
  createdAt: '2026-01-01',
};
beforeEach(() => {
  api.one.mockResolvedValue({ category: 'Супы', ownerName: 'Автор рецепта', status: 'APPROVED' });
  useApp.mockReturnValue({ user: { id: 3, role: 'ADMIN' }, requireUser: () => true, notify: vi.fn() });
  api.myReports.mockResolvedValue({ content: [report], total: 1, totalPages: 1 });
  api.adminReports.mockResolvedValue({ content: [report], total: 21, totalPages: 3 });
  api.adminUsers.mockResolvedValue({
    content: [{ id: 10, name: 'Пользователь', email: 'user@example.test', status: 'ACTIVE', role: 'USER' }],
    total: 1,
    totalPages: 1,
  });
  api.adminAudit.mockResolvedValue({
    content: [
      {
        id: 9,
        adminId: 3,
        adminName: 'Модератор',
        action: 'REPORT_RESOLVED',
        targetType: 'REPORT',
        targetId: 7,
        details: 'Status: RESOLVED',
        createdAt: '2026-01-01',
      },
    ],
    total: 1,
    totalPages: 1,
  });
});
it('отправляет жалобу из модального окна', async () => {
  renderPage(<ReportForm recipeId={1} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Пожаловаться' }));
  expect(screen.getByRole('dialog')).toHaveAccessibleName('Пожаловаться на рецепт');
  await user.type(screen.getByLabelText('Описание жалобы'), 'Подробная причина жалобы');
  await user.click(screen.getByRole('button', { name: 'Отправить жалобу' }));
  expect(api.report).toHaveBeenCalledWith(1, { reason: 'SPAM', description: 'Подробная причина жалобы' });
  expect(await screen.findByRole('status')).toHaveTextContent('Модератор рассмотрит');
});
it('позволяет отправить причину без описания и показывает активный дубликат', async () => {
  api.report.mockRejectedValueOnce(new Error('Такая жалоба уже рассматривается'));
  renderPage(<ReportForm recipeId={1} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Пожаловаться' }));
  await user.click(screen.getByRole('button', { name: 'Отправить жалобу' }));
  expect(api.report).toHaveBeenCalledWith(1, { reason: 'SPAM', description: '' });
  expect(await screen.findByRole('alert')).toHaveTextContent('уже рассматривается');
});
it('сохраняет доступ к истории жалоб', async () => {
  renderPage(<ReportsPage />);
  expect(await screen.findByText(/Спам · Открыта/)).toBeInTheDocument();
});
it.each([['RESOLVED', 'Закрыть без изменения рецепта'], ['REJECTED', 'Отклонить жалобу']])(
  'сохраняет решение %s только после подтверждения', async (status, label) => {
  api.reportDecision.mockClear();
  renderPage(<AdminPage />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Рассмотреть' }));
  await user.selectOptions(screen.getByLabelText('Решение'), screen.getByRole('option', { name: label }));
  await user.type(screen.getByLabelText('Комментарий к жалобе 7'), 'Проверено модератором');
  await user.click(screen.getByRole('button', { name: 'Сохранить решение' }));
  expect(api.reportDecision).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Подтвердить решение' }));
  expect(api.reportDecision).toHaveBeenCalledWith(7, { status, comment: 'Проверено модератором' });
});
it('подтверждает снятие вместе с закрытием и сохраняет форму при ошибке', async () => {
  api.reportDecision.mockClear().mockRejectedValueOnce(new Error('Рецепт уже не опубликован'));
  renderPage(<AdminPage />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Рассмотреть' }));
  await user.selectOptions(screen.getByLabelText('Решение'), screen.getByRole('option', { name: 'Снять рецепт с публикации' }));
  await user.type(screen.getByLabelText('Комментарий к жалобе 7'), 'Нарушение подтверждено');
  await user.click(screen.getByRole('button', { name: 'Сохранить решение' }));
  expect(screen.getByText(/исчезнет из публичного каталога/)).toBeVisible();
  expect(api.reportDecision).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Подтвердить решение' }));
  expect(api.reportDecision).toHaveBeenCalledExactlyOnceWith(7, {
    status: 'RESOLVED', comment: 'Нарушение подтверждено', unpublishRecipe: true,
  });
  expect(await screen.findByRole('alert')).toHaveTextContent('Рецепт уже не опубликован');
  expect(screen.getByLabelText('Комментарий к жалобе 7')).toHaveValue('Нарушение подтверждено');
});
it('требует причину и подтверждение перед блокировкой', async () => {
  renderPage(<AdminPage />);
  const user = userEvent.setup();
  await user.click(screen.getByRole('link', { name: 'Пользователи' }));
  await user.click(await screen.findByRole('button', { name: 'Заблокировать' }));
  await user.type(screen.getByLabelText('Причина блокировки 10'), 'Нарушение правил');
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Заблокировать' }));
  expect(api.blockUser).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Подтвердить решение' }));
  expect(api.blockUser).toHaveBeenCalledWith(10, { reason: 'Нарушение правил' });
});
it('передаёт пагинацию, размер и сортировку серверу', async () => {
  renderPage(<AdminPage />);
  const user = userEvent.setup();
  await screen.findByRole('button', { name: 'Рассмотреть' });
  await user.click(screen.getByRole('button', { name: 'Далее' }));
  await waitFor(() => expect(api.adminReports).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, size: 10 })));
  await user.selectOptions(screen.getByLabelText('Строк на странице'), '20');
  await user.selectOptions(screen.getByLabelText('Сортировка'), 'createdAt,asc');
  await waitFor(() =>
    expect(api.adminReports).toHaveBeenLastCalledWith(expect.objectContaining({ page: 0, size: 20, sort: 'createdAt,asc' })),
  );
});
it('показывает понятные события аудита и подробности', async () => {
  renderPage(<AdminPage />);
  const user = userEvent.setup();
  await screen.findByRole('button', { name: 'Рассмотреть' });
  await user.click(screen.getByRole('link', { name: 'Аудит' }));
  expect(await screen.findByText('Модератор')).toBeInTheDocument();
  expect(within(screen.getByRole('table')).getByText('Жалоба закрыта')).toBeInTheDocument();
  expect(screen.queryByText('REPORT_RESOLVED')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Подробности' }));
  expect(within(screen.getByRole('dialog')).getAllByText('Жалоба закрыта')).toHaveLength(2);
});
it('показывает ошибки загрузки и безопасно запрещает самоблокировку', async () => {
  api.adminReports.mockRejectedValueOnce(new Error('Нет соединения'));
  renderPage(<AdminPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Нет соединения');
  api.adminUsers.mockResolvedValue({
    content: [{ id: 3, name: 'Администратор', status: 'ACTIVE', role: 'ADMIN' }],
    total: 1,
    totalPages: 1,
  });
  await userEvent.click(screen.getByRole('link', { name: 'Пользователи' }));
  expect(await screen.findByRole('button', { name: 'Заблокировать' })).toBeDisabled();
});
it('восстанавливает фильтры, страницу и размер из прямой ссылки', async () => {
  api.adminUsers.mockResolvedValue({ content: [], total: 55, totalPages: 3 });
  renderPage(<AdminPage />, '/admin?section=users&search=Автор&role=USER&status=ACTIVE&sort=name,asc&page=1&size=20');
  expect(screen.getByRole('searchbox')).toHaveValue('Автор');
  await waitFor(() =>
    expect(api.adminUsers).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'Автор', role: 'USER', status: 'ACTIVE', sort: 'name,asc', page: 1, size: 20 }),
    ),
  );
});
it('не возвращает строки из опоздавшего ответа после смены фильтра', async () => {
  let resolve;
  api.adminReports.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  renderPage(<AdminPage />);
  await waitFor(() => expect(api.adminReports).toHaveBeenCalledTimes(1));
  api.adminReports.mockResolvedValue({ content: [{ ...report, id: 99 }], total: 1, totalPages: 1 });
  await userEvent.selectOptions(screen.getByLabelText('Фильтр статуса'), 'OPEN');
  await screen.findByText('#99');
  await act(async () => resolve({ content: [report], total: 1, totalPages: 1 }));
  expect(screen.getByText('#99')).toBeInTheDocument();
  expect(screen.queryByText('#7')).not.toBeInTheDocument();
});
