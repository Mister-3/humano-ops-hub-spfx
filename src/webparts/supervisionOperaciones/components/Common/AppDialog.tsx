import * as React from 'react';
import { createPortal } from 'react-dom';

export type AppDialogMaxWidth = 'sm' | 'md' | 'lg' | 'xl';

export interface IAppDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: AppDialogMaxWidth;
}

const MAX_WIDTH_CLASSES: Record<AppDialogMaxWidth, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl'
};

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

let dialogSequence = 0;

const getFocusableElements = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.getAttribute('aria-hidden') !== 'true'
  );

export const AppDialog: React.FC<IAppDialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'md'
}) => {
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const onCloseRef = React.useRef(onClose);
  const titleIdRef = React.useRef<string>();
  const descriptionIdRef = React.useRef<string>();

  if (!titleIdRef.current) {
    dialogSequence += 1;
    titleIdRef.current = `app-dialog-title-${dialogSequence}`;
    descriptionIdRef.current = `app-dialog-description-${dialogSequence}`;
  }

  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  React.useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return undefined;

    const previouslyFocusedElement = document.activeElement as HTMLElement | null;
    const bodyAlreadyLocked = document.body.classList.contains('overflow-hidden');
    document.body.classList.add('overflow-hidden');

    const focusTimer = window.setTimeout(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusableElements = getFocusableElements(dialog);
      (focusableElements[0] || dialog).focus();
    }, 0);

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusableElements = getFocusableElements(dialog);

      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      if (!bodyAlreadyLocked) document.body.classList.remove('overflow-hidden');
      previouslyFocusedElement?.focus();
    };
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  const titleId = titleIdRef.current as string;
  const descriptionId = descriptionIdRef.current as string;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm transition-opacity duration-200 ease-out"
      data-testid="app-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCloseRef.current();
      }}
    >
      <div
        ref={dialogRef}
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className={`flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/95 text-white shadow-2xl transition-all duration-200 ease-out transform scale-100 opacity-100 ${MAX_WIDTH_CLASSES[maxWidth]}`}
        role="dialog"
        tabIndex={-1}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-800 px-6 py-5">
          <div className="min-w-0">
            <h2 id={titleId} className="m-0 text-lg font-bold text-white">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-sm leading-6 text-slate-400">
                {description}
              </p>
            )}
          </div>
          <button
            aria-label="Cerrar diálogo"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-xl text-slate-300 transition-colors hover:bg-slate-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            onClick={() => onCloseRef.current()}
            type="button"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>
        <div className="overflow-y-auto p-6">{children}</div>
      </div>
    </div>,
    document.body
  );
};

export default AppDialog;
