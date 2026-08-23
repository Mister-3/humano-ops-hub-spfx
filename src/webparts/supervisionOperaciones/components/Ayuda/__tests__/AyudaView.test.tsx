import * as React from 'react';
import { act } from 'react-dom/test-utils';
import { describe, expect, it, afterEach } from 'vitest';
import AyudaView from '../AyudaView';
import { renderUi, cleanupUi } from '../../Common/__tests__/testUtils';
import { APP_INFO, MODULES_INFO, RELEASES_DATA } from '../ayudaData';

describe('AyudaView Component', () => {
  afterEach(() => {
    cleanupUi();
  });

  it('renderiza el encabezado principal con el título, descripción y badge de versión', () => {
    const { container } = renderUi(<AyudaView />);
    expect(container.textContent).toContain('Centro de Ayuda & Versiones');
    expect(container.textContent).toContain(APP_INFO.version);
    expect(container.textContent).toContain('Documentación general del ecosistema Manager Hub');
  });

  it('renderiza la pestaña "Acerca de la Plataforma" por defecto con pilares y catálogo de módulos', () => {
    const { container } = renderUi(<AyudaView />);
    // Verifica pestañas
    expect(container.querySelector('#tab-acerca')).not.toBeNull();
    expect(container.querySelector('#tab-versiones')).not.toBeNull();

    // Verifica Hero y pilares
    expect(container.textContent).toContain(APP_INFO.name);
    expect(container.textContent).toContain('Pilares Técnicos y Arquitectura');

    // Verifica que los módulos principales estén presentes
    MODULES_INFO.forEach((mod) => {
      expect(container.textContent).toContain(mod.title);
    });
  });

  it('permite alternar a la pestaña "Versiones y Correcciones" y visualizar el timeline', () => {
    const { container } = renderUi(<AyudaView />);
    const versionesTabBtn = container.querySelector('#tab-versiones') as HTMLButtonElement;
    expect(versionesTabBtn).not.toBeNull();

    act(() => {
      versionesTabBtn.click();
    });

    // Verifica KPIs del changelog
    expect(container.textContent).toContain('Versión Activa');
    expect(container.textContent).toContain('Total Despliegues');
    expect(container.textContent).toContain('Última Actualización');

    // Verifica que todas las versiones históricas se muestren
    RELEASES_DATA.forEach((release) => {
      expect(container.textContent).toContain(release.version);
      expect(container.textContent).toContain(release.codename);
    });
  });

  it('permite filtrar los cambios en la pestaña de versiones', () => {
    const { container } = renderUi(<AyudaView />);
    const versionesTabBtn = container.querySelector('#tab-versiones') as HTMLButtonElement;

    act(() => {
      versionesTabBtn.click();
    });

    // Encuentra los botones de filtro
    const filterButtons = container.querySelectorAll('button');
    const featureFilterBtn = Array.from(filterButtons).find((btn) =>
      btn.textContent?.includes('Mejoras')
    );
    expect(featureFilterBtn).toBeDefined();

    act(() => {
      featureFilterBtn?.click();
    });

    // Sigue mostrando el timeline filtrado
    expect(container.textContent).toContain('v2.4.0');
  });
});
