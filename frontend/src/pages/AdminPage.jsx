import { createElement, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ClipboardList, Users, ScrollText, BookOpen, HardDrive, LayoutDashboard, ExternalLink } from 'lucide-react';
import { api, errorText } from '../api/client';
import { useApp } from '../context/AppContext';
import ModerationPage from './ModerationPage';
import MediaMaintenance from '../components/MediaMaintenance';
import { reasons } from '../components/ReportForm';
import { reportStatuses } from './ReportsPage';
import Avatar from '../components/Avatar';
import Modal from '../components/Modal';
import ReportRecipeSummary from '../components/ReportRecipeSummary';
import DataTable, { StatusBadge, TablePagination } from '../components/DataTable';

const userStatuses = { ACTIVE: 'Активен', BLOCKED: 'Заблокирован', LEGACY: 'Архивный аккаунт' };
const roles = { USER: 'Пользователь', ADMIN: 'Администратор' };
const events = {
  USER_BLOCKED: 'Пользователь заблокирован',
  USER_UNBLOCKED: 'Доступ восстановлен',
  REPORT_IN_REVIEW: 'Жалоба принята в работу',
  REPORT_RESOLVED: 'Жалоба закрыта',
  REPORT_REJECTED: 'Жалоба отклонена',
  RECIPE_APPROVED: 'Рецепт опубликован',
  RECIPE_REJECTED: 'Рецепт отклонён',
  RECIPE_UNPUBLISHED: 'Рецепт снят с публикации',
};
const targets = { RECIPE: 'Рецепт', USER: 'Пользователь', REPORT: 'Жалоба' };
const sections = {
  overview: ['Обзор', LayoutDashboard],
  reports: ['Жалобы', ClipboardList],
  users: ['Пользователи', Users],
  audit: ['Аудит', ScrollText],
  recipes: ['Рецепты', BookOpen],
  storage: ['Хранилище', HardDrive],
};
const date = (value) => (value ? new Date(value).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const detail = (item) =>
  item.details?.startsWith('Status:')
    ? events[item.action]
    : item.details === 'Access restored'
      ? 'Доступ к аккаунту восстановлен'
      : item.details;

export default function AdminPage() {
  const { user, notify } = useApp();
  const [params, setParams] = useSearchParams();
  const pendingFilters = useRef(null);
  useLayoutEffect(() => {
    pendingFilters.current = null;
  }, [params]);
  const tab = Object.hasOwn(sections, params.get('section')) ? params.get('section') : 'reports';
  const status = params.get(tab === 'audit' ? 'action' : 'status') || '';
  const role = params.get('role') || '';
  const sort = params.get('sort') || (tab === 'users' ? 'registeredAt,desc' : 'createdAt,desc');
  const search = params.get('search') || '';
  const page = Math.max(0, Math.min(1000000, Math.floor(Number(params.get('page')) || 0)));
  const size = [10, 20, 50].includes(Number(params.get('size'))) ? Number(params.get('size')) : 10;
  const updateFilters = useCallback(
    (patch, replace = false) => {
      // Preserve earlier filter events when the router has yet to render their URL.
      const next = new URLSearchParams(pendingFilters.current ?? params);
      for (const [key, value] of Object.entries(patch)) {
        if (value === '' || value === 0) next.delete(key);
        else next.set(key, String(value));
      }
      pendingFilters.current = next;
      setParams(next, { replace });
    },
    [params, setParams],
  );
  const setPage = useCallback((value) => updateFilters({ page: value }), [updateFilters]);
  const [version, setVersion] = useState(0);
  const [resultData, setData] = useState(null);
  const requestKey = JSON.stringify([tab, page, size, status, role, sort, search]);
  const data = resultData?.requestKey === requestKey ? resultData : null;
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(null);
  const [comment, setComment] = useState('');
  const [decision, setDecision] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [actionError, setActionError] = useState('');
  useEffect(() => {
    setSelected(null);
  }, [tab]);
  useEffect(() => {
    if (!['reports', 'users', 'audit'].includes(tab)) return;
    let active = true;
    setLoading(true);
    setError('');
    setData(null);
    const timer = setTimeout(() => {
      const request =
        tab === 'reports'
          ? api.adminReports({
              page,
              size,
              status: status || undefined,
              search,
              sort: ['createdAt', 'id', 'status', 'recipeTitle'].includes(sort.split(',')[0]) ? sort : 'createdAt,desc',
            })
          : tab === 'users'
            ? api.adminUsers({
                page,
                size,
                status,
                search,
                role,
                sort: ['registeredAt', 'name', 'email', 'status', 'role'].includes(sort.split(',')[0]) ? sort : 'registeredAt,desc',
              })
            : api.adminAudit({ page, size, action: status || undefined });
      request
        .then((result) => {
          if (active) {
            setData({ ...result, requestKey });
            if (page && page >= result.totalPages) setPage(Math.max(0, result.totalPages - 1));
          }
        })
        .catch((err) => {
          if (active) setError(errorText(err));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [tab, status, role, sort, search, page, size, version, requestKey, setPage]);
  function changeTab(key) {
    setData(null);
    setLoading(true);
    setSelected(null);
    setParams({ section: key });
  }
  function open(item) {
    setSelected(item);
    setComment('');
    setActionError('');
    setConfirm(false);
    setDecision(item.status === 'OPEN' ? 'IN_REVIEW' : 'RESOLVED');
  }
  async function act(e) {
    e.preventDefault();
    if (!confirm && (tab === 'users' || decision !== 'IN_REVIEW')) {
      setConfirm(true);
      return;
    }
    setBusy(true);
    setActionError('');
    try {
      if (tab === 'reports') await api.reportDecision(selected.id, { status: decision, comment: comment.trim() });
      else if (selected.status === 'BLOCKED') await api.unblockUser(selected.id);
      else await api.blockUser(selected.id, { reason: comment.trim() });
      notify('Решение сохранено');
      setSelected(null);
      setVersion((v) => v + 1);
    } catch (err) {
      setActionError(errorText(err));
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  }
  const filters = tab === 'reports' ? reportStatuses : tab === 'users' ? userStatuses : events;
  const columns =
    tab === 'reports'
      ? ['ID', 'Дата', 'Рецепт', 'Автор жалобы', 'Причина', 'Статус', 'Действия']
      : tab === 'users'
        ? ['Пользователь', 'Email', 'Роль', 'Статус', 'Регистрация', 'Действия']
        : ['Дата и время', 'Администратор', 'Действие', 'Объект', 'Подробности'];
  return (
    <div className="container admin-page">
      <header className="page-heading">
        <div className="eyebrow">Рабочее пространство</div>
        <h1>Управление сообществом</h1>
        <p>Проверяйте обращения, управляйте доступом и следите за историей решений</p>
      </header>
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <nav aria-label="Разделы управления">
            {Object.entries(sections).map(([key, [name, Icon]]) => (
              <Link key={key} aria-current={tab === key ? 'page' : undefined} to={`/admin?section=${key}`}>
                {createElement(Icon, { 'aria-hidden': true })}
                {name}
              </Link>
            ))}
          </nav>
          <p>Все решения фиксируются в журнале аудита</p>
        </aside>
        <section className="admin-content" aria-label={sections[tab][0]}>
          {tab === 'overview' ? (
            <>
              <h2>Работа с сообществом</h2>
              <p>Выберите задачу. Жалобы, модерация рецептов и блокировка аккаунтов — отдельные операции.</p>
              <div className="admin-overview">
                {Object.entries(sections)
                  .filter(([key]) => key !== 'overview')
                  .map(([key, [name, Icon]]) => (
                    <button className="overview-link" key={key} onClick={() => changeTab(key)}>
                      {createElement(Icon, { 'aria-hidden': true })}
                      <strong>{name}</strong>
                      <span>
                        {
                          {
                            reports: 'Рассмотрение обращений участников',
                            users: 'Аккаунты и управление доступом',
                            audit: 'История административных действий',
                            recipes: 'Проверка перед публикацией',
                            storage: 'Безопасное обслуживание изображений',
                          }[key]
                        }
                      </span>
                    </button>
                  ))}
              </div>
            </>
          ) : tab === 'recipes' ? (
            <ModerationPage embedded />
          ) : tab === 'storage' ? (
            <MediaMaintenance />
          ) : (
            <>
              <div className="table-title">
                <h2>{sections[tab][0]}</h2>
                <span className="muted">{tab === 'audit' ? 'Сначала новые события' : 'Поиск и фильтры применяются ко всему списку'}</span>
              </div>
              <div className="table-toolbar">
                {tab !== 'audit' && (
                  <label className="search-field">
                    Поиск
                    <input
                      type="search"
                      aria-label="Административный поиск"
                      placeholder={tab === 'users' ? 'Имя или email' : 'Рецепт, имя или email заявителя'}
                      value={search}
                      maxLength={100}
                      onChange={(e) => {
                        updateFilters({ search: e.target.value, page: 0 }, true);
                      }}
                    />
                  </label>
                )}
                <label>
                  {tab === 'audit' ? 'Тип события' : 'Статус'}
                  <select
                    aria-label="Фильтр статуса"
                    value={status}
                    onChange={(e) => {
                      updateFilters({ [tab === 'audit' ? 'action' : 'status']: e.target.value, page: 0 });
                    }}
                  >
                    <option value="">Все</option>
                    {Object.entries(filters).map(([key, name]) => (
                      <option key={key} value={key}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                {tab === 'users' && (
                  <label>
                    Роль
                    <select
                      aria-label="Роль"
                      value={role}
                      onChange={(e) => {
                        updateFilters({ role: e.target.value, page: 0 });
                      }}
                    >
                      <option value="">Все роли</option>
                      {Object.entries(roles).map(([key, name]) => (
                        <option key={key} value={key}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {tab !== 'audit' && (
                  <label>
                    Сортировка
                    <select
                      aria-label="Сортировка"
                      value={sort}
                      onChange={(e) => {
                        updateFilters({ sort: e.target.value, page: 0 });
                      }}
                    >
                      {Object.entries(
                        tab === 'users'
                          ? {
                              'registeredAt,desc': 'Сначала новые',
                              'registeredAt,asc': 'Сначала старые',
                              'name,asc': 'Имя А–Я',
                              'email,asc': 'Email А–Я',
                            }
                          : {
                              'createdAt,desc': 'Сначала новые',
                              'createdAt,asc': 'Сначала старые',
                              'recipeTitle,asc': 'Рецепт А–Я',
                              'status,asc': 'По статусу',
                            },
                      ).map(([key, text]) => (
                        <option key={key} value={key}>
                          {text}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              {error && (
                <div className="error-box" role="alert">
                  <p>{error}</p>
                  <button className="btn btn-outline" onClick={() => setVersion((v) => v + 1)}>
                    Повторить загрузку
                  </button>
                </div>
              )}
              <DataTable label={sections[tab][0]} columns={columns} loading={loading} empty={!error && !data?.content.length}>
                {data?.content.map((item) => (
                  <tr key={item.id}>
                    {tab === 'reports' ? (
                      <>
                        <td className="numeric">#{item.id}</td>
                        <td className="nowrap">{date(item.createdAt)}</td>
                        <td>
                          <Link className="table-link" to={`/recipes/${item.recipeId}`}>
                            {item.recipeTitle}
                            <ExternalLink aria-hidden="true" />
                          </Link>
                        </td>
                        <td>
                          {item.reporterName}
                          <small>Участник #{item.reporterId}</small>
                        </td>
                        <td>{reasons[item.reason]}</td>
                        <td>
                          <StatusBadge value={item.status} labels={reportStatuses} />
                        </td>
                        <td>
                          <button className="btn btn-outline btn-sm" onClick={() => open(item)}>
                            {['OPEN', 'IN_REVIEW'].includes(item.status) ? 'Рассмотреть' : 'Подробнее'}
                          </button>
                        </td>
                      </>
                    ) : tab === 'users' ? (
                      <>
                        <td>
                          <div className="table-person">
                            <Avatar user={item} />
                            <strong>{item.name}</strong>
                          </div>
                        </td>
                        <td className="table-email">{item.email || 'Адрес не задан'}</td>
                        <td>{roles[item.role]}</td>
                        <td>
                          <StatusBadge value={item.status} labels={userStatuses} />
                        </td>
                        <td className="nowrap">{date(item.registeredAt)}</td>
                        <td>
                          {item.status === 'LEGACY' ? (
                            <span className="muted">Вход недоступен</span>
                          ) : (
                            <button
                              className={`btn btn-sm ${item.status === 'BLOCKED' ? 'btn-outline' : 'btn-danger'}`}
                              disabled={item.id === user.id || user.role !== 'ADMIN'}
                              title={item.id === user.id ? 'Нельзя изменить доступ к своему аккаунту' : undefined}
                              onClick={() => open(item)}
                            >
                              {item.status === 'BLOCKED' ? 'Разблокировать' : 'Заблокировать'}
                            </button>
                          )}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="nowrap">{date(item.createdAt)}</td>
                        <td>{item.adminName || `Администратор #${item.adminId}`}</td>
                        <td>
                          <span className={`event-label event-${item.action.split('_')[0].toLowerCase()}`}>
                            {events[item.action] || 'Административное действие'}
                          </span>
                        </td>
                        <td>
                          {targets[item.targetType] || 'Объект'} #{item.targetId}
                        </td>
                        <td>
                          <button className="btn btn-text" onClick={() => open(item)}>
                            Подробности
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </DataTable>
              <TablePagination
                data={data}
                page={page}
                size={size}
                onPage={setPage}
                onSize={(value) => {
                  updateFilters({ size: value, page: 0 });
                }}
                loading={loading}
              />
            </>
          )}
        </section>
      </div>
      {selected && (
        <Modal
          title={
            tab === 'reports'
              ? `Жалоба #${selected.id}`
              : tab === 'users'
                ? selected.status === 'BLOCKED'
                  ? 'Восстановить доступ'
                  : 'Заблокировать пользователя'
                : events[selected.action] || 'Подробности события'
          }
          onClose={() => setSelected(null)}
          busy={busy}
          wide={tab === 'reports'}
        >
          {tab === 'audit' ? (
            <dl className="detail-list">
              <dt>Дата и время</dt>
              <dd>{date(selected.createdAt)}</dd>
              <dt>Администратор</dt>
              <dd>{selected.adminName || `#${selected.adminId}`}</dd>
              <dt>Объект</dt>
              <dd>
                {targets[selected.targetType]} #{selected.targetId}
              </dd>
              <dt>Подробности</dt>
              <dd>{detail(selected)}</dd>
            </dl>
          ) : (
            <>
              {tab === 'reports' ? (
                <>
                  <Link className="table-link" to={`/recipes/${selected.recipeId}`}>
                    {selected.recipeTitle} <ExternalLink aria-hidden="true" />
                  </Link>
                  <ReportRecipeSummary key={selected.recipeId} recipeId={selected.recipeId} />
                  <dl className="detail-list">
                    <dt>Заявитель</dt>
                    <dd>
                      {selected.reporterName} · #{selected.reporterId}
                    </dd>
                    <dt>Дата</dt>
                    <dd>{date(selected.createdAt)}</dd>
                    <dt>Причина</dt>
                    <dd>{reasons[selected.reason]}</dd>
                    <dt>Описание</dt>
                    <dd>{selected.description || 'Описание не добавлено'}</dd>
                    <dt>Статус</dt>
                    <dd>
                      <StatusBadge value={selected.status} labels={reportStatuses} />
                    </dd>
                    {selected.moderatorComment && (
                      <>
                        <dt>Внутренняя заметка</dt>
                        <dd>{selected.moderatorComment}</dd>
                      </>
                    )}
                  </dl>
                  <p className="info-note">
                    Решение по жалобе не меняет статус рецепта и не блокирует автора. Эти действия доступны отдельно.
                  </p>
                </>
              ) : (
                <>
                  <div className="table-person">
                    <Avatar user={selected} />
                    <div>
                      <strong>{selected.name}</strong>
                      <small>{selected.email}</small>
                    </div>
                  </div>
                  <p>
                    {selected.status === 'BLOCKED'
                      ? 'Пользователь снова сможет войти в аккаунт. Старые сессии останутся отозванными.'
                      : 'Вход будет закрыт, все активные сессии будут отозваны. Рецепты пользователя сохранятся.'}
                  </p>
                  {selected.blockReason && <p>Причина блокировки: {selected.blockReason}</p>}
                </>
              )}
              {(tab === 'users' || ['OPEN', 'IN_REVIEW'].includes(selected.status)) && (
                <form onSubmit={act}>
                  {tab === 'reports' && (
                    <div className="field">
                      <label htmlFor="decision">Решение</label>
                      <select id="decision" disabled={confirm || busy} value={decision} onChange={(e) => setDecision(e.target.value)}>
                        {Object.entries({ IN_REVIEW: 'Принять в работу', RESOLVED: 'Закрыть жалобу', REJECTED: 'Отклонить жалобу' })
                          .filter(([key]) => key !== selected.status)
                          .map(([key, text]) => (
                            <option key={key} value={key}>
                              {text}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                  {(tab === 'reports' || selected.status === 'ACTIVE') && (
                    <div className="field">
                      <label htmlFor="action-comment">
                        {tab === 'reports' ? `Комментарий к жалобе ${selected.id}` : `Причина блокировки ${selected.id}`}
                      </label>
                      <textarea
                        id="action-comment"
                        required
                        minLength={3}
                        maxLength={tab === 'reports' ? 1000 : 500}
                        rows={4}
                        value={comment}
                        disabled={confirm || busy}
                        onChange={(e) => setComment(e.target.value)}
                      />
                      <small>
                        {tab === 'reports' ? 'Внутренняя заметка — заявитель её не увидит' : 'Причина сохранится в журнале аудита'}
                      </small>
                    </div>
                  )}
                  {confirm && (
                    <p className="warning-note">
                      {tab === 'reports'
                        ? 'После завершения жалобу нельзя вернуть в работу. Подтвердите решение.'
                        : 'Подтвердите изменение доступа к аккаунту.'}
                    </p>
                  )}
                  {actionError && (
                    <p className="error-box" role="alert">
                      {actionError}
                    </p>
                  )}
                  <div className="dialog-actions">
                    <button
                      type="button"
                      className="btn btn-outline"
                      disabled={busy}
                      onClick={() => (confirm ? setConfirm(false) : setSelected(null))}
                    >
                      {confirm ? 'Назад' : 'Отмена'}
                    </button>
                    <button
                      disabled={busy}
                      className={`btn ${tab === 'users' && selected.status === 'ACTIVE' ? 'btn-danger-solid' : 'btn-primary'}`}
                    >
                      {busy
                        ? 'Сохраняем…'
                        : confirm
                          ? 'Подтвердить решение'
                          : tab === 'reports'
                            ? 'Сохранить решение'
                            : selected.status === 'BLOCKED'
                              ? 'Разблокировать'
                              : 'Заблокировать'}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
