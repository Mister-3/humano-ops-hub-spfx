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
import SupervisionOperaciones from './webparts/supervisionOperaciones/components/SupervisionOperaciones';
import GraphService from './webparts/supervisionOperaciones/services/GraphService';

const App: React.FC = () => {
  const graphService = React.useMemo(() => new GraphService(), []);
  const syncService = React.useMemo(() => new PowerAutomateSyncService(), []);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [isSyncing, setIsSyncing] = React.useState<boolean>(false);
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
        text: 'Paquete AppDB.xlsx / Power Automate exportado correctamente.'
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
      setMessage({
        type: MessageBarType.success,
        text: 'Datos importados. La aplicación se actualizará automáticamente.'
      });
      window.setTimeout(() => window.location.reload(), 700);
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

  return (
    <div className="standaloneApp">
      <aside className="syncToolbar" aria-label="Sincronización Power Automate">
        <div className="syncStatus">
          <span className="syncStatusDot" aria-hidden="true" />
          <span>
            Backend local activo · AppDB.xlsx / Power Automate
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
            text="Importar AppDB"
          />
          <PrimaryButton
            disabled={isSyncing}
            iconProps={{ iconName: 'Download' }}
            onClick={() => void handleExport()}
            text="Exportar para Power Automate"
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

      <SupervisionOperaciones graphService={graphService} />
    </div>
  );
};

export default App;
