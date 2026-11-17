import FormError from '../components/FormError';
import { useState } from 'react';
import { Flag } from 'lucide-react';
import { api, errorText } from '../api/client';
import { useApp } from '../context/AppContext';
import Modal from './Modal';
export const reasons = {
  SPAM: 'Спам',
  ABUSE: 'Оскорбления',
  COPYRIGHT: 'Нарушение авторских прав',
  INCORRECT: 'Ошибочный рецепт',
  OTHER: 'Другое',
};
export default function ReportForm({ recipeId }) {
  const { requireUser, notify } = useApp();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('SPAM');
  const [sent, setSent] = useState(false);
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <section className="report-entry">
      <p>Заметили нарушение или неточность?</p>
      <button
        className="btn btn-text"
        onClick={() => {
          if (requireUser()) setOpen(true);
        }}
      >
        <Flag aria-hidden="true" /> Пожаловаться
      </button>
      {open && (
        <Modal title={sent ? 'Жалоба отправлена' : 'Пожаловаться на рецепт'} onClose={() => setOpen(false)} busy={busy}>
          {sent ? (
            <>
              <p role="status">Модератор рассмотрит обращение. Повторная жалоба с той же причиной недоступна, пока обращение активно.</p>
              <button className="btn btn-primary" onClick={() => setOpen(false)}>
                Понятно
              </button>
            </>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError('');
                try {
                  await api.report(recipeId, { reason, description });
                  notify('Жалоба отправлена');
                  setSent(true);
                  setDescription('');
                } catch (err) {
                  setError(errorText(err));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <p>Сообщите о нарушении правил. Отправка жалобы не снимает рецепт с публикации — решение принимает модератор.</p>
              <div className="field">
                <label htmlFor="report-reason">Причина жалобы</label>
                <select id="report-reason" name="reason" required value={reason} onChange={(e) => setReason(e.target.value)}>
                  {Object.entries(reasons).map(([key, text]) => (
                    <option key={key} value={key}>
                      {text}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="report-description">Описание жалобы</label>
                <textarea
                  id="report-description"
                  name="report-description"
                  minLength={10}
                  maxLength={1000}
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  aria-describedby="report-count"
                />
                <small id="report-count">Необязательно · {description.length} / 1000 · Минимум 10 символов, если заполняете</small>
              </div>
              {error && <FormError>{error}</FormError>}
              <div className="dialog-actions">
                <button type="button" className="btn btn-outline" disabled={busy} onClick={() => setOpen(false)}>
                  Отмена
                </button>
                <button disabled={busy} className="btn btn-primary">
                  {busy ? 'Отправляем…' : 'Отправить жалобу'}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </section>
  );
}
