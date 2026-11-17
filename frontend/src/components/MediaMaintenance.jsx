import { useState } from 'react';
import { api, errorText } from '../api/client';
import ConfirmDialog from './ConfirmDialog';

export default function MediaMaintenance() {
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  async function run(dryRun) {
    setBusy(true);
    setError('');
    try {
      setReport(await api.mediaCleanup({ dryRun }));
      setConfirm(false);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="editor-card">
      <h2>Обслуживание изображений</h2>
      <p>
        Сначала выполните проверку без удаления. Учитываются ссылки PostgreSQL, незавершённые загрузки и защитный срок не менее 24 часов.
        Резервируйте БД и файлы совместно.
      </p>
      {error && (
        <p role="alert" className="error-box">
          {error}
        </p>
      )}
      <button className="btn btn-outline" disabled={busy} onClick={() => run(true)}>
        Проверить без удаления
      </button>
      <button className="btn btn-danger" disabled={busy || !report?.dryRun || !report.candidates.length} onClick={() => setConfirm(true)}>
        Очистить неиспользуемые файлы
      </button>
      {confirm && (
        <ConfirmDialog
          title="Очистить хранилище?"
          label="Удалить неиспользуемые файлы"
          onClose={() => setConfirm(false)}
          onConfirm={() => run(false)}
          busy={busy}
          error={error}
        >
          <p>
            Будут удалены только файлы без ссылок из БД, старше защитного срока не менее 24 часов. Восстановление возможно только из
            резервной копии.
          </p>
        </ConfirmDialog>
      )}
      {busy && <p role="status">Проверяем хранилище…</p>}
      {report && (
        <>
          <p role="status">
            Найдено: {report.candidates.length}. Удалено: {report.deleted}. Ошибок: {report.failed}. Режим:{' '}
            {report.dryRun ? 'без удаления' : 'очистка'}.
          </p>
          {report.hasMore && <p>Показана партия до 500 файлов. После обработки повторите проверку.</p>}
          <details>
            <summary>Кандидаты на очистку</summary>
            <ul>
              {report.candidates.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </details>
        </>
      )}
    </section>
  );
}
