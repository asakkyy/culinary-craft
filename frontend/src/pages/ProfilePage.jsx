import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Heart, Plus, Settings2, ShieldCheck } from 'lucide-react';
import { api, errorText } from '../api/client';
import { useApp } from '../context/AppContext';
import RecipeCard from '../components/RecipeCard';

const labels = { PENDING: 'На модерации', REJECTED: 'Отклонён', APPROVED: 'Опубликован' };
export default function ProfilePage({ view = 'mine' }) {
  const { user, setPickerOpen, dataVersion } = useApp();
  const [mine, setMine] = useState([]); const [favorites, setFavorites] = useState([]);
  const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  useEffect(() => {
    if (!user) return;
    let ok = true; setLoading(true); setError('');
    Promise.all([api.mine(), api.favorites()]).then(([a, b]) => { if (ok) { setMine(a); setFavorites(b); } })
      .catch((err) => { if (ok) setError(errorText(err)); }).finally(() => { if (ok) setLoading(false); });
    return () => { ok = false; };
  }, [user, dataVersion]);
  if (!user) return <div className="container narrow-page"><div className="empty-state"><span>👋</span><h2>Добро пожаловать!</h2><p>Выбери демонстрационного пользователя, чтобы открыть свою кухню.</p><button className="btn btn-primary" onClick={() => setPickerOpen(true)}>Выбрать пользователя</button></div></div>;
  const list = view === 'favorites' ? favorites : mine;
  return <div className="container profile-page"><div className="profile-cover"><span className="profile-deco one">✳</span><span className="profile-deco two">✴</span><div className="profile-avatar">{user.initials}</div><div><div className="eyebrow light">ЛИЧНОЕ ПРОСТРАНСТВО</div><h1>{user.name}</h1><p>{user.email}</p><p>Регистрация: {user.registeredAt ? new Date(user.registeredAt).toLocaleDateString('ru-RU') : '—'} · {user.status}</p></div><button className="btn btn-light profile-switch" onClick={() => navigate('/settings')}><Settings2 size={17}/> Настройки аккаунта</button></div>
    <div className="profile-stats"><div><strong>{mine.length}</strong><span>Мои рецепты</span></div><div><strong>{favorites.length}</strong><span>Избранное</span></div><div><strong>{mine.filter((r) => r.status === 'APPROVED').length}</strong><span>Опубликовано</span></div></div>
    <div className="profile-content"><div className="section-heading compact"><div><div className="eyebrow muted">ТВОЯ КНИГА РЕЦЕПТОВ</div><h2>{view === 'favorites' ? 'Любимые рецепты' : 'Мои творения'}</h2></div><button className="btn btn-primary" onClick={() => navigate('/create')}><Plus size={18}/> Новый рецепт</button></div>
      <div className="profile-tabs"><Link to="/profile" className={view === 'mine' ? 'active' : ''}><BookOpen size={17}/> Мои рецепты</Link><Link to="/favorites" className={view === 'favorites' ? 'active' : ''}><Heart size={17}/> Избранное</Link>{user.role === 'ADMIN' && <Link to="/moderation"><ShieldCheck size={17}/> Модерация</Link>}</div>
      {error && <div className="error-box">{error}</div>}
      {loading && <div className="loading-message">Загружаем твою кухню…</div>}
      {!error && !loading && (list.length ? <div className="recipe-grid">{list.map((r) => <div key={r.id} className="profile-recipe-wrap">{view === 'mine' && <span className={`recipe-status status-${r.status.toLowerCase()}`}>{labels[r.status]}</span>}<RecipeCard recipe={r}/></div>)}</div> : <div className="empty-state"><span>{view === 'mine' ? '📝' : '💛'}</span><h3>{view === 'mine' ? 'Здесь появятся твои рецепты' : 'Пока ничего не сохранено'}</h3><p>{view === 'mine' ? 'Начни с семейного любимчика или придумай что-нибудь новенькое.' : 'Нажимай на сердечки понравившихся блюд — они появятся здесь.'}</p><Link className="btn btn-primary" to={view === 'mine' ? '/create' : '/'}>{view === 'mine' ? 'Создать рецепт' : 'Найти рецепты'}<ArrowRight size={17}/></Link></div>)}
    </div>
  </div>;
}
