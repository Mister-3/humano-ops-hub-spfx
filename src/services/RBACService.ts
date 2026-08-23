import { authenticatedSupabase } from './supabase';
import {
  mergeRBACRoleCatalog,
  normalizeRBACRoleId,
  type IRBACRole
} from '../auth/rbacRoleCatalog';

export type { IRBACRole } from '../auth/rbacRoleCatalog';

export interface IRBACPermission {
  id: string;
  module: string;
  name: string;
  description: string;
  category: 'pantalla' | 'accion';
}

export interface IRBACUserAssignment {
  userId: string;
  email: string;
  displayName: string;
  roleIds: string[];
}

export interface IRBACAdminData {
  roles: IRBACRole[];
  permissions: IRBACPermission[];
  permissionIdsByRole: Record<string, string[]>;
  users: IRBACUserAssignment[];
}

const errorMessage = (operation: string, detail?: string): Error =>
  new Error(`${operation}${detail ? `: ${detail}` : '.'}`);

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const loadRolesWithTimeout = async () => {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), 5000);
  try {
    return await authenticatedSupabase
      .from('roles')
      .select('id,name,description,is_system')
      .order('name')
      .abortSignal(controller.signal);
  } catch (loadError: unknown) {
    return {
      data: null,
      error: {
        message: loadError instanceof Error
          ? loadError.message
          : 'La consulta del catálogo de roles excedió el tiempo permitido.'
      }
    };
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
};

export class RBACService {
  public async getMyAccess(): Promise<{ roles: string[]; permissions: string[] }> {
    const { data, error } = await authenticatedSupabase.rpc('rbac_get_my_access');
    if (error) throw errorMessage('No se pudieron cargar los permisos', error.message);

    const payload = data && typeof data === 'object'
      ? data as Record<string, unknown>
      : {};
    return {
      roles: Array.from(new Set(asStringArray(payload.roles)
        .map(normalizeRBACRoleId)
        .filter(Boolean))),
      permissions: asStringArray(payload.permissions)
    };
  }

  public async getAdminData(): Promise<IRBACAdminData> {
    const [rolesResult, permissionsResult, mappingsResult, usersResult] = await Promise.all([
      loadRolesWithTimeout(),
      authenticatedSupabase.from('permissions').select('id,modulo,nombre,descripcion,categoria').order('modulo').order('nombre'),
      authenticatedSupabase.from('role_permissions').select('role_id,permission_id'),
      authenticatedSupabase.rpc('rbac_list_users')
    ]);

    const firstError = permissionsResult.error || mappingsResult.error || usersResult.error;
    if (firstError) {
      throw errorMessage('No se pudo cargar la administración RBAC', firstError.message);
    }

    const databaseRoles: IRBACRole[] = (rolesResult.data || []).map((row) => ({
      id: String(row.id),
      name: String(row.name),
      description: String(row.description || ''),
      isSystem: Boolean(row.is_system)
    }));
    const roles = mergeRBACRoleCatalog(databaseRoles);
    const permissions: IRBACPermission[] = (permissionsResult.data || []).map((row) => {
      const id = String(row.id);
      const module = id === 'modulo:admin:gestionar_usuarios' ||
        id === 'modulo:admin:gestionar_permisos'
        ? 'Administración de Usuarios'
        : id.startsWith('modulo:admin:')
          ? 'Configuración'
          : String(row.modulo);
      return {
        id,
        module,
        name: id === 'modulo:admin:ver' ? 'Ver Configuración' : String(row.nombre),
        description: String(row.descripcion || ''),
        category: row.categoria === 'pantalla' ? 'pantalla' : 'accion'
      };
    });
    const permissionIdsByRole = (mappingsResult.data || []).reduce<Record<string, string[]>>(
      (result, row) => {
        const roleId = normalizeRBACRoleId(String(row.role_id));
        if (!roleId) return result;
        result[roleId] = [...(result[roleId] || []), String(row.permission_id)];
        return result;
      },
      {}
    );
    const users: IRBACUserAssignment[] = (usersResult.data || []).map((row: Record<string, unknown>) => ({
      userId: String(row.user_id),
      email: String(row.email || ''),
      displayName: String(row.display_name || row.email || 'Usuario'),
      roleIds: Array.from(new Set(asStringArray(row.role_ids)
        .map(normalizeRBACRoleId)
        .filter(Boolean)))
    }));

    return { roles, permissions, permissionIdsByRole, users };
  }

  public async setRolePermissions(roleId: string, permissionIds: string[]): Promise<void> {
    const { error } = await authenticatedSupabase.rpc('rbac_set_role_permissions', {
      target_role_id: roleId,
      target_permission_ids: permissionIds
    });
    if (error) throw errorMessage('No se pudo actualizar el rol', error.message);
  }

  public async createRole(role: Pick<IRBACRole, 'id' | 'name' | 'description'>): Promise<IRBACRole> {
    const { data, error } = await authenticatedSupabase.rpc('rbac_create_role', {
      target_role_id: role.id,
      target_name: role.name,
      target_description: role.description
    });
    if (error) throw errorMessage('No se pudo crear el rol', error.message);
    return {
      id: String(data || role.id),
      name: role.name,
      description: role.description,
      isSystem: false
    };
  }

  public async setUserRoles(userId: string, roleIds: string[]): Promise<void> {
    const { error } = await authenticatedSupabase.rpc('rbac_set_user_roles', {
      target_user_id: userId,
      target_role_ids: roleIds
    });
    if (error) throw errorMessage('No se pudieron actualizar los roles del usuario', error.message);
  }
}

export const rbacService = new RBACService();
