import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CatalogPage from './CatalogPage';
import { api } from '../api/client';
import { useApp } from '../context/AppContext';
import { recipe, renderPage } from '../test/testHelpers';

vi.mock('../api/client', () => ({ api: { catalog: vi.fn() }, errorText: (err) => err.message }));
vi.mock('../context/AppContext', () => ({ useApp: vi.fn() }));

beforeEach(() => {
  useApp.mockReturnValue({ dataVersion: 0, user: null, requireUser: vi.fn() });
  api.catalog.mockResolvedValue({ content: [recipe], total: 1, totalPages: 1 });
});

describe('Каталог: пользовательские сценарии', () => {
  it('ограничивает число кнопок для большого каталога', async () => {
    api.catalog.mockResolvedValue({ content: [recipe], total: 600000, totalPages: 100000 });
    renderPage(<CatalogPage/>);
    expect(await screen.findByRole('navigation', { name: 'Страницы каталога' })).toBeInTheDocument();
    expect(screen.getAllByRole('button').length).toBeLessThan(25);
    expect(screen.getByRole('button', { name: '100000', exact: true })).toBeInTheDocument();
  });
  it('показывает доступное сообщение ошибки сервера', async () => {
    api.catalog.mockRejectedValueOnce(new Error('Сервер временно недоступен'));
    renderPage(<CatalogPage/>);
    expect(await screen.findByRole('alert')).toHaveTextContent('Сервер временно недоступен');
  });
  it('показывает список рецептов и число результатов', async () => {
    renderPage(<CatalogPage />);
    expect(await screen.findByText('Тестовый домашний суп')).toBeInTheDocument();
    expect(screen.getByText('Найдено 1 рецептов')).toBeInTheDocument();
  });

  it('передаёт строку поиска в REST API', async () => {
    const user = userEvent.setup();
    renderPage(<CatalogPage />);
    await user.type(screen.getByRole('textbox', { name: 'Поиск рецептов' }), 'паста');
    await user.click(screen.getByRole('button', { name: /Найти$/ }));
    await waitFor(() => expect(api.catalog).toHaveBeenCalledWith(expect.objectContaining({ search: 'паста' })));
  });

  it('фильтрует по категории', async () => {
    const user = userEvent.setup();
    renderPage(<CatalogPage />);
    await user.click(screen.getByRole('button', { name: /Десерты/ }));
    await waitFor(() => expect(api.catalog).toHaveBeenCalledWith(expect.objectContaining({ category: 'Десерты' })));
  });

  it('передаёт выбранную сортировку', async () => {
    const user = userEvent.setup();
    renderPage(<CatalogPage />);
    await user.selectOptions(screen.getByLabelText('Сортировка:'), 'quick');
    await waitFor(() => expect(api.catalog).toHaveBeenCalledWith(expect.objectContaining({ sort: 'quick' })));
  });

  it('переходит на следующую страницу', async () => {
    api.catalog.mockResolvedValue({ content: [recipe], total: 10, totalPages: 2 });
    const user = userEvent.setup();
    renderPage(<CatalogPage />);
    await user.click(await screen.findByRole('button', { name: 'Далее' }));
    await waitFor(() => expect(api.catalog).toHaveBeenCalledWith(expect.objectContaining({ page: 1 })));
  });

  it('показывает пустую выдачу и позволяет сбросить фильтры', async () => {
    api.catalog.mockResolvedValue({ content: [], total: 0, totalPages: 0 });
    renderPage(<CatalogPage />);
    expect(await screen.findByText('Пока ничего не нашли')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Сбросить фильтры' })).toBeInTheDocument();
  });
});
