import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { PageHeader } from '../PageHeader';
import { cleanupUi, renderUi } from './testUtils';

describe('PageHeader', () => {
  afterEach(cleanupUi);

  it('renderiza título, subtítulo, icono, badge y acción en el encabezado estándar', () => {
    const { container } = renderUi(
      <PageHeader
        action={<button type="button">Nueva historia</button>}
        badge={<span>QA</span>}
        icon={<span aria-label="Iniciativas">◎</span>}
        subtitle="Descripción operativa"
        title="Iniciativas"
      />
    );

    const header = container.querySelector('header');
    expect(header?.className).toContain('bg-slate-900/90');
    expect(header?.className).toContain('md:flex-row');
    expect(container.textContent).toContain('Iniciativas');
    expect(container.textContent).toContain('Descripción operativa');
    expect(container.textContent).toContain('QA');
    expect(container.querySelector('button')?.textContent).toBe('Nueva historia');
  });
});
