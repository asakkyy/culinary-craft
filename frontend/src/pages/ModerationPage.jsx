import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Clock3, Eye, ShieldCheck, X } from 'lucide-react';
import { api, errorText } from '../api/client';
import { useApp } from '../context/AppContext';
import CoverImage from '../components/CoverImage';
import ConfirmDialog from '../components/ConfirmDialog';

export default function ModerationPage({ embedded = false }) {
  const { user, dataVersion, changed, notify, showError } = useApp();
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const [rejectId, setRejectId] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (user?.role !== 'ADMIN') return;
    let valid = true;
    setError('');
    setLoading(true);
    api
      .pending()
      .then((data) => {
        if (valid) setItems(data);
      })
      .catch((err) => {
        if (valid) setError(errorText(err));
      })
      .finally(() => {
        if (valid) setLoading(false);
      });
    return () => {
      valid = false;
    };
  }, [user, dataVersion]);
  async function moderate(id, status) {
    setBusy(id);
    try {
      await api.moderate(id, status);
      setRejectId(null);
      notify(status === 'APPROVED' ? 'Рецепт опубликован' : 'Рецепт отклонён');
      changed();
    } catch (err) {
      showError(err);
    } finally {
      setBusy(null);
    }
  }
  if (user?.role !== 'ADMIN')
    return (
      <div className="container narrow-page">
        <div className="empty-state">
          <h2>Доступ только для модератора</h2>
          <p>Войдите в аккаунт администратора для проверки рецептов.</p>
          <Link to="/" className="btn btn-primary">
            В каталог
          </Link>
        </div>
      </div>
    );
  return (
    <div className={embedded ? 'moderation-page' : 'container moderation-page'}>
      <div className="moderation-header">
        <div>
          <div className="eyebrow muted">
            <ShieldCheck size={17} aria-hidden="true" /> Проверка контента
          </div>
          {embedded ? <h2>Модерация рецептов</h2> : <h1>Модерация рецептов</h1>}
          <p>Помогаем сообществу делиться качественными рецептами.</p>
        </div>
        <span className="pending-counter">
          <Clock3 size={20} aria-hidden="true" />
          <strong>{items.length}</strong> ожидают решения
        </span>
      </div>
      <div className="moderation-info">
        <div>
          <strong>Проверка перед публикацией</strong>
          <p>Новые и изменённые рецепты отправляются на проверку. После одобрения они сразу становятся видны в каталоге.</p>
        </div>
      </div>
      <div className="section-heading compact">
        <div>
          <h2>Ожидают проверки</h2>
          <p>Просмотри рецепт, прежде чем принимать решение.</p>
        </div>
      </div>
      {error && <div className="error-box">{error}</div>}
      {loading && <p role="status">Загружаем очередь…</p>}
      {!error &&
        !loading &&
        (items.length ? (
          <div className="moderation-list">
            {items.map((recipe) => (
              <article className="moderation-item" key={recipe.id}>
                <CoverImage recipe={recipe} />
                <div className="moderation-item-body">
                  <span className="moderation-category">
                    {recipe.category} · {recipe.prepMinutes} мин
                  </span>
                  <h3>{recipe.title}</h3>
                  <p>{recipe.description}</p>
                  <small>Автор: {recipe.ownerName}</small>
                </div>
                <div className="moderation-actions">
                  <Link className="btn btn-outline" to={`/recipes/${recipe.id}`}>
                    <Eye size={17} aria-hidden="true" /> Просмотр
                  </Link>
                  <button disabled={busy === recipe.id} className="btn btn-approve" onClick={() => moderate(recipe.id, 'APPROVED')}>
                    <Check size={17} aria-hidden="true" /> Одобрить
                  </button>
                  <button disabled={busy === recipe.id} className="btn btn-danger" onClick={() => setRejectId(recipe.id)}>
                    <X size={17} aria-hidden="true" /> Отклонить
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Check aria-hidden="true" />
            <h3>Все рецепты проверены</h3>
            <p>На данный момент заявок больше нет. Можно возвращаться к готовке.</p>
            <Link className="btn btn-primary" to="/">
              В каталог
            </Link>
          </div>
        ))}
      {rejectId && (
        <ConfirmDialog
          title="Отклонить рецепт?"
          label="Отклонить"
          busy={busy === rejectId}
          onClose={() => setRejectId(null)}
          onConfirm={() => moderate(rejectId, 'REJECTED')}
        >
          <p>Рецепт останется у автора. После редактирования его можно отправить на проверку снова.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
