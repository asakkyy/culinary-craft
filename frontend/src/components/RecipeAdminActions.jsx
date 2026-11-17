import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { api, errorText } from '../api/client';
import { useApp } from '../context/AppContext';
import ConfirmDialog from './ConfirmDialog';

export default function RecipeAdminActions({ recipe }) {
  const { user, changed, notify } = useApp();
  const [action, setAction] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (user?.role !== 'ADMIN' || !['PENDING', 'APPROVED'].includes(recipe.status)) return null;
  async function submit() {
    if (action === 'unpublish' && reason.trim().length < 3) {
      setError('Укажите причину: от 3 до 500 символов');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (action === 'unpublish') await api.unpublish(recipe.id, reason.trim());
      else await api.moderate(recipe.id, action);
      notify(
        action === 'APPROVED'
          ? 'Рецепт опубликован'
          : action === 'unpublish'
            ? 'Рецепт снят с публикации и отправлен на проверку'
            : 'Рецепт отклонён',
      );
      changed();
      setAction(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  function open(value) {
    setAction(value);
    setError('');
    setReason('');
  }
  return (
    <section className="recipe-admin-panel">
      <h2>
        <ShieldCheck /> Модерация рецепта
      </h2>
      <p>
        {recipe.status === 'PENDING'
          ? 'Рецепт ожидает проверки. Просмотрите ингредиенты и инструкцию перед публикацией.'
          : 'Опубликованный рецепт можно вернуть на проверку. Он сохранится у автора, но исчезнет из публичного каталога.'}
      </p>
      <div className="recipe-admin-actions">
        {recipe.status === 'PENDING' ? (
          <>
            <button className="btn btn-primary" onClick={() => open('APPROVED')}>
              Одобрить рецепт
            </button>
            <button className="btn btn-danger" onClick={() => open('REJECTED')}>
              Отклонить рецепт
            </button>
          </>
        ) : (
          <button className="btn btn-danger" onClick={() => open('unpublish')}>
            Снять с публикации
          </button>
        )}
      </div>
      {action && (
        <ConfirmDialog
          title={
            action === 'APPROVED' ? 'Опубликовать рецепт?' : action === 'unpublish' ? 'Снять рецепт с публикации?' : 'Отклонить рецепт?'
          }
          label={action === 'APPROVED' ? 'Опубликовать' : action === 'unpublish' ? 'Снять с публикации' : 'Отклонить рецепт'}
          danger={action !== 'APPROVED'}
          onClose={() => setAction(null)}
          onConfirm={submit}
          busy={busy}
          error={error}
        >
          <p>
            {action === 'APPROVED'
              ? 'Рецепт станет виден всем посетителям каталога.'
              : action === 'unpublish'
                ? 'Рецепт вернётся в очередь проверки. Данные и фотография сохранятся. Решение будет записано в аудит.'
                : 'Рецепт не будет опубликован. Автор сможет изменить его и отправить на проверку снова.'}
          </p>
          {action === 'unpublish' && (
            <div className="field">
              <label htmlFor="unpublish-reason">Причина снятия с публикации</label>
              <textarea
                id="unpublish-reason"
                minLength={3}
                maxLength={500}
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          )}
        </ConfirmDialog>
      )}
    </section>
  );
}
