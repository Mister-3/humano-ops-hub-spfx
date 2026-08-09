import * as React from 'react';
import { Spinner, SpinnerSize } from '@fluentui/react';
import styles from './DeleteConfirmModal.module.scss';

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
  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={isDeleting ? undefined : onCancel}>
      <div
        className={styles.modalCard}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        <div className={styles.header}>
          <div className={styles.iconWrapper}>
            🗑️
          </div>
          <h3 id="confirm-modal-title" className={styles.title}>
            {title}
          </h3>
        </div>

        <p className={styles.description}>{description}</p>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onCancel}
            disabled={isDeleting}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={styles.dangerBtn}
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
