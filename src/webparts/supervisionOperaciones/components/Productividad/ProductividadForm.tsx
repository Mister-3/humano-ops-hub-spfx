import * as React from 'react';
import {
  DatePicker,
  Dropdown,
  type IDropdownOption,
  MessageBar,
  MessageBarType,
  PrimaryButton,
  SpinButton,
  Spinner,
  SpinnerSize,
  Stack,
  Text
} from '@fluentui/react';

import type GraphService from '../../services/GraphService';
import SharePointService, {
  type IRegistrarProductividadData
} from '../../services/SharePointService';
import styles from './ProductividadForm.module.scss';

export interface IProductividadFormProps {
  graphService: GraphService;
}

const parseNumber = (value: string | undefined): number | undefined => {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }

  const parsedValue = Number(value.replace(',', '.'));
  return Number.isFinite(parsedValue) ? parsedValue : undefined;
};

const ProductividadForm: React.FC<IProductividadFormProps> = ({ graphService }) => {
  const [agente, setAgente] = React.useState<string>('');
  const [fecha, setFecha] = React.useState<Date | null>(new Date());
  const [casos, setCasos] = React.useState<number>(0);
  const [emisiones, setEmisiones] = React.useState<number>(0);
  const [movimientos, setMovimientos] = React.useState<number>(0);
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [successMessage, setSuccessMessage] = React.useState<string>('');
  const [errorMessage, setErrorMessage] = React.useState<string>('');
  const [teamOptions, setTeamOptions] = React.useState<IDropdownOption[]>([]);
  const [isLoadingTeam, setIsLoadingTeam] = React.useState<boolean>(true);
  const [teamErrorMessage, setTeamErrorMessage] = React.useState<string>('');
  const sharePointService = React.useMemo(() => new SharePointService(), []);

  React.useEffect(() => {
    let isMounted = true;

    const loadTeam = async (): Promise<void> => {
      try {
        const directReports = await graphService.getDirectReports();

        if (isMounted) {
          setTeamOptions(directReports.map((item) => ({
            key: item.name,
            text: item.name
          })));
        }
      } catch (error: unknown) {
        if (isMounted) {
          const detail = error instanceof Error
            ? error.message
            : 'No fue posible cargar el equipo del supervisor.';
          setTeamErrorMessage(detail);
        }
      } finally {
        if (isMounted) {
          setIsLoadingTeam(false);
        }
      }
    };

    loadTeam().catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [graphService]);

  const submitProductividad = async (): Promise<void> => {
    setSuccessMessage('');
    setErrorMessage('');

    const numericValues = [casos, emisiones, movimientos];
    const hasInvalidNumber = numericValues.some(
      (value) => !Number.isFinite(value) || value < 0
    );

    if (!agente.trim() || !fecha || hasInvalidNumber) {
      setErrorMessage('Complete correctamente todos los campos obligatorios.');
      return;
    }

    setIsSubmitting(true);

    try {
      const data: IRegistrarProductividadData = {
        agente: agente.trim(),
        fecha,
        casos,
        emisiones,
        movimientos
      };

      await sharePointService.registrarProductividad(data);

      setAgente('');
      setFecha(new Date());
      setCasos(0);
      setEmisiones(0);
      setMovimientos(0);
      setSuccessMessage('Productividad registrada correctamente.');
    } catch (error: unknown) {
      const detail = error instanceof Error
        ? error.message
        : 'Ocurrió un error inesperado al registrar la productividad.';
      setErrorMessage(detail);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    submitProductividad().catch((error: unknown) => {
      const detail = error instanceof Error
        ? error.message
        : 'Ocurrió un error inesperado al registrar la productividad.';
      setErrorMessage(detail);
      setIsSubmitting(false);
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <Stack className={styles.form} tokens={{ childrenGap: 18 }}>
        <Stack tokens={{ childrenGap: 4 }}>
          <Text variant="xxLarge">Carga de Productividad</Text>
          <Text className={styles.description}>
            Registra los resultados operativos obtenidos por cada agente.
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

        {teamErrorMessage && (
          <MessageBar messageBarType={MessageBarType.warning}>
            {teamErrorMessage}
          </MessageBar>
        )}

        <Stack className={styles.formCard} tokens={{ childrenGap: 18 }}>
          {isLoadingTeam && (
            <Spinner
              label="Cargando equipo del supervisor..."
              size={SpinnerSize.small}
            />
          )}

          <Dropdown
            disabled={isSubmitting || isLoadingTeam}
            label="Agente"
            onChange={(_, option) => setAgente(String(option?.key || ''))}
            options={teamOptions}
            placeholder="Seleccione un reporte directo"
            required
            selectedKey={agente || undefined}
          />

          <DatePicker
            disabled={isSubmitting}
            firstDayOfWeek={1}
            label="Fecha de registro"
            onSelectDate={(selectedDate) => setFecha(selectedDate || null)}
            placeholder="Seleccione una fecha"
            value={fecha || undefined}
          />

          <Stack horizontal wrap tokens={{ childrenGap: 20 }}>
            <Stack.Item className={styles.field} grow>
              <SpinButton
                disabled={isSubmitting}
                label="Casos procesados"
                min={0}
                onChange={(_, value) => {
                  const parsedValue = parseNumber(value);
                  if (parsedValue !== undefined) {
                    setCasos(parsedValue);
                  }
                }}
                step={1}
                value={String(casos)}
              />
            </Stack.Item>

            <Stack.Item className={styles.field} grow>
              <SpinButton
                disabled={isSubmitting}
                label="Emisiones"
                min={0}
                onChange={(_, value) => {
                  const parsedValue = parseNumber(value);
                  if (parsedValue !== undefined) {
                    setEmisiones(parsedValue);
                  }
                }}
                step={1}
                value={String(emisiones)}
              />
            </Stack.Item>

            <Stack.Item className={styles.field} grow>
              <SpinButton
                disabled={isSubmitting}
                label="Movimientos"
                min={0}
                onChange={(_, value) => {
                  const parsedValue = parseNumber(value);
                  if (parsedValue !== undefined) {
                    setMovimientos(parsedValue);
                  }
                }}
                step={1}
                value={String(movimientos)}
              />
            </Stack.Item>
          </Stack>

          <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 12 }}>
            <PrimaryButton
              disabled={isSubmitting || isLoadingTeam}
              text="Registrar Productividad"
              type="submit"
            />
            {isSubmitting && (
              <Spinner label="Guardando..." size={SpinnerSize.small} />
            )}
          </Stack>
        </Stack>
      </Stack>
    </form>
  );
};

export default ProductividadForm;
