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

import type { IDirectReport } from '../../services/GraphService';
import type { RoleType } from '../../models/AppModels';
import SharePointService, {
  type IRegistrarProductividadData
} from '../../services/SharePointService';
import { getWorkingDaysCount } from '../../utils';
import AgentComboBox from '../AgentSelector/AgentComboBox';
import HistorialView from '../Historial/HistorialView';
import styles from './ProductividadForm.module.scss';

export interface IProductividadFormProps {
  availableAgents: ReadonlyArray<IDirectReport>;
  currentUserEmail: string;
  currentUserName: string;
  isLoadingAgents?: boolean;
  userRole: RoleType;
}

interface IProductivityMetrics {
  casosAtendidos: number;
  casosATiempo: number;
  emisionesTx: number;
  emisionesPg: number;
  devolucionesEmisiones: number;
  movimientosTx: number;
  movimientosPg: number;
  devolucionesMovimientos: number;
  escaneoTx: number;
  escaneoPg: number;
  devolucionesEscaneo: number;
  carnetsTx: number;
  carnetsPg: number;
}

interface IDailyProductivityGoals {
  emisionesTx: number;
  movimientosPg: number;
  escaneoPg: number;
}

type ProductivityMetricKey = keyof IProductivityMetrics;

const EMPTY_METRICS: IProductivityMetrics = {
  casosAtendidos: 0,
  casosATiempo: 0,
  emisionesTx: 0,
  emisionesPg: 0,
  devolucionesEmisiones: 0,
  movimientosTx: 0,
  movimientosPg: 0,
  devolucionesMovimientos: 0,
  escaneoTx: 0,
  escaneoPg: 0,
  devolucionesEscaneo: 0,
  carnetsTx: 0,
  carnetsPg: 0
};

const DEFAULT_DAILY_GOALS: IDailyProductivityGoals = {
  emisionesTx: 10,
  movimientosPg: 350,
  escaneoPg: 350
};

const getYesterday = (): Date => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d;
};

const isSameDayOrFuture = (date: Date | null): boolean => {
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  return checkDate.getTime() >= today.getTime();
};

const parseNumber = (value: string | undefined): number | undefined => {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }

  const parsedValue = Number(value.replace(',', '.'));
  return Number.isFinite(parsedValue) ? parsedValue : undefined;
};

const getSafeGoal = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : fallback;

const formatQuantity = (value: number): string =>
  value.toLocaleString('es-DO', { maximumFractionDigits: 2 });

const ProductividadForm: React.FC<IProductividadFormProps> = ({
  availableAgents,
  currentUserEmail,
  currentUserName,
  isLoadingAgents = false,
  userRole
}) => {
  const [selectedAgent, setSelectedAgent] = React.useState<
    IDirectReport | undefined
  >();
  const [fechaInicio, setFechaInicio] = React.useState<Date | null>(getYesterday());
  const [fechaFin, setFechaFin] = React.useState<Date | null>(getYesterday());
  const [metrics, setMetrics] = React.useState<IProductivityMetrics>({
    ...EMPTY_METRICS
  });
  const [dailyGoals, setDailyGoals] =
    React.useState<IDailyProductivityGoals>(DEFAULT_DAILY_GOALS);
  const [isLoadingGoals, setIsLoadingGoals] = React.useState<boolean>(true);
  const [goalsWarning, setGoalsWarning] = React.useState<string>('');
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [successMessage, setSuccessMessage] = React.useState<string>('');
  const [errorMessage, setErrorMessage] = React.useState<string>('');
  const teamMembers = availableAgents;
  const isLoadingTeam = isLoadingAgents;
  const sharePointService = React.useMemo(() => new SharePointService(), []);

  React.useEffect(() => {
    let isMounted = true;

    const loadProductivityGoals = async (): Promise<void> => {
      setIsLoadingGoals(true);
      setGoalsWarning('');

      try {
        const configuration = await sharePointService.getConfiguracion();

        if (isMounted) {
          setDailyGoals({
            emisionesTx: getSafeGoal(
              configuration.MetaEmisionesTx,
              DEFAULT_DAILY_GOALS.emisionesTx
            ),
            movimientosPg: getSafeGoal(
              configuration.MetaMovimientosPg,
              DEFAULT_DAILY_GOALS.movimientosPg
            ),
            escaneoPg: getSafeGoal(
              configuration.MetaEscaneoPg,
              DEFAULT_DAILY_GOALS.escaneoPg
            )
          });
        }
      } catch {
        if (isMounted) {
          setDailyGoals(DEFAULT_DAILY_GOALS);
          setGoalsWarning(
            'No se pudieron cargar las metas configuradas. Las cuotas mostradas usan valores temporales de respaldo.'
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingGoals(false);
        }
      }
    };

    loadProductivityGoals().catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [sharePointService]);

  const workingDays = React.useMemo(
    () =>
      fechaInicio && fechaFin
        ? getWorkingDaysCount(fechaInicio, fechaFin)
        : 0,
    [fechaFin, fechaInicio]
  );

  const expectedQuotas = React.useMemo(
    () => ({
      emisionesTx: dailyGoals.emisionesTx * workingDays,
      movimientosPg: dailyGoals.movimientosPg * workingDays,
      escaneoPg: dailyGoals.escaneoPg * workingDays
    }),
    [dailyGoals, workingDays]
  );

  const caseSlaPercentage = metrics.casosAtendidos > 0
    ? (metrics.casosATiempo / metrics.casosAtendidos) * 100
    : undefined;
  const hasInvalidCaseSla =
    metrics.casosATiempo > metrics.casosAtendidos;

  const updateMetric = (
    key: ProductivityMetricKey,
    value: string | undefined
  ): void => {
    const parsedValue = parseNumber(value);

    if (parsedValue !== undefined) {
      setMetrics((currentMetrics) => ({
        ...currentMetrics,
        [key]: parsedValue
      }));
    }
  };

  const submitProductividad = async (): Promise<void> => {
    setSuccessMessage('');
    setErrorMessage('');

    const numericValues = Object.keys(metrics).map(
      (key) => metrics[key as ProductivityMetricKey]
    );
    const hasInvalidNumber = numericValues.some(
      (value) => !Number.isFinite(value) || value < 0
    );
    const hasProductivityActivity = numericValues.some(
      (value) => value > 0
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

    if (!hasProductivityActivity) {
      setErrorMessage(
        'Registre al menos una métrica de productividad mayor que cero.'
      );
      return;
    }

    if (hasInvalidCaseSla) {
      setErrorMessage(
        'Los casos resueltos a tiempo no pueden superar los casos atendidos.'
      );
      return;
    }

    if (isSameDayOrFuture(fechaInicio) || isSameDayOrFuture(fechaFin)) {
      setErrorMessage(
        'No es posible registrar productividad para el día en curso. Selecciona un período finalizado anterior a hoy.'
      );
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
        ...metrics
      };

      await sharePointService.registrarProductividad(data);

      setSelectedAgent(undefined);
      setFechaInicio(getYesterday());
      setFechaFin(getYesterday());
      setMetrics({ ...EMPTY_METRICS });
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

  const hasCurrentDaySelected = isSameDayOrFuture(fechaInicio) || isSameDayOrFuture(fechaFin);

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

            {hasCurrentDaySelected && (
              <MessageBar messageBarType={MessageBarType.warning}>
                No es posible registrar productividad para el día en curso. Selecciona un período finalizado anterior a hoy.
              </MessageBar>
            )}

            {goalsWarning && (
              <MessageBar messageBarType={MessageBarType.warning}>
                {goalsWarning}
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

              <section
                aria-busy={isLoadingGoals}
                aria-label="Resumen de días laborables y cuotas esperadas"
                className={styles.quotaPanel}
              >
                <div className={styles.workingDaysSummary}>
                  <Text className={styles.quotaEyebrow}>
                    PERÍODO OPERATIVO
                  </Text>
                  <Text className={styles.workingDaysValue}>
                    {workingDays}
                  </Text>
                  <Text className={styles.workingDaysLabel}>
                    {workingDays === 1
                      ? 'día laborable'
                      : 'días laborables'}{' '}
                    (sábado equivale a 0.5)
                  </Text>
                </div>

                {isLoadingGoals ? (
                  <Spinner
                    label="Calculando cuotas configuradas..."
                    size={SpinnerSize.small}
                  />
                ) : (
                  <div className={styles.quotaGrid}>
                    <div className={styles.quotaItem}>
                      <Text className={styles.quotaLabel}>
                        Meta Emisiones Tx
                      </Text>
                      <Text className={styles.quotaValue}>
                        {formatQuantity(expectedQuotas.emisionesTx)}
                      </Text>
                      <Text className={styles.quotaHint}>
                        {formatQuantity(dailyGoals.emisionesTx)} diarias
                      </Text>
                    </div>

                    <div className={styles.quotaItem}>
                      <Text className={styles.quotaLabel}>
                        Meta Movimientos Pg
                      </Text>
                      <Text className={styles.quotaValue}>
                        {formatQuantity(expectedQuotas.movimientosPg)}
                      </Text>
                      <Text className={styles.quotaHint}>
                        {formatQuantity(dailyGoals.movimientosPg)} diarias
                      </Text>
                    </div>

                    <div className={styles.quotaItem}>
                      <Text className={styles.quotaLabel}>Meta Escaneo Pg</Text>
                      <Text className={styles.quotaValue}>
                        {formatQuantity(expectedQuotas.escaneoPg)}
                      </Text>
                      <Text className={styles.quotaHint}>
                        {formatQuantity(dailyGoals.escaneoPg)} diarias
                      </Text>
                    </div>
                  </div>
                )}
              </section>

              <div className={styles.metricsGrid}>
                <Stack
                  className={`${styles.metricCard} glowCard`}
                  tokens={{ childrenGap: 14 }}
                >
                  <Stack tokens={{ childrenGap: 3 }}>
                    <Text className={styles.metricTitle}>
                      📋 Gestión de Casos
                    </Text>
                    <Text className={styles.metricDescription}>
                      Mide la tasa de cierre dentro del SLA acordado.
                    </Text>
                  </Stack>
                  <SpinButton
                    disabled={isSubmitting}
                    label="Casos Atendidos (Totales)"
                    min={0}
                    onChange={(_, value) =>
                      updateMetric('casosAtendidos', value)
                    }
                    step={1}
                    value={String(metrics.casosAtendidos)}
                  />
                  <SpinButton
                    disabled={isSubmitting}
                    label="Casos Resueltos a Tiempo (Dentro de SLA)"
                    min={0}
                    onChange={(_, value) =>
                      updateMetric('casosATiempo', value)
                    }
                    step={1}
                    value={String(metrics.casosATiempo)}
                  />
                  <div
                    aria-live="polite"
                    className={`${styles.slaBadge} ${
                      hasInvalidCaseSla
                        ? styles.slaBadgeInvalid
                        : caseSlaPercentage === undefined
                          ? styles.slaBadgeInactive
                          : styles.slaBadgeActive
                    }`}
                  >
                    {caseSlaPercentage === undefined
                      ? 'SLA: N/A - Re-distribuido por Normalización Dinámica'
                      : hasInvalidCaseSla
                        ? `SLA: ${formatQuantity(caseSlaPercentage)}% · Revisa los valores`
                        : `SLA en vivo: ${formatQuantity(caseSlaPercentage)}%`}
                  </div>
                </Stack>

                <Stack
                  className={`${styles.metricCard} glowCard`}
                  tokens={{ childrenGap: 14 }}
                >
                  <Stack tokens={{ childrenGap: 3 }}>
                    <Text className={styles.metricTitle}>
                      📦 Proceso Emisiones
                    </Text>
                    <Text className={styles.metricDescription}>
                      Registra transacciones y páginas digitadas.
                    </Text>
                  </Stack>
                  <SpinButton
                    disabled={isSubmitting}
                    label="Transacciones"
                    min={0}
                    onChange={(_, value) =>
                      updateMetric('emisionesTx', value)
                    }
                    step={1}
                    value={String(metrics.emisionesTx)}
                  />
                  <SpinButton
                    disabled={isSubmitting}
                    label="Páginas Digitadas"
                    min={0}
                    onChange={(_, value) =>
                      updateMetric('emisionesPg', value)
                    }
                    step={1}
                    value={String(metrics.emisionesPg)}
                  />
                  <SpinButton
                    disabled={isSubmitting}
                    label="Devoluciones"
                    min={0}
                    onChange={(_, value) =>
                      updateMetric('devolucionesEmisiones', value)
                    }
                    step={1}
                    value={String(metrics.devolucionesEmisiones)}
                  />
                </Stack>

                <Stack
                  className={`${styles.metricCard} glowCard`}
                  tokens={{ childrenGap: 14 }}
                >
                  <Stack tokens={{ childrenGap: 3 }}>
                    <Text className={styles.metricTitle}>
                      🔄 Proceso Movimientos
                    </Text>
                    <Text className={styles.metricDescription}>
                      Registra transacciones y páginas digitadas.
                    </Text>
                  </Stack>
                  <SpinButton
                    disabled={isSubmitting}
                    label="Transacciones"
                    min={0}
                    onChange={(_, value) =>
                      updateMetric('movimientosTx', value)
                    }
                    step={1}
                    value={String(metrics.movimientosTx)}
                  />
                  <SpinButton
                    disabled={isSubmitting}
                    label="Páginas Digitadas"
                    min={0}
                    onChange={(_, value) =>
                      updateMetric('movimientosPg', value)
                    }
                    step={1}
                    value={String(metrics.movimientosPg)}
                  />
                  <SpinButton
                    disabled={isSubmitting}
                    label="Devoluciones"
                    min={0}
                    onChange={(_, value) =>
                      updateMetric('devolucionesMovimientos', value)
                    }
                    step={1}
                    value={String(metrics.devolucionesMovimientos)}
                  />
                </Stack>

                <Stack
                  className={`${styles.metricCard} glowCard`}
                  tokens={{ childrenGap: 14 }}
                >
                  <Stack tokens={{ childrenGap: 3 }}>
                    <Text className={styles.metricTitle}>
                      🖨️ Proceso Escaneo
                    </Text>
                    <Text className={styles.metricDescription}>
                      Registra transacciones y páginas escaneadas.
                    </Text>
                  </Stack>
                  <SpinButton
                    disabled={isSubmitting}
                    label="Transacciones"
                    min={0}
                    onChange={(_, value) => updateMetric('escaneoTx', value)}
                    step={1}
                    value={String(metrics.escaneoTx)}
                  />
                  <SpinButton
                    disabled={isSubmitting}
                    label="Páginas Escaneadas"
                    min={0}
                    onChange={(_, value) => updateMetric('escaneoPg', value)}
                    step={1}
                    value={String(metrics.escaneoPg)}
                  />
                  <SpinButton
                    disabled={isSubmitting}
                    label="Devoluciones"
                    min={0}
                    onChange={(_, value) =>
                      updateMetric('devolucionesEscaneo', value)
                    }
                    step={1}
                    value={String(metrics.devolucionesEscaneo)}
                  />
                </Stack>

                <Stack
                  className={`${styles.metricCard} glowCard`}
                  tokens={{ childrenGap: 14 }}
                >
                  <Stack tokens={{ childrenGap: 3 }}>
                    <Text className={styles.metricTitle}>
                      🪪 Gestión de Carnets
                    </Text>
                    <Text className={styles.metricDescription}>
                      Registra solicitudes recibidas y carnets procesados.
                    </Text>
                  </Stack>
                  <SpinButton
                    disabled={isSubmitting}
                    label="Transacciones / Solicitudes Recibidas"
                    min={0}
                    onChange={(_, value) => updateMetric('carnetsTx', value)}
                    step={1}
                    value={String(metrics.carnetsTx)}
                  />
                  <SpinButton
                    disabled={isSubmitting}
                    label="Carnets Procesados / Gestionados"
                    min={0}
                    onChange={(_, value) => updateMetric('carnetsPg', value)}
                    step={1}
                    value={String(metrics.carnetsPg)}
                  />
                </Stack>
              </div>

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
          isLoadingAgents={isLoadingAgents}
          moduleType="productividad"
          userRole={userRole}
        />
      </PivotItem>
    </Pivot>
  );
};

export default ProductividadForm;
