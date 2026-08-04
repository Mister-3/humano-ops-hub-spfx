import * as React from 'react';

import { useAuth } from './auth/AuthProvider';
import AuthView from './auth/AuthView';
import ChangePasswordDialog from './auth/ChangePasswordDialog';
import SupervisionOperaciones from './webparts/supervisionOperaciones/components/SupervisionOperaciones';
import GraphService from './webparts/supervisionOperaciones/services/GraphService';

const App: React.FC = () => {
  const { currentUser, signOut } = useAuth();
  const graphService = React.useMemo(() => new GraphService(), []);
  const [isChangePasswordOpen, setIsChangePasswordOpen] =
    React.useState<boolean>(false);

  const handleSignOut = async (): Promise<void> => {
    setIsChangePasswordOpen(false);
    await signOut();
  };

  return (
    <div className="standaloneApp">
      <AuthView>
        {currentUser && currentUser.status === 'Active' ? (
          <SupervisionOperaciones
            currentUser={{
              id: currentUser.id,
              email: currentUser.email,
              displayName: currentUser.displayName,
              rol: currentUser.role
            }}
            graphService={graphService}
            onChangePassword={() => setIsChangePasswordOpen(true)}
            onSignOut={() => void handleSignOut()}
          />
        ) : null}
      </AuthView>

      <ChangePasswordDialog
        isOpen={Boolean(
          currentUser?.status === 'Active' && isChangePasswordOpen
        )}
        onDismiss={() => setIsChangePasswordOpen(false)}
      />
    </div>
  );
};

export default App;
