import { useState } from 'react';
import { api, errorText } from '../api/client';
import { useApp } from '../context/AppContext';
export const reasons = { SPAM: 'Спам', ABUSE: 'Оскорбления', COPYRIGHT: 'Нарушение авторских прав', INCORRECT: 'Ошибочный рецепт', OTHER: 'Другое' };
export default function ReportForm({ recipeId }) {
  const { requireUser, notify } = useApp();
  const [open, setOpen] = useState(false); const [reason, setReason] = useState('SPAM');
  const [description, setDescription] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  return <section className="editor-card"><button className="btn btn-outline" onClick={() => { if (requireUser()) setOpen(!open); }}>Пожаловаться</button>
    {open && <form onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError('');
      try { await api.report(recipeId, { reason, description }); notify('Жалоба отправлена'); setOpen(false); setDescription(''); }
      catch (err) { setError(errorText(err)); } finally { setBusy(false); }
    }}><div className="field"><label htmlFor="report-reason">Причина жалобы</label><select id="report-reason" value={reason} onChange={e => setReason(e.target.value)}>{Object.entries(reasons).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></div>
      <div className="field"><label htmlFor="report-description">Описание жалобы</label><textarea id="report-description" required minLength={10} maxLength={1000} value={description} onChange={e => setDescription(e.target.value)}/></div>
      {error && <p className="error-box" role="alert">{error}</p>}<button disabled={busy} className="btn btn-primary">Отправить жалобу</button>
    </form>}
  </section>;
}
