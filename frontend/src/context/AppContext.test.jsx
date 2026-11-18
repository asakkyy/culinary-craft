import { StrictMode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProvider, useApp } from './AppContext';
import { api } from '../api/client';
vi.mock('../api/client', () => ({ api: { me: vi.fn(), login: vi.fn(), logout: vi.fn() }, errorText: (e) => e.message }));
const account = { id: 7, name: 'Автор', emailVerified: true };
function Probe() {
  const app = useApp();
  return (
    <>
      <p>{app.user?.name || 'Гость'}</p>
      <button onClick={() => app.login({})}>Вход</button>
      <button onClick={app.logout}>Выход</button>
      <button onClick={app.refreshUser}>Обновить</button>
    </>
  );
}
beforeEach(() => {
  api.login.mockResolvedValue(account);
  api.logout.mockResolvedValue();
});
it('делит начальный запрос в StrictMode и не возвращает аккаунт из позднего ответа после logout', async () => {
  let resolve;
  api.me.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  render(
    <StrictMode>
      <AppProvider>
        <Probe />
      </AppProvider>
    </StrictMode>,
  );
  expect(api.me).toHaveBeenCalledTimes(1);
  await userEvent.click(screen.getByRole('button', { name: 'Вход' }));
  expect(screen.getByText('Автор')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Выход' }));
  await act(async () => {
    resolve(account);
  });
  expect(screen.getByText('Гость')).toBeInTheDocument();
});
it('обновляет подтверждение с сервера при возвращении в вкладку без отправки писем', async () => {
  api.me.mockResolvedValueOnce({ ...account, name: 'До подтверждения', emailVerified: false }).mockResolvedValueOnce(account);
  render(
    <AppProvider>
      <Probe />
    </AppProvider>,
  );
  await screen.findByText('До подтверждения');
  act(() => window.dispatchEvent(new Event('focus')));
  await waitFor(() => expect(screen.getByText('Автор')).toBeInTheDocument());
  expect(api.me).toHaveBeenCalledTimes(2);
});
it('не восстанавливает аккаунт поздним ответом login после выхода', async () => {
  api.me.mockResolvedValue(null);
  let resolve;
  api.login.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  render(
    <AppProvider>
      <Probe />
    </AppProvider>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Вход' }));
  await userEvent.click(screen.getByRole('button', { name: 'Выход' }));
  await act(async () => resolve(account));
  expect(screen.getByText('Гость')).toBeInTheDocument();
});
it('не перезаписывает обновлённый аккаунт старым me, начатым до подтверждения', async () => {
  let resolve;
  api.me
    .mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    )
    .mockResolvedValueOnce({ ...account, name: 'Подтверждённый автор' });
  render(
    <AppProvider>
      <Probe />
    </AppProvider>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Обновить' }));
  await screen.findByText('Подтверждённый автор');
  await act(async () => resolve({ ...account, name: 'Старое состояние', emailVerified: false }));
  expect(screen.getByText('Подтверждённый автор')).toBeInTheDocument();
});
