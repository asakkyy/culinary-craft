import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Mail, KeyRound } from 'lucide-react';
import { api, errorText } from '../api/client';
import { useApp } from '../context/AppContext';

export default function RecoveryPage({ mode }) {
  const app = useApp();
  const navigate = useNavigate();
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') || '');
  const [email, setEmail] = useState(app?.user?.email || '');
  const [password, setPassword] = useState('');
  const [now, setNow] = useState(Date.now());
  const [deadline, setDeadline] = useState(0);
  const cooldownKey = `cc-mail-after:${mode}:${email.toLowerCase()}`;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname);
  }, []);
  useEffect(() => {
    if (app?.user?.email) setEmail(app.user.email);
  }, [app?.user?.email]);
  useEffect(() => {
    setDeadline(Number(sessionStorage.getItem(cooldownKey)) || 0);
    setNow(Date.now());
  }, [cooldownKey]);
  useEffect(() => {
    if (deadline <= Date.now()) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [deadline]);
  const remaining = Math.max(0, Math.ceil((deadline - now) / 1000));
  const titles = { forgot: 'Восстановление пароля', resend: 'Подтверждение email', verify: 'Подтвердить email', reset: 'Новый пароль' };
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'forgot' || mode === 'resend') {
        const result = await (mode === 'forgot' ? api.requestPassword({ email }) : api.requestVerification({ email }));
        setMessage(result.message);
        const after = Date.now() + 60000;
        setNow(Date.now());
        setDeadline(after);
        sessionStorage.setItem(cooldownKey, String(after));
      } else {
        if (mode === 'verify') {
          await api.verifyEmail({ token });
          if (app?.user) await app.refreshUser();
          app?.notify?.('Email подтверждён');
          navigate(app?.user ? '/profile' : '/login', { replace: true, state: { notice: 'Email подтверждён. Войдите в аккаунт.' } });
        } else {
          await api.resetPassword({ token, password });
          app?.forgetUser();
        }
        setPassword('');
        setMessage(
          mode === 'verify'
            ? 'Email подтверждён. Теперь можно публиковать рецепты и отзывы.'
            : 'Пароль изменён. Войдите с новым паролем. Старые сессии отозваны.',
        );
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  const linkAction = mode === 'verify' || mode === 'reset';
  if ((mode === 'resend' || mode === 'verify') && app?.authLoading)
    return (
      <p className="loading-message" role="status">
        Проверяем аккаунт…
      </p>
    );
  if ((mode === 'resend' || mode === 'verify') && app?.user?.emailVerified) return <Navigate to="/profile" replace />;
  return (
    <section className="container narrow-page auth-page">
      <div className="auth-symbol">{mode === 'forgot' || mode === 'reset' ? <KeyRound /> : <Mail />}</div>
      <h1>{titles[mode]}</h1>
      <p>
        {mode === 'resend'
          ? 'Подтверждение адреса защищает ваш аккаунт. До подтверждения доступны вход и настройки. Публикация рецептов, отзывы, избранное и жалобы станут доступны после подтверждения.'
          : 'Никому не передавайте ссылку из письма. Она действует один раз.'}
      </p>
      {mode === 'resend' && (
        <p className="info-note">Письмо отправляется только по кнопке «Отправить письмо». Не чаще раза в минуту и до пяти раз в сутки.</p>
      )}
      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {linkAction && !token ? (
        <p role="alert">Откройте полную ссылку из письма либо запросите новую.</p>
      ) : (
        (!message || !linkAction) && (
          <form onSubmit={submit}>
            {!linkAction && (
              <div className="field">
                <label htmlFor="recovery-email">Email аккаунта</label>
                <input
                  id="recovery-email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            )}
            {mode === 'reset' && (
              <div className="field">
                <label htmlFor="recovery-password">Новый пароль</label>
                <input
                  id="recovery-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={64}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}
            <button className="btn btn-primary" disabled={busy || (!linkAction && remaining > 0)}>
              {busy
                ? 'Отправляем…'
                : mode === 'verify'
                  ? 'Подтвердить email'
                  : mode === 'reset'
                    ? 'Сохранить новый пароль'
                    : 'Отправить письмо'}
            </button>
            {!linkAction && remaining > 0 && (
              <p className="muted" aria-live="polite">
                Повторная отправка через {remaining} с
              </p>
            )}
          </form>
        )
      )}
      <p>
        <Link to="/login">Вход</Link> · <Link to="/resend-verification">Повторить подтверждение</Link> ·{' '}
        <Link to="/forgot-password">Восстановить пароль</Link>
      </p>
    </section>
  );
}
