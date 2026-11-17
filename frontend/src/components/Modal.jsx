import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function Modal({ title, children, onClose, busy = false, wide = false }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (dialog.showModal) dialog.showModal();
    else dialog.setAttribute('open', '');
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return createPortal(
    <dialog
      ref={ref}
      aria-modal="true"
      aria-labelledby={titleId}
      className={`dialog ${wide ? 'dialog-wide' : ''}`}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const controls = [...ref.current.querySelectorAll('button, a[href], input, select, textarea, [tabindex]')].filter(
          (element) => !element.disabled && !element.hidden && element.tabIndex >= 0,
        );
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (!first) {
          event.preventDefault();
          return;
        }
        if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) {
          const box = e.currentTarget.getBoundingClientRect();
          if (e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom) onClose();
        }
      }}
    >
      <header className="dialog-header">
        <h2 id={titleId}>{title}</h2>
        <button className="icon-button" aria-label="Закрыть окно" onClick={onClose} disabled={busy}>
          <X />
        </button>
      </header>
      <div className="dialog-body">{children}</div>
    </dialog>,
    document.body,
  );
}
