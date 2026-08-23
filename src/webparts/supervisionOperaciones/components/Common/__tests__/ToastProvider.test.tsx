import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { ToastProvider, useToast } from '../ToastProvider';
import { cleanupUi, renderUi } from './testUtils';

const TestComponent: React.FC = () => {
  const toast = useToast();

  return (
    <div>
      <button type="button" onClick={() => toast.success('Operación exitosa', 'Guardado')}>
        Lanzar éxito
      </button>
      <button type="button" onClick={() => toast.error('Ocurrió un error', 'Fallo')}>
        Lanzar error
      </button>
    </div>
  );
};

describe('ToastProvider & useToast', () => {
  afterEach(cleanupUi);

  it('permite renderizar toasts de éxito con título y mensaje', () => {
    const { container } = renderUi(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    const successBtn = container.querySelector('button');
    successBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const toastItem = container.querySelector('[data-testid="toast-item"]');
    expect(toastItem).not.toBeNull();
    expect(toastItem?.getAttribute('data-variant')).toBe('success');
    expect(container.textContent).toContain('Guardado');
    expect(container.textContent).toContain('Operación exitosa');
  });

  it('permite cerrar un toast manualmente con el botón de cierre', () => {
    const { container } = renderUi(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    const buttons = container.querySelectorAll('button');
    buttons[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true })); // Error button

    const closeBtn = container.querySelector('[aria-label="Cerrar notificación"]');
    expect(closeBtn).not.toBeNull();
    closeBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const toastItem = container.querySelector('[data-testid="toast-item"]');
    expect(toastItem).toBeNull();
  });
});
