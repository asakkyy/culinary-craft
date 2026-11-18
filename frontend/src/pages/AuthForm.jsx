import FormError from '../components/FormError';
import { useState } from 'react';
import { api, errorText } from '../api/client';
import { useApp } from '../context/AppContext';
import { Link, useLocation, useNavigate } from 'react-router-dom';

function loginDestination(from) {
  if (typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//')) return '/';
  const origin = window.location.origin;
  try {
    const { origin: destinationOrigin, pathname, search, hash } = new URL(from, origin);
    const route = decodeURIComponent(pathname);
    if (destinationOrigin === origin && !route.startsWith('//') && !/^\/(login|register)\/?$/i.test(route)) {
      return { pathname, search, hash };
    }
  } catch {
    return '/';
  }
  return '/';
}

export default function AuthForm({ register: signup = false }) {
  const { user, login, logout } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (user) await logout();
      else {
        if (signup) await api.register({ name, email, password });
        await login({ email, password });
        setPassword('');
        if (signup) navigate('/resend-verification', { replace: true });
        else navigate(loginDestination(location.state?.from), { replace: true });
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="container narrow-page auth-page">
      <div className="eyebrow">Ваша книга рецептов</div>
      <h1>{user ? user.name : signup ? 'Регистрация' : 'Вход'}</h1>
      <p>
        {user
          ? 'Вы вошли в свой аккаунт'
          : signup
            ? 'Сохраняйте любимые блюда и делитесь собственными рецептами'
            : 'Вернитесь к сохранённым рецептам и своей кухне'}
      </p>
      {location.state?.notice && <p role="status">{location.state.notice}</p>}
      {error && <FormError>{error}</FormError>}
      <form onSubmit={submit}>
        {!user && (
          <>
            {signup && (
              <div className="field">
                <label htmlFor="auth-name">Имя</label>
                <input
                  id="auth-name"
                  name="auth-name"
                  required
                  minLength={2}
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}
            <div className="field">
              <label htmlFor="auth-email">Email</label>
              <input
                id="auth-email"
                name="auth-email"
                type="email"
                spellCheck={false}
                autoComplete="username"
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="auth-password">Пароль</label>
              <input
                id="auth-password"
                name="auth-password"
                type="password"
                autoComplete={signup ? 'new-password' : 'current-password'}
                required
                minLength={signup ? 12 : 1}
                maxLength={64}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </>
        )}
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Подождите…' : user ? 'Выйти' : signup ? 'Создать аккаунт' : 'Войти'}
        </button>
        {!user && (
          <Link to={signup ? '/login' : '/register'} state={location.state} className="btn btn-outline">
            {signup ? 'Уже есть аккаунт' : 'Регистрация'}
          </Link>
        )}
      </form>
      <p>
        <Link to="/forgot-password">Забыли пароль?</Link>
      </p>
    </section>
  );
}
