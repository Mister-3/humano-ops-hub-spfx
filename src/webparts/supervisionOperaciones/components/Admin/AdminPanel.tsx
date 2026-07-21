import * as React from 'react';
import {
  MessageBar,
  MessageBarType,
  PrimaryButton,
  SpinButton,
  Spinner,
  SpinnerSize,
  Stack,
  Text
} from '@fluentui/react';

import type { RoleType } from '../../models/AppModels';
import SharePointService, {
  type IConfiguracionMetricasUpdate
} from '../../services/SharePointService';
import styles from './AdminPanel.module.scss';

export interface IAdminPanelProps {
  userRole: RoleType;
}

const parseNumber = (value: string | undefined): number | undefined => {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }

  const parsedValue = Number(value.replace(',', '.'));
  return Number.isFinite(parsedValue) ? parsedValue : undefined;
};

const AdminConfiguration: React.FC = () => {
  const [configurationId, setConfigurationId] = React.useState<number>();
  const [pesoCasos, setPesoCasos] = React.useState<number>(1);
  const [pesoEmisiones, setPesoEmisiones] = React.useState<number>(1.5);
  const [pesoMovimientos, setPesoMovimientos] = React.useState<number>(1.2);
  const [metaDiaria, setMetaDiaria] = React.useState<number>(100);
  const [puntosPorKudo, setPuntosPorKudo] = React.useState<number>(10);
  const [penalidadBaja, setPenalidadBaja] = React.useState<number>(5);
  const [penalidadMedia, setPenalidadMedia] = React.useState<number>(15);
  const [penalidadCritica, setPenalidadCritica] = React.useState<number>(50);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [successMessage, setSuccessMessage] = React.useState<string>('');
  const [errorMessage, setErrorMessage] = React.useState<string>('');
  const sharePointService = React.useMemo(() => new SharePointService(), []);

  React.useEffect(() => {
    let isMounted = true;

    const loadConfiguration = async (): Promise<void> => {
      try {
        const configuration = await sharePointService.getConfiguracion();

        if (isMounted) {
          setConfigurationId(configuration.Id);
          setPesoCasos(configuration.PesoCasos);
          setPesoEmisiones(configuration.PesoEmisiones);
          setPesoMovimientos(configuration.PesoMovimientos);
          setMetaDiaria(configuration.MetaDiaria);
          setPuntosPorKudo(configuration.PuntosPorKudo);
          setPenalidadBaja(configuration.PenalidadBaja);
          setPenalidadMedia(configuration.PenalidadMedia);
          setPenalidadCritica(configuration.PenalidadCritica);
        }
      } catch (error: unknown) {
        if (isMounted) {
          const detail = error instanceof Error
            ? error.message
            : 'Ocurrió un error inesperado al cargar la configuración.';
          setErrorMessage(detail);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadConfiguration().catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [sharePointService]);

  const saveConfiguration = async (): Promise<void> => {
    setSuccessMessage('');
    setErrorMessage('');

    const values = [
      pesoCasos,
      pesoEmisiones,
      pesoMovimientos,
      metaDiaria,
      puntosPorKudo,
      penalidadBaja,
      penalidadMedia,
      penalidadCritica
    ];
    const hasInvalidValue = values.some(
      (value) => !Number.isFinite(value) || value < 0
    );

    if (configurationId === undefined || hasInvalidValue) {
      setErrorMessage('Revise los valores antes de guardar la configuración.');
      return;
    }

    setIsSubmitting(true);

    try {
      const data: IConfiguracionMetricasUpdate = {
        PesoCasos: pesoCasos,
        PesoEmisiones: pesoEmisiones,
        PesoMovimientos: pesoMovimientos,
        MetaDiaria: metaDiaria,
        PuntosPorKudo: puntosPorKudo,
        PenalidadBaja: penalidadBaja,
        PenalidadMedia: penalidadMedia,
        PenalidadCritica: penalidadCritica
      };

      await sharePointService.actualizarConfiguracion(configurationId, data);
      setSuccessMessage('Configuración guardada correctamente.');
    } catch (error: unknown) {
      const detail = error instanceof Error
        ? error.message
        : 'Ocurrió un error inesperado al guardar la configuración.';
      setErrorMessage(detail);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <Stack className={styles.loading} horizontalAlign="center" verticalAlign="center">
        <Spinner
          label="Cargando configuración de métricas..."
          size={SpinnerSize.large}
        />
      </Stack>
    );
  }

  return (
    <Stack className={styles.panel} tokens={{ childrenGap: 20 }}>
      <Stack tokens={{ childrenGap: 4 }}>
        <Text variant="xxLarge">Configuración de métricas</Text>
        <Text className={styles.description}>
          Define los pesos operativos y la meta diaria global del equipo.
        </Text>
      </Stack>

      {successMessage && (
        <MessageBar messageBarType={MessageBarType.success}>
          {successMessage}
        </MessageBar>
      )}

      {errorMessage && (
        <MessageBar messageBarType={MessageBarType.error}>
          {errorMessage}
        </MessageBar>
      )}

      <Stack className={styles.formCard} tokens={{ childrenGap: 20 }}>
        <Stack horizontal wrap tokens={{ childrenGap: 20 }}>
          <Stack.Item className={styles.field} grow>
            <SpinButton
              disabled={isSubmitting}
              label="Peso de casos"
              min={0}
              onChange={(_, value) => {
                const parsedValue = parseNumber(value);
                if (parsedValue !== undefined) {
                  setPesoCasos(parsedValue);
                }
              }}
              step={0.1}
              value={String(pesoCasos)}
            />
          </Stack.Item>

          <Stack.Item className={styles.field} grow>
            <SpinButton
              disabled={isSubmitting}
              label="Peso de emisiones"
              min={0}
              onChange={(_, value) => {
                const parsedValue = parseNumber(value);
                if (parsedValue !== undefined) {
                  setPesoEmisiones(parsedValue);
                }
              }}
              step={0.1}
              value={String(pesoEmisiones)}
            />
          </Stack.Item>
        </Stack>

        <Stack horizontal wrap tokens={{ childrenGap: 20 }}>
          <Stack.Item className={styles.field} grow>
            <SpinButton
              disabled={isSubmitting}
              label="Peso de movimientos"
              min={0}
              onChange={(_, value) => {
                const parsedValue = parseNumber(value);
                if (parsedValue !== undefined) {
                  setPesoMovimientos(parsedValue);
                }
              }}
              step={0.1}
              value={String(pesoMovimientos)}
            />
          </Stack.Item>

          <Stack.Item className={styles.field} grow>
            <SpinButton
              disabled={isSubmitting}
              label="Meta diaria"
              min={0}
              onChange={(_, value) => {
                const parsedValue = parseNumber(value);
                if (parsedValue !== undefined) {
                  setMetaDiaria(parsedValue);
                }
              }}
              step={1}
              value={String(metaDiaria)}
            />
          </Stack.Item>

          <Stack.Item className={styles.field} grow>
            <SpinButton
              disabled={isSubmitting}
              label="Puntos por Kudo"
              min={0}
              onChange={(_, value) => {
                const parsedValue = parseNumber(value);
                if (parsedValue !== undefined) {
                  setPuntosPorKudo(parsedValue);
                }
              }}
              step={1}
              value={String(puntosPorKudo)}
            />
          </Stack.Item>
        </Stack>

        <Stack className={styles.section} tokens={{ childrenGap: 16 }}>
          <Text variant="xLarge">
            Penalidades por Faltas (Puntos a restar)
          </Text>

          <Stack horizontal wrap tokens={{ childrenGap: 20 }}>
            <Stack.Item className={styles.field} grow>
              <SpinButton
                disabled={isSubmitting}
                label="Impacto bajo"
                min={0}
                onChange={(_, value) => {
                  const parsedValue = parseNumber(value);
                  if (parsedValue !== undefined) {
                    setPenalidadBaja(parsedValue);
                  }
                }}
                step={1}
                value={String(penalidadBaja)}
              />
            </Stack.Item>

            <Stack.Item className={styles.field} grow>
              <SpinButton
                disabled={isSubmitting}
                label="Impacto medio"
                min={0}
                onChange={(_, value) => {
                  const parsedValue = parseNumber(value);
                  if (parsedValue !== undefined) {
                    setPenalidadMedia(parsedValue);
                  }
                }}
                step={1}
                value={String(penalidadMedia)}
              />
            </Stack.Item>

            <Stack.Item className={styles.field} grow>
              <SpinButton
                disabled={isSubmitting}
                label="Impacto crítico"
                min={0}
                onChange={(_, value) => {
                  const parsedValue = parseNumber(value);
                  if (parsedValue !== undefined) {
                    setPenalidadCritica(parsedValue);
                  }
                }}
                step={1}
                value={String(penalidadCritica)}
              />
            </Stack.Item>
          </Stack>
        </Stack>

        <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 12 }}>
          <PrimaryButton
            disabled={isSubmitting || configurationId === undefined}
            onClick={() => saveConfiguration().catch(() => undefined)}
            text="Guardar Configuración"
          />
          {isSubmitting && (
            <Spinner label="Guardando..." size={SpinnerSize.small} />
          )}
        </Stack>
      </Stack>
    </Stack>
  );
};

const AdminPanel: React.FC<IAdminPanelProps> = ({ userRole }) => {
  if (userRole !== 'Admin') {
    return (
      <Stack className={styles.panel}>
        <MessageBar messageBarType={MessageBarType.blocked}>
          Acceso Denegado: Esta vista es exclusiva para Administradores.
        </MessageBar>
      </Stack>
    );
  }

  return <AdminConfiguration />;
};

export default AdminPanel;
