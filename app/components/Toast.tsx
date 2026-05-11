'use client';

import { useEffect } from 'react';

export type ToastKind = 'success' | 'error';

type Props = {
  kind: ToastKind;
  message: string;
  onClose: () => void;
  duration?: number;
};

export default function Toast({ kind, message, onClose, duration = 4000 }: Props) {
  useEffect(() => {
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [onClose, duration]);

  return (
    <div className={`toast toast--${kind}`} role="status" aria-live="polite">
      <span className="toast-icon" aria-hidden="true">
        {kind === 'success' ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="13" />
            <line x1="12" y1="16.5" x2="12" y2="16.5" />
          </svg>
        )}
      </span>
      <span className="toast-msg">{message}</span>
      <button
        type="button"
        className="toast-close"
        aria-label="Закрыть"
        onClick={onClose}
      >
        ×
      </button>
    </div>
  );
}
