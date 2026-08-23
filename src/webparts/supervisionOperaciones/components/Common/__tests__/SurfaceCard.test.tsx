import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { SurfaceCard } from '../SurfaceCard';
import { cleanupUi, renderUi } from './testUtils';

describe('SurfaceCard', () => {
  afterEach(cleanupUi);

  it('combina clases personalizadas con la elevación solicitada', () => {
    const { container } = renderUi(
      <SurfaceCard className="p-6" elevation="flat">
        Contenido operativo
      </SurfaceCard>
    );

    const card = container.firstElementChild as HTMLElement;
    expect(card.dataset.elevation).toBe('flat');
    expect(card.className).toContain('bg-slate-900/90');
    expect(card.className).toContain('shadow-none');
    expect(card.className).toContain('p-6');
    expect(card.textContent).toBe('Contenido operativo');
  });
});
