import * as React from 'react';
import {
  DefaultButton,
  MessageBar,
  MessageBarType,
  Pivot,
  PivotItem,
  Spinner,
  SpinnerSize,
  Stack,
  Text
} from '@fluentui/react';

import type { IUsuario } from '../models/AppModels';
import type GraphService from '../services/GraphService';
import SecurityService from '../services/SecurityService';
import AdminPanel from './Admin/AdminPanel';
import Dashboard from './Dashboard/Dashboard';
import FaltasForm from './Faltas/FaltasForm';
import KudosForm from './Kudos/KudosForm';
import ProductividadForm from './Productividad/ProductividadForm';
import styles from './SupervisionOperaciones.module.scss';

export interface ISupervisionOperacionesProps {
  graphService: GraphService;
}

const SupervisionOperaciones: React.FC<ISupervisionOperacionesProps> = ({
  graphService
}) => {
  const [usuario, setUsuario] = React.useState<IUsuario | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    let isMounted = true;

    const loadCurrentUser = async (): Promise<void> => {
      try {
        const securityService = new SecurityService();
        const currentUser = await securityService.getCurrentUser();

        if (isMounted) {
          setUsuario(currentUser);
        }
      } catch (error: unknown) {
        if (isMounted) {
          const detail = error instanceof Error
            ? error.message
            : 'Ocurrió un error inesperado.';
          setErrorMessage(detail);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadCurrentUser().catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <Stack className={styles.supervisionOperaciones} verticalAlign="center">
        <Spinner
          label="Cargando identidad de Microsoft 365..."
          size={SpinnerSize.large}
        />
      </Stack>
    );
  }

  if (errorMessage || !usuario) {
    return (
      <Stack className={styles.supervisionOperaciones} verticalAlign="center">
        <MessageBar messageBarType={MessageBarType.error}>
          {errorMessage || 'No fue posible identificar al usuario actual.'}
        </MessageBar>
      </Stack>
    );
  }

  return (
    <Stack
      className={styles.supervisionOperaciones}
      horizontalAlign="center"
      verticalAlign="center"
      tokens={{ childrenGap: 20 }}
    >
      <MessageBar messageBarType={MessageBarType.success}>
        <Text variant="large">
          Bienvenido, {usuario.displayName}. Rol activo: {usuario.rol}
        </Text>
      </MessageBar>

      <DefaultButton
        disabled={usuario.rol !== 'Admin'}
        text="Acceso a panel de configuración"
      />

      <Pivot className={styles.pivot} aria-label="Módulos del portal">
        <PivotItem headerText="Dashboard">
          <Dashboard />
        </PivotItem>

        <PivotItem headerText="Registro Operativo">
          <FaltasForm graphService={graphService} userRole={usuario.rol} />
        </PivotItem>

        <PivotItem headerText="Reconocimientos">
          <KudosForm graphService={graphService} remitente={usuario.displayName} />
        </PivotItem>

        {(usuario.rol === 'Admin' || usuario.rol === 'Supervisor') && (
          <PivotItem headerText="Carga de Productividad">
            <ProductividadForm graphService={graphService} />
          </PivotItem>
        )}

        {usuario.rol === 'Admin' && (
          <PivotItem headerText="Administración">
            <AdminPanel userRole={usuario.rol} />
          </PivotItem>
        )}
      </Pivot>
    </Stack>
  );
};

export default SupervisionOperaciones;
