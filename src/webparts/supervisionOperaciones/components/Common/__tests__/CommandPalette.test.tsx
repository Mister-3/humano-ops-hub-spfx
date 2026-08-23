import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CommandPalette } from '../CommandPalette';
import { cleanupUi, renderUi } from './testUtils';

describe('CommandPalette', () => {
  afterEach(cleanupUi);

  it('no renderiza nada cuando isOpen es falso', () => {
    const { container } = renderUi(
      <CommandPalette isOpen={false} onClose={vi.fn()} onNavigate={vi.fn()} />
    );

    expect(container.querySelector('[data-testid="command-palette-overlay"]')).toBeNull();
  });

  it('renderiza la barra de búsqueda y lista de comandos cuando isOpen es verdadero', () => {
    const { container } = renderUi(
      <CommandPalette isOpen={true} onClose={vi.fn()} onNavigate={vi.fn()} />
    );

    expect(container.querySelector('[data-testid="command-palette-overlay"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="command-palette-input"]')).not.toBeNull();
    expect(container.textContent).toContain('Dashboard General');
    expect(container.textContent).toContain('Custodia End-to-End');
  });

  it('ejecuta la acción de navegación al seleccionar un comando', () => {
    const onNavigate = vi.fn();
    const onClose = vi.fn();

    const { container } = renderUi(
      <CommandPalette isOpen={true} onClose={onClose} onNavigate={onNavigate} />
    );

    const endToEndItem = container.querySelector('[data-testid="command-item-nav-endtoend"]');
    expect(endToEndItem).not.toBeNull();

    endToEndItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onNavigate).toHaveBeenCalledWith('endToEnd');
    expect(onClose).toHaveBeenCalled();
  });
});
