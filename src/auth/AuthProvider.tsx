import * as React from 'react';

import AuthService from './AuthService';
import {
  isDevAuthBypassEnabled,
  getDevMockRoleSlug,
  getMockUser,
  DEV_MOCK_STORAGE_KEY,
  DEV_MOCK_USERS
} from './devMockUsers';
import type {
  AppUserRole,
  IAppUserRecord,
  IAuthenticatedUser,
  IMasterAdminRecoveryResult,
  IRegistrationInput,
  IUserAuthorizationResult
} from './AuthModels';

interface IAuthContextValue {
  currentUser: IAuthenticatedUser | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (input: IRegistrationInput) => Promise<void>;
  changePassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<void>;
  requestMasterAdminRecovery: (
    recoveryEmail: string
  ) => Promise<IMasterAdminRecoveryResult>;
  signOut: () => Promise<void>;
  refreshCurrentUser: () => Promise<void>;
  listUsers: () => Promise<Array<IAppUserRecord & { Id: number }>>;
  authorizeUser: (
    userId: number,
    role: AppUserRole
  ) => Promise<IUserAuthorizationResult>;
}

const AuthContext = React.createContext<IAuthContextValue | undefined>(
  undefined
);

interface IAuthProviderProps {
  children?: React.ReactNode;
}

export const AuthProvider: React.FC<IAuthProviderProps> = ({
  children
}) => {
  const service = React.useMemo(() => new AuthService(), []);
  const [currentUser, setCurrentUser] =
    React.useState<IAuthenticatedUser | null>(() => {
      if (isDevAuthBypassEnabled()) {
        const slug = getDevMockRoleSlug();
        return getMockUser(slug);
      }
      return null;
    });
  const [isLoading, setIsLoading] = React.useState<boolean>(() => !isDevAuthBypassEnabled());

  React.useEffect(() => {
    let isMounted = true;

    if (isDevAuthBypassEnabled()) {
      const slug = getDevMockRoleSlug();
      setCurrentUser(getMockUser(slug));
      setIsLoading(false);
    } else {
      service.initialize()
        .then((user) => {
          if (isMounted) {
            setCurrentUser(user);
          }
        })
        .finally(() => {
          if (isMounted) {
            setIsLoading(false);
          }
        });
    }

    const handleRoleChange = () => {
      if (!isMounted) return;
      if (isDevAuthBypassEnabled()) {
        const slug = getDevMockRoleSlug();
        setCurrentUser(getMockUser(slug));
        setIsLoading(false);
      } else {
        service.restoreSession().then((user) => {
          if (isMounted) setCurrentUser(user);
        });
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
      isMounted = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('ops-dev-role-change', handleRoleChange);
      }
    };
  }, [service]);

  const value = React.useMemo<IAuthContextValue>(() => ({
    currentUser,
    isLoading,
    signIn: async (email, password) => {
      setCurrentUser(await service.signIn(email, password));
    },
    register: async (input) => {
      setCurrentUser(await service.register(input));
    },
    changePassword: (currentPassword, newPassword) =>
      service.changePassword(currentPassword, newPassword),
    requestMasterAdminRecovery: (recoveryEmail) =>
      service.requestMasterAdminRecovery(recoveryEmail),
    signOut: async () => {
      // Desmonta inmediatamente toda UI y estado del usuario anterior.
      if (typeof window !== 'undefined' && isDevAuthBypassEnabled()) {
        window.localStorage?.removeItem(DEV_MOCK_STORAGE_KEY);
      }
      setCurrentUser(null);
      await service.signOut();
    },
    refreshCurrentUser: async () => {
      if (isDevAuthBypassEnabled()) {
        const slug = getDevMockRoleSlug();
        setCurrentUser(getMockUser(slug));
      } else {
        setCurrentUser(await service.restoreSession());
      }
    },
    listUsers: async () => {
      const dbUsers = await service.listUsers();
      if (dbUsers.length > 0) return dbUsers;
      if (isDevAuthBypassEnabled()) {
        return Object.values(DEV_MOCK_USERS).map((mock, index) => ({
          Id: mock.id,
          ID: mock.externalId,
          Email: mock.email,
          PasswordHash: '',
          Nombre: mock.displayName,
          Rol: mock.role,
          Estado: mock.status,
          IsProfileValidatedByPA: mock.isProfileValidatedByPA,
          FechaRegistro: new Date().toISOString(),
          FechaAprobacion: new Date().toISOString()
        }));
      }
      return [];
    },
    authorizeUser: (userId, role) => service.authorizeUser(userId, role)
  }), [currentUser, isLoading, service]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): IAuthContextValue => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ejecutarse dentro de AuthProvider.');
  }
  return context;
};
