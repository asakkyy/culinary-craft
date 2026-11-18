import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import EditorPage from './EditorPage';
import { api } from '../api/client';
import { useApp } from '../context/AppContext';
import { anna, recipe } from '../test/testHelpers';

vi.mock('../api/client', () => ({
  api: { create: vi.fn(), update: vi.fn(), one: vi.fn(), photo: vi.fn(), deletePhoto: vi.fn() },
  errorText: (e) => e.message,
}));
vi.mock('../context/AppContext', () => ({ useApp: vi.fn() }));

const createKey = 'cc-recipe-draft:1:create';
const title = () => screen.getByRole('textbox', { name: /Название рецепта/ });

function renderEditor(path = '/create') {
  const router = createMemoryRouter(
    [
      { path: '/create', element: <EditorPage /> },
      { path: '/recipes/:id/edit', element: <EditorPage /> },
      { path: '/recipes/:id', element: <p>Сохранённый рецепт</p> },
      { path: '/profile', element: <p>Моя кухня</p> },
    ],
    { initialEntries: ['/profile', path] },
  );
  return { ...render(<RouterProvider router={router} />), router };
}

function changeTitle(value) {
  fireEvent.change(title(), { target: { value } });
}

async function persistDraft() {
  expect(await screen.findByText('Черновик сохранён')).toBeVisible();
}

function fillRequired() {
  changeTitle('Домашний суп');
  fireEvent.change(screen.getByLabelText(/Краткое описание/), { target: { value: 'Вкусный суп для семейного обеда и ужина' } });
  fireEvent.change(screen.getByLabelText('Ингредиент 1'), { target: { value: 'Морковь' } });
  fireEvent.change(screen.getByLabelText('Шаг 1'), { target: { value: 'Нарезать овощи' } });
}

beforeEach(() => {
  localStorage.clear();
  useApp.mockReturnValue({ user: anna, setPickerOpen: vi.fn(), notify: vi.fn(), changed: vi.fn() });
  api.create.mockResolvedValue({ id: 456, status: 'PENDING' });
  api.update.mockResolvedValue({ id: 123, status: 'PENDING' });
  api.one.mockResolvedValue(recipe);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('неавторизованный гость не видит форму создания', () => {
  useApp.mockReturnValue({ user: null, setPickerOpen: vi.fn() });
  renderEditor();
  expect(screen.getByText('Войдите, чтобы создать рецепт')).toBeInTheDocument();
});

it('динамически добавляет ингредиенты и шаги', async () => {
  const user = userEvent.setup();
  renderEditor();
  await user.click(screen.getByRole('button', { name: 'Добавить ингредиент' }));
  await user.click(screen.getByRole('button', { name: 'Добавить шаг' }));
  expect(screen.getAllByRole('textbox', { name: /^Ингредиент \d/ })).toHaveLength(3);
  expect(screen.getAllByRole('textbox', { name: /^Шаг \d/ })).toHaveLength(3);
});

it('валидирует ингредиенты и шаги на уровне формы', async () => {
  const user = userEvent.setup();
  renderEditor();
  await user.type(screen.getByLabelText(/Название рецепта/), 'Домашний суп');
  await user.type(screen.getByLabelText(/Краткое описание/), 'Вкусный суп для семейного обеда и ужина');
  await user.click(screen.getByRole('button', { name: 'Отправить рецепт' }));
  expect(await screen.findByText('Добавь хотя бы один ингредиент и один шаг.')).toBeInTheDocument();
  expect(api.create).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveFocus();
  await user.type(screen.getByRole('textbox', { name: 'Ингредиент 1' }), 'Морковь');
  expect(screen.getByRole('textbox', { name: 'Ингредиент 1' })).toHaveFocus();
});

it('отправляет данные формы в API для модерации', async () => {
  const user = userEvent.setup();
  renderEditor();
  await user.type(screen.getByLabelText(/Название рецепта/), 'Домашний суп');
  await user.type(screen.getByLabelText(/Краткое описание/), 'Вкусный суп для семейного обеда и ужина');
  await user.type(screen.getByRole('textbox', { name: 'Ингредиент 1' }), 'Морковь');
  await user.type(screen.getByRole('textbox', { name: 'Шаг 1' }), 'Нарезать овощи');
  await user.type(screen.getByLabelText('Теги через запятую'), 'Домашнее, Быстро');
  await user.click(screen.getByRole('button', { name: 'Отправить рецепт' }));
  await waitFor(() =>
    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Домашний суп',
        ingredients: ['Морковь'],
        steps: ['Нарезать овощи'],
        tags: ['Домашнее', 'Быстро'],
      }),
    ),
  );
});

it('загружает существующий рецепт для редактирования', async () => {
  renderEditor('/recipes/123/edit');
  expect(await screen.findByDisplayValue('Тестовый домашний суп')).toBeInTheDocument();
  expect(api.one).toHaveBeenCalledWith('123');
});
it('не показывает пустую форму редактирования после ошибки загрузки', async () => {
  api.one.mockRejectedValueOnce(new Error('Рецепт не найден'));
  renderEditor('/recipes/404/edit');
  expect(await screen.findByRole('alert')).toHaveTextContent('Рецепт не найден');
  expect(screen.queryByRole('button', { name: 'Сохранить изменения' })).not.toBeInTheDocument();
});

it('записывает только последнее значение после debounce и предлагает восстановить его', () => {
  vi.useFakeTimers();
  const mounted = renderEditor();
  changeTitle('Первый вариант');
  act(() => vi.advanceTimersByTime(250));
  changeTitle('Второй вариант');
  act(() => vi.advanceTimersByTime(250));
  expect(localStorage.getItem(createKey)).toBeNull();
  act(() => vi.advanceTimersByTime(250));
  expect(localStorage.getItem(createKey)).toContain('Второй вариант');
  expect(localStorage.getItem(createKey)).not.toContain('Первый вариант');
  mounted.unmount();
  renderEditor();
  expect(screen.getByRole('dialog', { name: 'Найден черновик' }).querySelector('time')).toBeInTheDocument();
  expect(title()).toHaveValue('');
  fireEvent.click(screen.getByRole('button', { name: 'Восстановить черновик' }));
  expect(title()).toHaveValue('Второй вариант');
});

it('предупреждает при Back, позволяет остаться и сохраняет при подтверждении ухода', async () => {
  const { router } = renderEditor();
  changeTitle('Черновик перед уходом');
  await act(() => router.navigate(-1));
  expect(screen.getByRole('dialog', { name: 'Выйти из редактора?' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(title()).toHaveValue('Черновик перед уходом');
  await act(() => router.navigate(-1));
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить черновик и выйти' }));
  expect(await screen.findByText('Моя кухня')).toBeVisible();
  expect(localStorage.getItem(createKey)).toContain('Черновик перед уходом');
});

it('показывает изменения сервера перед восстановлением и оставляет поля, которые пользователь не менял', async () => {
  const mounted = renderEditor('/recipes/123/edit');
  await screen.findByDisplayValue(recipe.title);
  changeTitle('Локальный вариант');
  await persistDraft();
  mounted.unmount();
  api.one.mockResolvedValue({ ...recipe, title: 'Серверный вариант', description: 'Новое описание на сервере', imageUrl: '/api/media/server-photo' });
  renderEditor('/recipes/123/edit');
  expect(await screen.findByText(/Рецепт на сервере изменился/)).toBeVisible();
  expect(title()).toHaveValue('Серверный вариант');
  fireEvent.click(screen.getByRole('button', { name: 'Восстановить черновик' }));
  expect(title()).toHaveValue('Локальный вариант');
  expect(screen.getByLabelText(/Краткое описание/)).toHaveValue('Новое описание на сервере');
  expect(screen.getByLabelText('Ссылка на фотографию')).toHaveValue('/api/media/server-photo');
});

it('отделяет создание, редактирование каждого рецепта и разных пользователей, сохраняя привязку при смене email', async () => {
  const editing = renderEditor('/recipes/123/edit');
  await screen.findByDisplayValue(recipe.title);
  changeTitle('Черновик рецепта 123');
  editing.unmount();
  const otherRecipe = renderEditor('/recipes/124/edit');
  expect(await screen.findByDisplayValue(recipe.title)).toBeVisible();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  otherRecipe.unmount();
  const creating = renderEditor();
  expect(title()).toHaveValue('');
  changeTitle('Черновик Анны');
  creating.unmount();
  useApp.mockReturnValue({ user: null });
  renderEditor().unmount();
  useApp.mockReturnValue({ user: { ...anna, id: 2 } });
  const otherUser = renderEditor();
  expect(title()).toHaveValue('');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  otherUser.unmount();
  useApp.mockReturnValue({ user: { ...anna, email: 'new@example.test' } });
  renderEditor();
  fireEvent.click(screen.getByRole('button', { name: 'Восстановить черновик' }));
  expect(title()).toHaveValue('Черновик Анны');
});

it.each(['{bad', '{"version":999}', '{"version":1,"savedAt":1,"fields":{"title":{"before":"","value":{}}}}'])(
  'обрабатывает повреждённый или несовместимый черновик (%s)',
  (stored) => {
    localStorage.setItem(createKey, stored);
    renderEditor();
    expect(screen.getByText(/Черновик повреждён или несовместим/)).toBeVisible();
    expect(localStorage.getItem(createKey)).toBe(stored);
    fireEvent.click(screen.getByRole('button', { name: 'Начать заново' }));
    expect(title()).toHaveValue('');
    expect(localStorage.getItem(createKey)).toBeNull();
  },
);

it('начинает заново только после явного отказа от сохранённого черновика', () => {
  const mounted = renderEditor();
  changeTitle('Удаляемый черновик');
  mounted.unmount();
  renderEditor();
  expect(localStorage.getItem(createKey)).toContain('Удаляемый черновик');
  fireEvent.click(screen.getByRole('button', { name: 'Начать заново' }));
  expect(title()).toHaveValue('');
  expect(localStorage.getItem(createKey)).toBeNull();
});

it('показывает ошибку localStorage и сохраняет форму доступной', async () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('Storage is full', 'QuotaExceededError');
  });
  renderEditor();
  changeTitle('Ввод доступен');
  expect(await screen.findByText(/Не удалось сохранить черновик/)).toBeVisible();
  expect(title()).toHaveValue('Ввод доступен');
});

it('оставляет черновик при ошибке API и удаляет только его после успешной отправки', async () => {
  const otherKey = 'cc-recipe-draft:2:create';
  localStorage.setItem(otherKey, 'unrelated');
  api.create.mockRejectedValueOnce(new Error('Сервер временно недоступен'));
  renderEditor();
  fillRequired();
  fireEvent.click(screen.getByRole('button', { name: 'Отправить рецепт' }));
  expect(await screen.findByText('Сервер временно недоступен')).toBeVisible();
  expect(localStorage.getItem(createKey)).toContain('Домашний суп');
  fireEvent.click(screen.getByRole('button', { name: 'Отправить рецепт' }));
  expect(await screen.findByText('Сохранённый рецепт')).toBeVisible();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(localStorage.getItem(createKey)).toBeNull();
  expect(localStorage.getItem(otherKey)).toBe('unrelated');
});

function choosePhoto() {
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = () => 'blob:local-preview';
      static revokeObjectURL = vi.fn();
    },
  );
  const file = new File(['test photo'], 'photo.png', { type: 'image/png' });
  fireEvent.change(screen.getByLabelText('Фотография рецепта'), { target: { files: [file] } });
}

it('хранит признак нового фото без файла, object URL и приватной ссылки', async () => {
  const mounted = renderEditor();
  changeTitle('Фотография дома');
  fireEvent.change(screen.getByLabelText('Ссылка на фотографию'), {
    target: { value: 'https://example.test/photo.png?token=test-placeholder' },
  });
  choosePhoto();
  await persistDraft();
  const stored = localStorage.getItem(createKey);
  expect(stored).toContain('"photo":"select"');
  expect(stored).not.toMatch(/blob:|photo\.png|token|test photo/);
  mounted.unmount();
  renderEditor();
  fireEvent.click(screen.getByRole('button', { name: 'Восстановить черновик' }));
  expect(screen.getByText(/выберите файл фотографии заново/)).toBeVisible();
  expect(screen.getByLabelText('Ссылка на фотографию')).toHaveValue('');
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});

it('после сбоя загрузки фото продолжает работу с созданным рецептом без повторного POST', async () => {
  const mounted = renderEditor();
  fillRequired();
  choosePhoto();
  api.photo.mockRejectedValueOnce(new Error('Ошибка загрузки файла'));
  fireEvent.click(screen.getByRole('button', { name: 'Отправить рецепт' }));
  expect(await screen.findByText('Ошибка загрузки файла')).toBeVisible();
  mounted.unmount();
  api.one.mockResolvedValue({ ...recipe, id: 456, title: 'Домашний суп' });
  renderEditor();
  fireEvent.click(await screen.findByRole('button', { name: 'Восстановить черновик' }));
  expect(screen.getByText(/выберите файл фотографии заново/)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Отправить рецепт' }));
  expect(await screen.findByText('Сохранённый рецепт')).toBeVisible();
  expect(api.create).toHaveBeenCalledTimes(1);
  expect(api.update).toHaveBeenCalledWith(456, expect.objectContaining({ title: 'Домашний суп' }));
  expect(localStorage.getItem(createKey)).toBeNull();
});

it('синхронно сохраняет последний ввод перед уходом и предупреждает только при изменениях', () => {
  renderEditor();
  const beforeUnload = () => new Event('beforeunload', { cancelable: true });
  expect(window.dispatchEvent(beforeUnload())).toBe(true);
  changeTitle('Последние секунды');
  expect(window.dispatchEvent(beforeUnload())).toBe(false);
  expect(localStorage.getItem(createKey)).toContain('Последние секунды');
});

it('не перезаписывает черновик, который обновила другая вкладка', async () => {
  renderEditor();
  changeTitle('Локальная правка');
  localStorage.setItem(createKey, 'правка из другой вкладки');
  expect(await screen.findByText(/Не удалось сохранить черновик/)).toBeVisible();
  expect(localStorage.getItem(createKey)).toBe('правка из другой вкладки');
  expect(title()).toHaveValue('Локальная правка');
});

it('показывает только один диалог, если нажать Back во время удаления черновика', async () => {
  const { router } = renderEditor();
  changeTitle('Черновик с подтверждением');
  fireEvent.click(screen.getByRole('button', { name: 'Удалить черновик' }));
  expect(screen.getByRole('dialog', { name: 'Удалить черновик?' })).toBeVisible();
  await act(() => router.navigate(-1));
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  expect(screen.getByRole('dialog', { name: 'Выйти из редактора?' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
  expect(screen.getByRole('dialog', { name: 'Удалить черновик?' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
  expect(document.body.style.overflow).toBe('');
  expect(title()).toHaveValue('Черновик с подтверждением');
});
