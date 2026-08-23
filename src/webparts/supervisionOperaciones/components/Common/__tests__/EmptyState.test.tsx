import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { EmptyState } from '../EmptyState';
import { cleanupUi, renderUi } from './testUtils';

describe('EmptyState', () => {
  afterEach(cleanupUi);

  it('renderiza título, descripción e ícono correctamente', () => {
    const { container } = renderUi(
      <EmptyState
        icon={<span data-testid="test-icon">🔍</span>}
        title="Sin resultados"
        description="No se encontraron registros en el período seleccionado."
      />
    );

    const emptyElement = container.querySelector('[data-testid="empty-state"]');
    expect(emptyElement).not.toBeNull();
    expect(container.textContent).toContain('Sin resultados');
    expect(container.textContent).toContain('No se encontraron registros en el período seleccionado.');
    expect(container.querySelector('[data-testid="test-icon"]')).not.toBeNull();
  });

  it('renderiza el slot de acción cuando se proporciona', () => {
    const { container } = renderUi(
      <EmptyState
        title="Bandeja vacía"
        action={<button type="button">Crear nuevo</button>}
      />
    );

    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    expect(button?.textContent).toBe('Crear nuevo');
  });
});
