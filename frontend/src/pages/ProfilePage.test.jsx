import { beforeEach, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfilePage from './ProfilePage';
import { api } from '../api/client';
import { useApp } from '../context/AppContext';
import { anna, recipe, renderPage } from '../test/testHelpers';

vi.mock('../api/client', () => ({ api: { mine: vi.fn(), favorites: vi.fn() }, errorText: (e) => e.message }));
vi.mock('../context/AppContext', () => ({ useApp: vi.fn() }));

beforeEach(() => {
  useApp.mockReturnValue({ user: anna, dataVersion: 0, setPickerOpen: vi.fn() });
  api.mine.mockResolvedValue([{ ...recipe, status: 'PENDING' }]);
  api.favorites.mockResolvedValue([{ ...recipe, status: 'APPROVED' }]);
});

it('показывает имя владельца и его рецепты', async () => {
  renderPage(<ProfilePage />);
  expect(screen.getByRole('heading', { name: 'Анна Петрова' })).toBeInTheDocument();
  expect(await screen.findByText('На модерации')).toBeInTheDocument();
});

it('открывает сохранённые рецепты в избранном', async () => {
  renderPage(<ProfilePage view="favorites" />);
  expect(await screen.findByRole('heading', { name: 'Любимые рецепты' })).toBeInTheDocument();
  expect(await screen.findByText('Тестовый домашний суп')).toBeInTheDocument();
});

it('предлагает гостю войти в свою книгу рецептов', () => {
  useApp.mockReturnValue({ user: null, setPickerOpen: vi.fn() });
  renderPage(<ProfilePage />);
  expect(screen.getByRole('heading', { name: 'Ваша книга рецептов' })).toBeInTheDocument();
});
it('позволяет восстановить список после сетевой ошибки без ложных нулевых счётчиков', async () => {
  api.mine.mockRejectedValueOnce(new Error('Нет сети'));
  renderPage(<ProfilePage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Нет сети');
  expect(document.querySelector('.profile-stats')).toHaveTextContent('—');
  await userEvent.click(screen.getByRole('button', { name: 'Повторить загрузку' }));
  expect(await screen.findByText('Тестовый домашний суп')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
