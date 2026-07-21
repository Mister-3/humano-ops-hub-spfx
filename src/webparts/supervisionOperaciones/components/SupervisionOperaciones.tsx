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
  Text,
  ThemeProvider
} from '@fluentui/react';

import type { IUsuario } from '../models/AppModels';
import type GraphService from '../services/GraphService';
import SecurityService from '../services/SecurityService';
import { darkTheme, glowCardStyles } from '../theme/DarkTheme';
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

  const renderContent = (): React.ReactElement => {
    if (isLoading) {
      return (
        <Stack
          className={styles.stateContainer}
          horizontalAlign="center"
          verticalAlign="center"
        >
          <Stack className={styles.stateCard} styles={glowCardStyles}>
            <Spinner
              label="Cargando identidad de Microsoft 365..."
              size={SpinnerSize.large}
            />
          </Stack>
        </Stack>
      );
    }

    if (errorMessage || !usuario) {
      return (
        <Stack
          className={styles.stateContainer}
          horizontalAlign="center"
          verticalAlign="center"
        >
          <Stack className={styles.stateCard} styles={glowCardStyles}>
            <MessageBar messageBarType={MessageBarType.error}>
              {errorMessage || 'No fue posible identificar al usuario actual.'}
            </MessageBar>
          </Stack>
        </Stack>
      );
    }

    return (
      <Stack
        className={styles.supervisionOperaciones}
        horizontalAlign="center"
        tokens={{ childrenGap: 24 }}
      >
        <Stack
          className={styles.commandHeader}
          horizontal
          horizontalAlign="space-between"
          verticalAlign="center"
          wrap
          tokens={{ childrenGap: 24 }}
          styles={glowCardStyles}
        >
          <Stack className={styles.identityBlock} tokens={{ childrenGap: 6 }}>
            <Text className={styles.commandKicker}>
              HUMANO SEGUROS · CENTRO DE COMANDO
            </Text>
            <Text className={styles.welcomeTitle}>
              Bienvenido, {usuario.displayName}
            </Text>
            <Text className={styles.commandSubtitle}>
              Supervisión de cultura y rendimiento operativo
            </Text>
          </Stack>

          <Stack
            className={styles.commandActions}
            horizontal
            verticalAlign="center"
            wrap
            tokens={{ childrenGap: 16 }}
          >
            <Stack
              className={styles.roleWidget}
              horizontal
              verticalAlign="center"
              tokens={{ childrenGap: 12 }}
            >
              <span className={styles.statusDot} aria-hidden="true" />
              <Stack tokens={{ childrenGap: 2 }}>
                <Text className={styles.roleLabel}>ROL ACTIVO</Text>
                <Text className={styles.roleValue}>{usuario.rol}</Text>
              </Stack>
            </Stack>

            <DefaultButton
              className={styles.adminButton}
              disabled={usuario.rol !== 'Admin'}
              iconProps={{ iconName: 'Settings' }}
              text="Acceso a panel de configuración"
            />
          </Stack>
        </Stack>

        <div className={styles.navigationSurface}>
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
        </div>
      </Stack>
    );
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <div className={styles.themeRoot}>{renderContent()}</div>
    </ThemeProvider>
  );
};

export default SupervisionOperaciones;
