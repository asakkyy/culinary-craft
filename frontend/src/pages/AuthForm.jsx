import { useState } from 'react';
import { api, errorText } from '../api/client';
import { useApp } from '../context/AppContext';
import { Link, useLocation, useNavigate } from 'react-router-dom';

export default function AuthForm({ register = false }) {
  const { user, login, logout } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [signup, setSignup] = useState(register);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      if (user) await logout();
      else {
        if (signup) await api.register({ name, email, password });
        await login({ email, password });
        setPassword('');
        if (location.state?.from) navigate(location.state.from, { replace: true });
      }
    } catch (err) { setError(errorText(err)); }
    finally { setBusy(false); }
  }
  return <section className="container narrow-page"><h1>{user ? user.name : signup ? 'Регистрация' : 'Вход'}</h1>
    {user && user.emailVerified === false && <p role="status">Подтвердите email из письма, чтобы создавать рецепты, отзывы и жалобы. <Link to="/resend-verification">Отправить письмо повторно</Link></p>}
    {error && <p className="error-box" role="alert">{error}</p>}
    <form onSubmit={submit}>
      {!user && <>
        {signup && <div className="field"><label htmlFor="auth-name">Имя</label><input id="auth-name" required minLength={2} maxLength={80} value={name} onChange={e => setName(e.target.value)}/></div>}
        <div className="field"><label htmlFor="auth-email">Email</label><input id="auth-email" type="email" autoComplete="username" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)}/></div>
        <div className="field"><label htmlFor="auth-password">Пароль</label><input id="auth-password" type="password" autoComplete={signup ? 'new-password' : 'current-password'} required minLength={signup ? 12 : 1} maxLength={64} value={password} onChange={e => setPassword(e.target.value)}/></div>
      </>}
      <button className="btn btn-primary" disabled={busy}>{busy ? 'Подождите…' : user ? 'Выйти' : signup ? 'Создать аккаунт' : 'Войти'}</button>
      {!user && <button type="button" className="btn btn-outline" onClick={() => setSignup(!signup)}>{signup ? 'Уже есть аккаунт' : 'Регистрация'}</button>}
    </form>
    <p><Link to="/forgot-password">Забыли пароль?</Link> · <Link to="/resend-verification">Подтвердить email</Link></p>
  </section>;
}
