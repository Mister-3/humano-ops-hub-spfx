import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { StatusBadge, type StatusBadgeVariant } from '../StatusBadge';
import { cleanupUi, renderUi } from './testUtils';

const EXPECTED_VARIANT_CLASS: Record<StatusBadgeVariant, string> = {
  success: 'text-emerald-300',
  warning: 'text-amber-300',
  danger: 'text-rose-300',
  info: 'text-cyan-300',
  role: 'text-purple-300',
  neutral: 'text-slate-300'
};

describe('StatusBadge', () => {
  afterEach(cleanupUi);

  it('aplica el color semántico de cada variante', () => {
    const variants = Object.keys(EXPECTED_VARIANT_CLASS) as StatusBadgeVariant[];
    const { container } = renderUi(
      <div>
        {variants.map((variant) => (
          <StatusBadge key={variant} variant={variant}>
            {variant}
          </StatusBadge>
        ))}
      </div>
    );

    variants.forEach((variant) => {
      const badge = container.querySelector(`[data-variant="${variant}"]`);
      expect(badge?.className).toContain(EXPECTED_VARIANT_CLASS[variant]);
      expect(badge?.className).toContain('rounded-full');
    });
  });

  it('admite el tamaño mediano', () => {
    const { container } = renderUi(
      <StatusBadge size="md" variant="info">Activo</StatusBadge>
    );

    expect(container.querySelector('span')?.className).toContain('text-sm');
    expect(container.querySelector('span')?.className).toContain('px-3');
  });
});
