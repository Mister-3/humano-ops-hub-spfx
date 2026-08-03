import * as React from 'react';
import {
  DefaultButton,
  MessageBar,
  MessageBarType,
  PrimaryButton,
  Spinner,
  SpinnerSize
} from '@fluentui/react';

import PowerAutomateSyncService from './services/PowerAutomateSyncService';
import { useAuth } from './auth/AuthProvider';
import AuthView from './auth/AuthView';
import ChangePasswordDialog from './auth/ChangePasswordDialog';
import SupervisionOperaciones from './webparts/supervisionOperaciones/components/SupervisionOperaciones';
import GraphService from './webparts/supervisionOperaciones/services/GraphService';

const App: React.FC = () => {
  const { currentUser, refreshCurrentUser, signOut } = useAuth();
  const graphService = React.useMemo(() => new GraphService(), []);
  const syncService = React.useMemo(() => new PowerAutomateSyncService(), []);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [isSyncing, setIsSyncing] = React.useState<boolean>(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] =
    React.useState<boolean>(false);
  const [message, setMessage] = React.useState<{
    type: MessageBarType;
    text: string;
  } | null>(null);

  const handleExport = async (): Promise<void> => {
    setIsSyncing(true);
    setMessage(null);

    try {
      await syncService.downloadExport();
      setMessage({
        type: MessageBarType.success,
        text: 'Diferencias exportadas para sincronizar AppDB.xlsx mediante Power Automate.'
      });
    } catch (error: unknown) {
      setMessage({
        type: MessageBarType.error,
        text: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleImport = async (
    event: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setIsSyncing(true);
    setMessage(null);

    try {
      await syncService.importPackage(await file.text());
      await refreshCurrentUser();
      setMessage({
        type: MessageBarType.success,
        text: 'Respuesta de OneDrive / Excel importada y fusionada correctamente.'
      });
    } catch (error: unknown) {
      setMessage({
        type: MessageBarType.error,
        text: error instanceof Error ? error.message : String(error)
      });
    } finally {
      event.target.value = '';
      setIsSyncing(false);
    }
  };

  const handleSignOut = async (): Promise<void> => {
    setIsChangePasswordOpen(false);
    await signOut();
  };

  return (
    <div className="standaloneApp">
      <aside className="syncToolbar" aria-label="Sincronización Power Automate">
        <div className="syncStatus">
          <span className="syncStatusDot" aria-hidden="true" />
          <span>
            Local-first activo · Sincronización manual AppDB.xlsx
          </span>
        </div>

        <div className="syncActions">
          {isSyncing && (
            <Spinner size={SpinnerSize.small} label="Procesando" />
          )}
          <DefaultButton
            disabled={isSyncing}
            iconProps={{ iconName: 'Upload' }}
            onClick={() => fileInputRef.current?.click()}
            text="Importar respuesta"
          />
          <PrimaryButton
            disabled={isSyncing}
            iconProps={{ iconName: 'Download' }}
            onClick={() => void handleExport()}
            text="🔄 Sincronizar a OneDrive / Excel"
          />
          <input
            ref={fileInputRef}
            accept="application/json,.json"
            aria-label="Seleccionar paquete AppDB"
            className="syncFileInput"
            onChange={(event) => void handleImport(event)}
            type="file"
          />
        </div>
      </aside>

      {message && (
        <div className="syncMessage">
          <MessageBar
            isMultiline={false}
            messageBarType={message.type}
            onDismiss={() => setMessage(null)}
          >
            {message.text}
          </MessageBar>
        </div>
      )}

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
