import Modal from './Modal';
export default function ConfirmDialog({ title, children, onClose, onConfirm, busy, label = 'Подтвердить', danger = true, error }) {
  return (
    <Modal title={title} onClose={onClose} busy={busy}>
      {children}
      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <button className="btn btn-outline" onClick={onClose} disabled={busy}>
          Отмена
        </button>
        <button className={`btn ${danger ? 'btn-danger-solid' : 'btn-primary'}`} onClick={onConfirm} disabled={busy}>
          {busy ? 'Сохраняем…' : label}
        </button>
      </div>
    </Modal>
  );
}
