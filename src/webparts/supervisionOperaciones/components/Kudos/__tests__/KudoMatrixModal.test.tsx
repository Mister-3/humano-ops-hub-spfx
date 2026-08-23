import * as React from 'react';
import { act } from 'react-dom/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanupUi, renderUi } from '../../Common/__tests__/testUtils';
import { KudoMatrixModal } from '../KudoMatrixModal';
import { buildKudoCriteriaMatrix, DEFAULT_KUDO_MATRIX } from '../kudoCriteriaMatrix';
import type { ICatalogoItem } from '../../../../../types';

describe('Kudo Criteria Matrix & KudoMatrixModal', () => {
  afterEach(cleanupUi);

  it('buildKudoCriteriaMatrix retorna los 6 grupos de atributos por defecto', () => {
    const matrix = buildKudoCriteriaMatrix([]);
    expect(matrix.length).toBe(6);
    expect(matrix.map((g) => g.attribute)).toContain('Empatía');
    expect(matrix.map((g) => g.attribute)).toContain('Agilidad');
    expect(matrix.map((g) => g.attribute)).toContain('Pensamiento digital');
    expect(matrix.map((g) => g.attribute)).toContain('Orientado al negocio');
    expect(matrix.map((g) => g.attribute)).toContain('Resolución de problemas');
    expect(matrix.map((g) => g.attribute)).toContain('Trabajo en equipo');

    const empatia = matrix.find((g) => g.attribute === 'Empatía');
    expect(empatia?.criteria.length).toBeGreaterThanOrEqual(3);
  });

  it('buildKudoCriteriaMatrix vincula conceptos personalizados del catálogo', () => {
    const customCatalog: ICatalogoItem[] = [
      {
        Id: 1,
        rawId: 'k1',
        Title: 'Kudo',
        Valor: 'Innovación',
        SyncStatus: 'Sincronizado'
      },
      {
        Id: 2,
        rawId: 'c1',
        Title: 'ConceptoKudo',
        Valor: 'Creación de macros automatizadas',
        parent_id: 'Innovación',
        SyncStatus: 'Sincronizado'
      },
      {
        Id: 3,
        rawId: 'c2',
        Title: 'ConceptoKudo',
        Valor: 'Apoyo en contingencia de escaneo',
        parent_id: 'Trabajo en equipo',
        SyncStatus: 'Sincronizado'
      }
    ];

    const matrix = buildKudoCriteriaMatrix(customCatalog);
    expect(matrix.some((g) => g.attribute === 'Innovación')).toBe(true);

    const innovacion = matrix.find((g) => g.attribute === 'Innovación');
    expect(innovacion?.criteria.some((c) => c.text === 'Creación de macros automatizadas')).toBe(true);

    const teamGroup = matrix.find((g) => g.attribute === 'Trabajo en equipo');
    expect(teamGroup?.criteria.some((c) => c.text === 'Apoyo en contingencia de escaneo')).toBe(true);
  });

  it('KudoMatrixModal no renderiza contenido cuando isOpen es falso', () => {
    const matrix = buildKudoCriteriaMatrix([]);
    const { container } = renderUi(
      <KudoMatrixModal
        isOpen={false}
        matrixGroups={matrix}
        onClose={vi.fn()}
      />
    );

    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('KudoMatrixModal renderiza grupos y ejecuta onSelectConcept al seleccionar un criterio', () => {
    const matrix = buildKudoCriteriaMatrix([]);
    const onSelectConcept = vi.fn();
    const onClose = vi.fn();

    renderUi(
      <KudoMatrixModal
        isOpen={true}
        matrixGroups={matrix}
        onClose={onClose}
        onSelectConcept={onSelectConcept}
      />
    );

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('Matriz de Criterios y Conceptos de Reconocimiento');
    expect(dialog?.textContent).toContain('Empatía');
    expect(dialog?.textContent).toContain('Agilidad');

    // Buscar y hacer click en un botón "Usar criterio"
    const useButtons = dialog?.querySelectorAll('button[title="Usar este criterio en el reconocimiento"]');
    expect(useButtons && useButtons.length).toBeGreaterThan(0);

    act(() => {
      (useButtons![0] as HTMLButtonElement).click();
    });

    expect(onSelectConcept).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
