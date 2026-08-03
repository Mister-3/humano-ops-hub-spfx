import * as React from 'react';

import AuthService from './AuthService';
import type {
  AppUserRole,
  IAppUserRecord,
  IAuthenticatedUser,
  IRegistrationInput
} from './AuthModels';

interface IAuthContextValue {
  currentUser: IAuthenticatedUser | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (input: IRegistrationInput) => Promise<void>;
  signOut: () => Promise<void>;
  refreshCurrentUser: () => Promise<void>;
  listUsers: () => Promise<Array<IAppUserRecord & { Id: number }>>;
  authorizeUser: (
    userId: number,
    role: Extract<AppUserRole, 'Admin' | 'Supervisor' | 'Asistente'>
  ) => Promise<void>;
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
    React.useState<IAuthenticatedUser | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);

  React.useEffect(() => {
    let isMounted = true;

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

    return () => {
      isMounted = false;
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
    signOut: async () => {
      await service.signOut();
      setCurrentUser(null);
    },
    refreshCurrentUser: async () => {
      setCurrentUser(await service.restoreSession());
    },
    listUsers: () => service.listUsers(),
    authorizeUser: async (userId, role) => {
      await service.authorizeUser(userId, role);
    }
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
