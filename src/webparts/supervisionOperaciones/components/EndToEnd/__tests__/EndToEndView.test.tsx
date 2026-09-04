import * as React from 'react';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import EndToEndView from '../EndToEndView';
import { cleanupUi, renderUi } from '../../Common/__tests__/testUtils';
import type { IEndToEndAnalyzedRow } from '../../../../../types';
import type { IEndToEndWorkspace } from '../../../../../modules/endToEnd/endToEndRepository';

const mockWorkspace: IEndToEndWorkspace = {
  activeSnapshot: {
    id: 'snap-test-01',
    fileName: 'reporte-operativo.xlsx',
    fileHash: 'hash-abc-123',
    generationAt: '2026-08-10T12:00:00.000Z',
    importedAt: '2026-08-10T12:05:00.000Z',
    importedBy: 'supervisor@empresa.com',
    status: 'active',
    detectedRows: 2,
    uniqueRadicaciones: 2,
    totalPages: 30,
    rows: [
      {
        rowNumber: 1,
        radicacion: 'RAD-EMI-100',
        radicacionAt: '2026-08-10T08:00:00.000Z',
        usuarioRadicacion: 'OPERADOR_EMI',
        tipoLote: 'EMISION DE POLIZA',
        descripcionNovedad: 'EMISION NUEVA',
        estadoRadicacion: 'RECIBIDA',
        escalado: false,
        estadoDistro: 'N/A',
        canal: 'DIGITAL',
        modalidad: 'Manual',
        flow: 'emision',
        excludedByRule: false,
        apiEmissionExcluded: false,
        pages: 10,
        duplicateExact: false,
        dataWarnings: [],
        original: { rowNumber: 1, values: {} },
        sla: {
          referenceAt: '2026-08-10T12:00:00.000Z',
          completed: false,
          severity: 'amarillo',
          stage: 'Pendiente de escaneo',
          action: 'Escaneo',
          reconciliationRequired: false
        }
      } as IEndToEndAnalyzedRow,
      {
        rowNumber: 2,
        radicacion: 'RAD-MOV-200',
        radicacionAt: '2026-08-10T08:00:00.000Z',
        usuarioRadicacion: 'OPERADOR_MOV',
        tipoLote: 'MOVIMIENTO DE AFILIADOS',
        descripcionNovedad: 'INCLUSION BENEFICIARIO',
        estadoRadicacion: 'RECIBIDA',
        fechaEscaneo: '2026-08-10T09:00:00.000Z',
        fechaAprobacion: '2026-08-10T10:00:00.000Z',
        escalado: true,
        estadoDistro: 'Revisado',
        canal: 'OFICINA VIRTUAL',
        modalidad: 'Automatica',
        flow: 'movimiento',
        excludedByRule: false,
        apiEmissionExcluded: false,
        pages: 20,
        duplicateExact: false,
        dataWarnings: [],
        original: { rowNumber: 2, values: {} },
        sla: {
          referenceAt: '2026-08-10T12:00:00.000Z',
          completed: false,
          severity: 'rojo',
          stage: 'Pendiente de sincronización',
          action: 'Sincronización',
          reconciliationRequired: false
        }
      } as IEndToEndAnalyzedRow
    ]
  },
  snapshots: [],
  closures: [],
  cancellationAliases: [],
  reportedRadications: new Set(),
  previousRadications: new Set(),
  recurrentToday: new Set(),
  conflicts: [],
  disappearedRadications: []
};

vi.mock('../../../../../auth/RBACContext', () => ({
  useRBAC: () => ({
    hasPermission: () => true,
    hasRole: () => true,
    hasAnyPermission: () => true,
    loading: false
  })
}));

vi.mock('../../../../../modules/endToEnd/endToEndRepository', () => ({
  endToEndRepository: {
    loadWorkspace: vi.fn().mockImplementation(() => Promise.resolve(mockWorkspace)),
    saveSnapshot: vi.fn(),
    recordAction: vi.fn(),
    saveClosure: vi.fn(),
    resolveConflict: vi.fn()
  }
}));

describe('EndToEndView - Pestaña Vista General y Segmentación Reactiva', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupUi();
  });

  const renderAndWait = async () => {
    const result = renderUi(
      <EndToEndView
        currentUserEmail="supervisor@empresa.com"
        currentUserName="Supervisor Operativo"
      />
    );

    // Esperar a que resuelva loadWorkspace() dentro del useEffect
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    return result;
  };

  it('renderiza la pestaña "Vista General" como predeterminada y muestra todas las radicaciones', async () => {
    const { container } = await renderAndWait();

    // Validar selector de pestañas
    const tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(3);

    const generalTab = tabs[0];
    const emisionesTab = tabs[1];
    const movimientosTab = tabs[2];

    expect(generalTab.textContent).toBe('Vista General');
    expect(generalTab.getAttribute('aria-selected')).toBe('true');
    expect(emisionesTab.textContent).toBe('Emisiones');
    expect(emisionesTab.getAttribute('aria-selected')).toBe('false');
    expect(movimientosTab.textContent).toContain('Movimientos');
    expect(movimientosTab.getAttribute('aria-selected')).toBe('false');

    // Validar que en Vista General se listan ambas radicaciones en la tabla
    expect(container.textContent).toContain('RAD-EMI-100');
    expect(container.textContent).toContain('RAD-MOV-200');

    // Validar que el conteo en el toolbar muestra 2 radicaciones
    expect(container.textContent).toContain('2 radicaciones · 0 seleccionadas');
  });

  it('filtra reactivamente métricas analíticas y tabla al seleccionar la pestaña "Emisiones"', async () => {
    const { container } = await renderAndWait();

    const tabs = container.querySelectorAll('[role="tab"]');
    const emisionesTab = tabs[1] as HTMLButtonElement;

    // Cambiar a pestaña Emisiones
    act(() => {
      emisionesTab.click();
    });

    expect(emisionesTab.getAttribute('aria-selected')).toBe('true');
    expect(tabs[0].getAttribute('aria-selected')).toBe('false');

    // La tabla solo debe mostrar la radicación de emisión
    expect(container.textContent).toContain('RAD-EMI-100');
    expect(container.textContent).not.toContain('RAD-MOV-200');
    expect(container.textContent).toContain('1 radicaciones · 0 seleccionadas');

    // En los canales de Emisiones solo está DIGITAL (10 páginas), no OFICINA VIRTUAL
    expect(container.textContent).toContain('DIGITAL');
  });

  it('filtra reactivamente métricas analíticas y tabla al seleccionar la pestaña "Movimientos y Cancelaciones"', async () => {
    const { container } = await renderAndWait();

    const tabs = container.querySelectorAll('[role="tab"]');
    const movimientosTab = tabs[2] as HTMLButtonElement;

    // Cambiar a pestaña Movimientos
    act(() => {
      movimientosTab.click();
    });

    expect(movimientosTab.getAttribute('aria-selected')).toBe('true');
    expect(tabs[0].getAttribute('aria-selected')).toBe('false');

    // La tabla solo debe mostrar la radicación de movimiento
    expect(container.textContent).not.toContain('RAD-EMI-100');
    expect(container.textContent).toContain('RAD-MOV-200');
    expect(container.textContent).toContain('1 radicaciones · 0 seleccionadas');

    // En los canales de Movimientos está OFICINA VIRTUAL
    expect(container.textContent).toContain('OFICINA VIRTUAL');
  });

  it('permite regresar a "Vista General" restaurando la totalidad de registros y métricas', async () => {
    const { container } = await renderAndWait();

    const tabs = container.querySelectorAll('[role="tab"]');
    const generalTab = tabs[0] as HTMLButtonElement;
    const emisionesTab = tabs[1] as HTMLButtonElement;

    // Alternar a Emisiones primero
    act(() => {
      emisionesTab.click();
    });
    expect(container.textContent).not.toContain('RAD-MOV-200');

    // Regresar a Vista General
    act(() => {
      generalTab.click();
    });

    expect(generalTab.getAttribute('aria-selected')).toBe('true');
    expect(container.textContent).toContain('RAD-EMI-100');
    expect(container.textContent).toContain('RAD-MOV-200');
    expect(container.textContent).toContain('2 radicaciones · 0 seleccionadas');
  });

  it('calcula las 4 secciones analíticas de resumen reactivamente según la pestaña activa', async () => {
    const { container } = await renderAndWait();

    const getChartCard = (title: string): HTMLElement => {
      const cards = Array.from(container.querySelectorAll('article'));
      const found = cards.find((c) => c.querySelector('h4')?.textContent?.includes(title));
      expect(found).toBeDefined();
      return found!;
    };

    // 1. Pestaña por defecto: Vista General (100% de los datos)
    let semaforoCard = getChartCard('Distribución por semáforo');
    expect(semaforoCard.textContent).toContain('Cumple / < 4 h2');
    let etapaCard = getChartCard('Carga por etapa');
    expect(etapaCard.textContent).toContain('Pendiente de escaneo');
    expect(etapaCard.textContent).toContain('Pendiente de sincronización');
    let canalCard = getChartCard('Páginas pendientes por canal');
    expect(canalCard.textContent).toContain('DIGITAL');
    expect(canalCard.textContent).toContain('OFICINA VIRTUAL');
    let distroCard = getChartCard('Escaladas · Estado Distro');
    expect(distroCard.textContent).toContain('1Revisadas');

    // 2. Cambiar a Emisiones
    const tabs = container.querySelectorAll('[role="tab"]');
    act(() => {
      (tabs[1] as HTMLButtonElement).click();
    });

    semaforoCard = getChartCard('Distribución por semáforo');
    expect(semaforoCard.textContent).toContain('Cumple / < 4 h1');
    etapaCard = getChartCard('Carga por etapa');
    expect(etapaCard.textContent).toContain('Pendiente de escaneo');
    expect(etapaCard.textContent).not.toContain('Pendiente de sincronización');
    canalCard = getChartCard('Páginas pendientes por canal');
    expect(canalCard.textContent).toContain('DIGITAL');
    expect(canalCard.textContent).not.toContain('OFICINA VIRTUAL');
    distroCard = getChartCard('Escaladas · Estado Distro');
    expect(distroCard.textContent).toContain('0Revisadas');

    // 3. Cambiar a Movimientos
    act(() => {
      (tabs[2] as HTMLButtonElement).click();
    });

    semaforoCard = getChartCard('Distribución por semáforo');
    expect(semaforoCard.textContent).toContain('Cumple / < 4 h1');
    etapaCard = getChartCard('Carga por etapa');
    expect(etapaCard.textContent).not.toContain('Pendiente de escaneo');
    expect(etapaCard.textContent).toContain('Pendiente de sincronización');
    canalCard = getChartCard('Páginas pendientes por canal');
    expect(canalCard.textContent).not.toContain('DIGITAL');
    expect(canalCard.textContent).toContain('OFICINA VIRTUAL');
    distroCard = getChartCard('Escaladas · Estado Distro');
    expect(distroCard.textContent).toContain('1Revisadas');
  });

  it('sincroniza reactivamente las 8 tarjetas KPI superiores y los indicadores de decisiones con la pestaña activa', async () => {
    const { container } = await renderAndWait();

    const getKpiValue = (label: string): string => {
      const buttons = Array.from(container.querySelectorAll('button'));
      const btn = buttons.find((b) => b.querySelector('span')?.textContent === label);
      expect(btn).toBeDefined();
      return btn?.querySelector('strong')?.textContent || '';
    };

    const tabs = container.querySelectorAll('[role="tab"]');
    const generalTab = tabs[0] as HTMLButtonElement;
    const emisionesTab = tabs[1] as HTMLButtonElement;
    const movimientosTab = tabs[2] as HTMLButtonElement;

    // 1. En Vista General (ambas radicaciones: 10 + 20 = 30 páginas, 1 escalada en RAD-MOV-200)
    expect(getKpiValue('Radicaciones gestionables')).toBe('2');
    expect(getKpiValue('Páginas pendientes')).toBe('30');
    expect(getKpiValue('SLA vencidas')).toBe('0');
    expect(getKpiValue('Críticas')).toBe('0');
    expect(getKpiValue('Escaladas')).toBe('1');
    expect(getKpiValue('Reincidentes hoy')).toBe('0');
    expect(getKpiValue('Errores / advertencias')).toBe('0');
    expect(getKpiValue('Volumen bruto excluido')).toBe('0');

    // Indicadores inferiores en Vista General
    expect(getKpiValue('Próximas a vencer')).toBe('2');
    expect(getKpiValue('Conciliaciones')).toBe('0');
    expect(getKpiValue('Calidad de datos')).toBe('0');
    expect(getKpiValue('Oficina Virtual automática')).toBe('1');

    // 2. Cambiar a pestaña "Emisiones" (RAD-EMI-100: 10 páginas, SLA amarillo)
    act(() => {
      emisionesTab.click();
    });

    expect(getKpiValue('Radicaciones gestionables')).toBe('1');
    expect(getKpiValue('Páginas pendientes')).toBe('10');
    expect(getKpiValue('SLA vencidas')).toBe('0');
    expect(getKpiValue('Críticas')).toBe('0');
    expect(getKpiValue('Escaladas')).toBe('0');
    expect(getKpiValue('Próximas a vencer')).toBe('1');
    expect(getKpiValue('Oficina Virtual automática')).toBe('0');

    // 3. Cambiar a pestaña "Movimientos y Cancelaciones" (RAD-MOV-200: 20 páginas, escalada)
    act(() => {
      movimientosTab.click();
    });

    expect(getKpiValue('Radicaciones gestionables')).toBe('1');
    expect(getKpiValue('Páginas pendientes')).toBe('20');
    expect(getKpiValue('SLA vencidas')).toBe('0');
    expect(getKpiValue('Críticas')).toBe('0');
    expect(getKpiValue('Escaladas')).toBe('1');
    expect(getKpiValue('Próximas a vencer')).toBe('1');
    expect(getKpiValue('Oficina Virtual automática')).toBe('1');

    // 4. Regresar a "Vista General" restaurando totales consolidados
    act(() => {
      generalTab.click();
    });

    expect(getKpiValue('Radicaciones gestionables')).toBe('2');
    expect(getKpiValue('Páginas pendientes')).toBe('30');
    expect(getKpiValue('SLA vencidas')).toBe('0');
    expect(getKpiValue('Escaladas')).toBe('1');
    expect(getKpiValue('Próximas a vencer')).toBe('2');
    expect(getKpiValue('Oficina Virtual automática')).toBe('1');
  });
});
