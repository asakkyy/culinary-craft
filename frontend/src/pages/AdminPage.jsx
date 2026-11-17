import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorText } from '../api/client';
import { useApp } from '../context/AppContext';
import ModerationPage from './ModerationPage';
import MediaMaintenance from '../components/MediaMaintenance';
import { reasons } from '../components/ReportForm';
import { reportStatuses } from './ReportsPage';

export default function AdminPage() {
  const { user, notify } = useApp();
  const [tab, setTab] = useState('reports'); const [status, setStatus] = useState('');
  const [search, setSearch] = useState(''); const [page, setPage] = useState(0); const [version, setVersion] = useState(0);
  const [data, setData] = useState(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [comments, setComments] = useState({});
  useEffect(() => {
    if (tab === 'recipes' || tab === 'storage') return;
    let active = true; setData(null); setError('');
    const request = tab === 'reports' ? api.adminReports({ page, status: status || undefined, search })
      : tab === 'users' ? api.adminUsers({ page, status, search }) : api.adminAudit({ page, action: status || undefined });
    request.then(result => { if (active) setData(result); }).catch(err => { if (active) setError(errorText(err)); });
    return () => { active = false; };
  }, [tab, status, search, page, version]);
  async function act(action) {
    if (!window.confirm('Подтвердить административное действие?')) return;
    setBusy(true); setError('');
    try { await action(); notify('Решение сохранено'); setVersion(v => v + 1); }
    catch (err) { setError(errorText(err)); } finally { setBusy(false); }
  }
  const filters = tab === 'reports' ? reportStatuses : tab === 'users' ? { ACTIVE: 'Активные', BLOCKED: 'Заблокированные', LEGACY: 'Legacy' }
    : { USER_BLOCKED: 'Блокировки', USER_UNBLOCKED: 'Разблокировки', REPORT_IN_REVIEW: 'Жалобы в работе', REPORT_RESOLVED: 'Закрытие жалоб', REPORT_REJECTED: 'Отклонение жалоб', RECIPE_APPROVED: 'Одобрение рецептов', RECIPE_REJECTED: 'Отклонение рецептов' };
  return <div className="container moderation-page"><h1>Управление сообществом</h1>
    <nav className="profile-tabs" aria-label="Разделы управления">{Object.entries({ recipes: 'Рецепты', reports: 'Жалобы', users: 'Пользователи', audit: 'Аудит', storage: 'Хранилище' }).map(([key, name]) => <button className="btn btn-outline" key={key} onClick={() => { setTab(key); setStatus(''); setSearch(''); setPage(0); }}>{name}</button>)}</nav>
    {tab === 'recipes' ? <ModerationPage/> : tab === 'storage' ? <MediaMaintenance/> : <>
      <div className="catalog-toolbar"><label>Фильтр статуса<select aria-label="Фильтр статуса" value={status} onChange={e => { setStatus(e.target.value); setPage(0); }}><option value="">Все</option>{Object.entries(filters).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
        {tab !== 'audit' && <label>Поиск<input aria-label="Административный поиск" value={search} maxLength={100} onChange={e => { setSearch(e.target.value); setPage(0); }}/></label>}</div>
      {error && <p role="alert" className="error-box">{error}</p>}{!data && !error && <p role="status">Загрузка…</p>}
      {data?.content.length === 0 && <p>Записей не найдено</p>}
      {data?.content.map(item => <article className="editor-card" key={item.id}>
        {tab === 'reports' ? <><h2><Link to={`/recipes/${item.recipeId}`}>{item.recipeTitle}</Link></h2><p>{item.reporterName} · {reasons[item.reason]} · {reportStatuses[item.status]}</p>
          <details><summary>Подробности жалобы #{item.id}</summary><p>{item.description}</p><p>{item.moderatorComment}</p><small>Администратор: {item.moderatorId || '—'} · {item.reviewedAt || 'Ожидает решения'}</small></details>
          {['OPEN', 'IN_REVIEW'].includes(item.status) && <><label>Комментарий к жалобе #{item.id}<textarea aria-label={`Комментарий к жалобе ${item.id}`} maxLength={1000} value={comments[item.id] || ''} onChange={e => setComments({ ...comments, [item.id]: e.target.value })}/></label>
          <div>{Object.entries({ IN_REVIEW: 'В работу', RESOLVED: 'Закрыть жалобу', REJECTED: 'Отклонить жалобу' }).filter(([key]) => key !== item.status).map(([value, name]) => <button className="btn btn-outline" key={value} disabled={busy || (comments[item.id] || '').trim().length < 3} onClick={() => act(() => api.reportDecision(item.id, { status: value, comment: comments[item.id].trim() }))}>{name}</button>)}</div></>}
        </> : tab === 'users' ? <><h2>{item.name}</h2><p>{item.email || 'Legacy'} · {item.role} · {item.status}</p><p>{item.blockReason} {item.blockedAt && new Date(item.blockedAt).toLocaleString('ru-RU')}</p>
          {item.status === 'ACTIVE' && <label>Причина блокировки<input aria-label={`Причина блокировки ${item.id}`} maxLength={500} value={comments[item.id] || ''} onChange={e => setComments({ ...comments, [item.id]: e.target.value })}/></label>}
          {item.status !== 'LEGACY' && <button className="btn btn-danger" disabled={busy || item.id === user.id || (item.status === 'ACTIVE' && (comments[item.id] || '').trim().length < 3)} onClick={() => act(() => item.status === 'BLOCKED' ? api.unblockUser(item.id) : api.blockUser(item.id, { reason: comments[item.id].trim() }))}>{item.status === 'BLOCKED' ? 'Разблокировать' : 'Заблокировать'}</button>}
        </> : <><strong>{item.action}</strong><p>Администратор #{item.adminId} · {item.targetType} #{item.targetId}</p><p>{item.details}</p><small>{new Date(item.createdAt).toLocaleString('ru-RU')}</small></>}
      </article>)}
      {data && <div className="pagination"><button disabled={!page} onClick={() => setPage(page - 1)}>Назад</button><span>{page + 1} / {Math.max(1, data.totalPages)}</span><button disabled={page + 1 >= data.totalPages} onClick={() => setPage(page + 1)}>Далее</button></div>}
    </>}
  </div>;
}
