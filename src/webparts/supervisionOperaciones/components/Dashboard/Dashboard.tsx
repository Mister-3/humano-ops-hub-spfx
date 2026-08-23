import * as React from 'react';
import {
  DetailsList,
  DetailsListLayoutMode,
  type IColumn,
  MessageBar,
  MessageBarType,
  SelectionMode,
  Stack,
  Text
} from '@fluentui/react';

import SkeletonLoader from '../Common/SkeletonLoader';
import { EmptyState, StatusBadge } from '../Common';
import type { IDirectReport } from '../../services/GraphService';
import useCurrentDate from '../../hooks/useCurrentDate';
import SharePointService, {
  deduplicateKudos,
  isFaltaApprovedForScoring,
  type IConfiguracionMetricas,
  type IDashboardProductividadItem,
  type IKudoHistorialItem,
  type IKudoListItem,
  type IPublicacionEmpleadoMes
} from '../../services/SharePointService';
import {
  calculateAgentProductivity,
  calculateProductivityOverlapFactor,
  calculateTeamMetricAverages,
  getWorkingDaysCount,
  PRODUCTIVITY_METRIC_KEYS,
  resolveCaseSlaGoalPercentage,
  resolveCaseSlaValues,
  resolveProductivityMetricValues,
  type IAgentProductivityResult,
  type IProductivityAgentRecord,
  type IProductivityMetricBreakdown,
  type ProductivityMetricKey
} from '../../utils';
import EmployeeMonthCard from './EmployeeMonthCard';
import {
  buildKudoMedals,
  type IKudoMedal
} from './KudoMedals';
import styles from './Dashboard.module.scss';

interface IAgenteLeaderboard {
  agente: string;
  casosATiempo: number;
  casosAtendidos: number;
  emisionesTx: number;
  escaneoPg: number;
  metaSlaCasos: number;
  movimientosPg: number;
  puntosProductividad: number;
  puntosKudos: number;
  puntosRestados: number;
  slaCasosObtenido?: number;
  puntajeTotal: number;
}

interface IAgenteAccumulator {
  agente: string;
  hasProductividad: boolean;
  metricasProductividad: IProductivityAgentRecord;
  puntosKudos: number;
  puntosRestados: number;
}

interface IAgenteIdentityItem {
  Title?: string;
  AgenteEmail?: string;
  AgenteObjectID?: string;
}

interface IResolvedAgentIdentity {
  key: string;
  displayName: string;
}

interface IDashboardTemporalContext {
  currentMonthLabel: string;
  isMysteryMode: boolean;
  recognitionEnd: Date;
  recognitionMonthLabel: string;
  recognitionStart: Date;
}

interface IRecognitionPeriod {
  end: Date;
  start: Date;
}

interface IProductivityPeriod extends IRecognitionPeriod {
  label: string;
  workingDays: number;
}

interface IProductivityPeriodGoals {
  casosATiempo: number;
  casosAtendidos: number;
  emisionesTx: number;
  movimientosPg: number;
  escaneoPg: number;
  metaSlaCasos: number;
  slaCasos?: number;
}

export interface IDashboardProps {
  availableAgents: ReadonlyArray<IDirectReport>;
  hasGlobalScope: boolean;
}

const MONTH_NAMES: ReadonlyArray<string> = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre'
];

const toFiniteNumber = (value: unknown): number => (
  typeof value === 'number' && Number.isFinite(value) ? value : 0
);

const normalizeBusinessValue = (value?: string): string => (
  value
    ?.trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase() || ''
);

const formatMonthYear = (date: Date): string => (
  `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`
);

const createTemporalContext = (today: Date): IDashboardTemporalContext => {
  const recognitionStart = new Date(
    today.getFullYear(),
    today.getMonth() - 1,
    1
  );
  const recognitionEnd = new Date(
    today.getFullYear(),
    today.getMonth(),
    0,
    23,
    59,
    59,
    999
  );

  return {
    currentMonthLabel: formatMonthYear(today),
    isMysteryMode: today.getDate() >= 26,
    recognitionEnd,
    recognitionMonthLabel: formatMonthYear(recognitionStart),
    recognitionStart
  };
};

const resolveRecognitionPeriod = (
  monthYearLabel: string,
  fallback: IRecognitionPeriod
): IRecognitionPeriod => {
  const normalizedParts = monthYearLabel.trim().split(/\s+/);
  const monthName = normalizedParts[0]?.toLocaleLowerCase() || '';
  const parsedYear = Number(normalizedParts[normalizedParts.length - 1]);
  const monthIndex = MONTH_NAMES.findIndex(
    (candidate) => candidate.toLocaleLowerCase() === monthName
  );

  if (
    monthIndex < 0 ||
    !Number.isInteger(parsedYear) ||
    parsedYear < 1900
  ) {
    return fallback;
  }

  return {
    start: new Date(parsedYear, monthIndex, 1),
    end: new Date(parsedYear, monthIndex + 1, 0, 23, 59, 59, 999)
  };
};

const resolveAgentIdentity = (
  item: IAgenteIdentityItem
): IResolvedAgentIdentity | undefined => {
  const agentName = item.Title?.trim() || '';
  const agentEmail = item.AgenteEmail?.trim().toLocaleLowerCase() || '';
  const agentObjectId = item.AgenteObjectID?.trim().toLocaleLowerCase() || '';
  const key = agentEmail
    ? `email:${agentEmail}`
    : agentObjectId
      ? `object:${agentObjectId}`
      : agentName
        ? `legacy:${agentName.toLocaleLowerCase()}`
        : '';

  if (!key) {
    return undefined;
  }

  return {
    key,
    displayName: agentName || agentEmail || agentObjectId
  };
};

const matchesAuthorizedAgent = (
  item: IAgenteIdentityItem,
  agent: IDirectReport
): boolean => {
  const itemEmail = item.AgenteEmail?.trim().toLocaleLowerCase() || '';
  const agentEmail = agent.email.trim().toLocaleLowerCase();

  if (itemEmail && agentEmail && itemEmail === agentEmail) {
    return true;
  }

  const itemObjectId =
    item.AgenteObjectID?.trim().toLocaleLowerCase() || '';
  const agentObjectId = agent.id.trim().toLocaleLowerCase();

  if (
    itemObjectId &&
    agentObjectId &&
    itemObjectId === agentObjectId
  ) {
    return true;
  }

  if (itemEmail || itemObjectId) {
    return false;
  }

  return Boolean(
    item.Title?.trim() &&
    item.Title.trim().toLocaleLowerCase() ===
      agent.name.trim().toLocaleLowerCase()
  );
};

const matchesPublishedWinner = (
  item: IKudoHistorialItem,
  publication: IPublicacionEmpleadoMes
): boolean => {
  const publicationEmail = publication.AgenteEmail
    .trim()
    .toLocaleLowerCase();
  const itemEmail = item.AgenteEmail?.trim().toLocaleLowerCase() || '';

  if (publicationEmail && itemEmail) {
    return publicationEmail === itemEmail;
  }

  if (itemEmail) {
    return false;
  }

  return Boolean(
    publication.AgenteNombre.trim() &&
    item.Title?.trim().toLocaleLowerCase() ===
      publication.AgenteNombre.trim().toLocaleLowerCase()
  );
};

const formatPoints = (value: number): string => value.toLocaleString('es-DO', {
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

const createProductivityPeriod = (today: Date): IProductivityPeriod => {
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    23,
    59,
    59,
    999
  );
  const workingDays = getWorkingDaysCount(start, end);

  return {
    start,
    end,
    label: `${formatMonthYear(today)} · días 1-${today.getDate()}`,
    workingDays
  };
};

const createProductivityPeriodFromRecognition = (
  period: IRecognitionPeriod,
  label: string
): IProductivityPeriod => ({
  ...period,
  label,
  workingDays: getWorkingDaysCount(period.start, period.end)
});

const createEmptyProductivityRecord = (): IProductivityAgentRecord => ({
  CasosAtendidos: 0,
  CasosATiempo: 0,
  hasCaseSlaData: false,
  EmisionesTx: 0,
  EmisionesPg: 0,
  MovimientosTx: 0,
  MovimientosPg: 0,
  EscaneoTx: 0,
  EscaneoPg: 0
});

const addProductivityRecord = (
  accumulator: IProductivityAgentRecord,
  item: IDashboardProductividadItem,
  overlapFactor: number
): void => {
  const values = resolveProductivityMetricValues(item);
  const caseSla = resolveCaseSlaValues(item);

  if (caseSla.hasSlaData) {
    accumulator.CasosAtendidos =
      toFiniteNumber(accumulator.CasosAtendidos) +
      (caseSla.casosAtendidos * overlapFactor);
    accumulator.CasosATiempo =
      toFiniteNumber(accumulator.CasosATiempo) +
      (caseSla.casosATiempo * overlapFactor);
    accumulator.hasCaseSlaData = true;
  }

  PRODUCTIVITY_METRIC_KEYS.forEach((metric) => {
    if (metric === 'Casos') {
      return;
    }

    accumulator[metric] = toFiniteNumber(accumulator[metric]) +
      (values[metric] * overlapFactor);
  });
};

const getMetricResult = (
  result: IAgentProductivityResult,
  metric: ProductivityMetricKey
): IProductivityMetricBreakdown | undefined =>
  result.metrics.find((candidate) => candidate.metric === metric);

const createColumns = (): IColumn[] => [
  {
    key: 'posicionAgente',
    isResizable: true,
    minWidth: 190,
    name: 'Posición / Agente',
    onRender: (item?: IAgenteLeaderboard, index?: number) => (
      <Text variant="mediumPlus">
        <strong>#{(index || 0) + 1}</strong> {item?.agente || ''}
      </Text>
    )
  },
  {
    key: 'productividad',
    minWidth: 120,
    name: 'Índice Productividad (%)',
    onRender: (item?: IAgenteLeaderboard) => (
      <Text>{formatPercentage(item?.puntosProductividad || 0)}</Text>
    )
  },
  {
    key: 'casosSla',
    isResizable: true,
    maxWidth: 340,
    minWidth: 280,
    name: 'SLA Casos (%)',
    onRender: (item?: IAgenteLeaderboard) => {
      const sla = item?.slaCasosObtenido;
      const goal = item?.metaSlaCasos || 90;

      return sla === undefined ? (
        <Text className={`${styles.slaComparisonBadge} ${styles.goalPending}`}>
          SLA: N/A (Meta: {formatPercentage(goal)} · 0/0 casos)
        </Text>
      ) : (
        <Text className={`${styles.slaComparisonBadge} ${
          sla >= goal ? styles.goalMet : styles.goalPending
        }`}>
          SLA: {formatPercentage(sla)} (Meta: {formatPercentage(goal)} · {
            formatPoints(item?.casosATiempo || 0)
          }/{formatPoints(item?.casosAtendidos || 0)} casos)
        </Text>
      );
    }
  },
  {
    key: 'emisiones',
    minWidth: 90,
    name: 'Emisiones Tx',
    onRender: (item?: IAgenteLeaderboard) => (
      <Text>{formatPoints(item?.emisionesTx || 0)}</Text>
    )
  },
  {
    key: 'movimientos',
    minWidth: 100,
    name: 'Movimientos Pg',
    onRender: (item?: IAgenteLeaderboard) => (
      <Text>{formatPoints(item?.movimientosPg || 0)}</Text>
    )
  },
  {
    key: 'escaneo',
    minWidth: 90,
    name: 'Escaneo Pg',
    onRender: (item?: IAgenteLeaderboard) => (
      <Text>{formatPoints(item?.escaneoPg || 0)}</Text>
    )
  },
  {
    key: 'kudos',
    minWidth: 80,
    name: 'Kudos (+)',
    onRender: (item?: IAgenteLeaderboard) => (
      <Text className={styles.kudosBadge}>
        +{formatPoints(item?.puntosKudos || 0)} pts
      </Text>
    )
  },
  {
    key: 'total',
    minWidth: 105,
    name: 'Puntaje Total',
    onRender: (item?: IAgenteLeaderboard) => (
      <Text variant="mediumPlus">
        <strong>{formatPoints(item?.puntajeTotal || 0)}</strong>
      </Text>
    )
  }
];

const getPenalty = (
  impacto: string | undefined,
  config: IConfiguracionMetricas
): number => {
  switch (normalizeBusinessValue(impacto)) {
    case 'bajo':
    case 'leve':
      return toFiniteNumber(config.PenalidadBaja);
    case 'medio':
      return toFiniteNumber(config.PenalidadMedia);
    case 'critico':
    case 'grave':
      return toFiniteNumber(config.PenalidadCritica);
    default:
      return 0;
  }
};

const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'AG';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const getRankBadge = (rank: number): React.ReactNode => {
  if (rank === 1) {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400/20 text-amber-300 font-bold border border-amber-400/40 text-xs shadow-lg shadow-amber-400/10">
        🥇
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-300/20 text-slate-200 font-bold border border-slate-300/40 text-xs">
        🥈
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-700/20 text-amber-500 font-bold border border-amber-600/40 text-xs">
        🥉
      </span>
    );
  }
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-slate-400 font-semibold text-xs border border-slate-700">
      #{rank}
    </span>
  );
};

const Dashboard: React.FC<IDashboardProps> = ({
  availableAgents,
  hasGlobalScope
}) => {
  const [leaderboard, setLeaderboard] = React.useState<IAgenteLeaderboard[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [errorMessage, setErrorMessage] = React.useState<string>('');
  const [publicationError, setPublicationError] = React.useState<string>('');
  const [publication, setPublication] =
    React.useState<IPublicacionEmpleadoMes | undefined>(undefined);
  const [winnerMedals, setWinnerMedals] =
    React.useState<IKudoMedal[]>([]);
  const [productivityGoals, setProductivityGoals] =
    React.useState<IProductivityPeriodGoals>();
  const sharePointService = React.useMemo(() => new SharePointService(), []);
  const currentDate = useCurrentDate();
  const temporalContext = React.useMemo(
    () => createTemporalContext(currentDate),
    [currentDate]
  );
  const defaultProductivityPeriod = React.useMemo(
    () => createProductivityPeriod(currentDate),
    [currentDate]
  );
  const [productivityPeriod, setProductivityPeriod] =
    React.useState<IProductivityPeriod>(defaultProductivityPeriod);
  const columns = React.useMemo(() => createColumns(), []);

  React.useEffect(() => {
    let isMounted = true;

    const loadDashboard = async (): Promise<void> => {
      setIsLoading(true);
      setErrorMessage('');
      setPublicationError('');

      try {
        let activePublication: IPublicacionEmpleadoMes | undefined;
        let publicationLoadError = '';
        let evaluationPeriod = defaultProductivityPeriod;

        if (!temporalContext.isMysteryMode) {
          try {
            activePublication = await sharePointService.getPublicacionMes(
              temporalContext.recognitionMonthLabel
            );

            if (activePublication) {
              const publicationPeriod = resolveRecognitionPeriod(
                activePublication.Title,
                {
                  start: temporalContext.recognitionStart,
                  end: temporalContext.recognitionEnd
                }
              );

              evaluationPeriod = createProductivityPeriodFromRecognition(
                publicationPeriod,
                activePublication.Title
              );
            }
          } catch (publicationFailure: unknown) {
            publicationLoadError = publicationFailure instanceof Error
              ? publicationFailure.message
              : 'No fue posible cargar la publicación del período.';
          }
        }

        const { config, productividad, faltas, kudos } =
          await sharePointService.getDatosDashboard(
            evaluationPeriod.start,
            evaluationPeriod.end
          );
        const agents: Record<string, IAgenteAccumulator> = {};
        const isAuthorizedItem = (item: IAgenteIdentityItem): boolean =>
          hasGlobalScope ||
          availableAgents.some((agent) =>
            matchesAuthorizedAgent(item, agent)
          );

        const getAgent = (
          item: IAgenteIdentityItem
        ): IAgenteAccumulator | undefined => {
          const identity = resolveAgentIdentity(item);

          if (!identity) {
            return undefined;
          }

          if (!agents[identity.key]) {
            agents[identity.key] = {
              agente: identity.displayName,
              hasProductividad: false,
              metricasProductividad: createEmptyProductivityRecord(),
              puntosKudos: 0,
              puntosRestados: 0
            };
          }

          return agents[identity.key];
        };

        productividad.forEach((item) => {
          if (!isAuthorizedItem(item)) {
            return;
          }

          const agent = getAgent(item);

          if (!agent) {
            return;
          }

          const overlapFactor = calculateProductivityOverlapFactor(
            item,
            evaluationPeriod.start,
            evaluationPeriod.end
          );

          if (overlapFactor > 0) {
            agent.hasProductividad = true;
            addProductivityRecord(
              agent.metricasProductividad,
              item,
              overlapFactor
            );
          }
        });

        deduplicateKudos(kudos).forEach((item: IKudoListItem) => {
          if (!isAuthorizedItem(item)) {
            return;
          }

          const agent = getAgent(item);

          if (!agent) {
            return;
          }

          agent.puntosKudos += toFiniteNumber(item.Puntos);
        });

        faltas.forEach((item) => {
          if (
            !isAuthorizedItem(item) ||
            !isFaltaApprovedForScoring(item.EstadoAprobacion)
          ) {
            return;
          }

          const agent = getAgent(item);

          if (!agent) {
            return;
          }

          if (normalizeBusinessValue(item.Categoria) === 'capacitacion') {
            return;
          }

          agent.puntosRestados += getPenalty(item.Impacto, config);
        });

        const accumulatedAgents = Object.keys(agents).map(
          (agentKey) => agents[agentKey]
        );
        const teamAverages = calculateTeamMetricAverages(
          accumulatedAgents
            .filter((agent) => agent.hasProductividad)
            .map((agent) => agent.metricasProductividad)
        );
        const goalReference = calculateAgentProductivity(
          {
            ...createEmptyProductivityRecord(),
            applicableMetrics: [
              'EmisionesTx',
              'MovimientosPg',
              'EscaneoPg'
            ]
          },
          config,
          teamAverages,
          evaluationPeriod.workingDays
        );
        const caseSlaTotals = accumulatedAgents.reduce(
          (totals, agent) => {
            const caseSla = resolveCaseSlaValues(
              agent.metricasProductividad
            );

            if (caseSla.hasSlaData && caseSla.casosAtendidos > 0) {
              totals.casosAtendidos += caseSla.casosAtendidos;
              totals.casosATiempo += caseSla.casosATiempo;
            }

            return totals;
          },
          { casosATiempo: 0, casosAtendidos: 0 }
        );
        const periodGoals: IProductivityPeriodGoals = {
          casosATiempo: caseSlaTotals.casosATiempo,
          casosAtendidos: caseSlaTotals.casosAtendidos,
          emisionesTx:
            getMetricResult(goalReference, 'EmisionesTx')?.targetValue || 0,
          movimientosPg:
            getMetricResult(goalReference, 'MovimientosPg')?.targetValue || 0,
          escaneoPg:
            getMetricResult(goalReference, 'EscaneoPg')?.targetValue || 0,
          metaSlaCasos: resolveCaseSlaGoalPercentage(config),
          slaCasos: caseSlaTotals.casosAtendidos > 0
            ? (caseSlaTotals.casosATiempo /
              caseSlaTotals.casosAtendidos) * 100
            : undefined
        };
        const ranking = accumulatedAgents
          .map((agent): IAgenteLeaderboard => {
            const productivityResult = calculateAgentProductivity(
              agent.metricasProductividad,
              config,
              teamAverages,
              evaluationPeriod.workingDays
            );
            const productivityPercentage =
              productivityResult.productivityPercentage;
            const caseSlaValues = resolveCaseSlaValues(
              agent.metricasProductividad
            );
            const metricValues = resolveProductivityMetricValues(
              agent.metricasProductividad
            );

            return {
              agente: agent.agente,
              casosATiempo: caseSlaValues.casosATiempo,
              casosAtendidos: caseSlaValues.casosAtendidos,
              emisionesTx: metricValues.EmisionesTx,
              escaneoPg: metricValues.EscaneoPg,
              metaSlaCasos: resolveCaseSlaGoalPercentage(config),
              movimientosPg: metricValues.MovimientosPg,
              puntosProductividad: productivityPercentage,
              puntosKudos: agent.puntosKudos,
              puntosRestados: agent.puntosRestados,
              slaCasosObtenido: caseSlaValues.slaPercentage,
              puntajeTotal:
                productivityPercentage +
                agent.puntosKudos -
                agent.puntosRestados
            };
          })
          .sort((first, second) => second.puntajeTotal - first.puntajeTotal);
        let accumulatedMedals: IKudoMedal[] = [];

        if (activePublication) {
          const publishedWinner = activePublication;

          try {
            const periodKudos = await sharePointService.getKudosHistorial(
              evaluationPeriod.start,
              evaluationPeriod.end
            );
            const winnerKudos = periodKudos.filter((item) =>
              matchesPublishedWinner(item, publishedWinner)
            );

            accumulatedMedals = buildKudoMedals(winnerKudos);
          } catch (publicationFailure: unknown) {
            publicationLoadError = publicationFailure instanceof Error
              ? publicationFailure.message
              : 'No fue posible cargar las medallas del período.';
          }
        }

        if (isMounted) {
          setLeaderboard(ranking);
          setProductivityGoals(periodGoals);
          setPublication(activePublication);
          setWinnerMedals(accumulatedMedals);
          setPublicationError(publicationLoadError);
          setProductivityPeriod(evaluationPeriod);
        }
      } catch (error: unknown) {
        if (isMounted) {
          const detail = error instanceof Error
            ? error.message
            : 'Ocurrió un error inesperado al calcular el Dashboard.';
          setLeaderboard([]);
          setProductivityGoals(undefined);
          setPublication(undefined);
          setWinnerMedals([]);
          setProductivityPeriod(defaultProductivityPeriod);
          setErrorMessage(detail);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadDashboard().catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [
    availableAgents,
    defaultProductivityPeriod,
    hasGlobalScope,
    sharePointService,
    temporalContext
  ]);

  if (isLoading) {
    return (
      <SkeletonLoader
        cardCount={3}
        label="Calculando empleado del mes..."
        rowCount={6}
        showHero
      />
    );
  }

  if (errorMessage) {
    return (
      <Stack className={styles.dashboard}>
        <MessageBar messageBarType={MessageBarType.error}>
          {errorMessage}
        </MessageBar>
      </Stack>
    );
  }

  return (
    <Stack className={styles.dashboard} tokens={{ childrenGap: 24 }}>
      <Text className={styles.subtitle}>
        Índice consolidado de productividad y reconocimientos del período.
      </Text>

      {publicationError && publication ? (
        <MessageBar messageBarType={MessageBarType.warning}>
          La publicación está disponible, pero no fue posible cargar todas sus
          medallas: {publicationError}
        </MessageBar>
      ) : null}

      {temporalContext.isMysteryMode ? (
        <Stack
          className={`${styles.leaderCard} ${styles.mysteryCard}`}
          horizontalAlign="center"
          tokens={{ childrenGap: 12 }}
        >
          <Text className={styles.mysterySymbol}>🔮</Text>
          <Text className={styles.heroTitle}>
            Proceso de Evaluación de Desempeño
          </Text>
          <Text className={styles.mysterySubtitle}>
            El Empleado del Mes de {temporalContext.currentMonthLabel} está
            siendo calculado. El ganador será publicado en los primeros días
            del próximo mes.
          </Text>
        </Stack>
      ) : publication ? (
        <EmployeeMonthCard
          agenteNombre={publication.AgenteNombre}
          conceptoKudo={publication.ConceptoKudo}
          dedicatoria={publication.Dedicatoria}
          medals={winnerMedals}
          mesAno={publication.Title}
          puntosTotales={toFiniteNumber(publication.PuntosTotales)}
        />
      ) : (
        <Stack
          className={styles.pendingPublicationCard}
          tokens={{ childrenGap: 10 }}
        >
          <Text className={styles.pendingTitle}>
            🏆 Empleado del Mes - {temporalContext.recognitionMonthLabel}
          </Text>
          <MessageBar
            messageBarType={
              publicationError
                ? MessageBarType.warning
                : MessageBarType.info
            }
          >
            {publicationError ||
              'El reconocimiento de este período aún no ha sido publicado.'}
          </MessageBar>
        </Stack>
      )}

      <section className={styles.goalsCard}>
        <div>
          <Text className={styles.goalsEyebrow}>
            Cumplimiento operativo · {productivityPeriod.label}
          </Text>
          <Text className={styles.goalsTitle}>
            Metas v4 proporcionales por colaborador
          </Text>
          <Text className={styles.goalsDescription}>
            {productivityPeriod.workingDays} jornadas equivalentes; los
            sábados cuentan como media jornada y los domingos no cuentan.
          </Text>
        </div>
        <div className={styles.goalSummaryGrid}>
          <span>
            <small>SLA de Casos</small>
            <strong>
              {productivityGoals?.slaCasos === undefined
                ? 'N/A'
                : formatPercentage(productivityGoals.slaCasos)}
            </strong>
            <em>
              {productivityGoals?.slaCasos === undefined
                ? `SLA: N/A (Meta: ${formatPercentage(
                  productivityGoals?.metaSlaCasos || 90
                )} · 0/0 casos). Peso redistribuido.`
                : `SLA: ${formatPercentage(
                  productivityGoals.slaCasos
                )} (Meta: ${formatPercentage(
                  productivityGoals.metaSlaCasos
                )} · ${formatPoints(
                  productivityGoals.casosATiempo
                )} / ${formatPoints(
                  productivityGoals.casosAtendidos
                )} casos)`}
            </em>
          </span>
          <span>
            <small>Meta Emisiones Tx</small>
            <strong>
              {formatPoints(productivityGoals?.emisionesTx || 0)}
            </strong>
            <em>Transacciones</em>
          </span>
          <span>
            <small>Meta Movimientos Pg</small>
            <strong>
              {formatPoints(productivityGoals?.movimientosPg || 0)}
            </strong>
            <em>Páginas</em>
          </span>
          <span>
            <small>Meta Escaneo Pg</small>
            <strong>{formatPoints(productivityGoals?.escaneoPg || 0)}</strong>
            <em>Páginas</em>
          </span>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-white">
              Ranking general · {productivityPeriod.label}
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Desempeño consolidado de productividad diaria, SLA de casos, reconocimientos y deducciones.
            </p>
          </div>
          <StatusBadge variant="info">
            {leaderboard.length} colaborador{leaderboard.length === 1 ? '' : 'es'}
          </StatusBadge>
        </div>

        {leaderboard.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/80 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3.5">Posición & Colaborador</th>
                  <th className="px-4 py-3.5">Índice Productividad</th>
                  <th className="px-4 py-3.5">SLA Casos</th>
                  <th className="px-4 py-3.5 text-right">Emisiones Tx</th>
                  <th className="px-4 py-3.5 text-right">Movimientos Pg</th>
                  <th className="px-4 py-3.5 text-right">Escaneo Pg</th>
                  <th className="px-4 py-3.5 text-center">Kudos (+)</th>
                  <th className="px-4 py-3.5 text-right">Puntaje Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {leaderboard.map((item, index) => {
                  const rank = index + 1;
                  const prodPct = Math.max(0, Math.min(100, item.puntosProductividad || 0));
                  const sla = item.slaCasosObtenido;
                  const goal = item.metaSlaCasos || 90;

                  return (
                    <tr
                      key={item.agente}
                      className="transition-colors hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          {getRankBadge(rank)}
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-xs font-bold text-slate-300">
                            {getInitials(item.agente)}
                          </div>
                          <strong className="text-white font-medium">{item.agente}</strong>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 min-w-[180px]">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-cyan-300 tabular-nums font-mono">
                              {formatPercentage(item.puntosProductividad || 0)}
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-500"
                              style={{ width: `${prodPct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {sla === undefined ? (
                          <span className="inline-block rounded-full border border-slate-700 bg-slate-800 px-2.5 py-0.5 text-xs text-slate-400">
                            SLA: N/A (Meta: {formatPercentage(goal)})
                          </span>
                        ) : (
                          <span
                            className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold tabular-nums font-mono ${
                              sla >= goal
                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                            }`}
                          >
                            SLA: {formatPercentage(sla)} ({formatPoints(item.casosATiempo || 0)}/{formatPoints(item.casosAtendidos || 0)})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right font-medium text-slate-200 tabular-nums font-mono">
                        {formatPoints(item.emisionesTx || 0)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-medium text-slate-200 tabular-nums font-mono">
                        {formatPoints(item.movimientosPg || 0)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-medium text-slate-200 tabular-nums font-mono">
                        {formatPoints(item.escaneoPg || 0)}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {item.puntosKudos > 0 ? (
                          <span className="inline-block rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-xs font-bold text-cyan-300 tabular-nums font-mono">
                            +{formatPoints(item.puntosKudos)} pts
                          </span>
                        ) : (
                          <span className="text-slate-500 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <strong className="text-base font-bold text-white tabular-nums font-mono">
                          {formatPoints(item.puntajeTotal || 0)}
                        </strong>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            className="my-2"
            icon={<span className="text-2xl">📊</span>}
            title="Sin datos operativos"
            description="No hay datos operativos suficientes en el período seleccionado para calcular el ranking general."
          />
        )}
      </section>
    </Stack>
  );
};

export default Dashboard;
