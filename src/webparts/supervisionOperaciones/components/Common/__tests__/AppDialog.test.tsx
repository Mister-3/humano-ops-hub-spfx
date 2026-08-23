import * as React from 'react';
import { act } from 'react-dom/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppDialog } from '../AppDialog';
import { cleanupUi, renderUi } from './testUtils';

describe('AppDialog', () => {
  afterEach(() => {
    cleanupUi();
    vi.useRealTimers();
  });

  it('no monta el Portal cuando está cerrado', () => {
    renderUi(
      <AppDialog isOpen={false} onClose={() => undefined} title="Oculto">
        Contenido
      </AppDialog>
    );

    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renderiza un diálogo accesible en document.body y bloquea el scroll', () => {
    vi.useFakeTimers();
    const { unmount } = renderUi(
      <AppDialog
        description="Confirma la operación"
        isOpen
        maxWidth="xl"
        onClose={() => undefined}
        title="Modal universal"
      >
        <button type="button">Acción interna</button>
      </AppDialog>
    );

    act(() => {
      vi.runAllTimers();
    });
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.parentElement).toBe(document.body.lastElementChild);
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-labelledby')).toBeTruthy();
    expect(dialog?.getAttribute('aria-describedby')).toBeTruthy();
    expect(dialog?.className).toContain('max-w-xl');
    expect(document.body.classList.contains('overflow-hidden')).toBe(true);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Cerrar diálogo');

    unmount();
    expect(document.body.classList.contains('overflow-hidden')).toBe(false);
  });

  it('invoca onClose con Escape, botón de cierre y backdrop', () => {
    const onClose = vi.fn();
    renderUi(
      <AppDialog isOpen onClose={onClose} title="Cerrar modal">
        Contenido
      </AppDialog>
    );

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    act(() => {
      document.querySelector<HTMLButtonElement>('[aria-label="Cerrar diálogo"]')?.click();
    });
    expect(onClose).toHaveBeenCalledTimes(2);

    const backdrop = document.querySelector<HTMLElement>('[data-testid="app-dialog-backdrop"]');
    act(() => {
      backdrop?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('mantiene el foco dentro del diálogo al recorrer con Tab', () => {
    vi.useFakeTimers();
    renderUi(
      <AppDialog isOpen onClose={() => undefined} title="Trampa de foco">
        <button type="button">Primera acción</button>
        <button type="button">Última acción</button>
      </AppDialog>
    );
    act(() => {
      vi.runAllTimers();
    });

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const buttons = Array.from(dialog?.querySelectorAll<HTMLButtonElement>('button') || []);
    const first = buttons[0];
    const last = buttons[buttons.length - 1];

    act(() => {
      last.focus();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    });
    expect(document.activeElement).toBe(first);

    act(() => {
      first.focus();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }));
    });
    expect(document.activeElement).toBe(last);
  });
});
