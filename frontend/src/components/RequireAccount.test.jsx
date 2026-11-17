import { expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { renderPage } from '../test/testHelpers';
import RequireAccount from './RequireAccount';
vi.mock('../context/AppContext', () => ({ useApp: vi.fn() }));
it('направляет гостя на вход', () => {
  useApp.mockReturnValue({ user: null, authLoading: false });
  renderPage(<Routes><Route path="/" element={<RequireAccount>Private</RequireAccount>}/><Route path="/login" element={<h1>Login</h1>}/></Routes>);
  expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument();
});
it('не открывает административную страницу пользователю', () => {
  useApp.mockReturnValue({ user: { role: 'USER' }, authLoading: false });
  renderPage(<RequireAccount admin>Private</RequireAccount>);
  expect(screen.getByText('Доступ только для администратора')).toBeInTheDocument();
});
it('ожидает восстановление сессии', () => {
  useApp.mockReturnValue({ user: null, authLoading: true });
  renderPage(<RequireAccount>Private</RequireAccount>);
  expect(screen.getByRole('status')).toBeInTheDocument();
});
