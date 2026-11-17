import { beforeEach, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RecipeAdminActions from './RecipeAdminActions';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';
import { renderPage, recipe } from '../test/testHelpers';
vi.mock('../context/AppContext', () => ({ useApp: vi.fn() }));
vi.mock('../api/client', () => ({ api: { unpublish: vi.fn(), moderate: vi.fn() }, errorText: (e) => e.message }));
beforeEach(() => useApp.mockReturnValue({ user: { role: 'ADMIN' }, changed: vi.fn(), notify: vi.fn() }));
it('отделяет снятие с публикации от удаления и требует причину', async () => {
  renderPage(<RecipeAdminActions recipe={recipe} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Снять с публикации' }));
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Снять с публикации' }));
  expect(api.unpublish).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('Укажите причину');
  await user.type(screen.getByLabelText('Причина снятия с публикации'), 'Проверка содержания');
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Снять с публикации' }));
  expect(api.unpublish).toHaveBeenCalledWith(123, 'Проверка содержания');
});
it('показывает действия проверки только для ожидающего рецепта', async () => {
  renderPage(<RecipeAdminActions recipe={{ ...recipe, status: 'PENDING' }} />);
  const user = userEvent.setup();
  expect(screen.queryByRole('button', { name: 'Снять с публикации' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Одобрить рецепт' }));
  expect(api.moderate).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Опубликовать', exact: true }));
  expect(api.moderate).toHaveBeenCalledWith(123, 'APPROVED');
});
it('скрывает административные действия обычному пользователю', () => {
  useApp.mockReturnValue({ user: { role: 'USER' } });
  renderPage(<RecipeAdminActions recipe={recipe} />);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
