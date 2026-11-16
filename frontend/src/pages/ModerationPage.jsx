import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Clock3, Eye, ShieldCheck, X } from 'lucide-react';
import { api, errorText } from '../api/client';
import { useApp } from '../context/AppContext';
import CoverImage from '../components/CoverImage';

export default function ModerationPage() {
  const { user, dataVersion, changed, notify, showError } = useApp();
  const [items, setItems] = useState([]); const [error, setError] = useState(''); const [busy, setBusy] = useState(null);
  useEffect(() => {
    if (user?.role !== 'ADMIN') return;
    let valid = true;
    api.pending().then((data) => { if (valid) setItems(data); })
      .catch((err) => { if (valid) setError(errorText(err)); });
    return () => { valid = false; };
  }, [user, dataVersion]);
  async function moderate(id, status) {
    setBusy(id);
    try { await api.moderate(id, status); notify(status === 'APPROVED' ? 'Рецепт опубликован' : 'Рецепт отклонён'); changed(); }
    catch (err) { showError(err); } finally { setBusy(null); }
  }
  if (user?.role !== 'ADMIN') return <div className="container narrow-page"><div className="empty-state"><span>🔒</span><h2>Доступ только для модератора</h2><p>Выбери Марину Волкову в меню профиля, чтобы посмотреть заявки.</p><Link to="/" className="btn btn-primary">В каталог</Link></div></div>;
  return <div className="container moderation-page"><div className="moderation-header"><div><div className="eyebrow muted"><ShieldCheck size={17}/> ПРОВЕРКА КОНТЕНТА</div><h1>Панель модератора</h1><p>Помогаем сообществу делиться качественными рецептами.</p></div><span className="pending-counter"><Clock3 size={20}/><strong>{items.length}</strong> ожидают решения</span></div>
    <div className="moderation-info"><span>✳</span><div><strong>Как работает демонстрационная модерация</strong><p>Новые и изменённые рецепты получают статус PENDING. После одобрения они сразу становятся видны в каталоге.</p></div></div>
    <div className="section-heading compact"><div><h2>Ожидают проверки</h2><p>Просмотри рецепт, прежде чем принимать решение.</p></div></div>
    {error && <div className="error-box">{error}</div>}
    {!error && (items.length ? <div className="moderation-list">{items.map((recipe) => <article className="moderation-item" key={recipe.id}><CoverImage recipe={recipe}/><div className="moderation-item-body"><span className="moderation-category">{recipe.category} · {recipe.prepMinutes} мин</span><h3>{recipe.title}</h3><p>{recipe.description}</p><small>Автор: {recipe.ownerName}</small></div><div className="moderation-actions"><Link className="btn btn-outline" to={`/recipes/${recipe.id}`}><Eye size={17}/> Просмотр</Link><button disabled={busy === recipe.id} className="btn btn-approve" onClick={() => moderate(recipe.id, 'APPROVED')}><Check size={17}/> Одобрить</button><button disabled={busy === recipe.id} className="btn btn-danger" onClick={() => moderate(recipe.id, 'REJECTED')}><X size={17}/> Отклонить</button></div></article>)}</div> : <div className="empty-state"><span>🎉</span><h3>Все рецепты проверены!</h3><p>На данный момент заявок больше нет. Можно возвращаться к готовке.</p><Link className="btn btn-primary" to="/">В каталог</Link></div>)}
  </div>;
}
