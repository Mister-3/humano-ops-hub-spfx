import * as React from 'react';
import { createPortal } from 'react-dom';
import { Icon, Spinner, SpinnerSize } from '@fluentui/react';

import { useRBAC } from '../../../../auth/RBACContext';
import {
  createRoleSlug,
  isValidCustomRoleSlug,
  mergeRBACRoleCatalog
} from '../../../../auth/rbacRoleCatalog';
import {
  type IRBACAdminData,
  type IRBACPermission,
  rbacService
} from '../../../../services/RBACService';
import { NoAccessMessage } from '../Common/PermissionGuard';
import styles from './RolesPermissionsAdmin.module.scss';

const PERMISSION_MODULE_ORDER = [
  'Administración de Usuarios',
  'Configuración',
  'Dashboard',
  'Iniciativas & Mejoras',
  'End-to-End',
  'Faltas',
  'Ausencias',
  'Kudos',
  'Productividad',
  'Ocupación',
  'Evaluación'
] as const;

const groupPermissions = (
  permissions: ReadonlyArray<IRBACPermission>
): Array<[string, IRBACPermission[]]> => {
  const groups = permissions.reduce<Record<string, IRBACPermission[]>>((result, permission) => {
    result[permission.module] = [...(result[permission.module] || []), permission];
    return result;
  }, {});
  return Object.entries(groups).sort(([left], [right]) => {
    const leftIndex = PERMISSION_MODULE_ORDER.indexOf(left as typeof PERMISSION_MODULE_ORDER[number]);
    const rightIndex = PERMISSION_MODULE_ORDER.indexOf(right as typeof PERMISSION_MODULE_ORDER[number]);
    if (leftIndex >= 0 || rightIndex >= 0) {
      return (leftIndex >= 0 ? leftIndex : Number.MAX_SAFE_INTEGER) -
        (rightIndex >= 0 ? rightIndex : Number.MAX_SAFE_INTEGER);
    }
    return left.localeCompare(right, 'es');
  });
};

const permissionsForRole = (
  data: IRBACAdminData,
  roleId: string
): string[] => roleId === 'admin'
  ? data.permissions.map((permission) => permission.id)
  : data.permissionIdsByRole[roleId] || [];

const RolesPermissionsAdmin: React.FC = () => {
  const { hasPermission, refreshAccess } = useRBAC();
  const [data, setData] = React.useState<IRBACAdminData>();
  const [selectedRoleId, setSelectedRoleId] = React.useState<string>('admin');
  const [selectedPermissions, setSelectedPermissions] = React.useState<Set<string>>(new Set());
  const [userDrafts, setUserDrafts] = React.useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = React.useState<boolean>(true);
  const [savingRole, setSavingRole] = React.useState<boolean>(false);
  const [savingUserId, setSavingUserId] = React.useState<string>('');
  const [message, setMessage] = React.useState<{ kind: 'success' | 'error'; text: string }>();
  const [toast, setToast] = React.useState<string>('');
  const [isCreateRoleOpen, setIsCreateRoleOpen] = React.useState<boolean>(false);
  const [creatingRole, setCreatingRole] = React.useState<boolean>(false);
  const [newRoleName, setNewRoleName] = React.useState<string>('');
  const [newRoleSlug, setNewRoleSlug] = React.useState<string>('');
  const [newRoleDescription, setNewRoleDescription] = React.useState<string>('');
  const [roleSlugEdited, setRoleSlugEdited] = React.useState<boolean>(false);
  const [createRoleError, setCreateRoleError] = React.useState<string>('');
  const newRoleNameRef = React.useRef<HTMLInputElement>(null);

  const canManage = hasPermission('modulo:admin:gestionar_permisos');

  const loadData = React.useCallback(async (): Promise<void> => {
    if (!canManage) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setMessage(undefined);
    try {
      const loaded = await rbacService.getAdminData();
      setData(loaded);
      const activeRole = loaded.roles.some((role) => role.id === selectedRoleId)
        ? selectedRoleId
        : loaded.roles[0]?.id || '';
      setSelectedRoleId(activeRole);
      setSelectedPermissions(new Set(permissionsForRole(loaded, activeRole)));
      setUserDrafts(loaded.users.reduce<Record<string, Set<string>>>((result, user) => {
        result[user.userId] = new Set(user.roleIds);
        return result;
      }, {}));
    } catch (loadError: unknown) {
      setMessage({
        kind: 'error',
        text: loadError instanceof Error ? loadError.message : 'No se pudo cargar la matriz RBAC.'
      });
    } finally {
      setLoading(false);
    }
  }, [canManage, selectedRoleId]);

  React.useEffect(() => {
    void loadData();
    // La carga inicial no debe repetirse mientras se edita el selector.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  React.useEffect(() => {
    if (!toast) return undefined;
    const timeoutId = globalThis.setTimeout(() => setToast(''), 4200);
    return () => globalThis.clearTimeout(timeoutId);
  }, [toast]);

  React.useEffect(() => {
    if (!isCreateRoleOpen) return undefined;
    const focusId = globalThis.setTimeout(() => newRoleNameRef.current?.focus(), 0);
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !creatingRole) setIsCreateRoleOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      globalThis.clearTimeout(focusId);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [creatingRole, isCreateRoleOpen]);

  const selectRole = (roleId: string): void => {
    setSelectedRoleId(roleId);
    setSelectedPermissions(new Set(data ? permissionsForRole(data, roleId) : []));
    setMessage(undefined);
  };

  const openCreateRole = (): void => {
    setNewRoleName('');
    setNewRoleSlug('');
    setNewRoleDescription('');
    setRoleSlugEdited(false);
    setCreateRoleError('');
    setIsCreateRoleOpen(true);
  };

  const closeCreateRole = (): void => {
    if (!creatingRole) setIsCreateRoleOpen(false);
  };

  const handleRoleNameChange = (value: string): void => {
    setNewRoleName(value);
    if (!roleSlugEdited) setNewRoleSlug(createRoleSlug(value));
  };

  const createRole = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const name = newRoleName.trim();
    const slug = createRoleSlug(newRoleSlug);
    if (name.length < 3) {
      setCreateRoleError('El nombre del rol debe contener al menos 3 caracteres.');
      return;
    }
    if (!isValidCustomRoleSlug(slug)) {
      setCreateRoleError('Usa un slug de 3 a 50 caracteres: letras minúsculas, números y guion bajo.');
      return;
    }
    if (data?.roles.some((role) => role.id === slug || role.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setCreateRoleError('Ya existe un rol con ese nombre o identificador.');
      return;
    }

    setCreatingRole(true);
    setCreateRoleError('');
    try {
      const createdRole = await rbacService.createRole({
        id: slug,
        name,
        description: newRoleDescription.trim()
      });
      const loaded = await rbacService.getAdminData();
      const loadedWithCreatedRole: IRBACAdminData = {
        ...loaded,
        roles: mergeRBACRoleCatalog([...loaded.roles, createdRole]),
        permissionIdsByRole: {
          ...loaded.permissionIdsByRole,
          [createdRole.id]: loaded.permissionIdsByRole[createdRole.id] || []
        }
      };
      setData(loadedWithCreatedRole);
      setSelectedRoleId(createdRole.id);
      setSelectedPermissions(new Set(permissionsForRole(loadedWithCreatedRole, createdRole.id)));
      setUserDrafts(loaded.users.reduce<Record<string, Set<string>>>((result, user) => {
        result[user.userId] = new Set(user.roleIds);
        return result;
      }, {}));
      setIsCreateRoleOpen(false);
      setToast(`Rol “${createdRole.name}” creado. Ya puedes asignarle permisos.`);
    } catch (creationError: unknown) {
      setCreateRoleError(creationError instanceof Error
        ? creationError.message
        : 'No se pudo crear el nuevo rol.');
    } finally {
      setCreatingRole(false);
    }
  };

  const togglePermission = (permissionId: string): void => {
    const isProtectedAdminPermission = selectedRoleId === 'admin';
    if (isProtectedAdminPermission) return;
    setSelectedPermissions((current) => {
      const next = new Set(current);
      if (next.has(permissionId)) next.delete(permissionId);
      else next.add(permissionId);
      return next;
    });
  };

  const saveRole = async (): Promise<void> => {
    if (!selectedRoleId) return;
    setSavingRole(true);
    setMessage(undefined);
    try {
      await rbacService.setRolePermissions(selectedRoleId, Array.from(selectedPermissions));
      setData((current) => current ? {
        ...current,
        permissionIdsByRole: {
          ...current.permissionIdsByRole,
          [selectedRoleId]: Array.from(selectedPermissions)
        }
      } : current);
      await refreshAccess();
      setMessage({ kind: 'success', text: 'Permisos actualizados y aplicados sin recargar la página.' });
    } catch (saveError: unknown) {
      setMessage({ kind: 'error', text: saveError instanceof Error ? saveError.message : 'No se pudo guardar el rol.' });
    } finally {
      setSavingRole(false);
    }
  };

  const toggleUserRole = (userId: string, roleId: string): void => {
    setUserDrafts((current) => {
      const nextRoles = new Set(current[userId] || []);
      if (nextRoles.has(roleId)) nextRoles.delete(roleId);
      else nextRoles.add(roleId);
      return { ...current, [userId]: nextRoles };
    });
  };

  const saveUser = async (userId: string): Promise<void> => {
    const roleIds = Array.from(userDrafts[userId] || []);
    if (roleIds.length === 0) {
      setMessage({ kind: 'error', text: 'Cada usuario debe conservar al menos un rol.' });
      return;
    }
    setSavingUserId(userId);
    setMessage(undefined);
    try {
      await rbacService.setUserRoles(userId, roleIds);
      await refreshAccess();
      setMessage({ kind: 'success', text: 'Roles del usuario actualizados correctamente.' });
    } catch (saveError: unknown) {
      setMessage({ kind: 'error', text: saveError instanceof Error ? saveError.message : 'No se pudieron guardar los roles.' });
    } finally {
      setSavingUserId('');
    }
  };

  if (!canManage) {
    return <NoAccessMessage detail="Se requiere el permiso para gestionar roles y permisos." />;
  }
  if (loading) {
    return <section className={styles.panel}><Spinner label="Cargando matriz de permisos..." size={SpinnerSize.large} /></section>;
  }

  return (
    <section className={styles.panel} aria-label="Administración de roles y permisos">
      <header className={styles.header}>
        <div className={styles.headerIcon}><Icon iconName="Permissions" /></div>
        <div>
          <h3>Roles y permisos granulares</h3>
          <p>Administra el acceso a pantallas y acciones. Los cambios se aplican a nuevas consultas de sesión.</p>
        </div>
      </header>

      {message && <div className={message.kind === 'success' ? styles.success : styles.error} role="status">{message.text}</div>}

      {toast && <div className={styles.toast} role="status"><Icon iconName="CheckMark" /> {toast}</div>}

      <div className={styles.roleSelector}>
        <label htmlFor="rbac-role">Rol a configurar</label>
        <div className={styles.roleSelectorRow}>
          <select id="rbac-role" value={selectedRoleId} onChange={(event) => selectRole(event.target.value)}>
            {(data?.roles || []).map((role) => (
              <option className={styles.option} key={role.id} value={role.id}>
                {role.name}{role.isSystem ? '' : ' · personalizado'}
              </option>
            ))}
          </select>
          <button
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-cyan-600/20 transition-all flex items-center gap-1.5"
            onClick={openCreateRole}
            type="button"
          >
            <Icon iconName="Add" /> + Nuevo Rol
          </button>
        </div>
        <p>{data?.roles.find((role) => role.id === selectedRoleId)?.description}</p>
      </div>

      {selectedRoleId === 'admin' && (
        <div className={styles.adminNotice} role="note">
          Admin conserva acceso efectivo a todas las pantallas y acciones. Las casillas permiten mantener visible y auditable su asignación explícita.
        </div>
      )}

      <div className={styles.permissionGroups}>
        {groupPermissions(data?.permissions || []).map(([moduleName, permissions]) => (
          <fieldset className={styles.permissionGroup} key={moduleName}>
            <legend>{moduleName} <small>{permissions.length} permisos</small></legend>
            {permissions.map((permission) => {
              const protectedPermission = selectedRoleId === 'admin';
              return (
                <label className={styles.permissionRow} key={permission.id}>
                  <input
                    checked={selectedPermissions.has(permission.id)}
                    disabled={protectedPermission}
                    onChange={() => togglePermission(permission.id)}
                    type="checkbox"
                  />
                  <span><strong>{permission.name}</strong><small>{permission.description}</small></span>
                  <em>{permission.category === 'pantalla' ? 'Pantalla' : 'Acción'}</em>
                </label>
              );
            })}
          </fieldset>
        ))}
      </div>

      <div className={styles.actions}>
        <button className={styles.primaryButton} disabled={savingRole} onClick={() => void saveRole()} type="button">
          {savingRole ? 'Guardando…' : 'Guardar Permisos'}
        </button>
      </div>

      <div className={styles.usersSection}>
        <div><h4>Asignación de roles a usuarios</h4><p>Un usuario puede acumular permisos mediante uno o varios roles.</p></div>
        <div className={styles.usersGrid}>
          {(data?.users || []).map((user) => (
            <article className={styles.userCard} key={user.userId}>
              <div><strong>{user.displayName}</strong><small>{user.email}</small></div>
              <div className={styles.userRoles}>
                {(data?.roles || []).map((role) => (
                  <label key={role.id}>
                    <input
                      checked={userDrafts[user.userId]?.has(role.id) || false}
                      onChange={() => toggleUserRole(user.userId, role.id)}
                      type="checkbox"
                    />
                    {role.name}
                  </label>
                ))}
              </div>
              <button
                className={styles.secondaryButton}
                disabled={savingUserId === user.userId}
                onClick={() => void saveUser(user.userId)}
                type="button"
              >
                {savingUserId === user.userId ? 'Guardando…' : 'Guardar roles'}
              </button>
            </article>
          ))}
        </div>
      </div>

      {isCreateRoleOpen && typeof document !== 'undefined' && createPortal(
        <div
          aria-labelledby="create-role-title"
          aria-modal="true"
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeCreateRole();
          }}
          role="dialog"
        >
          <form
            className="bg-slate-900 border border-slate-800 text-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-auto space-y-5"
            onSubmit={(event) => void createRole(event)}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="m-0 text-lg font-bold text-white" id="create-role-title">Crear nuevo rol</h4>
                <p className="mt-1 mb-0 text-sm text-slate-400">El rol aparecerá inmediatamente en la matriz y en la asignación de usuarios.</p>
              </div>
              <button
                aria-label="Cerrar creación de rol"
                className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-slate-300 hover:bg-slate-700"
                disabled={creatingRole}
                onClick={closeCreateRole}
                type="button"
              >
                <Icon iconName="Cancel" />
              </button>
            </div>

            {createRoleError && <div className={styles.modalError} role="alert">{createRoleError}</div>}

            <label className="block space-y-2" htmlFor="new-role-name">
              <span className="text-sm font-semibold text-slate-200">Nombre del Rol *</span>
              <input
                className="w-full bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 rounded-xl p-3 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                id="new-role-name"
                maxLength={80}
                onChange={(event) => handleRoleNameChange(event.target.value)}
                placeholder="Ej. Auditor Operativo"
                ref={newRoleNameRef}
                required
                value={newRoleName}
              />
            </label>

            <label className="block space-y-2" htmlFor="new-role-slug">
              <span className="text-sm font-semibold text-slate-200">Identificador / Slug *</span>
              <input
                aria-describedby="new-role-slug-help"
                className="w-full bg-slate-950 border border-slate-800 text-slate-400 placeholder-slate-600 rounded-xl p-3 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                id="new-role-slug"
                maxLength={50}
                onChange={(event) => {
                  setRoleSlugEdited(true);
                  setNewRoleSlug(createRoleSlug(event.target.value));
                }}
                placeholder="auditor_operativo"
                required
                value={newRoleSlug}
              />
              <small className="block text-xs text-slate-500" id="new-role-slug-help">Letras minúsculas, números y guion bajo; debe iniciar con una letra.</small>
            </label>

            <label className="block space-y-2" htmlFor="new-role-description">
              <span className="text-sm font-semibold text-slate-200">Descripción <span className="font-normal text-slate-500">(opcional)</span></span>
              <textarea
                className="w-full resize-y bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 rounded-xl p-3 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                id="new-role-description"
                maxLength={500}
                onChange={(event) => setNewRoleDescription(event.target.value)}
                placeholder="Describe el alcance operativo de este rol."
                rows={3}
                value={newRoleDescription}
              />
            </label>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm"
                disabled={creatingRole}
                onClick={closeCreateRole}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-sm shadow-lg shadow-cyan-600/20 disabled:cursor-wait disabled:opacity-60"
                disabled={creatingRole}
                type="submit"
              >
                {creatingRole ? 'Guardando…' : 'Guardar Rol'}
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}
    </section>
  );
};

export default RolesPermissionsAdmin;
