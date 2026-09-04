import type { AppModuleKey } from '../components/Navigation/SidebarNav';

export type ViewKey = AppModuleKey;

export const DEFAULT_VIEW: AppModuleKey = 'dashboard';

/**
 * Mapeo de AppModuleKey a slugs canónicos para la URL.
 */
export const MODULE_TO_SLUG: Record<AppModuleKey, string> = {
  dashboard: 'dashboard',
  endToEnd: 'end-to-end',
  faltas: 'faltas',
  kudos: 'kudos',
  productividad: 'productividad',
  Ocupacion: 'ocupacion',
  mejoras: 'iniciativas',
  iniciativas: 'iniciativas',
  oportunidades: 'iniciativas',
  solicitudes_mejora: 'iniciativas',
  Evaluacion: 'evaluacion',
  admin: 'admin',
  userAdmin: 'user-admin',
  ayuda: 'ayuda'
};

/**
 * Mapeo de slugs de URL (y sus alias) a AppModuleKey válidos.
 */
export const SLUG_TO_MODULE: Record<string, AppModuleKey> = {
  'dashboard': 'dashboard',
  'inicio': 'dashboard',
  'end-to-end': 'endToEnd',
  'endtoend': 'endToEnd',
  'faltas': 'faltas',
  'registro-operativo': 'faltas',
  'ausencias': 'faltas',
  'kudos': 'kudos',
  'reconocimientos': 'kudos',
  'productividad': 'productividad',
  'ocupacion': 'Ocupacion',
  'mejoras': 'mejoras',
  'iniciativas': 'mejoras',
  'oportunidades': 'mejoras',
  'solicitudes-mejora': 'mejoras',
  'solicitudes_mejora': 'mejoras',
  'evaluacion': 'Evaluacion',
  'admin': 'admin',
  'configuracion': 'admin',
  'user-admin': 'userAdmin',
  'useradmin': 'userAdmin',
  'usuarios': 'userAdmin',
  'ayuda': 'ayuda'
};

/**
 * Limpia y normaliza un hash de URL para extraer el slug puro.
 * Maneja formatos como '#/modulo', '#modulo', '#/modulo?param=1', etc.
 */
export const parseHash = (hash: string): string => {
  if (!hash) return '';
  const beforeQuery = hash.split('?')[0] || '';
  const withoutHash = beforeQuery.replace(/^#/, '');
  return withoutHash.trim().replace(/^\/+|\/+$/g, '').toLowerCase();
};

/**
 * Obtiene el slug correspondiente a una vista dada.
 */
export const getSlugFromView = (view: AppModuleKey): string => {
  return MODULE_TO_SLUG[view] || 'dashboard';
};

/**
 * Retorna la vista correspondiente a un slug de texto.
 */
export const getViewFromSlug = (slug: string): AppModuleKey => {
  const normalized = parseHash(slug);
  if (!normalized) return DEFAULT_VIEW;
  return SLUG_TO_MODULE[normalized] || DEFAULT_VIEW;
};

/**
 * Lee el hash actual de la URL (o el proporcionado) y retorna la vista correspondiente.
 * Si el hash es vacío o desconocido, retorna DEFAULT_VIEW ('dashboard').
 */
export const getViewFromHash = (hash?: string): AppModuleKey => {
  const rawHash = typeof hash === 'string'
    ? hash
    : (typeof window !== 'undefined' ? window.location.hash : '');
  return getViewFromSlug(rawHash);
};

/**
 * Retorna la cadena hash formateada ('#/slug') para una vista dada.
 */
export const getHashForView = (view: AppModuleKey): string => {
  return `#/${getSlugFromView(view)}`;
};

/**
 * Actualiza el hash de la URL del navegador sin recargar la página
 * ni alterar los query parameters existentes (?mockRole=admin, etc.).
 */
export const updateHashForView = (view: AppModuleKey): void => {
  if (typeof window === 'undefined') return;

  const targetHash = getHashForView(view);
  if (window.location.hash !== targetHash) {
    window.location.hash = targetHash;
  }
};
