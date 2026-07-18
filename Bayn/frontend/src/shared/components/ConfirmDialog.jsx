import { useEffect } from 'react';
import Button from './Button';
import './ConfirmDialog.css';

// Reusable confirm modal. All text is passed in already-translated, so the
// dialog stays language-agnostic. Renders nothing when closed. Clicking the
// backdrop or pressing Escape cancels.
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  confirmDisabled = false,
  children,
}) {
  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') onCancel?.();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="confirm" role="presentation" onClick={onCancel}>
      <div
        className="confirm__box"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title" className="confirm__title">{title}</h2>
        {message && <p className="confirm__message">{message}</p>}
        {children && <div className="confirm__body">{children}</div>}
        <div className="confirm__actions">
          <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button type="button" variant="primary" size="sm" onClick={onConfirm} disabled={confirmDisabled}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
