import * as React from 'react';
import {
  DatePicker,
  Dropdown,
  type IDropdownOption,
  MessageBar,
  MessageBarType,
  Persona,
  PersonaSize,
  PrimaryButton,
  Stack,
  Text
} from '@fluentui/react';

import SkeletonLoader from '../Common/SkeletonLoader';
import type { RoleType } from '../../models/AppModels';
import type { IDirectReport } from '../../services/GraphService';
import SharePointService, {
  type IConfiguracionMetricas,
  type IEvaluacionKudoItem,
  type IEvaluacionProductividadItem
} from '../../services/SharePointService';
import { getWorkingDaysCount } from '../../utils';
import styles from './EvaluacionRendimiento.module.scss';

export interface IEvaluacionRendimientoProps {
  userRole: RoleType;
  currentUserEmail: string;
  directReports: ReadonlyArray<IDirectReport>;
}

const KUDO_ATTRIBUTES = [
  'Orientado al negocio',
  'Empatía',
  'Agilidad',
  'Pensamiento digital',
  'Resolución de problemas',
  'Trabajo en equipo'
] as const;

const ALL_AGENTS_KEY = '__all_agents__';

type KudoAttribute = typeof KUDO_ATTRIBUTES[number];

interface IAgentAccumulator {
  agente: string;
  agenteEmail: string;
  agenteObjectId: string;
  emisiones: number;
  movimientos: number;
  puntosProductividad: number;
  puntosKudos: number;
  hasProductividad: boolean;
}

interface IKudoLeader {
  atributo: KudoAttribute;
  agente?: string;
  puntos: number;
}

interface IProductivityRankingItem {
  agente: string;
  cumplimientoEmisiones: number;
  cumplimientoMovimientos: number;
  emisiones: number;
  movimientos: number;
  puntosProductividad: number;
  porcentajeLider: number;
}

interface IAgentAlert {
  agente: string;
  puntosProductividad: number;
  puntosKudos: number;
  desviacionProductividad: number;
  desviacionKudos: number;
  bajoProductividad: boolean;
  bajoKudos: boolean;
  isCritical: boolean;
}

interface IAnalyticsResult {
  alertas: IAgentAlert[];
  diasLaborables: number;
  kudosLeaders: IKudoLeader[];
  metaEmisiones: number;
  metaMovimientos: number;
  promedioKudos: number;
  promedioProductividad: number;
  rankingProductividad: IProductivityRankingItem[];
  totalAgentes: number;
}

const getInitialStartDate = (): Date => {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), 1);
};

const normalizeText = (value: string): string =>
  value.trim().toLocaleLowerCase();

const normalizeEmail = (value: string): string =>
  value.trim().toLocaleLowerCase();

const getIdentityKey = (
  name: string,
  email?: string,
  objectId?: string
): string => {
  const normalizedEmail = normalizeEmail(email || '');
  const normalizedObjectId = normalizeText(objectId || '');

  if (normalizedEmail) {
    return `email:${normalizedEmail}`;
  }

  if (normalizedObjectId) {
    return `object:${normalizedObjectId}`;
  }

  return `name:${normalizeText(name)}`;
};

const getReportKey = (report: IDirectReport): string =>
  getIdentityKey(report.name, report.email, report.id);

const toFiniteNumber = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const formatNumber = (value: number): string => value.toLocaleString('es-DO', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0
});

const formatPercentage = (value: number): string => `${value.toLocaleString(
  'es-DO',
  {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1
  }
)}%`;

const padDatePart = (value: number): string =>
  value < 10 ? `0${value}` : String(value);

const formatPickerDate = (date?: Date): string => {
  if (!date) {
    return '';
  }

  const day = padDatePart(date.getDate());
  const month = padDatePart(date.getMonth() + 1);
  return `${day}/${month}/${date.getFullYear()}`;
};

const isGlobalRole = (role: RoleType): boolean =>
  role === 'Admin';

const getProductivityPoints = (
  item: IEvaluacionProductividadItem,
  config: IConfiguracionMetricas
): number => (
  (toFiniteNumber(item.Casos) * toFiniteNumber(config.PesoCasos)) +
  (toFiniteNumber(item.Emisiones) * toFiniteNumber(config.PesoEmisiones)) +
  (toFiniteNumber(item.Movimientos) * toFiniteNumber(config.PesoMovimientos))
);

const getDeviation = (value: number, average: number): number => {
  if (average <= 0 || value >= average) {
    return 0;
  }

  return ((average - value) / average) * 100;
};

const getCompliance = (actual: number, goal: number): number => (
  goal > 0 ? (actual / goal) * 100 : 0
);

const filterByScope = <T extends {
  Title?: string;
  AgenteEmail?: string;
  AgenteObjectID?: string;
}>(
  items: ReadonlyArray<T>,
  allowedReports: ReadonlyArray<IDirectReport>,
  hasGlobalScope: boolean
): T[] => {
  if (hasGlobalScope) {
    return [...items];
  }

  return items.filter((item) => allowedReports.some((report) => {
    const itemEmail = normalizeEmail(item.AgenteEmail || '');
    const reportEmail = normalizeEmail(report.email);

    if (itemEmail && reportEmail && reportEmail === itemEmail) {
      return true;
    }

    const itemObjectId = normalizeText(item.AgenteObjectID || '');
    const reportObjectId = normalizeText(report.id);

    if (
      itemObjectId &&
      reportObjectId &&
      reportObjectId === itemObjectId
    ) {
      return true;
    }

    if (itemEmail || itemObjectId) {
      return false;
    }

    return Boolean(
      item.Title &&
      normalizeText(item.Title) === normalizeText(report.name)
    );
  }));
};

const calculateAnalytics = (
  productividad: ReadonlyArray<IEvaluacionProductividadItem>,
  kudos: ReadonlyArray<IEvaluacionKudoItem>,
  config: IConfiguracionMetricas,
  rosterReports: ReadonlyArray<IDirectReport>,
  workingDays: number
): IAnalyticsResult => {
  const agents = new Map<string, IAgentAccumulator>();
  const attributeScores = new Map<
    KudoAttribute,
    Map<string, { agente: string; puntos: number }>
  >();

  KUDO_ATTRIBUTES.forEach((attribute) => {
    attributeScores.set(attribute, new Map());
  });

  const getAgent = (
    agentName: string,
    agentEmail?: string,
    agentObjectId?: string
  ): IAgentAccumulator => {
    const key = getIdentityKey(agentName, agentEmail, agentObjectId);
    const existingAgent = agents.get(key);

    if (existingAgent) {
      return existingAgent;
    }

    if (!agentEmail?.trim() && !agentObjectId?.trim()) {
      const legacyAgent = Array.from(agents.values()).find(
        (candidate) =>
          normalizeText(candidate.agente) === normalizeText(agentName)
      );

      if (legacyAgent) {
        return legacyAgent;
      }
    }

    const newAgent: IAgentAccumulator = {
      agente: agentName.trim(),
      agenteEmail: agentEmail?.trim() || '',
      agenteObjectId: agentObjectId?.trim() || '',
      emisiones: 0,
      movimientos: 0,
      puntosProductividad: 0,
      puntosKudos: 0,
      hasProductividad: false
    };
    agents.set(key, newAgent);
    return newAgent;
  };

  rosterReports.forEach((report) => {
    if (report.name.trim()) {
      getAgent(report.name, report.email, report.id);
    }
  });

  productividad.forEach((item) => {
    const agentName = item.Title?.trim() || item.AgenteEmail?.trim();

    if (!agentName) {
      return;
    }

    const agent = getAgent(
      agentName,
      item.AgenteEmail,
      item.AgenteObjectID
    );
    agent.hasProductividad = true;
    agent.emisiones += toFiniteNumber(item.Emisiones);
    agent.movimientos += toFiniteNumber(item.Movimientos);
    agent.puntosProductividad += getProductivityPoints(item, config);
  });

  kudos.forEach((item) => {
    const agentName = item.Title?.trim() || item.AgenteEmail?.trim();

    if (!agentName) {
      return;
    }

    const points = toFiniteNumber(item.Puntos);
    const agent = getAgent(
      agentName,
      item.AgenteEmail,
      item.AgenteObjectID
    );
    agent.puntosKudos += points;

    const attribute = KUDO_ATTRIBUTES.find(
      (candidate) => normalizeText(candidate) === normalizeText(item.Atributo || '')
    );

    if (!attribute) {
      return;
    }

    const scoresByAgent = attributeScores.get(attribute);

    if (!scoresByAgent) {
      return;
    }

    const agentKey = getIdentityKey(
      agentName,
      item.AgenteEmail,
      item.AgenteObjectID
    );
    const currentScore = scoresByAgent.get(agentKey);
    scoresByAgent.set(agentKey, {
      agente: currentScore?.agente || agentName,
      puntos: (currentScore?.puntos || 0) + points
    });
  });

  const agentMetrics = Array.from(agents.values());
  const totalAgentes = agentMetrics.length;
  const promedioProductividad = totalAgentes > 0
    ? agentMetrics.reduce(
      (total, agent) => total + agent.puntosProductividad,
      0
    ) / totalAgentes
    : 0;
  const promedioKudos = totalAgentes > 0
    ? agentMetrics.reduce(
      (total, agent) => total + agent.puntosKudos,
      0
    ) / totalAgentes
    : 0;

  const alertas = agentMetrics
    .map((agent): IAgentAlert => {
      const bajoProductividad =
        agent.puntosProductividad < promedioProductividad;
      const bajoKudos = agent.puntosKudos < promedioKudos;
      const desviacionProductividad = getDeviation(
        agent.puntosProductividad,
        promedioProductividad
      );
      const desviacionKudos = getDeviation(agent.puntosKudos, promedioKudos);

      return {
        agente: agent.agente,
        puntosProductividad: agent.puntosProductividad,
        puntosKudos: agent.puntosKudos,
        desviacionProductividad,
        desviacionKudos,
        bajoProductividad,
        bajoKudos,
        isCritical:
          (bajoProductividad && bajoKudos) ||
          Math.max(desviacionProductividad, desviacionKudos) >= 50
      };
    })
    .filter((agent) => agent.bajoProductividad || agent.bajoKudos)
    .sort((left, right) => {
      const leftDeviation = Math.max(
        left.desviacionProductividad,
        left.desviacionKudos
      );
      const rightDeviation = Math.max(
        right.desviacionProductividad,
        right.desviacionKudos
      );
      return rightDeviation - leftDeviation;
    });

  const rankingAgents = agentMetrics
    .filter((agent) => agent.hasProductividad)
    .sort(
      (left, right) =>
        right.puntosProductividad - left.puntosProductividad
    );
  const leaderPoints = rankingAgents[0]?.puntosProductividad || 0;
  const metaEmisiones = workingDays * 10;
  const metaMovimientos = workingDays * 350;
  const rankingProductividad = rankingAgents.map(
    (agent): IProductivityRankingItem => ({
      agente: agent.agente,
      cumplimientoEmisiones: getCompliance(
        agent.emisiones,
        metaEmisiones
      ),
      cumplimientoMovimientos: getCompliance(
        agent.movimientos,
        metaMovimientos
      ),
      emisiones: agent.emisiones,
      movimientos: agent.movimientos,
      puntosProductividad: agent.puntosProductividad,
      porcentajeLider: leaderPoints > 0
        ? Math.min(100, (agent.puntosProductividad / leaderPoints) * 100)
        : 0
    })
  );

  const kudosLeaders = KUDO_ATTRIBUTES.map((attribute): IKudoLeader => {
    const scores = Array.from(attributeScores.get(attribute)?.values() || []);
    const leader = scores.sort((left, right) => (
      right.puntos - left.puntos ||
      left.agente.localeCompare(right.agente, 'es')
    ))[0];

    return {
      atributo: attribute,
      agente: leader?.agente,
      puntos: leader?.puntos || 0
    };
  });

  return {
    alertas,
    diasLaborables: workingDays,
    kudosLeaders,
    metaEmisiones,
    metaMovimientos,
    promedioKudos,
    promedioProductividad,
    rankingProductividad,
    totalAgentes
  };
};

const EvaluacionRendimiento: React.FC<IEvaluacionRendimientoProps> = ({
  userRole,
  currentUserEmail,
  directReports
}) => {
  const [startDate, setStartDate] = React.useState<Date | undefined>(
    getInitialStartDate()
  );
  const [endDate, setEndDate] = React.useState<Date | undefined>(new Date());
  const [selectedAgentKey, setSelectedAgentKey] = React.useState<string>(
    ALL_AGENTS_KEY
  );
  const [analytics, setAnalytics] = React.useState<IAnalyticsResult>();
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [hasProcessed, setHasProcessed] = React.useState<boolean>(false);
  const [errorMessage, setErrorMessage] = React.useState<string>('');
  const sharePointService = React.useMemo(() => new SharePointService(), []);
  const requestIdRef = React.useRef<number>(0);

  const hasGlobalScope = isGlobalRole(userRole);
  const availableReports = React.useMemo(() => {
    const reportsByKey = new Map<string, IDirectReport>();

    directReports.forEach((report) => {
      const key = getReportKey(report);

      if (key && !reportsByKey.has(key)) {
        reportsByKey.set(key, report);
      }
    });

    return Array.from(reportsByKey.values()).sort(
      (left, right) => left.name.localeCompare(right.name, 'es')
    );
  }, [directReports]);
  const agentOptions = React.useMemo<IDropdownOption[]>(
    () => [
      { key: ALL_AGENTS_KEY, text: 'Todos los Agentes' },
      ...availableReports.map((report): IDropdownOption => ({
        key: getReportKey(report),
        text: report.name
      }))
    ],
    [availableReports]
  );
  const selectedReport = availableReports.find(
    (report) => getReportKey(report) === selectedAgentKey
  );
  const effectiveReports = selectedAgentKey === ALL_AGENTS_KEY
    ? availableReports
    : selectedReport
      ? [selectedReport]
      : [];
  const hasGlobalQuery =
    hasGlobalScope && selectedAgentKey === ALL_AGENTS_KEY;
  const scopeLabel = selectedReport
    ? selectedReport.name
    : hasGlobalScope
      ? 'Alcance global'
      : `${availableReports.length} colaborador${
        availableReports.length === 1 ? '' : 'es'
      } autorizado${availableReports.length === 1 ? '' : 's'}`;

  React.useEffect(() => () => {
    requestIdRef.current += 1;
  }, []);

  React.useEffect(() => {
    if (
      selectedAgentKey !== ALL_AGENTS_KEY &&
      !availableReports.some(
        (report) => getReportKey(report) === selectedAgentKey
      )
    ) {
      setSelectedAgentKey(ALL_AGENTS_KEY);
      setAnalytics(undefined);
      setHasProcessed(false);
    }
  }, [availableReports, selectedAgentKey]);

  const processAnalytics = async (): Promise<void> => {
    setErrorMessage('');

    if (!startDate || !endDate) {
      setAnalytics(undefined);
      setHasProcessed(true);
      setErrorMessage('Seleccione una fecha de inicio y una fecha de fin.');
      return;
    }

    if (startDate.getTime() > endDate.getTime()) {
      setAnalytics(undefined);
      setHasProcessed(true);
      setErrorMessage(
        'La fecha de inicio no puede ser posterior a la fecha de fin.'
      );
      return;
    }

    if (!hasGlobalQuery && effectiveReports.length === 0) {
      setAnalytics(undefined);
      setHasProcessed(true);
      setErrorMessage(
        `No se encontró un alcance autorizado para ${currentUserEmail || 'el usuario actual'}.`
      );
      return;
    }

    const currentRequestId = requestIdRef.current + 1;
    requestIdRef.current = currentRequestId;
    setIsLoading(true);
    setHasProcessed(true);

    try {
      const data = await sharePointService.getDatosEvaluacion(
        startDate,
        endDate
      );

      if (requestIdRef.current !== currentRequestId) {
        return;
      }

      const scopedProductivity = filterByScope(
        data.productividad,
        effectiveReports,
        hasGlobalQuery
      );
      const scopedKudos = filterByScope(
        data.kudos,
        effectiveReports,
        hasGlobalQuery
      );

      setAnalytics(calculateAnalytics(
        scopedProductivity,
        scopedKudos,
        data.config,
        hasGlobalQuery ? [] : effectiveReports,
        getWorkingDaysCount(startDate, endDate)
      ));
    } catch (error: unknown) {
      if (requestIdRef.current !== currentRequestId) {
        return;
      }

      const detail = error instanceof Error
        ? error.message
        : 'Ocurrió un error inesperado al procesar las analíticas.';
      setAnalytics(undefined);
      setErrorMessage(detail);
    } finally {
      if (requestIdRef.current === currentRequestId) {
        setIsLoading(false);
      }
    }
  };

  return (
    <Stack className={styles.evaluation} tokens={{ childrenGap: 22 }}>
      <Stack
        className={styles.header}
        horizontal
        horizontalAlign="space-between"
        tokens={{ childrenGap: 16 }}
        verticalAlign="center"
        wrap
      >
        <Stack tokens={{ childrenGap: 5 }}>
          <Text variant="xxLarge">Evaluación de Rendimiento</Text>
          <Text className={styles.subtitle}>
            Analítica ponderada de productividad y cultura corporativa.
          </Text>
        </Stack>
        <span className={styles.scopeBadge}>
          {userRole} · {scopeLabel}
        </span>
      </Stack>

      <Stack
        className={styles.controlsCard}
        horizontal
        tokens={{ childrenGap: 16 }}
        verticalAlign="end"
        wrap
      >
        <DatePicker
          className={styles.dateField}
          disabled={isLoading}
          formatDate={formatPickerDate}
          label="Fecha Inicio"
          onSelectDate={(date) => {
            setStartDate(date || undefined);
            setAnalytics(undefined);
            setHasProcessed(false);
          }}
          placeholder="dd/mm/aaaa"
          value={startDate}
        />
        <DatePicker
          className={styles.dateField}
          disabled={isLoading}
          formatDate={formatPickerDate}
          label="Fecha Fin"
          onSelectDate={(date) => {
            setEndDate(date || undefined);
            setAnalytics(undefined);
            setHasProcessed(false);
          }}
          placeholder="dd/mm/aaaa"
          value={endDate}
        />
        <Dropdown
          className={styles.agentField}
          disabled={isLoading}
          label="Seleccionar Agente"
          onChange={(_, option) => {
            setSelectedAgentKey(String(option?.key || ALL_AGENTS_KEY));
            setAnalytics(undefined);
            setHasProcessed(false);
          }}
          options={agentOptions}
          selectedKey={selectedAgentKey}
        />
        <PrimaryButton
          disabled={isLoading}
          iconProps={{ iconName: 'Filter' }}
          onClick={() => processAnalytics().catch(() => undefined)}
          text="Procesar Analíticas"
        />
      </Stack>

      {errorMessage && (
        <MessageBar messageBarType={MessageBarType.error}>
          {errorMessage}
        </MessageBar>
      )}

      {isLoading ? (
        <SkeletonLoader
          cardCount={4}
          label="Recalculando indicadores del período..."
          rowCount={5}
        />
      ) : analytics && analytics.totalAgentes > 0 ? (
        <React.Fragment>
          <section className={`${styles.sectionCard} ${styles.goalsSection}`}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.sectionEyebrow}>
                  Metas proporcionales
                </span>
                <h3>Objetivos del período por colaborador</h3>
                <p className={styles.sectionDescription}>
                  El rango contiene {analytics.diasLaborables} días laborables;
                  se excluyen únicamente los domingos.
                </p>
              </div>
            </div>

            <div className={styles.goalsGrid}>
              <article className={styles.goalCard}>
                <span>Días laborables</span>
                <strong>{analytics.diasLaborables}</strong>
                <small>Lunes a sábado</small>
              </article>
              <article className={styles.goalCard}>
                <span>Meta de Emisiones</span>
                <strong>{formatNumber(analytics.metaEmisiones)}</strong>
                <small>10 transacciones por día</small>
              </article>
              <article className={styles.goalCard}>
                <span>Meta de Movimientos</span>
                <strong>{formatNumber(analytics.metaMovimientos)}</strong>
                <small>350 páginas por día</small>
              </article>
            </div>
          </section>

          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.sectionEyebrow}>
                  Cultura corporativa
                </span>
                <h3>Agentes destacados por tipo de Kudo</h3>
                <p className={styles.sectionDescription}>
                  Mayor puntuación acumulada por atributo durante el período.
                </p>
              </div>
            </div>

            <div className={styles.kudosGrid}>
              {analytics.kudosLeaders.map((leader) => (
                <article className={styles.kudoCard} key={leader.atributo}>
                  <span className={styles.kudoAttribute}>
                    {leader.atributo}
                  </span>
                  {leader.agente ? (
                    <React.Fragment>
                      <Persona
                        size={PersonaSize.size40}
                        text={leader.agente}
                      />
                      <strong className={styles.kudoPoints}>
                        {formatNumber(leader.puntos)} puntos
                      </strong>
                    </React.Fragment>
                  ) : (
                    <span className={styles.kudoEmpty}>
                      Sin reconocimientos en el período
                    </span>
                  )}
                </article>
              ))}
            </div>
          </section>

          <section className={`${styles.sectionCard} ${styles.alertSection}`}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.sectionEyebrow}>
                  Detección preventiva
                </span>
                <h3>Alertas bajo el promedio del área</h3>
                <p className={styles.sectionDescription}>
                  Promedio productividad: {
                    formatNumber(analytics.promedioProductividad)
                  } · Promedio Kudos: {formatNumber(analytics.promedioKudos)}
                </p>
              </div>
            </div>

            {analytics.alertas.length > 0 ? (
              <div className={styles.alertList}>
                {analytics.alertas.map((alert) => (
                  <article className={styles.alertRow} key={alert.agente}>
                    <div className={styles.alertIdentity}>
                      <Persona
                        size={PersonaSize.size40}
                        text={alert.agente}
                      />
                    </div>

                    <div className={styles.alertMetrics}>
                      <div className={styles.metricBlock}>
                        <span className={styles.metricLabel}>
                          Productividad
                        </span>
                        <strong className={styles.metricValue}>
                          {formatNumber(alert.puntosProductividad)}
                        </strong>
                        <span>
                          {alert.bajoProductividad
                            ? `${formatPercentage(
                              alert.desviacionProductividad
                            )} bajo la media`
                            : 'En la media o superior'}
                        </span>
                      </div>

                      <div className={styles.metricBlock}>
                        <span className={styles.metricLabel}>Kudos</span>
                        <strong className={styles.metricValue}>
                          {formatNumber(alert.puntosKudos)}
                        </strong>
                        <span>
                          {alert.bajoKudos
                            ? `${formatPercentage(
                              alert.desviacionKudos
                            )} bajo la media`
                            : 'En la media o superior'}
                        </span>
                      </div>
                    </div>

                    <span className={
                      alert.isCritical
                        ? styles.dangerBadge
                        : styles.warningBadge
                    }>
                      {alert.isCritical ? 'Atención prioritaria' : 'Seguimiento'}
                    </span>
                  </article>
                ))}
              </div>
            ) : (
              <MessageBar messageBarType={MessageBarType.success}>
                Todos los agentes evaluados están en la media o por encima de ella.
              </MessageBar>
            )}
          </section>

          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.sectionEyebrow}>
                  Rendimiento operativo
                </span>
                <h3>Ranking de Productividad Acumulada</h3>
                <p className={styles.sectionDescription}>
                  Puntaje ponderado y cumplimiento frente a las metas
                  proporcionales del rango.
                </p>
              </div>
            </div>

            {analytics.rankingProductividad.length > 0 ? (
              <div className={styles.rankingList}>
                <div className={styles.rankingHeader} aria-hidden="true">
                  <span>Agente</span>
                  <span>Progreso respecto al líder</span>
                  <span>Cumplimiento de metas</span>
                  <span>Puntaje</span>
                </div>
                {analytics.rankingProductividad.map((item, index) => (
                  <div className={styles.rankingRow} key={item.agente}>
                    <span className={styles.rankingName}>
                      <strong>#{index + 1}</strong> {item.agente}
                    </span>
                    <div
                      aria-label={`${item.agente}: ${formatPercentage(
                        item.porcentajeLider
                      )} respecto al primer lugar`}
                      aria-valuemax={100}
                      aria-valuemin={0}
                      aria-valuenow={Math.round(item.porcentajeLider)}
                      className={styles.barTrack}
                      role="progressbar"
                    >
                      <span
                        className={styles.barFill}
                        style={{ width: `${item.porcentajeLider}%` }}
                      />
                    </div>
                    <span className={styles.complianceGroup}>
                      <span className={
                        item.cumplimientoEmisiones >= 100
                          ? styles.complianceMet
                          : styles.compliancePending
                      }>
                        Emisiones {formatPercentage(
                          item.cumplimientoEmisiones
                        )}
                      </span>
                      <span className={
                        item.cumplimientoMovimientos >= 100
                          ? styles.complianceMet
                          : styles.compliancePending
                      }>
                        Movimientos {formatPercentage(
                          item.cumplimientoMovimientos
                        )}
                      </span>
                    </span>
                    <span className={styles.rankingValue}>
                      {formatNumber(item.puntosProductividad)} pts
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <MessageBar messageBarType={MessageBarType.info}>
                No existen registros de productividad en el período seleccionado.
              </MessageBar>
            )}
          </section>
        </React.Fragment>
      ) : hasProcessed && !errorMessage ? (
        <Stack className={styles.emptyState} horizontalAlign="center">
          <Text variant="large">
            No existen datos dentro del período y alcance seleccionados.
          </Text>
        </Stack>
      ) : !hasProcessed ? (
        <Stack className={styles.emptyState} horizontalAlign="center">
          <Text variant="large">
            Seleccione el período y presione “Procesar Analíticas”.
          </Text>
        </Stack>
      ) : null}
    </Stack>
  );
};

export default EvaluacionRendimiento;
