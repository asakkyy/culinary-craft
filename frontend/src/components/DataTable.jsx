export function StatusBadge({ value, labels }) {
  return <span className={`status-badge status-${value?.toLowerCase()}`}>{labels[value] || value}</span>;
}
export function TablePagination({ data, page, size, onPage, onSize, loading }) {
  return (
    <div className="table-pagination">
      <span>Всего: {data?.total ?? '—'}</span>
      <label>
        Строк на странице{' '}
        <select aria-label="Строк на странице" value={size} onChange={(e) => onSize(Number(e.target.value))}>
          {[10, 20, 50].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <nav aria-label="Страницы таблицы">
        <button className="btn btn-outline" disabled={loading || !page} onClick={() => onPage(page - 1)}>
          Назад
        </button>
        <span aria-live="polite">{data ? `${page + 1} / ${Math.max(1, data.totalPages || 0)}` : '— / —'}</span>
        <button className="btn btn-outline" disabled={loading || page + 1 >= (data?.totalPages || 0)} onClick={() => onPage(page + 1)}>
          Далее
        </button>
      </nav>
    </div>
  );
}
export default function DataTable({ columns, children, empty, loading, label = 'Результаты' }) {
  return (
    <div className="table-scroll" role="region" aria-label="Таблица результатов" tabIndex={0} aria-busy={loading}>
      <table className="data-table">
        <caption className="visually-hidden">{label}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th scope="col" key={c}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {loading ? (
        <p className="table-empty" role="status">
          Загружаем записи…
        </p>
      ) : (
        empty && (
          <div className="table-empty">
            <h3>Записей не найдено</h3>
            <p>Попробуйте изменить поиск или фильтры</p>
          </div>
        )
      )}
    </div>
  );
}
