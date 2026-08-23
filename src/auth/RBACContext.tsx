import * as React from 'react';

import { createRBACPolicy } from './rbacPolicy';
import { rbacService } from '../services/RBACService';
import {
  isDevAuthBypassEnabled,
  getDevMockRoleSlug,
  getMockUser,
  DEV_MOCK_STORAGE_KEY
} from './devMockUsers';

export interface IRBACContextValue {
  userRoles: string[];
  permissions: string[];
  hasPermission: (permissionCode: string) => boolean;
  hasAnyPermission: (permissionCodes: ReadonlyArray<string>) => boolean;
  hasAllPermissions: (permissionCodes: ReadonlyArray<string>) => boolean;
  hasRole: (roleName: string) => boolean;
  loading: boolean;
  error: string;
  refreshAccess: () => Promise<void>;
}

const RBACContext = React.createContext<IRBACContextValue | undefined>(undefined);

interface IRBACProviderProps {
  children?: React.ReactNode;
  userEmail: string;
}

export const RBACProvider: React.FC<IRBACProviderProps> = ({ children, userEmail }) => {
  const [userRoles, setUserRoles] = React.useState<string[]>(() => {
    if (isDevAuthBypassEnabled()) {
      const slug = getDevMockRoleSlug();
      return getMockUser(slug).roles;
    }
    return [];
  });
  const [permissions, setPermissions] = React.useState<string[]>(() => {
    if (isDevAuthBypassEnabled()) {
      const slug = getDevMockRoleSlug();
      return getMockUser(slug).permissions;
    }
    return [];
  });
  const [loading, setLoading] = React.useState<boolean>(() => !isDevAuthBypassEnabled());
  const [error, setError] = React.useState<string>('');
  const activeIdentityRef = React.useRef<string>('');

  const refreshAccess = React.useCallback(async (): Promise<void> => {
    const requestedIdentity = userEmail.trim().toLocaleLowerCase();
    
    if (isDevAuthBypassEnabled()) {
      const slug = getDevMockRoleSlug();
      const mock = getMockUser(slug);
      setUserRoles(mock.roles);
      setPermissions(mock.permissions);
      setLoading(false);
      setError('');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const access = await rbacService.getMyAccess();
      if (activeIdentityRef.current !== requestedIdentity) return;
      setUserRoles(access.roles);
      setPermissions(access.permissions);
    } catch (loadError: unknown) {
      if (activeIdentityRef.current !== requestedIdentity) return;
      setUserRoles([]);
      setPermissions([]);
      setError(loadError instanceof Error
        ? loadError.message
        : 'No fue posible cargar los permisos de la sesión.');
    } finally {
      if (activeIdentityRef.current === requestedIdentity) setLoading(false);
    }
  }, [userEmail]);

  React.useEffect(() => {
    const requestedIdentity = userEmail.trim().toLocaleLowerCase();
    activeIdentityRef.current = requestedIdentity;

    if (isDevAuthBypassEnabled()) {
      const slug = getDevMockRoleSlug();
      const mock = getMockUser(slug);
      setUserRoles(mock.roles);
      setPermissions(mock.permissions);
      setLoading(false);
      setError('');
    } else {
      setUserRoles([]);
      setPermissions([]);
      setError('');
      void refreshAccess();
    }

    const handleRoleChange = () => {
      if (isDevAuthBypassEnabled()) {
        const slug = getDevMockRoleSlug();
        const mock = getMockUser(slug);
        setUserRoles(mock.roles);
        setPermissions(mock.permissions);
        setLoading(false);
        setError('');
      } else {
        void refreshAccess();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('ops-dev-role-change', handleRoleChange);
      window.addEventListener('storage', (event) => {
        if (event.key === DEV_MOCK_STORAGE_KEY) {
          handleRoleChange();
        }
      });
    }

    return () => {
      if (activeIdentityRef.current === requestedIdentity) {
        activeIdentityRef.current = '';
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('ops-dev-role-change', handleRoleChange);
      }
    };
  }, [refreshAccess, userEmail]);

  const policy = React.useMemo(
    () => createRBACPolicy({ roles: userRoles, permissions }),
    [permissions, userRoles]
  );
  const value = React.useMemo<IRBACContextValue>(() => ({
    userRoles,
    permissions,
    ...policy,
    loading,
    error,
    refreshAccess
  }), [error, loading, permissions, policy, refreshAccess, userRoles]);

  return <RBACContext.Provider value={value}>{children}</RBACContext.Provider>;
};

export const useRBAC = (): IRBACContextValue => {
  const context = React.useContext(RBACContext);
  if (!context) throw new Error('useRBAC debe ejecutarse dentro de RBACProvider.');
  return context;
};
