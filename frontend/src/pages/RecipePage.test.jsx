import { beforeEach, expect, it, vi } from 'vitest';
import { screen, waitFor, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RecipePage from './RecipePage';
import { api } from '../api/client';
import { useApp } from '../context/AppContext';
import { anna, recipe } from '../test/testHelpers';

vi.mock('../api/client', () => ({ api: {
  one: vi.fn(), reviews: vi.fn(), toggleFavorite: vi.fn(), addReview: vi.fn(), remove: vi.fn(),
}, errorText: (e) => e.message }));
vi.mock('../context/AppContext', () => ({ useApp: vi.fn() }));

const display = () => render(<MemoryRouter initialEntries={['/recipes/123']}><Routes>
  <Route path="/recipes/:id" element={<RecipePage />} />
</Routes></MemoryRouter>);

beforeEach(() => {
  useApp.mockReturnValue({ user: anna, dataVersion: 0, requireUser: () => true, notify: vi.fn(), showError: vi.fn(), changed: vi.fn() });
  api.one.mockResolvedValue(recipe);
  api.reviews.mockResolvedValue([]);
  api.toggleFavorite.mockResolvedValue({ favorite: true });
  api.addReview.mockResolvedValue({});
});

it('показывает ингредиенты и шаги рецепта', async () => {
  display();
  expect(await screen.findByRole('heading', { name: 'Тестовый домашний суп' })).toBeInTheDocument();
  expect(screen.getByText('Морковь')).toBeInTheDocument();
  expect(screen.getByText('Нарезать')).toBeInTheDocument();
});

it('сохраняет рецепт в избранном', async () => {
  const user = userEvent.setup();
  display();
  await user.click(await screen.findByRole('button', { name: 'Сохранить' }));
  await waitFor(() => expect(api.toggleFavorite).toHaveBeenCalledWith('123'));
});

it('публикует отзыв и оценку', async () => {
  const user = userEvent.setup();
  display();
  await user.click(await screen.findByRole('button', { name: 'Оценка 4' }));
  await user.type(screen.getByRole('textbox', { name: 'Твой отзыв' }), 'Отличный вкусный суп');
  await user.click(screen.getByRole('button', { name: /Опубликовать/ }));
  await waitFor(() => expect(api.addReview).toHaveBeenCalledWith('123', { rating: 4, comment: 'Отличный вкусный суп' }));
});

it('скрывает отзыв, если пользователь уже оценивал рецепт', async () => {
  api.reviews.mockResolvedValue([{ id: 5, authorId: 1, authorName: 'Анна', rating: 5, comment: 'Отлично', createdAt: '2026-01-01T00:00:00Z' }]);
  display();
  expect(await screen.findByText('Ты уже оценил этот рецепт')).toBeInTheDocument();
});
