import * as React from 'react';
import {
  DatePicker,
  Dropdown,
  type IDropdownOption,
  Icon,
  MessageBar,
  MessageBarType,
  PrimaryButton,
  SpinButton,
  Spinner,
  SpinnerSize,
  Text,
  TextField
} from '@fluentui/react';

import type GraphService from '../../services/GraphService';
import { useRBAC } from '../../../../auth/RBACContext';
import SharePointService, {
  type IRegistrarLlamadaFlotaData
} from '../../services/SharePointService';
import SupervisorTimeService, {
  type ISupervisorTimeAnalytics
} from '../../services/SupervisorTimeService';
import { getWorkingDaysCount } from '../../utils';
import { SkeletonLoader } from '../Common/SkeletonLoader';
import styles from './SupervisorTimeView.module.scss';

export interface ISupervisorTimeViewProps {
  currentUserEmail: string;
  graphService: GraphService;
}

type DateFilterMode = 'day' | 'range';

interface IAnalyzedRange {
  endDate: Date;
  startDate: Date;
}

interface IDistributionMetric {
  barClassName: string;
  dotClassName: string;
  key: string;
  label: string;
  minutes: number;
  rawPercentage: number;
  visualPercentage: number;
}

const DATE_FILTER_OPTIONS: IDropdownOption[] = [
  { key: 'day', text: 'Día específico' },
  { key: 'range', text: 'Rango de fechas' }
];

const MINUTES_PER_WORKDAY = 8 * 60;

const padTimePart = (value: number): string =>
  value < 10 ? `0${value}` : String(value);

const getCurrentTimeValue = (): string => {
  const now = new Date();
  return `${padTimePart(now.getHours())}:${padTimePart(now.getMinutes())}`;
};

const padDatePart = (value: number): string =>
  value < 10 ? `0${value}` : String(value);

const formatPickerDate = (date?: Date): string => {
  if (!date) {
    return '';
  }

  return `${padDatePart(date.getDate())}/${padDatePart(
    date.getMonth() + 1
  )}/${date.getFullYear()}`;
};

const formatDuration = (minutes: number): string => {
  const safeMinutes = Number.isFinite(minutes)
    ? Math.max(0, Math.round(minutes))
    : 0;
  const hours = Math.floor(safeMinutes / 60);
  const remainder = safeMinutes % 60;

  if (hours === 0) {
    return `${remainder} min`;
  }

  return remainder > 0
    ? `${hours} h ${remainder} min`
    : `${hours} h`;
};

const formatDateTime = (value: string): string => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleString('es-DO', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

const formatPercentage = (value: number): string => `${(
  Number.isFinite(value) ? Math.max(0, value) : 0
).toLocaleString('es-DO', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1
})}%`;

const parseDuration = (value?: string): number | undefined => {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }

  const parsedValue = Number(value.replace(',', '.'));
  return Number.isFinite(parsedValue) ? parsedValue : undefined;
};

const combineDateAndTime = (date: Date, timeValue: string): Date | undefined => {
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeValue.trim());

  if (!timeMatch) {
    return undefined;
  }

  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return undefined;
  }

  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hours,
    minutes,
    0,
    0
  );
};

const formatSourceError = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }

  if (value && typeof value === 'object') {
    const candidate = value as {
      message?: unknown;
      source?: unknown;
    };
    const sourceLabels: Record<string, string> = {
      fleetCalls: 'Registro_OcupacionLlamadas',
      sharePointEmails: 'Registro_OcupacionCorreos',
      teamsMeetings: 'Reuniones Teams',
      trainings: 'Capacitaciones'
    };
    const sourceKey = typeof candidate.source === 'string'
      ? candidate.source
      : '';
    const sourceLabel = sourceLabels[sourceKey] || sourceKey;
    const source = sourceLabel ? `${sourceLabel}: ` : '';

    if (typeof candidate.message === 'string') {
      return `${source}${candidate.message}`;
    }
  }

  return 'Una fuente de datos no respondió correctamente.';
};

const SupervisorTimeView: React.FC<ISupervisorTimeViewProps> = ({
  currentUserEmail,
  graphService
}) => {
  const { hasPermission } = useRBAC();
  const canRegisterOccupation = hasPermission('modulo:ocupacion:registrar');
  const [filterMode, setFilterMode] =
    React.useState<DateFilterMode>('day');
  const [startDate, setStartDate] = React.useState<Date>(new Date());
  const [endDate, setEndDate] = React.useState<Date>(new Date());
  const [analyzedRange, setAnalyzedRange] =
    React.useState<IAnalyzedRange | undefined>();
  const [analytics, setAnalytics] =
    React.useState<ISupervisorTimeAnalytics | undefined>();
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [analyticsError, setAnalyticsError] = React.useState<string>('');

  const [casoContacto, setCasoContacto] = React.useState<string>('');
  const [callDate, setCallDate] = React.useState<Date>(new Date());
  const [callTime, setCallTime] =
    React.useState<string>(getCurrentTimeValue);
  const [durationMinutes, setDurationMinutes] =
    React.useState<number>(0);
  const [comments, setComments] = React.useState<string>('');
  const [isSavingCall, setIsSavingCall] = React.useState<boolean>(false);
  const [callSuccess, setCallSuccess] = React.useState<string>('');
  const [callError, setCallError] = React.useState<string>('');

  const sharePointService = React.useMemo(
    () => new SharePointService(),
    []
  );
  const timeService = React.useMemo(
    () => new SupervisorTimeService(graphService, sharePointService),
    [graphService, sharePointService]
  );
  const hasLoadedInitially = React.useRef<boolean>(false);

  const effectiveEndDate = filterMode === 'day' ? startDate : endDate;

  const loadAnalytics = React.useCallback(async (): Promise<void> => {
    setAnalyticsError('');
    setIsLoading(true);

    if (startDate.getTime() > effectiveEndDate.getTime()) {
      setAnalyticsError(
        'La fecha de inicio no puede ser posterior a la fecha de fin.'
      );
      setIsLoading(false);
      return;
    }

    if (!currentUserEmail.trim()) {
      setAnalyticsError(
        'No fue posible identificar el correo del supervisor actual.'
      );
      setIsLoading(false);
      return;
    }

    try {
      const result = await timeService.getTimeAnalytics(
        startDate,
        effectiveEndDate,
        currentUserEmail
      );

      setAnalytics(result);
      setAnalyzedRange({
        startDate: new Date(startDate),
        endDate: new Date(effectiveEndDate)
      });
    } catch (error: unknown) {
      const detail = error instanceof Error
        ? error.message
        : 'No fue posible procesar las analíticas de ocupación.';
      setAnalyticsError(detail);
    } finally {
      setIsLoading(false);
    }
  }, [
    currentUserEmail,
    effectiveEndDate,
    startDate,
    timeService
  ]);

  React.useEffect(() => {
    if (hasLoadedInitially.current) {
      return;
    }

    hasLoadedInitially.current = true;
    loadAnalytics().catch(() => undefined);
  }, [loadAnalytics]);

  const submitFleetCall = async (): Promise<void> => {
    setCallSuccess('');
    setCallError('');

    if (!canRegisterOccupation) {
      setCallError('No posee permiso para registrar ocupación.');
      return;
    }

    const normalizedCase = casoContacto.trim();
    const callDateTime = combineDateAndTime(callDate, callTime);

    if (!normalizedCase) {
      setCallError('Indique el caso o contacto asociado a la llamada.');
      return;
    }

    if (!callDateTime) {
      setCallError('Seleccione una fecha y hora válidas para la llamada.');
      return;
    }

    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      setCallError('La duración debe ser mayor que cero minutos.');
      return;
    }

    setIsSavingCall(true);

    try {
      const data: IRegistrarLlamadaFlotaData = {
        casoContacto: normalizedCase,
        supervisorEmail: currentUserEmail,
        fechaHora: callDateTime,
        duracionMinutos: durationMinutes,
        comentarios: comments
      };

      await sharePointService.registrarLlamadaFlota(data);

      setCasoContacto('');
      setCallDate(new Date());
      setCallTime(getCurrentTimeValue());
      setDurationMinutes(0);
      setComments('');
      setCallSuccess('Llamada registrada correctamente.');

      await loadAnalytics();
    } catch (error: unknown) {
      const detail = error instanceof Error
        ? error.message
        : 'No fue posible guardar la llamada.';
      setCallError(detail);
    } finally {
      setIsSavingCall(false);
    }
  };

  const handleCallSubmit = (
    event: React.FormEvent<HTMLFormElement>
  ): void => {
    event.preventDefault();
    submitFleetCall().catch((error: unknown) => {
      const detail = error instanceof Error
        ? error.message
        : 'No fue posible guardar la llamada.';
      setCallError(detail);
      setIsSavingCall(false);
    });
  };

  const calculatedWorkingDays = analyzedRange
    ? getWorkingDaysCount(
      analyzedRange.startDate,
      analyzedRange.endDate
    )
    : 0;
  const standardWorkMinutes =
    calculatedWorkingDays * MINUTES_PER_WORKDAY;
  const meetingsMinutes = analytics?.meetingsMinutes || 0;
  const emailMinutes = analytics?.emailMinutes || 0;
  const trainingMinutes = analytics?.trainingMinutes || 0;
  const fleetCallMinutes = analytics?.fleetCallMinutes || 0;
  const totalOccupiedMinutes =
    meetingsMinutes + emailMinutes + trainingMinutes + fleetCallMinutes;
  const isOutsideStandardSchedule =
    analytics?.isOutsideStandardSchedule === true ||
    (standardWorkMinutes === 0 && totalOccupiedMinutes > 0);
  const distributionDenominator = standardWorkMinutes > 0
    ? standardWorkMinutes
    : totalOccupiedMinutes;
  const occupancyPercentage = standardWorkMinutes > 0
    ? (totalOccupiedMinutes / standardWorkMinutes) * 100
    : isOutsideStandardSchedule
      ? 100
      : 0;
  const availableMinutes = Math.max(
    0,
    standardWorkMinutes - totalOccupiedMinutes
  );
  const availablePercentage = standardWorkMinutes > 0
    ? (availableMinutes / standardWorkMinutes) * 100
    : 0;
  const visualScale = occupancyPercentage > 100
    ? 100 / occupancyPercentage
    : 1;

  const distributionMetrics: IDistributionMetric[] = [
    {
      barClassName: styles.barMeetings,
      dotClassName: styles.dotMeetings,
      key: 'meetings',
      label: 'Reuniones Teams',
      minutes: meetingsMinutes,
      rawPercentage: distributionDenominator > 0
        ? (meetingsMinutes / distributionDenominator) * 100
        : 0,
      visualPercentage: 0
    },
    {
      barClassName: styles.barEmail,
      dotClassName: styles.dotEmail,
      key: 'email',
      label: 'Gestión de Correos',
      minutes: emailMinutes,
      rawPercentage: distributionDenominator > 0
        ? (emailMinutes / distributionDenominator) * 100
        : 0,
      visualPercentage: 0
    },
    {
      barClassName: styles.barTraining,
      dotClassName: styles.dotTraining,
      key: 'training',
      label: 'Coaching & Capacitaciones',
      minutes: trainingMinutes,
      rawPercentage: distributionDenominator > 0
        ? (trainingMinutes / distributionDenominator) * 100
        : 0,
      visualPercentage: 0
    },
    {
      barClassName: styles.barCalls,
      dotClassName: styles.dotCalls,
      key: 'calls',
      label: 'Atención Flota / Llamadas',
      minutes: fleetCallMinutes,
      rawPercentage: distributionDenominator > 0
        ? (fleetCallMinutes / distributionDenominator) * 100
        : 0,
      visualPercentage: 0
    }
  ].map((metric) => ({
    ...metric,
    visualPercentage: metric.rawPercentage * visualScale
  }));

  const colorByMetric: { [key: string]: string } = {
    meetings: '#168fe0',
    email: '#00c7c7',
    training: '#9675e7',
    calls: '#f2ad27'
  };
  let gradientCursor = 0;
  const gradientSegments = distributionMetrics.map((metric) => {
    const segmentStart = gradientCursor;
    gradientCursor = Math.min(
      100,
      gradientCursor + metric.visualPercentage
    );
    return `${colorByMetric[metric.key]} ${segmentStart}% ${gradientCursor}%`;
  });
  const visualAvailablePercentage =
    isOutsideStandardSchedule || occupancyPercentage >= 100
    ? 0
    : 100 - occupancyPercentage;

  if (gradientCursor < 100) {
    gradientSegments.push(`#2f2f36 ${gradientCursor}% 100%`);
  }

  const donutStyle: React.CSSProperties = {
    background: `conic-gradient(${gradientSegments.join(', ')})`
  };
  const sourceErrors = analytics?.sourceErrors || [];

  return (
    <section
      className={styles.supervisorTimeView}
      aria-label="Ocupación del Supervisor"
    >
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <Text variant="xxLarge">Humano Time Analytics</Text>
          <Text block className={styles.subtitle}>
            Consolida reuniones, correos sincronizados, coaching y llamadas
            para visualizar cómo se distribuye el tiempo laboral del
            supervisor.
          </Text>
        </div>
        <span className={styles.scopeBadge}>JORNADA · 8 H/DÍA</span>
      </header>

      <div className={`${styles.card} ${styles.filtersCard}`}>
        <div className={styles.filterMode}>
          <Dropdown
            disabled={isLoading}
            label="Período de análisis"
            onChange={(_, option) => {
              if (option) {
                setFilterMode(option.key as DateFilterMode);
              }
            }}
            options={DATE_FILTER_OPTIONS}
            selectedKey={filterMode}
          />
        </div>

        <div className={styles.dateField}>
          <DatePicker
            disabled={isLoading}
            firstDayOfWeek={1}
            formatDate={formatPickerDate}
            label={filterMode === 'day' ? 'Fecha' : 'Fecha Inicio'}
            onSelectDate={(selectedDate) => {
              if (selectedDate) {
                setStartDate(selectedDate);

                if (selectedDate.getTime() > endDate.getTime()) {
                  setEndDate(selectedDate);
                }
              }
            }}
            value={startDate}
          />
        </div>

        {filterMode === 'range' && (
          <div className={styles.dateField}>
            <DatePicker
              disabled={isLoading}
              firstDayOfWeek={1}
              formatDate={formatPickerDate}
              label="Fecha Fin"
              minDate={startDate}
              onSelectDate={(selectedDate) => {
                if (selectedDate) {
                  setEndDate(selectedDate);
                }
              }}
              value={endDate}
            />
          </div>
        )}

        <PrimaryButton
          disabled={isLoading}
          iconProps={{ iconName: 'Sync' }}
          onClick={() => loadAnalytics().catch(() => undefined)}
          text={isLoading ? 'Sincronizando...' : 'Actualizar / Sincronizar'}
        />
      </div>

      {analyticsError && (
        <MessageBar messageBarType={MessageBarType.error}>
          {analyticsError}
        </MessageBar>
      )}

      {!isLoading && sourceErrors.length > 0 && (
        <MessageBar messageBarType={MessageBarType.warning}>
          Algunas fuentes no pudieron sincronizarse. Se muestran los datos
          disponibles: {sourceErrors.map(formatSourceError).join(' · ')}
        </MessageBar>
      )}

      <form
        className={`${styles.card} ${styles.section}`}
        onSubmit={handleCallSubmit}
      >
        <div className={styles.sectionHeader}>
          <div>
            <div className={styles.sectionEyebrow}>REGISTRO MANUAL</div>
            <h3>📞 Llamadas por Flota</h3>
            <p className={styles.sectionDescription}>
              Registra interacciones telefónicas operativas para incorporarlas
              inmediatamente al cálculo de ocupación.
            </p>
          </div>
        </div>

        {callSuccess && (
          <MessageBar messageBarType={MessageBarType.success}>
            {callSuccess}
          </MessageBar>
        )}

        {callError && (
          <MessageBar messageBarType={MessageBarType.error}>
            {callError}
          </MessageBar>
        )}

        <div className={styles.formGrid}>
          <TextField
            disabled={!canRegisterOccupation || isSavingCall}
            label="Caso / Contacto"
            onChange={(_, value) => setCasoContacto(value || '')}
            placeholder="ID del caso o nombre del contacto"
            required
            value={casoContacto}
          />

          <SpinButton
            disabled={isSavingCall}
            label="Duración en minutos"
            min={0}
            onChange={(_, value) => {
              const parsedValue = parseDuration(value);
              if (parsedValue !== undefined) {
                setDurationMinutes(parsedValue);
              }
            }}
            step={1}
            value={String(durationMinutes)}
          />

          <DatePicker
            disabled={isSavingCall}
            firstDayOfWeek={1}
            formatDate={formatPickerDate}
            label="Fecha"
            onSelectDate={(selectedDate) => {
              if (selectedDate) {
                setCallDate(selectedDate);
              }
            }}
            value={callDate}
          />

          <TextField
            disabled={isSavingCall}
            label="Hora"
            onChange={(_, value) => setCallTime(value || '')}
            required
            type="time"
            value={callTime}
          />

          <TextField
            className={styles.wideField}
            disabled={isSavingCall}
            label="Comentarios"
            multiline
            onChange={(_, value) => setComments(value || '')}
            placeholder="Contexto u observaciones de la llamada"
            rows={3}
            value={comments}
          />
        </div>

        <div className={styles.formActions}>
          <PrimaryButton
            disabled={isSavingCall}
            iconProps={{ iconName: 'Save' }}
            type="submit"
            text={isSavingCall ? 'Guardando...' : 'Guardar Llamada'}
          />
          {isSavingCall && (
            <Spinner
              label="Registrando llamada..."
              size={SpinnerSize.small}
            />
          )}
        </div>
      </form>

      {isLoading ? (
        <div className={styles.section}>
          <SkeletonLoader
            cardCount={4}
            label="Consolidando reuniones, correos, capacitaciones y llamadas..."
            rowCount={4}
            showHero
          />
        </div>
      ) : (
        <React.Fragment>
          <section className={styles.section} aria-labelledby="time-kpis-heading">
        <div className={styles.sectionHeader}>
          <div>
            <div className={styles.sectionEyebrow}>OCUPACIÓN CONSOLIDADA</div>
            <h3 id="time-kpis-heading">Indicadores del período</h3>
            <p className={styles.sectionDescription}>
              Los correos sincronizados desde Registro_OcupacionCorreos
              consideran una tasa estimada de 3 minutos y cada capacitación
              registrada representa 60 minutos de dedicación.
            </p>
          </div>
        </div>

        <div className={styles.kpiGrid}>
          <article className={styles.kpiCard}>
            <div className={styles.kpiTop}>
              <span className={styles.kpiIcon}>
                <Icon iconName="Calendar" aria-hidden="true" />
              </span>
              <span>📅 Reuniones Teams</span>
            </div>
            <div>
              <div className={styles.kpiValue}>
                {formatDuration(meetingsMinutes)}
              </div>
              <div className={styles.kpiDetail}>
                {analytics?.meetingsCount || 0} reunión(es) en calendario
              </div>
            </div>
          </article>

          <article className={styles.kpiCard}>
            <div className={styles.kpiTop}>
              <span className={styles.kpiIcon}>
                <Icon iconName="Mail" aria-hidden="true" />
              </span>
              <span>📧 Gestión de Correos</span>
            </div>
            <div>
              <div className={styles.kpiValue}>
                {formatDuration(emailMinutes)}
              </div>
              <div className={styles.kpiDetail}>
                {analytics?.sentEmailsCount || 0} correo(s) enviado(s) ·
                3 min estimados por correo
                <br />
                📧 Datos sincronizados desde la lista
                {' Registro_OcupacionCorreos'}
              </div>
            </div>
          </article>

          <article className={styles.kpiCard}>
            <div className={styles.kpiTop}>
              <span className={styles.kpiIcon}>
                <Icon iconName="Education" aria-hidden="true" />
              </span>
              <span>🎓 Coaching &amp; Capacitaciones</span>
            </div>
            <div>
              <div className={styles.kpiValue}>
                {formatDuration(trainingMinutes)}
              </div>
              <div className={styles.kpiDetail}>
                {analytics?.trainingCount || 0} actividad(es) registrada(s)
              </div>
            </div>
          </article>

          <article className={styles.kpiCard}>
            <div className={styles.kpiTop}>
              <span className={styles.kpiIcon}>
                <Icon iconName="Phone" aria-hidden="true" />
              </span>
              <span>📞 Atención Flota / Llamadas</span>
            </div>
            <div>
              <div className={styles.kpiValue}>
                {formatDuration(fleetCallMinutes)}
              </div>
              <div className={styles.kpiDetail}>
                {analytics?.fleetCallCount || 0} llamada(s) registrada(s)
              </div>
            </div>
          </article>
        </div>
          </section>

          {analytics && analytics.fleetCalls.length > 0 && (
            <section
              aria-labelledby="fleet-call-details-heading"
              className={`${styles.card} ${styles.section}`}
            >
              <div className={styles.sectionHeader}>
                <div>
                  <div className={styles.sectionEyebrow}>
                    TRAZABILIDAD OPERATIVA
                  </div>
                  <h3 id="fleet-call-details-heading">
                    Detalle de llamadas registradas
                  </h3>
                </div>
              </div>

              <div className={styles.callTableViewport}>
                <table className={styles.callTable}>
                  <thead>
                    <tr>
                      <th scope="col">Audit ID</th>
                      <th scope="col">Fecha y hora</th>
                      <th scope="col">Caso / Contacto</th>
                      <th scope="col">Duración</th>
                      <th scope="col">Comentarios</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.fleetCalls.map((call) => (
                      <tr key={call.Id}>
                        <td className={styles.auditIdCell}>
                          {call.AuditID || '—'}
                        </td>
                        <td>{formatDateTime(call.FechaHora)}</td>
                        <td>{call.Title || '—'}</td>
                        <td>{formatDuration(call.DuracionMinutos)}</td>
                        <td>{call.Comentarios || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section
            className={`${styles.card} ${styles.section} ${styles.distributionCard}`}
            aria-labelledby="time-distribution-heading"
          >
        <div className={styles.sectionHeader}>
          <div>
            <div className={styles.sectionEyebrow}>DISTRIBUCIÓN PORCENTUAL</div>
            <h3 id="time-distribution-heading">
              Uso de la jornada laboral
            </h3>
            <p className={styles.sectionDescription}>
              Comparación contra 8 horas de lunes a viernes, 4 horas los
              sábados y 0 horas los domingos.
            </p>
          </div>
        </div>

        {!analytics && !isLoading ? (
          <div className={styles.emptyState}>
            Seleccione un período y sincronice las fuentes para visualizar la
            distribución del tiempo.
          </div>
        ) : (
          <div className={styles.distributionLayout}>
            <div className={styles.donutArea}>
              <div
                className={styles.donut}
                style={donutStyle}
                role="img"
                aria-label={isOutsideStandardSchedule
                  ? `Actividad fuera de jornada: ${formatDuration(
                    totalOccupiedMinutes
                  )}`
                  : `Ocupación total ${formatPercentage(
                    occupancyPercentage
                  )}`}
              >
                <div className={styles.donutContent}>
                  <strong>
                    {isOutsideStandardSchedule
                      ? 'Fuera'
                      : formatPercentage(occupancyPercentage)}
                  </strong>
                  <span>
                    {isOutsideStandardSchedule
                      ? 'de jornada'
                      : 'ocupado'}
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.distributionDetails}>
              <div className={styles.journeySummary}>
                <span>
                  Días laborables: <strong>{calculatedWorkingDays}</strong>
                </span>
                <span>
                  Jornada disponible:{' '}
                  <strong>{formatDuration(standardWorkMinutes)}</strong>
                </span>
                <span>
                  Tiempo ocupado:{' '}
                  <strong>{formatDuration(totalOccupiedMinutes)}</strong>
                </span>
              </div>

              <div
                className={styles.stackedBar}
                role="img"
                aria-label={`Distribución del tiempo. Disponible ${
                  formatPercentage(availablePercentage)
                }`}
              >
                {distributionMetrics.map((metric) => (
                  <span
                    key={metric.key}
                    className={`${styles.barSegment} ${metric.barClassName}`}
                    style={{ width: `${metric.visualPercentage}%` }}
                    title={`${metric.label}: ${formatPercentage(
                      metric.rawPercentage
                    )}`}
                  />
                ))}
                <span
                  className={`${styles.barSegment} ${styles.barAvailable}`}
                  style={{ width: `${visualAvailablePercentage}%` }}
                  title={`Tiempo disponible: ${formatPercentage(
                    availablePercentage
                  )}`}
                />
              </div>

              <div className={styles.legend}>
                {distributionMetrics.map((metric) => (
                  <div key={metric.key} className={styles.legendItem}>
                    <span
                      className={`${styles.legendDot} ${metric.dotClassName}`}
                      aria-hidden="true"
                    />
                    <span>{metric.label}</span>
                    <strong>{formatPercentage(metric.rawPercentage)}</strong>
                  </div>
                ))}
                <div className={styles.legendItem}>
                  <span
                    className={`${styles.legendDot} ${styles.dotAvailable}`}
                    aria-hidden="true"
                  />
                  <span>Tiempo disponible</span>
                  <strong>{formatPercentage(availablePercentage)}</strong>
                </div>
              </div>

              {isOutsideStandardSchedule ? (
                <div className={styles.overCapacity}>
                  ⚠️ Se registraron {formatDuration(totalOccupiedMinutes)} de
                  actividad fuera de una jornada programada. La gráfica muestra
                  la composición del tiempo, no un porcentaje de capacidad.
                </div>
              ) : occupancyPercentage > 100 ? (
                <div className={styles.overCapacity}>
                  ⚠️ La ocupación registrada supera la jornada estándar en{' '}
                  {formatDuration(totalOccupiedMinutes - standardWorkMinutes)}.
                  Revise posibles solapamientos entre reuniones y actividades.
                </div>
              ) : null}
            </div>
          </div>
        )}
          </section>
        </React.Fragment>
      )}
    </section>
  );
};

export default SupervisorTimeView;
