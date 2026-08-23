import { normalizeRBACRoleId } from './rbacRoleCatalog.ts';

export interface IRBACAccessSnapshot {
  roles: ReadonlyArray<string>;
  permissions: ReadonlyArray<string>;
}

const normalizeIdentifier = (value: string): string =>
  value.trim().toLocaleLowerCase();

export const createRBACPolicy = (snapshot: IRBACAccessSnapshot) => {
  const roles = new Set(snapshot.roles
    .map(normalizeRBACRoleId)
    .filter(Boolean));
  const permissions = new Set(snapshot.permissions.map(normalizeIdentifier));
  const isAdmin = roles.has('admin');

  return {
    hasPermission: (permissionCode: string): boolean =>
      isAdmin || permissions.has(normalizeIdentifier(permissionCode)),
    hasAnyPermission: (permissionCodes: ReadonlyArray<string>): boolean =>
      permissionCodes.length > 0 && (isAdmin || permissionCodes.some((permissionCode) =>
        permissions.has(normalizeIdentifier(permissionCode))
      )),
    hasAllPermissions: (permissionCodes: ReadonlyArray<string>): boolean =>
      isAdmin || permissionCodes.every((permissionCode) =>
        permissions.has(normalizeIdentifier(permissionCode))
      ),
    hasRole: (roleName: string): boolean => roles.has(normalizeRBACRoleId(roleName))
  };
};
