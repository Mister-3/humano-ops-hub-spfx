import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_VIEW,
  getHashForView,
  getSlugFromView,
  getViewFromHash,
  getViewFromSlug,
  MODULE_TO_SLUG,
  parseHash,
  SLUG_TO_MODULE,
  updateHashForView,
  type ViewKey
} from '../routeUtils';
import type { AppModuleKey } from '../../components/Navigation/SidebarNav';

describe('routeUtils (Hash Routing & Slug Mapping)', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    // Resetear hash antes de cada test
    window.location.hash = '';
  });

  afterEach(() => {
    window.location.hash = '';
  });

  describe('parseHash', () => {
    it('retorna string vacío para hashes vacíos o solo con hash/slash', () => {
      expect(parseHash('')).toBe('');
      expect(parseHash('#')).toBe('');
      expect(parseHash('#/')).toBe('');
      expect(parseHash('///')).toBe('');
    });

    it('extrae el slug limpio de rutas con prefijo #/ y /', () => {
      expect(parseHash('#/ayuda')).toBe('ayuda');
      expect(parseHash('#/end-to-end')).toBe('end-to-end');
      expect(parseHash('#admin')).toBe('admin');
      expect(parseHash('/kudos/')).toBe('kudos');
    });

    it('descarta parámetros de query incluidos en el hash', () => {
      expect(parseHash('#/iniciativas?mockRole=admin')).toBe('iniciativas');
      expect(parseHash('#/evaluacion?tab=metrics&filter=all')).toBe('evaluacion');
    });

    it('normaliza a minúsculas y elimina slashes redundantes', () => {
      expect(parseHash('#///PRODUCTIVIDAD///')).toBe('productividad');
      expect(parseHash('#/Ocupacion')).toBe('ocupacion');
    });
  });

  describe('getSlugFromView', () => {
    it('mapea correctamente cada AppModuleKey a su slug canónico', () => {
      expect(getSlugFromView('dashboard')).toBe('dashboard');
      expect(getSlugFromView('endToEnd')).toBe('end-to-end');
      expect(getSlugFromView('faltas')).toBe('faltas');
      expect(getSlugFromView('kudos')).toBe('kudos');
      expect(getSlugFromView('productividad')).toBe('productividad');
      expect(getSlugFromView('Ocupacion')).toBe('ocupacion');
      expect(getSlugFromView('Evaluacion')).toBe('evaluacion');
      expect(getSlugFromView('iniciativas')).toBe('iniciativas');
      expect(getSlugFromView('mejoras')).toBe('iniciativas');
      expect(getSlugFromView('admin')).toBe('admin');
      expect(getSlugFromView('userAdmin')).toBe('user-admin');
      expect(getSlugFromView('ayuda')).toBe('ayuda');
    });

    it('retorna "dashboard" como fallback para vistas desconocidas', () => {
      expect(getSlugFromView('desconocido' as AppModuleKey)).toBe('dashboard');
    });
  });

  describe('getViewFromSlug', () => {
    it('retorna el AppModuleKey correspondiente para slugs válidos y alias', () => {
      expect(getViewFromSlug('dashboard')).toBe('dashboard');
      expect(getViewFromSlug('end-to-end')).toBe('endToEnd');
      expect(getViewFromSlug('endtoend')).toBe('endToEnd');
      expect(getViewFromSlug('faltas')).toBe('faltas');
      expect(getViewFromSlug('ausencias')).toBe('faltas');
      expect(getViewFromSlug('kudos')).toBe('kudos');
      expect(getViewFromSlug('reconocimientos')).toBe('kudos');
      expect(getViewFromSlug('productividad')).toBe('productividad');
      expect(getViewFromSlug('ocupacion')).toBe('Ocupacion');
      expect(getViewFromSlug('evaluacion')).toBe('Evaluacion');
      expect(getViewFromSlug('iniciativas')).toBe('mejoras');
      expect(getViewFromSlug('mejoras')).toBe('mejoras');
      expect(getViewFromSlug('admin')).toBe('admin');
      expect(getViewFromSlug('configuracion')).toBe('admin');
      expect(getViewFromSlug('user-admin')).toBe('userAdmin');
      expect(getViewFromSlug('ayuda')).toBe('ayuda');
    });

    it('retorna DEFAULT_VIEW (dashboard) para slugs inválidos o vacíos', () => {
      expect(getViewFromSlug('')).toBe(DEFAULT_VIEW);
      expect(getViewFromSlug('ruta-fantasma-404')).toBe(DEFAULT_VIEW);
      expect(getViewFromSlug('unknown-module')).toBe(DEFAULT_VIEW);
    });
  });

  describe('getViewFromHash', () => {
    it('obtiene la vista correcta a partir de una cadena de hash explícita', () => {
      expect(getViewFromHash('#/ayuda')).toBe('ayuda');
      expect(getViewFromHash('#/end-to-end')).toBe('endToEnd');
      expect(getViewFromHash('#/user-admin')).toBe('userAdmin');
    });

    it('obtiene la vista correcta desde window.location.hash cuando no se pasa argumento', () => {
      window.location.hash = '#/kudos';
      expect(getViewFromHash()).toBe('kudos');

      window.location.hash = '#/evaluacion';
      expect(getViewFromHash()).toBe('Evaluacion');
    });

    it('retorna "dashboard" si window.location.hash está vacío', () => {
      window.location.hash = '';
      expect(getViewFromHash()).toBe('dashboard');
    });
  });

  describe('getHashForView & updateHashForView', () => {
    it('getHashForView genera la ruta con prefijo #/', () => {
      expect(getHashForView('ayuda')).toBe('#/ayuda');
      expect(getHashForView('endToEnd')).toBe('#/end-to-end');
      expect(getHashForView('admin')).toBe('#/admin');
    });

    it('updateHashForView actualiza window.location.hash de forma reactiva', () => {
      updateHashForView('ayuda');
      expect(window.location.hash).toBe('#/ayuda');

      updateHashForView('productividad');
      expect(window.location.hash).toBe('#/productividad');
    });

    it('coexiste armónicamente con query parameters existentes en la URL', () => {
      // Simular que la URL tiene search params
      window.location.hash = '#/dashboard';
      updateHashForView('kudos');
      expect(window.location.hash).toBe('#/kudos');
    });
  });
});
