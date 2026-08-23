import * as React from 'react';
import { createPortal } from 'react-dom';

import type { EndToEndOptionalCopyColumn } from '../../../../modules/endToEnd/endToEndClipboard';
import styles from './EndToEndView.module.scss';

interface ICopyColumnsPortalProps {
  selectedColumns: ReadonlySet<EndToEndOptionalCopyColumn>;
  onChange: (columns: Set<EndToEndOptionalCopyColumn>) => void;
}

const COPY_COLUMNS: ReadonlyArray<{
  key: EndToEndOptionalCopyColumn;
  label: string;
}> = [
  { key: 'poliza', label: 'Póliza' },
  { key: 'intermediario', label: 'Intermediario' },
  { key: 'director', label: 'Director' },
  { key: 'gerente', label: 'Gerente' }
];

interface IOverlayPosition {
  top: number;
  left: number;
  width: number;
}

const MENU_GAP = 8;
const VIEWPORT_GAP = 12;
const DEFAULT_MENU_HEIGHT = 214;

const CopyColumnsPortal: React.FC<ICopyColumnsPortalProps> = ({
  selectedColumns,
  onChange
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [position, setPosition] = React.useState<IOverlayPosition>({
    top: 0,
    left: VIEWPORT_GAP,
    width: 240
  });
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  const updatePosition = React.useCallback((): void => {
    const trigger = triggerRef.current;
    if (!trigger || typeof window === 'undefined') return;

    const triggerRect = trigger.getBoundingClientRect();
    const width = Math.min(260, window.innerWidth - VIEWPORT_GAP * 2);
    const menuHeight = menuRef.current?.offsetHeight || DEFAULT_MENU_HEIGHT;
    const left = Math.min(
      Math.max(VIEWPORT_GAP, triggerRect.right - width),
      window.innerWidth - width - VIEWPORT_GAP
    );
    const opensAbove = triggerRect.bottom + MENU_GAP + menuHeight > window.innerHeight &&
      triggerRect.top - MENU_GAP - menuHeight >= VIEWPORT_GAP;
    const top = opensAbove
      ? triggerRect.top - MENU_GAP - menuHeight
      : Math.min(
        triggerRect.bottom + MENU_GAP,
        window.innerHeight - menuHeight - VIEWPORT_GAP
      );

    setPosition({ top: Math.max(VIEWPORT_GAP, top), left, width });
  }, []);

  React.useLayoutEffect(() => {
    if (!isOpen) return undefined;
    updatePosition();
    const animationFrame = window.requestAnimationFrame(updatePosition);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  React.useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const toggleColumn = (
    column: EndToEndOptionalCopyColumn,
    checked: boolean
  ): void => {
    const next = new Set(selectedColumns);
    if (checked) next.add(column);
    else next.delete(column);
    onChange(next);
  };

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className={styles.columnChooserTrigger}
        aria-controls="end-to-end-copy-columns-menu"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={() => setIsOpen((current) => !current)}
      >
        Personalizar copia
      </button>
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          id="end-to-end-copy-columns-menu"
          ref={menuRef}
          className={styles.copyColumnsPortal}
          role="dialog"
          aria-modal="false"
          aria-label="Columnas opcionales para copiar"
          style={position}
        >
          <strong>Columnas opcionales</strong>
          <span>No se incluyen datos sensibles por defecto.</span>
          {COPY_COLUMNS.map((column) => (
            <label key={column.key}>
              <input
                type="checkbox"
                checked={selectedColumns.has(column.key)}
                onChange={(event) => toggleColumn(column.key, event.target.checked)}
              />
              {column.label}
            </label>
          ))}
        </div>,
        document.body
      )}
    </>
  );
};

export default CopyColumnsPortal;
