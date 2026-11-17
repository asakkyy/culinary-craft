import ImageUpload from '../components/ImageUpload';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { api, errorText } from '../api/client';
import { useApp } from '../context/AppContext';

export default function SettingsPage() {
  const { user, refreshUser, forgetUser, notify } = useApp();
  const navigate = useNavigate();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [emailPassword, setEmailPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(event, kind) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      if (kind === 'name') await api.profileName({ name });
      if (kind === 'email') { await api.profileEmail({ email, currentPassword: emailPassword }); setEmailPassword(''); }
      if (kind === 'password') {
        await api.profilePassword({ currentPassword, newPassword });
        setCurrentPassword(''); setNewPassword(''); forgetUser();
        notify('Пароль изменён. Войдите заново.'); navigate('/login'); return;
      }
      await refreshUser(); notify('Изменения сохранены');
    } catch (err) { setError(errorText(err)); }
    finally { setBusy(false); }
  }
  return <div className="container editor-page"><h1>Настройки аккаунта</h1>
    <p>Email: {user.emailVerified ? 'подтверждён' : 'не подтверждён'}. <Link to="/resend-verification">Запросить письмо подтверждения</Link></p>
    <section className="editor-card"><h2>Аватар</h2><ImageUpload label="Аватар" url={user.avatarUrl} busy={busy}
      onFile={async file => { setBusy(true); try { await api.avatar(file); await refreshUser(); notify('Аватар сохранён'); } catch (err) { throw new Error(errorText(err)); } finally { setBusy(false); } }}
      onDelete={async () => { await api.deleteAvatar(); await refreshUser(); }}/></section>
    {error && <p className="error-box" role="alert">{error}</p>}
    <section className="editor-card"><h2>Имя</h2><form onSubmit={e => save(e, 'name')}>
      <div className="field"><label htmlFor="profile-name">Отображаемое имя</label><input id="profile-name" minLength={2} maxLength={80} required value={name} onChange={e => setName(e.target.value)}/></div>
      <button disabled={busy} className="btn btn-primary">Сохранить имя</button></form></section>
    <section className="editor-card"><h2>Email</h2><p>После изменения подтвердите новый адрес по ссылке из письма. До подтверждения изменение контента недоступно.</p>
      <form onSubmit={e => save(e, 'email')}><div className="field"><label htmlFor="profile-email">Новый email</label><input id="profile-email" type="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)}/></div>
      <div className="field"><label htmlFor="email-password">Пароль для смены email</label><input id="email-password" type="password" autoComplete="current-password" required maxLength={64} value={emailPassword} onChange={e => setEmailPassword(e.target.value)}/></div>
      <button disabled={busy} className="btn btn-primary">Сохранить email</button></form></section>
    <section className="editor-card"><h2>Пароль</h2><p>После смены потребуется повторный вход на всех устройствах.</p><form onSubmit={e => save(e, 'password')}>
      <div className="field"><label htmlFor="current-password">Текущий пароль</label><input id="current-password" autoComplete="current-password" type="password" required maxLength={64} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}/></div>
      <div className="field"><label htmlFor="new-password">Новый пароль</label><input id="new-password" autoComplete="new-password" type="password" required minLength={12} maxLength={64} value={newPassword} onChange={e => setNewPassword(e.target.value)}/></div>
      <button disabled={busy} className="btn btn-primary">Изменить пароль</button></form></section>
    {busy && <p role="status">Сохраняем…</p>}
  </div>;
}
