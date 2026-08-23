import * as React from 'react';
import {
  DatePicker,
  MessageBar,
  MessageBarType,
  PrimaryButton,
  SpinButton,
  Spinner,
  SpinnerSize,
  Stack,
  Text
} from '@fluentui/react';
import {
  Activity,
  FilePlus2,
  History,
  IdCard,
  PackageOpen,
  RefreshCw,
  ScanLine
} from 'lucide-react';

import type { IDirectReport } from '../../services/GraphService';
import { useRBAC } from '../../../../auth/RBACContext';
import type { RoleType } from '../../models/AppModels';
import SharePointService, {
  type IRegistrarProductividadData
} from '../../services/SharePointService';
import { getWorkingDaysCount } from '../../utils';
import AgentComboBox from '../AgentSelector/AgentComboBox';
import { KpiCard, PageHeader, StatusBadge, SurfaceCard } from '../Common';
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
type ProductivityViewKey = 'nuevo' | 'historial';

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
  const { hasPermission } = useRBAC();
  const canRegisterProductivity = hasPermission('modulo:productividad:registrar');
  const [selectedAgent, setSelectedAgent] = React.useState<
    IDirectReport | undefined
  >();
  const [activeView, setActiveView] =
    React.useState<ProductivityViewKey>('nuevo');
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

    if (!canRegisterProductivity) {
      setErrorMessage('No posee permiso para registrar productividad.');
      return;
    }

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
    <div className="space-y-6">
      <PageHeader
        action={(
          <button
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-600/20 transition-colors hover:bg-cyan-500"
            onClick={() => setActiveView('nuevo')}
            type="button"
          >
            <FilePlus2 aria-hidden="true" size={18} />
            Nuevo registro
          </button>
        )}
        icon={<Activity aria-hidden="true" size={24} />}
        subtitle="Captura resultados operativos por período y visualiza las cuotas esperadas sin alterar las reglas de cálculo."
        title="Productividad Operativa"
      />

      <nav
        aria-label="Vistas de productividad"
        className="flex flex-wrap gap-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-2 shadow-lg"
      >
        {([
          { key: 'nuevo' as const, label: 'Nuevo registro', icon: FilePlus2 },
          { key: 'historial' as const, label: 'Historial y consultas', icon: History }
        ]).map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeView === tab.key;
          return (
            <button
              aria-current={isActive ? 'page' : undefined}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${isActive
                ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300'
                : 'border-transparent text-slate-400 hover:border-slate-700 hover:bg-slate-800 hover:text-slate-200'}`}
              key={tab.key}
              onClick={() => setActiveView(tab.key)}
              type="button"
            >
              <TabIcon aria-hidden="true" size={17} />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {activeView === 'nuevo' && (
        <form onSubmit={handleSubmit}>
          <Stack className={styles.form} tokens={{ childrenGap: 18 }}>
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

            <SurfaceCard className={styles.formCard}>
              <Stack tokens={{ childrenGap: 18 }}>
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
                className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
              >
                {isLoadingGoals ? (
                  <div className="col-span-full rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
                    <Spinner
                      label="Calculando cuotas configuradas..."
                      size={SpinnerSize.small}
                    />
                  </div>
                ) : (
                  <>
                    <KpiCard
                      label="Período operativo"
                      subtext={`${workingDays === 1 ? 'día laborable' : 'días laborables'} · sábado = 0.5`}
                      value={workingDays}
                      variant="cyan"
                    />
                    <KpiCard
                      label="Meta Emisiones Tx"
                      subtext={`${formatQuantity(dailyGoals.emisionesTx)} diarias`}
                      value={formatQuantity(expectedQuotas.emisionesTx)}
                      variant="purple"
                    />
                    <KpiCard
                      label="Meta Movimientos Pg"
                      subtext={`${formatQuantity(dailyGoals.movimientosPg)} diarias`}
                      value={formatQuantity(expectedQuotas.movimientosPg)}
                      variant="amber"
                    />
                    <KpiCard
                      label="Meta Escaneo Pg"
                      subtext={`${formatQuantity(dailyGoals.escaneoPg)} diarias`}
                      value={formatQuantity(expectedQuotas.escaneoPg)}
                      variant="emerald"
                    />
                  </>
                )}
              </section>

              <div className={styles.metricsGrid}>
                <SurfaceCard className={styles.metricCard}>
                  <Stack tokens={{ childrenGap: 3 }}>
                    <Text className={styles.metricTitle}>
                      <Activity aria-hidden="true" size={18} />
                      Gestión de Casos
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
                  <div aria-live="polite">
                    <StatusBadge
                      size="md"
                      variant={hasInvalidCaseSla
                        ? 'danger'
                        : caseSlaPercentage === undefined
                          ? 'neutral'
                          : 'success'}
                    >
                      {caseSlaPercentage === undefined
                        ? 'SLA: N/A - Re-distribuido por Normalización Dinámica'
                        : hasInvalidCaseSla
                          ? `SLA: ${formatQuantity(caseSlaPercentage)}% · Revisa los valores`
                          : `SLA en vivo: ${formatQuantity(caseSlaPercentage)}%`}
                    </StatusBadge>
                  </div>
                </SurfaceCard>

                <SurfaceCard className={styles.metricCard}>
                  <Stack tokens={{ childrenGap: 3 }}>
                    <Text className={styles.metricTitle}>
                      <PackageOpen aria-hidden="true" size={18} />
                      Proceso Emisiones
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
                </SurfaceCard>

                <SurfaceCard className={styles.metricCard}>
                  <Stack tokens={{ childrenGap: 3 }}>
                    <Text className={styles.metricTitle}>
                      <RefreshCw aria-hidden="true" size={18} />
                      Proceso Movimientos
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
                </SurfaceCard>

                <SurfaceCard className={styles.metricCard}>
                  <Stack tokens={{ childrenGap: 3 }}>
                    <Text className={styles.metricTitle}>
                      <ScanLine aria-hidden="true" size={18} />
                      Proceso Escaneo
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
                </SurfaceCard>

                <SurfaceCard className={styles.metricCard}>
                  <Stack tokens={{ childrenGap: 3 }}>
                    <Text className={styles.metricTitle}>
                      <IdCard aria-hidden="true" size={18} />
                      Gestión de Carnets
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
                </SurfaceCard>
              </div>

              <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 12 }}>
                <PrimaryButton
                  disabled={!canRegisterProductivity || isSubmitting || isLoadingTeam}
                  text="Registrar Productividad"
                  type="submit"
                />
                {isSubmitting && (
                  <Spinner label="Guardando..." size={SpinnerSize.small} />
                )}
              </Stack>
              </Stack>
            </SurfaceCard>
          </Stack>
        </form>
      )}

      {activeView === 'historial' && (
        <HistorialView
          currentUserEmail={currentUserEmail}
          currentUserName={currentUserName}
          availableAgents={availableAgents}
          isLoadingAgents={isLoadingAgents}
          moduleType="productividad"
          userRole={userRole}
        />
      )}
    </div>
  );
};

export default ProductividadForm;
