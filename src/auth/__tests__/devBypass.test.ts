import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  DEV_MOCK_USERS,
  DEV_MOCK_PERMISSIONS,
  DEV_MOCK_STORAGE_KEY,
  getMockUser,
  getDevMockRoleSlug,
  isDevAuthBypassEnabled,
  setDevMockRole
} from '../devMockUsers';
import { createRBACPolicy } from '../rbacPolicy';
import { setupMemoryStorage } from '../../webparts/supervisionOperaciones/components/Common/__tests__/testUtils';

describe('Dev Auth Bypass & Role Switcher', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = setupMemoryStorage();
  });

  afterEach(() => {
    storage.clear();
  });

  it('define los 5 perfiles canónicos con sus metadatos y permisos correspondientes', () => {
    const roles = ['admin', 'gerente', 'supervisor', 'asistente', 'agente'] as const;

    roles.forEach((roleSlug) => {
      const mock = DEV_MOCK_USERS[roleSlug];
      expect(mock).toBeDefined();
      expect(mock.roleSlug).toBe(roleSlug);
      expect(mock.status).toBe('Active');
      expect(mock.email).toContain('@humano.com.do');
      expect(mock.permissions).toEqual(DEV_MOCK_PERMISSIONS[roleSlug]);
      expect(mock.permissions.length).toBeGreaterThan(0);
    });
  });

  it('getMockUser retorna el perfil exacto o hace fallback a admin', () => {
    expect(getMockUser('gerente').roleSlug).toBe('gerente');
    expect(getMockUser('supervisor').roleSlug).toBe('supervisor');
    expect(getMockUser('asistente').roleSlug).toBe('asistente');
    expect(getMockUser('agente').roleSlug).toBe('agente');
    expect(getMockUser('admin').roleSlug).toBe('admin');

    // Fallback con valores inválidos o nulos
    expect(getMockUser(null).roleSlug).toBe('admin');
    expect(getMockUser('rol_inexistente').roleSlug).toBe('admin');
  });

  it('evalúa correctamente las políticas de permisos según el rol mockeado', () => {
    const adminPolicy = createRBACPolicy({
      roles: DEV_MOCK_USERS.admin.roles,
      permissions: DEV_MOCK_USERS.admin.permissions
    });
    expect(adminPolicy.hasPermission('modulo:admin:gestionar_permisos')).toBe(true);
    expect(adminPolicy.hasPermission('cualquier:permiso:arbitrario')).toBe(true); // Admin bypass

    const agentePolicy = createRBACPolicy({
      roles: DEV_MOCK_USERS.agente.roles,
      permissions: DEV_MOCK_USERS.agente.permissions
    });
    expect(agentePolicy.hasPermission('modulo:faltas:ver')).toBe(true);
    expect(agentePolicy.hasPermission('modulo:admin:gestionar_permisos')).toBe(false);
    expect(agentePolicy.hasPermission('modulo:end_to_end:importar')).toBe(false);
  });

  it('permite cambiar y persistir el rol mock activo en localStorage en entorno dev', () => {
    setDevMockRole('supervisor');
    expect(storage.getItem(DEV_MOCK_STORAGE_KEY)).toBe('supervisor');
    expect(getDevMockRoleSlug()).toBe('supervisor');
    expect(isDevAuthBypassEnabled()).toBe(true);

    setDevMockRole('asistente');
    expect(storage.getItem(DEV_MOCK_STORAGE_KEY)).toBe('asistente');
    expect(getDevMockRoleSlug()).toBe('asistente');

    setDevMockRole(null);
    expect(storage.getItem(DEV_MOCK_STORAGE_KEY)).toBeNull();
  });
});
