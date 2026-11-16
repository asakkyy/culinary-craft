import { beforeEach, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, MemoryRouter } from 'react-router-dom';
import { render } from '@testing-library/react';
import EditorPage from './EditorPage';
import { api } from '../api/client';
import { useApp } from '../context/AppContext';
import { anna, recipe, renderPage } from '../test/testHelpers';

vi.mock('../api/client', () => ({ api: { create: vi.fn(), update: vi.fn(), one: vi.fn() }, errorText: (e) => e.message }));
vi.mock('../context/AppContext', () => ({ useApp: vi.fn() }));

beforeEach(() => {
  useApp.mockReturnValue({ user: anna, setPickerOpen: vi.fn(), notify: vi.fn(), changed: vi.fn() });
  api.create.mockResolvedValue({ id: 456, status: 'PENDING' });
  api.update.mockResolvedValue({ id: 123, status: 'PENDING' });
  api.one.mockResolvedValue(recipe);
});

it('неавторизованный гость не видит форму создания', () => {
  useApp.mockReturnValue({ user: null, setPickerOpen: vi.fn() });
  renderPage(<EditorPage />);
  expect(screen.getByText('Авторизуйся в демо-режиме')).toBeInTheDocument();
});

it('динамически добавляет ингредиенты и шаги', async () => {
  const user = userEvent.setup();
  renderPage(<EditorPage />);
  await user.click(screen.getByRole('button', { name: 'Добавить ингредиент' }));
  await user.click(screen.getByRole('button', { name: 'Добавить шаг' }));
  expect(screen.getAllByRole('textbox', { name: /^Ингредиент \d/ })).toHaveLength(3);
  expect(screen.getAllByRole('textbox', { name: /^Шаг \d/ })).toHaveLength(3);
});

it('валидирует ингредиенты и шаги на уровне формы', async () => {
  const user = userEvent.setup();
  renderPage(<EditorPage />);
  await user.type(screen.getByLabelText(/Название рецепта/), 'Домашний суп');
  await user.type(screen.getByLabelText(/Краткое описание/), 'Вкусный суп для семейного обеда и ужина');
  await user.click(screen.getByRole('button', { name: 'Отправить рецепт' }));
  expect(await screen.findByText('Добавь хотя бы один ингредиент и один шаг.')).toBeInTheDocument();
  expect(api.create).not.toHaveBeenCalled();
});

it('отправляет данные формы в API для модерации', async () => {
  const user = userEvent.setup();
  renderPage(<EditorPage />);
  await user.type(screen.getByLabelText(/Название рецепта/), 'Домашний суп');
  await user.type(screen.getByLabelText(/Краткое описание/), 'Вкусный суп для семейного обеда и ужина');
  await user.type(screen.getByRole('textbox', { name: 'Ингредиент 1' }), 'Морковь');
  await user.type(screen.getByRole('textbox', { name: 'Шаг 1' }), 'Нарезать овощи');
  await user.type(screen.getByLabelText('Теги через запятую'), 'Домашнее, Быстро');
  await user.click(screen.getByRole('button', { name: 'Отправить рецепт' }));
  await waitFor(() => expect(api.create).toHaveBeenCalledWith(expect.objectContaining({
    title: 'Домашний суп', ingredients: ['Морковь'], steps: ['Нарезать овощи'], tags: ['Домашнее', 'Быстро'],
  })));
});

it('загружает существующий рецепт для редактирования', async () => {
  render(<MemoryRouter initialEntries={['/recipes/123/edit']}><Routes>
    <Route path="/recipes/:id/edit" element={<EditorPage />} />
  </Routes></MemoryRouter>);
  expect(await screen.findByDisplayValue('Тестовый домашний суп')).toBeInTheDocument();
  expect(api.one).toHaveBeenCalledWith('123');
});
