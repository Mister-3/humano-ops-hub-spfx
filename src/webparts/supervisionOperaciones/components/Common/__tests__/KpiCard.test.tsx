import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { KpiCard } from '../KpiCard';
import { cleanupUi, renderUi } from './testUtils';

describe('KpiCard', () => {
  afterEach(cleanupUi);

  it('renderiza métrica, contexto y variante semántica', () => {
    const { container } = renderUi(
      <KpiCard
        icon={<span>✓</span>}
        label="Implementadas"
        subtext="12 este mes"
        value={48}
        variant="emerald"
      />
    );

    const card = container.querySelector('article');
    expect(card?.dataset.variant).toBe('emerald');
    expect(card?.className).toContain('min-h-[110px]');
    expect(container.textContent).toContain('Implementadas');
    expect(container.textContent).toContain('48');
    expect(container.textContent).toContain('12 este mes');
    expect(container.querySelector('.text-emerald-300')).not.toBeNull();
    expect(container.querySelector('.bg-emerald-500')).not.toBeNull();
  });
});
