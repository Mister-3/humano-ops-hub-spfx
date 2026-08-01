import * as React from 'react';
import {
  DatePicker,
  MessageBar,
  MessageBarType,
  PrimaryButton,
  Spinner,
  SpinnerSize,
  Stack,
  Text
} from '@fluentui/react';

import type { IDirectReport } from '../../services/GraphService';
import SharePointService, {
  type IAusenciaItem
} from '../../services/SharePointService';
import AgentComboBox, {
  type IAgentComboBoxScopeOption
} from '../AgentSelector/AgentComboBox';
import styles from './PlanificacionSemanal.module.scss';

export interface IPlanificacionSemanalProps {
  availableAgents: ReadonlyArray<IDirectReport>;
  isLoadingAgents?: boolean;
}

type CapacityLevel = 'healthy' | 'warning' | 'critical';

const ALL_TEAM_SCOPE_KEY = '__all_planning_agents__';
const ALL_TEAM_SCOPE_OPTIONS: ReadonlyArray<IAgentComboBoxScopeOption> = [
  { key: ALL_TEAM_SCOPE_KEY, text: 'Todo el equipo' }
];

const normalizeIdentity = (value?: string): string =>
  value?.trim().toLocaleLowerCase() || '';

const startOfDay = (date: Date): Date => {
  const result = new Date(date.getTime());
  result.setHours(0, 0, 0, 0);
  return result;
};

const endOfDay = (date: Date): Date => {
  const result = new Date(date.getTime());
  result.setHours(23, 59, 59, 999);
  return result;
};

const addDays = (date: Date, days: number): Date => {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
};

const getCurrentWorkWeek = (): { start: Date; end: Date } => {
  const today = startOfDay(new Date());
  const dayOfWeek = today.getDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const start = addDays(today, -daysSinceMonday);

  return {
    start,
    end: addDays(start, 5)
  };
};

const formatDate = (date: Date): string => date.toLocaleDateString('es-DO', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric'
});

const formatDayName = (date: Date): string => {
  const label = date.toLocaleDateString('es-DO', { weekday: 'short' });
  return label.charAt(0).toLocaleUpperCase() + label.slice(1).replace('.', '');
};

const getAgentKey = (agent: IDirectReport): string => {
  const email = normalizeIdentity(agent.email);

  if (email) {
    return `email:${email}`;
  }

  const objectId = normalizeIdentity(agent.id);
  return objectId ? `object:${objectId}` : `name:${normalizeIdentity(agent.name)}`;
};

const matchesAgentIdentity = (
  absence: IAusenciaItem,
  agent: IDirectReport
): boolean => {
  const absenceEmail = normalizeIdentity(absence.AgenteEmail);
  const agentEmail = normalizeIdentity(agent.email);

  if (absenceEmail && agentEmail && absenceEmail === agentEmail) {
    return true;
  }

  const absenceObjectId = normalizeIdentity(absence.AgenteObjectID);
  const agentObjectId = normalizeIdentity(agent.id);

  return Boolean(
    absenceObjectId &&
    agentObjectId &&
    absenceObjectId === agentObjectId
  );
};

const getAbsenceAuditId = (absence: IAusenciaItem): string => {
  if (!('AuditID' in absence) || typeof absence.AuditID !== 'string') {
    return '';
  }

  return absence.AuditID.trim();
};

const isAbsenceOnDate = (
  absence: IAusenciaItem,
  date: Date
): boolean => {
  const absenceStart = new Date(absence.FechaInicio);
  const absenceEnd = new Date(absence.FechaFin);

  if (
    Number.isNaN(absenceStart.getTime()) ||
    Number.isNaN(absenceEnd.getTime())
  ) {
    return false;
  }

  return (
    startOfDay(absenceStart).getTime() <= endOfDay(date).getTime() &&
    endOfDay(absenceEnd).getTime() >= startOfDay(date).getTime()
  );
};

const getRangeWorkDays = (startDate: Date, endDate: Date): Date[] => {
  const days: Date[] = [];
  const rangeEnd = endOfDay(endDate);
  let cursor = startOfDay(startDate);

  while (cursor.getTime() <= rangeEnd.getTime()) {
    const dayOfWeek = cursor.getDay();

    if (dayOfWeek >= 1 && dayOfWeek <= 6) {
      days.push(cursor);
    }

    cursor = addDays(cursor, 1);
  }

  return days;
};

const getAbsencePresentation = (
  absenceType: IAusenciaItem['TipoAusencia']
): { emoji: string; text: string } => {
  switch (absenceType) {
    case 'Vacaciones':
      return { emoji: '🌴', text: 'Vacaciones' };
    case 'Día Libre Cumpleaños':
      return { emoji: '🎂', text: 'Día Libre Cumpleaños' };
    case 'Día Libre Empleado del Mes':
      return { emoji: '🏆', text: 'Día Libre Empleado del Mes' };
    case 'Licencia / Incapacidad':
      return { emoji: '🩺', text: 'Licencia / Incapacidad' };
    default:
      return { emoji: '⚠️', text: absenceType };
  }
};

const getCapacityLevel = (capacity: number): CapacityLevel => {
  if (capacity > 85) {
    return 'healthy';
  }

  if (capacity >= 70) {
    return 'warning';
  }

  return 'critical';
};

const PlanificacionSemanal: React.FC<IPlanificacionSemanalProps> = ({
  availableAgents,
  isLoadingAgents = false
}) => {
  const initialWeek = React.useMemo(getCurrentWorkWeek, []);
  const sharePointService = React.useMemo(() => new SharePointService(), []);
  const [startDate, setStartDate] = React.useState<Date>(initialWeek.start);
  const [endDate, setEndDate] = React.useState<Date>(initialWeek.end);
  const [selectedAgent, setSelectedAgent] = React.useState<
    IDirectReport | undefined
  >();
  const [selectedScopeKey, setSelectedScopeKey] = React.useState<string>(
    ALL_TEAM_SCOPE_KEY
  );
  const [absences, setAbsences] = React.useState<IAusenciaItem[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [errorMessage, setErrorMessage] = React.useState<string>('');

  const roster = React.useMemo(() => {
    const agentsByIdentity = new Map<string, IDirectReport>();

    availableAgents.forEach((agent) => {
      const key = getAgentKey(agent);

      if (!agentsByIdentity.has(key)) {
        agentsByIdentity.set(key, agent);
      }
    });

    return Array.from(agentsByIdentity.values())
      .sort((left, right) => left.name.localeCompare(right.name, 'es'));
  }, [availableAgents]);
  const planningRoster = selectedAgent ? [selectedAgent] : roster;

  const loadAbsences = React.useCallback(async (
    rangeStart: Date,
    rangeEnd: Date
  ): Promise<void> => {
    setErrorMessage('');

    if (
      Number.isNaN(rangeStart.getTime()) ||
      Number.isNaN(rangeEnd.getTime())
    ) {
      setErrorMessage('Seleccione un rango de fechas válido.');
      return;
    }

    if (rangeStart.getTime() > rangeEnd.getTime()) {
      setErrorMessage(
        'La fecha de inicio no puede ser posterior a la fecha de fin.'
      );
      return;
    }

    setIsLoading(true);

    try {
      const today = startOfDay(new Date());
      const queryStart = rangeStart.getTime() < today.getTime()
        ? rangeStart
        : today;
      const queryEnd = rangeEnd.getTime() > today.getTime()
        ? rangeEnd
        : today;
      const result = await sharePointService.getAusencias(
        queryStart,
        queryEnd
      );
      setAbsences(result);
    } catch (error: unknown) {
      const detail = error instanceof Error
        ? error.message
        : 'No fue posible consultar la planificación semanal.';
      setErrorMessage(detail);
      setAbsences([]);
    } finally {
      setIsLoading(false);
    }
  }, [sharePointService]);

  React.useEffect(() => {
    let isMounted = true;

    const loadInitialAbsences = async (): Promise<void> => {
      try {
        const today = startOfDay(new Date());
        const queryStart = initialWeek.start.getTime() < today.getTime()
          ? initialWeek.start
          : today;
        const queryEnd = initialWeek.end.getTime() > today.getTime()
          ? initialWeek.end
          : today;
        const result = await sharePointService.getAusencias(
          queryStart,
          queryEnd
        );

        if (isMounted) {
          setAbsences(result);
          setErrorMessage('');
        }
      } catch (error: unknown) {
        if (isMounted) {
          const detail = error instanceof Error
            ? error.message
            : 'No fue posible consultar la planificación semanal.';
          setErrorMessage(detail);
          setAbsences([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadInitialAbsences().catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [initialWeek.end, initialWeek.start, sharePointService]);

  const visibleAbsences = React.useMemo(
    () => absences.filter((absence) =>
      roster.some((agent) => matchesAgentIdentity(absence, agent))
    ),
    [absences, roster]
  );

  const workDays = React.useMemo(
    () => getRangeWorkDays(startDate, endDate),
    [endDate, startDate]
  );

  const today = startOfDay(new Date());
  const absentAgentKeysToday = React.useMemo(() => {
    const keys = new Set<string>();

    roster.forEach((agent) => {
      const isAbsentToday = visibleAbsences.some((absence) =>
        matchesAgentIdentity(absence, agent) &&
        isAbsenceOnDate(absence, today)
      );

      if (isAbsentToday) {
        keys.add(getAgentKey(agent));
      }
    });

    return keys;
  }, [roster, today, visibleAbsences]);

  const totalAgents = roster.length;
  const absentToday = absentAgentKeysToday.size;
  const capacity = totalAgents > 0
    ? ((totalAgents - absentToday) / totalAgents) * 100
    : 0;
  const capacityLevel = getCapacityLevel(capacity);
  const capacityClassName = capacityLevel === 'healthy'
    ? styles.capacityHealthy
    : capacityLevel === 'warning'
      ? styles.capacityWarning
      : styles.capacityCritical;

  const handleStartDateChange = (date?: Date | null): void => {
    if (!date) {
      return;
    }

    setStartDate(date);

    if (date.getTime() > endDate.getTime()) {
      setEndDate(addDays(date, 5));
    }
  };

  const handleQuery = (): void => {
    loadAbsences(startDate, endDate).catch(() => undefined);
  };

  return (
    <section className={styles.planning}>
      <Stack tokens={{ childrenGap: 20 }}>
        <Stack tokens={{ childrenGap: 4 }}>
          <Text variant="xxLarge">Planificación Semanal de Trabajo</Text>
          <Text className={styles.description}>
            Consulta la disponibilidad operativa del equipo de lunes a sábado.
          </Text>
        </Stack>

        {errorMessage && (
          <MessageBar messageBarType={MessageBarType.error}>
            {errorMessage}
          </MessageBar>
        )}

        <div className={styles.controlsCard}>
          <div className={styles.agentField}>
            <AgentComboBox
              agents={roster}
              disabled={isLoading || isLoadingAgents}
              label="Filtrar por agente"
              onAgentChange={(agent) => {
                setSelectedAgent(agent);
                setSelectedScopeKey(
                  agent ? '' : ALL_TEAM_SCOPE_KEY
                );
              }}
              onScopeChange={(scopeKey) => {
                if (scopeKey === ALL_TEAM_SCOPE_KEY) {
                  setSelectedAgent(undefined);
                  setSelectedScopeKey(ALL_TEAM_SCOPE_KEY);
                } else {
                  setSelectedScopeKey('');
                }
              }}
              placeholder="Escriba un nombre o correo"
              scopeOptions={ALL_TEAM_SCOPE_OPTIONS}
              selectedAgent={selectedAgent}
              selectedScopeKey={selectedScopeKey || undefined}
            />
          </div>

          <div className={styles.dateField}>
            <DatePicker
              firstDayOfWeek={1}
              label="Fecha Inicio"
              onSelectDate={handleStartDateChange}
              placeholder="Seleccione la fecha de inicio"
              value={startDate}
            />
          </div>

          <div className={styles.dateField}>
            <DatePicker
              firstDayOfWeek={1}
              label="Fecha Fin"
              minDate={startDate}
              onSelectDate={(date) => {
                if (date) {
                  setEndDate(date);
                }
              }}
              placeholder="Seleccione la fecha de fin"
              value={endDate}
            />
          </div>

          <PrimaryButton
            disabled={isLoading || isLoadingAgents}
            iconProps={{ iconName: 'Refresh' }}
            onClick={handleQuery}
            text="Actualizar planificación"
          />
        </div>

        {isLoadingAgents && (
          <Spinner
            label="Cargando colaboradores disponibles..."
            size={SpinnerSize.small}
          />
        )}

        <article className={`${styles.capacityCard} ${capacityClassName}`}>
          <div>
            <Text className={styles.kpiEyebrow}>Capacidad Operativa</Text>
            <div className={styles.capacityValue}>
              {capacity.toLocaleString('es-DO', {
                maximumFractionDigits: 1,
                minimumFractionDigits: 1
              })}
              <span>%</span>
            </div>
          </div>

          <div className={styles.capacityDetails}>
            <strong>
              {absentToday} de {totalAgents} colaboradores ausentes hoy
            </strong>
            <span>
              {totalAgents > 0
                ? `${totalAgents - absentToday} colaboradores disponibles para operar.`
                : 'No hay colaboradores dentro del alcance seleccionado.'}
            </span>
          </div>
        </article>

        <article className={styles.gridCard}>
          <div className={styles.gridHeader}>
            <div>
              <Text className={styles.gridEyebrow}>Cobertura del equipo</Text>
              <h3>Semana operativa</h3>
            </div>
            <span className={styles.rangeBadge}>
              {formatDate(startDate)} — {formatDate(endDate)}
            </span>
          </div>

          {isLoading ? (
            <Spinner
              label="Consultando ausencias del equipo..."
              size={SpinnerSize.large}
            />
          ) : planningRoster.length === 0 ? (
            <MessageBar messageBarType={MessageBarType.warning}>
              No hay colaboradores disponibles dentro de su alcance actual.
            </MessageBar>
          ) : workDays.length === 0 ? (
            <MessageBar messageBarType={MessageBarType.info}>
              El rango seleccionado no contiene días laborables de lunes a
              sábado.
            </MessageBar>
          ) : (
            <div className={styles.tableViewport}>
              <table className={styles.scheduleTable}>
                <thead>
                  <tr>
                    <th scope="col">Oficial / Agente</th>
                    {workDays.map((day) => (
                      <th key={day.toISOString()} scope="col">
                        <span>{formatDayName(day)}</span>
                        <small>{formatDate(day)}</small>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {planningRoster.map((agent) => (
                    <tr key={getAgentKey(agent)}>
                      <th scope="row">
                        <span>{agent.name}</span>
                        {agent.email && <small>{agent.email}</small>}
                      </th>
                      {workDays.map((day) => {
                        const agentAbsences = visibleAbsences.filter(
                          (absence) =>
                            matchesAgentIdentity(absence, agent) &&
                            isAbsenceOnDate(absence, day)
                        );

                        return (
                          <td key={`${getAgentKey(agent)}-${day.toISOString()}`}>
                            {agentAbsences.length > 0 ? (
                              <div className={styles.badgeList}>
                                {agentAbsences.map((absence) => {
                                  const presentation = getAbsencePresentation(
                                    absence.TipoAusencia
                                  );
                                  const auditId = getAbsenceAuditId(absence);

                                  return (
                                    <span
                                      className={styles.absenceBadge}
                                      key={absence.Id}
                                      title={[
                                        absence.Comentarios || presentation.text,
                                        auditId ? `Audit ID: ${auditId}` : ''
                                      ].filter(Boolean).join(' · ')}
                                    >
                                      <span aria-hidden="true">
                                        {presentation.emoji}
                                      </span>
                                      <span className={styles.absenceBadgeCopy}>
                                        <span>{presentation.text}</span>
                                        {auditId && (
                                          <small>Audit ID: {auditId}</small>
                                        )}
                                      </span>
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className={styles.availableBadge}>
                                Disponible
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </Stack>
    </section>
  );
};

export default PlanificacionSemanal;
