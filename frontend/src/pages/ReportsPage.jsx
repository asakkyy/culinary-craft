import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorText } from '../api/client';
import { reasons } from '../components/ReportForm';
export const reportStatuses = { OPEN: 'Открыта', IN_REVIEW: 'В работе', RESOLVED: 'Закрыта', REJECTED: 'Отклонена' };
export default function ReportsPage() {
  const [page, setPage] = useState(0); const [data, setData] = useState(null); const [error, setError] = useState('');
  useEffect(() => { let active = true; setError(''); setData(null);
    api.myReports({ page }).then(result => { if (active) setData(result); }).catch(err => { if (active) setError(errorText(err)); });
    return () => { active = false; };
  }, [page]);
  return <div className="container narrow-page"><h1>Мои жалобы</h1>{error && <p role="alert" className="error-box">{error}</p>}
    {!data && !error && <p role="status">Загрузка…</p>}
    {data && (data.content.length ? data.content.map(item => <article key={item.id} className="editor-card"><Link to={`/recipes/${item.recipeId}`}>{item.recipeTitle}</Link>
      <p>{reasons[item.reason]} · {reportStatuses[item.status]}</p><p>{item.description}</p><small>{new Date(item.createdAt).toLocaleString('ru-RU')}</small></article>) : <p>Жалоб пока нет</p>)}
    {data && <div className="pagination"><button disabled={!page} onClick={() => setPage(page - 1)}>Назад</button><span>Страница {page + 1}</span><button disabled={page + 1 >= data.totalPages} onClick={() => setPage(page + 1)}>Далее</button></div>}
  </div>;
}
