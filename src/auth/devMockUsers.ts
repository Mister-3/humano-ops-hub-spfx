import type { IAuthenticatedUser } from './AuthModels';
import {
  type RoleSlug,
  type RoleType,
  canonicalizeRoleSlug,
  normalizeRoleType
} from '../types';

export const DEV_MOCK_STORAGE_KEY = 'ops_dev_mock_role';

export interface IDevMockUser extends IAuthenticatedUser {
  roleSlug: RoleSlug;
  roles: string[];
  permissions: string[];
}

export const DEV_MOCK_PERMISSIONS: Record<RoleSlug, string[]> = {
  admin: [
    'modulo:admin:ver',
    'modulo:admin:gestionar_catalogos',
    'modulo:admin:eliminar_catalogos',
    'modulo:admin:gestionar_usuarios',
    'modulo:admin:gestionar_permisos',
    'modulo:dashboard:ver',
    'modulo:evaluacion:ver',
    'modulo:faltas:ver',
    'modulo:faltas:registrar',
    'modulo:faltas:aprobar',
    'modulo:ausencias:ver',
    'modulo:ausencias:solicitar',
    'modulo:kudos:ver',
    'modulo:kudos:crear',
    'modulo:kudos:publicar_empleado_mes',
    'modulo:productividad:ver',
    'modulo:productividad:registrar',
    'modulo:productividad:eliminar',
    'modulo:ocupacion:ver',
    'modulo:ocupacion:registrar',
    'modulo:mejoras:ver',
    'modulo:mejoras:crear',
    'modulo:mejoras:aprobar',
    'modulo:iniciativas:ver',
    'modulo:iniciativas:crear',
    'modulo:iniciativas:editar',
    'modulo:iniciativas:eliminar',
    'modulo:iniciativas:aprobar',
    'modulo:end_to_end:ver',
    'modulo:end_to_end:importar',
    'modulo:end_to_end:marcar_reportada',
    'modulo:end_to_end:gestionar_calendario',
    'modulo:end_to_end:excluir_filas',
    'modulo:end_to_end:resolver_conflictos'
  ],
  gerente: [
    'modulo:dashboard:ver',
    'modulo:evaluacion:ver',
    'modulo:faltas:ver',
    'modulo:faltas:aprobar',
    'modulo:ausencias:ver',
    'modulo:kudos:ver',
    'modulo:kudos:publicar_empleado_mes',
    'modulo:productividad:ver',
    'modulo:ocupacion:ver',
    'modulo:mejoras:ver',
    'modulo:mejoras:aprobar',
    'modulo:iniciativas:ver',
    'modulo:iniciativas:crear',
    'modulo:iniciativas:editar',
    'modulo:iniciativas:aprobar',
    'modulo:end_to_end:ver',
    'modulo:end_to_end:marcar_reportada'
  ],
  supervisor: [
    'modulo:dashboard:ver',
    'modulo:evaluacion:ver',
    'modulo:faltas:ver',
    'modulo:faltas:registrar',
    'modulo:faltas:aprobar',
    'modulo:ausencias:ver',
    'modulo:ausencias:solicitar',
    'modulo:kudos:ver',
    'modulo:kudos:crear',
    'modulo:kudos:publicar_empleado_mes',
    'modulo:productividad:ver',
    'modulo:productividad:registrar',
    'modulo:ocupacion:ver',
    'modulo:ocupacion:registrar',
    'modulo:mejoras:ver',
    'modulo:mejoras:crear',
    'modulo:mejoras:aprobar',
    'modulo:iniciativas:ver',
    'modulo:iniciativas:crear',
    'modulo:iniciativas:editar',
    'modulo:iniciativas:eliminar',
    'modulo:iniciativas:aprobar',
    'modulo:end_to_end:ver',
    'modulo:end_to_end:importar',
    'modulo:end_to_end:marcar_reportada',
    'modulo:end_to_end:gestionar_calendario',
    'modulo:end_to_end:excluir_filas',
    'modulo:end_to_end:resolver_conflictos'
  ],
  asistente: [
    'modulo:dashboard:ver',
    'modulo:faltas:ver',
    'modulo:faltas:registrar',
    'modulo:ausencias:ver',
    'modulo:ausencias:solicitar',
    'modulo:kudos:ver',
    'modulo:kudos:crear',
    'modulo:productividad:ver',
    'modulo:mejoras:ver',
    'modulo:mejoras:crear',
    'modulo:iniciativas:ver',
    'modulo:iniciativas:crear',
    'modulo:iniciativas:editar',
    'modulo:iniciativas:eliminar',
    'modulo:end_to_end:ver',
    'modulo:end_to_end:importar',
    'modulo:end_to_end:marcar_reportada',
    'modulo:end_to_end:excluir_filas',
    'modulo:end_to_end:resolver_conflictos'
  ],
  agente: [
    'modulo:dashboard:ver',
    'modulo:faltas:ver',
    'modulo:faltas:registrar',
    'modulo:ausencias:ver',
    'modulo:ausencias:solicitar',
    'modulo:kudos:ver',
    'modulo:kudos:crear',
    'modulo:mejoras:ver',
    'modulo:mejoras:crear',
    'modulo:iniciativas:ver',
    'modulo:iniciativas:crear',
    'modulo:iniciativas:editar',
    'modulo:iniciativas:eliminar'
  ]
};

export const DEV_MOCK_USERS: Record<RoleSlug, IDevMockUser> = {
  admin: {
    id: 9991,
    externalId: 'dev-mock-admin-9991',
    email: 'admin.ops@humano.com.do',
    displayName: 'Admin Ops (Dev)',
    role: 'Admin',
    roleSlug: 'admin',
    status: 'Active',
    isProfileValidatedByPA: true,
    roles: ['admin'],
    permissions: DEV_MOCK_PERMISSIONS.admin
  },
  gerente: {
    id: 9992,
    externalId: 'dev-mock-gerente-9992',
    email: 'gerente.ops@humano.com.do',
    displayName: 'Gerente Ops (Dev)',
    role: 'Gerente',
    roleSlug: 'gerente',
    status: 'Active',
    isProfileValidatedByPA: true,
    roles: ['gerente'],
    permissions: DEV_MOCK_PERMISSIONS.gerente
  },
  supervisor: {
    id: 9993,
    externalId: 'dev-mock-supervisor-9993',
    email: 'supervisor.ops@humano.com.do',
    displayName: 'Supervisor Ops (Dev)',
    role: 'Supervisor',
    roleSlug: 'supervisor',
    status: 'Active',
    isProfileValidatedByPA: true,
    roles: ['supervisor'],
    permissions: DEV_MOCK_PERMISSIONS.supervisor
  },
  asistente: {
    id: 9994,
    externalId: 'dev-mock-asistente-9994',
    email: 'asistente.ops@humano.com.do',
    displayName: 'Asistente Ops (Dev)',
    role: 'Asistente',
    roleSlug: 'asistente',
    status: 'Active',
    isProfileValidatedByPA: true,
    roles: ['asistente'],
    permissions: DEV_MOCK_PERMISSIONS.asistente
  },
  agente: {
    id: 9995,
    externalId: 'dev-mock-agente-9995',
    email: 'agente.ops@humano.com.do',
    displayName: 'Agente Ops (Dev)',
    role: 'Agente',
    roleSlug: 'agente',
    status: 'Active',
    isProfileValidatedByPA: true,
    roles: ['agente'],
    permissions: DEV_MOCK_PERMISSIONS.agente
  }
};

export const isDevEnvironment = (): boolean => {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
    return true;
  }
  try {
    return Boolean(import.meta.env?.DEV) && !Boolean(import.meta.env?.PROD);
  } catch {
    return false;
  }
};

export const getDevMockRoleSlug = (): RoleSlug | null => {
  if (!isDevEnvironment()) return null;

  if (typeof window !== 'undefined') {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const urlRole = searchParams.get('mockRole') ||
        searchParams.get('devRole') ||
        searchParams.get('role');

      const canonicalFromUrl = canonicalizeRoleSlug(urlRole);
      if (canonicalFromUrl) {
        return canonicalFromUrl;
      }
    } catch {
      // Ignorar errores de URL en entornos aislados
    }

    try {
      const stored = window.localStorage?.getItem(DEV_MOCK_STORAGE_KEY);
      const canonicalFromStorage = canonicalizeRoleSlug(stored);
      if (canonicalFromStorage) {
        return canonicalFromStorage;
      }
    } catch {
      // Ignorar errores de localStorage
    }
  }

  // Si está habilitado explícitamente por variable de entorno
  try {
    if (import.meta.env?.VITE_ENABLE_AUTH_BYPASS === 'true') {
      return 'admin';
    }
  } catch {
    // Ignorar errores de env
  }

  return null;
};

export const isDevAuthBypassEnabled = (): boolean => {
  if (!isDevEnvironment()) return false;
  return getDevMockRoleSlug() !== null;
};

export const getMockUser = (roleInput?: string | null): IDevMockUser => {
  const slug = canonicalizeRoleSlug(roleInput) || 'admin';
  return DEV_MOCK_USERS[slug] || DEV_MOCK_USERS.admin;
};

export const setDevMockRole = (roleSlug: string | null): void => {
  if (!isDevEnvironment() || typeof window === 'undefined') return;
  try {
    if (!roleSlug) {
      window.localStorage?.removeItem(DEV_MOCK_STORAGE_KEY);
    } else {
      const canonical = canonicalizeRoleSlug(roleSlug) || 'admin';
      window.localStorage?.setItem(DEV_MOCK_STORAGE_KEY, canonical);
    }
    window.dispatchEvent(new CustomEvent('ops-dev-role-change', {
      detail: { roleSlug }
    }));
  } catch {
    // Ignorar excepciones de storage
  }
};
