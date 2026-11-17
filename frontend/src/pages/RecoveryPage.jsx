import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorText } from '../api/client';

export default function RecoveryPage({ mode }) {
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') || '');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  useEffect(() => { if (window.location.hash) window.history.replaceState(null, '', window.location.pathname); }, []);
  const titles = { forgot: 'Восстановление пароля', resend: 'Подтверждение email', verify: 'Подтвердить email', reset: 'Новый пароль' };
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      if (mode === 'forgot' || mode === 'resend') {
        const result = await (mode === 'forgot' ? api.requestPassword({ email }) : api.requestVerification({ email })); setMessage(result.message);
      } else {
        if (mode === 'verify') await api.verifyEmail({ token }); else await api.resetPassword({ token, password });
        setPassword(''); setMessage(mode === 'verify' ? 'Email подтверждён. Обновите страницу профиля или войдите в аккаунт.' : 'Пароль изменён. Войдите с новым паролем. Старые сессии отозваны.');
      }
    } catch (err) { setError(errorText(err)); } finally { setBusy(false); }
  }
  const linkAction = mode === 'verify' || mode === 'reset';
  return <section className="container narrow-page"><h1>{titles[mode]}</h1>
    <p>Никому не передавайте ссылку из письма. Запрос нового письма ограничен по частоте.</p>
    {error && <p className="error-box" role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    {linkAction && !token ? <p role="alert">Откройте полную ссылку из письма либо запросите новую.</p> : (!message || !linkAction) && <form onSubmit={submit}>
      {!linkAction && <div className="field"><label htmlFor="recovery-email">Email аккаунта</label><input id="recovery-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)}/></div>}
      {mode === 'reset' && <div className="field"><label htmlFor="recovery-password">Новый пароль</label><input id="recovery-password" type="password" autoComplete="new-password" minLength={12} maxLength={64} required value={password} onChange={e => setPassword(e.target.value)}/></div>}
      <button className="btn btn-primary" disabled={busy}>{busy ? 'Подождите…' : mode === 'verify' ? 'Подтвердить email' : mode === 'reset' ? 'Сохранить новый пароль' : 'Отправить письмо'}</button>
    </form>}
    <p><Link to="/login">Вход</Link> · <Link to="/resend-verification">Повторить подтверждение</Link> · <Link to="/forgot-password">Восстановить пароль</Link></p>
  </section>;
}
