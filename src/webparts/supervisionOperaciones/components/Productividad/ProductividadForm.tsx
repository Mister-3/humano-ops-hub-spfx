import * as React from 'react';
import {
  DatePicker,
  MessageBar,
  MessageBarType,
  Pivot,
  PivotItem,
  PrimaryButton,
  SpinButton,
  Spinner,
  SpinnerSize,
  Stack,
  Text
} from '@fluentui/react';

import type GraphService from '../../services/GraphService';
import type { IDirectReport } from '../../services/GraphService';
import type { RoleType } from '../../models/AppModels';
import SharePointService, {
  type IRegistrarProductividadData
} from '../../services/SharePointService';
import AgentComboBox from '../AgentSelector/AgentComboBox';
import HistorialView from '../Historial/HistorialView';
import styles from './ProductividadForm.module.scss';

export interface IProductividadFormProps {
  availableAgents?: ReadonlyArray<IDirectReport>;
  currentUserEmail: string;
  currentUserName: string;
  graphService: GraphService;
  isLoadingAgents?: boolean;
  userRole: RoleType;
}

const parseNumber = (value: string | undefined): number | undefined => {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }

  const parsedValue = Number(value.replace(',', '.'));
  return Number.isFinite(parsedValue) ? parsedValue : undefined;
};

const ProductividadForm: React.FC<IProductividadFormProps> = ({
  availableAgents,
  currentUserEmail,
  currentUserName,
  graphService,
  isLoadingAgents = false,
  userRole
}) => {
  const [selectedAgent, setSelectedAgent] = React.useState<
    IDirectReport | undefined
  >();
  const [fechaInicio, setFechaInicio] = React.useState<Date | null>(new Date());
  const [fechaFin, setFechaFin] = React.useState<Date | null>(new Date());
  const [casos, setCasos] = React.useState<number>(0);
  const [emisiones, setEmisiones] = React.useState<number>(0);
  const [movimientos, setMovimientos] = React.useState<number>(0);
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [successMessage, setSuccessMessage] = React.useState<string>('');
  const [errorMessage, setErrorMessage] = React.useState<string>('');
  const [teamMembers, setTeamMembers] = React.useState<IDirectReport[]>([]);
  const [isLoadingTeam, setIsLoadingTeam] = React.useState<boolean>(true);
  const [teamErrorMessage, setTeamErrorMessage] = React.useState<string>('');
  const sharePointService = React.useMemo(() => new SharePointService(), []);

  React.useEffect(() => {
    let isMounted = true;

    const loadTeam = async (): Promise<void> => {
      setIsLoadingTeam(availableAgents !== undefined
        ? isLoadingAgents
        : true);
      setTeamErrorMessage('');
      setSelectedAgent(undefined);
      setTeamMembers([]);

      try {
        const directReports = availableAgents !== undefined
          ? availableAgents
          : await graphService.getDirectReports();

        if (isMounted) {
          setTeamMembers([...directReports]);
        }
      } catch (error: unknown) {
        if (isMounted) {
          const detail = error instanceof Error
            ? error.message
            : 'No fue posible cargar el equipo del supervisor.';
          setTeamMembers([]);
          setTeamErrorMessage(detail);
        }
      } finally {
        if (isMounted) {
          setIsLoadingTeam(
            availableAgents !== undefined && isLoadingAgents
          );
        }
      }
    };

    loadTeam().catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [availableAgents, graphService, isLoadingAgents]);

  const submitProductividad = async (): Promise<void> => {
    setSuccessMessage('');
    setErrorMessage('');

    const numericValues = [casos, emisiones, movimientos];
    const hasInvalidNumber = numericValues.some(
      (value) => !Number.isFinite(value) || value < 0
    );

    if (
      !selectedAgent ||
      !selectedAgent.email.trim() ||
      !fechaInicio ||
      !fechaFin ||
      hasInvalidNumber
    ) {
      setErrorMessage('Complete correctamente todos los campos obligatorios.');
      return;
    }

    if (fechaInicio.getTime() > fechaFin.getTime()) {
      setErrorMessage(
        'La fecha de inicio no puede ser posterior a la fecha de fin.'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const data: IRegistrarProductividadData = {
        agente: selectedAgent.name.trim(),
        agenteEmail: selectedAgent.email.trim(),
        agenteObjectId: selectedAgent.id,
        fechaInicio,
        fechaFin,
        casos,
        emisiones,
        movimientos
      };

      await sharePointService.registrarProductividad(data);

      setSelectedAgent(undefined);
      setFechaInicio(new Date());
      setFechaFin(new Date());
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
    <Pivot className={styles.modulePivot} aria-label="Vistas del módulo de productividad">
      <PivotItem headerText="➕ Nuevo Registro" itemKey="nuevo">
        <form onSubmit={handleSubmit}>
          <Stack className={styles.form} tokens={{ childrenGap: 18 }}>
            <Stack tokens={{ childrenGap: 4 }}>
              <Text variant="xxLarge">Carga de Productividad</Text>
              <Text className={styles.description}>
                Registra los resultados operativos acumulados por cada agente
                dentro de un rango sin duplicar períodos.
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
                  label="Cargando colaboradores autorizados..."
                  size={SpinnerSize.small}
                />
              )}

              <AgentComboBox
                agents={teamMembers}
                disabled={isSubmitting || isLoadingTeam}
                label="Agente"
                onAgentChange={setSelectedAgent}
                placeholder="Escriba el nombre o correo del colaborador"
                required
                selectedAgent={selectedAgent}
              />

              <Stack horizontal wrap tokens={{ childrenGap: 20 }}>
                <Stack.Item className={styles.field} grow>
                  <DatePicker
                    disabled={isSubmitting}
                    firstDayOfWeek={1}
                    label="Fecha Inicio"
                    onSelectDate={(selectedDate) =>
                      setFechaInicio(selectedDate || null)
                    }
                    placeholder="Seleccione la fecha inicial"
                    value={fechaInicio || undefined}
                  />
                </Stack.Item>

                <Stack.Item className={styles.field} grow>
                  <DatePicker
                    disabled={isSubmitting}
                    firstDayOfWeek={1}
                    label="Fecha Fin"
                    onSelectDate={(selectedDate) =>
                      setFechaFin(selectedDate || null)
                    }
                    placeholder="Seleccione la fecha final"
                    value={fechaFin || undefined}
                  />
                </Stack.Item>
              </Stack>

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
      </PivotItem>

      <PivotItem headerText="📊 Historial y Consultas" itemKey="historial">
        <HistorialView
          currentUserEmail={currentUserEmail}
          currentUserName={currentUserName}
          availableAgents={availableAgents}
          graphService={graphService}
          isLoadingAgents={isLoadingAgents}
          moduleType="productividad"
          userRole={userRole}
        />
      </PivotItem>
    </Pivot>
  );
};

export default ProductividadForm;
