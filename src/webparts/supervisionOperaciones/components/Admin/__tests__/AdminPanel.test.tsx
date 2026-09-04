import * as React from 'react';
import { act } from 'react-dom/test-utils';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import AdminPanel from '../AdminPanel';
import { renderUi, cleanupUi } from '../../Common/__tests__/testUtils';

vi.mock('../../../../../auth/RBACContext', () => ({
  useRBAC: () => ({
    hasPermission: () => true,
    hasAnyPermission: () => true,
    hasRole: () => true,
    userRole: 'Admin',
    roles: ['Admin'],
    loading: false
  })
}));

vi.mock('../../../../../services/CloudDbClient', () => ({
  cloudDbClient: {
    getConfiguracionSistema: vi.fn().mockResolvedValue({
      limite_dia_publicacion: 5,
      max_kudos_por_atributo_mensual: 3
    })
  }
}));

vi.mock('../../../../../services/PowerAutomateSyncService', () => {
  class MockPowerAutomateSyncService {
    exportAppDbPackage = vi.fn().mockResolvedValue(undefined);
    importAppDbPackage = vi.fn().mockResolvedValue({ success: true });
  }
  return {
    default: MockPowerAutomateSyncService
  };
});

vi.mock('../../../services/SharePointService', () => {
  class MockSharePointService {
    getConfiguracion = vi.fn().mockResolvedValue({
      Id: 1,
      PesoCasos: 20,
      PesoEmisionesTx: 15,
      PesoEmisionesPg: 10,
      PesoMovimientosTx: 15,
      PesoMovimientosPg: 15,
      PesoEscaneoTx: 10,
      PesoEscaneoPg: 15,
      MetaSlaCasos: 90,
      MetaEmisionesTx: 10,
      MetaMovimientosPg: 350,
      MetaEscaneoPg: 350,
      PuntosPorKudo: 10,
      PenalidadBaja: 5,
      PenalidadMedia: 15,
      PenalidadCritica: 50,
      LimiteDiaPublicacion: 5,
      MaxKudosPorAtributoMensual: 3
    });
    getCatalogos = vi.fn().mockResolvedValue([
      { Id: 1, Title: 'Falta', Valor: 'Inasistencia Injustificada' },
      { Id: 2, Title: 'Kudo', Valor: 'Empatía' }
    ]);
  }
  return {
    default: MockSharePointService
  };
});

describe('AdminPanel Component - Segmentación por Pestañas v2.5.4', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupUi();
  });

  it('renderiza el selector de pestañas Dark Modern con ambas opciones', async () => {
    let result: ReturnType<typeof renderUi>;
    await act(async () => {
      result = renderUi(<AdminPanel />);
    });

    const tabParametros = result!.container.querySelector('#tab-parametros');
    const tabCatalogos = result!.container.querySelector('#tab-catalogos');

    expect(tabParametros).not.toBeNull();
    expect(tabCatalogos).not.toBeNull();
    expect(tabParametros?.textContent).toContain('Metas y Parámetros Operativos');
    expect(tabCatalogos?.textContent).toContain('Gestión de Catálogos');
  });

  it('inicia en la pestaña "Metas y Parámetros Operativos" mostrando las metas y el botón Guardar', async () => {
    let result: ReturnType<typeof renderUi>;
    await act(async () => {
      result = renderUi(<AdminPanel />);
    });

    const tabParametros = result!.container.querySelector('#tab-parametros') as HTMLButtonElement;
    expect(tabParametros.getAttribute('aria-selected')).toBe('true');

    // Panel de parámetros presente
    const panelParametros = result!.container.querySelector('#panel-parametros');
    expect(panelParametros).not.toBeNull();
    expect(panelParametros?.textContent).toContain('Metas Operativas');
    expect(panelParametros?.textContent).toContain('Pesos Porcentuales (%)');
    expect(panelParametros?.textContent).toContain('Publicación y Reconocimientos');
    expect(panelParametros?.textContent).toContain('Penalidades por Faltas');
    expect(panelParametros?.textContent).toContain('Guardar Configuración');

    // Panel de catálogos no debe estar montado
    const panelCatalogos = result!.container.querySelector('#panel-catalogos');
    expect(panelCatalogos).toBeNull();
  });

  it('cambia a la pestaña "Gestión de Catálogos" y muestra la sincronización de Headcount y catálogos operativos', async () => {
    let result: ReturnType<typeof renderUi>;
    await act(async () => {
      result = renderUi(<AdminPanel />);
    });

    const tabCatalogos = result!.container.querySelector('#tab-catalogos') as HTMLButtonElement;
    await act(async () => {
      tabCatalogos.click();
    });

    expect(tabCatalogos.getAttribute('aria-selected')).toBe('true');

    // Panel de catálogos debe estar montado
    const panelCatalogos = result!.container.querySelector('#panel-catalogos');
    expect(panelCatalogos).not.toBeNull();
    expect(panelCatalogos?.textContent).toContain('Sincronización de Headcount y Directorio');
    expect(panelCatalogos?.textContent).toContain('Gestión de Catálogos Operativos');

    // Panel de parámetros no debe estar montado
    const panelParametros = result!.container.querySelector('#panel-parametros');
    expect(panelParametros).toBeNull();
  });

  it('permite alternar entre ambas pestañas fluidamente', async () => {
    let result: ReturnType<typeof renderUi>;
    await act(async () => {
      result = renderUi(<AdminPanel />);
    });

    const tabParametros = result!.container.querySelector('#tab-parametros') as HTMLButtonElement;
    const tabCatalogos = result!.container.querySelector('#tab-catalogos') as HTMLButtonElement;

    // Alterna a catálogos
    await act(async () => {
      tabCatalogos.click();
    });
    expect(result!.container.querySelector('#panel-catalogos')).not.toBeNull();
    expect(result!.container.querySelector('#panel-parametros')).toBeNull();

    // Regresa a parámetros
    await act(async () => {
      tabParametros.click();
    });
    expect(result!.container.querySelector('#panel-parametros')).not.toBeNull();
    expect(result!.container.querySelector('#panel-catalogos')).toBeNull();
  });
});
