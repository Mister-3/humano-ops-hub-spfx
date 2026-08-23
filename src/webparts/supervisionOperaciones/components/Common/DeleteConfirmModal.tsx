import * as React from 'react';
import { Spinner, SpinnerSize } from '@fluentui/react';

export interface IDeleteConfirmModalProps {
  isOpen: boolean;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  isDeleting?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export const DeleteConfirmModal: React.FC<IDeleteConfirmModalProps> = ({
  isOpen,
  title = '¿Eliminar registro de productividad?',
  description = 'Esta acción no se puede deshacer. El registro de productividad seleccionado será removido permanentemente de Supabase.',
  confirmText = 'Sí, eliminar',
  cancelText = 'Cancelar',
  isDeleting = false,
  onConfirm,
  onCancel
}) => {
  const cancelButtonRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !isDeleting) {
        event.preventDefault();
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const focusTimer = window.setTimeout(() => cancelButtonRef.current?.focus(), 0);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isDeleting, isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={isDeleting ? undefined : onCancel}
    >
      <div
        className="flex w-full max-w-md flex-col gap-5 bg-slate-900/95 border border-slate-800 text-white rounded-2xl p-6 shadow-2xl backdrop-blur-md"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-description"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-rose-800/50 bg-rose-950/50 text-xl text-rose-400">
            🗑️
          </div>
          <h3 id="confirm-modal-title" className="m-0 text-lg font-semibold text-white">
            {title}
          </h3>
        </div>

        <p id="confirm-modal-description" className="m-0 text-sm leading-relaxed text-slate-300">{description}</p>

        <div className="mt-1 flex items-center justify-end gap-3">
          <button
            ref={cancelButtonRef}
            type="button"
            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onCancel}
            disabled={isDeleting}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-950/30 transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => void onConfirm()}
            disabled={isDeleting}
          >
            {isDeleting && <Spinner size={SpinnerSize.xSmall} />}
            <span>{isDeleting ? 'Eliminando...' : confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmModal;
