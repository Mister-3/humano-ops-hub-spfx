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
import type { IDirectReport } from '../../services/GraphService';
import useCurrentDate from '../../hooks/useCurrentDate';
import SharePointService, {
  type IConfiguracionMetricas,
  type IDashboardProductividadItem,
  type IKudoHistorialItem,
  type IPublicacionEmpleadoMes
} from '../../services/SharePointService';
import { getWorkingDaysCount } from '../../utils';
import EmployeeMonthCard from './EmployeeMonthCard';
import {
  buildKudoMedals,
  type IKudoMedal
} from './KudoMedals';
import styles from './Dashboard.module.scss';

interface IAgenteLeaderboard {
  agente: string;
  cumplimientoEmisiones: number;
  cumplimientoMovimientos: number;
  emisionesPeriodo: number;
  movimientosPeriodo: number;
  puntosProductividad: number;
  puntosKudos: number;
  puntosRestados: number;
  puntajeTotal: number;
}

type IAgenteAccumulator = Omit<
  IAgenteLeaderboard,
  'cumplimientoEmisiones' | 'cumplimientoMovimientos' | 'puntajeTotal'
>;

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
  metaEmisiones: number;
  metaMovimientos: number;
  workingDays: number;
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

const formatPenalty = (value: number): string => (
  value > 0 ? `-${formatPoints(value)}` : '0'
);

const formatPercentage = (value: number): string => `${value.toLocaleString(
  'es-DO',
  {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1
  }
)}%`;

const getCompliance = (actual: number, goal: number): number => (
  goal > 0 ? (actual / goal) * 100 : 0
);

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
    workingDays,
    metaEmisiones: workingDays * 10,
    metaMovimientos: workingDays * 350
  };
};

const isProductivityWithinPeriod = (
  item: IDashboardProductividadItem,
  period: IRecognitionPeriod
): boolean => {
  const startValue = item.FechaInicio || item.FechaRegistro;
  const endValue = item.FechaFin || item.FechaRegistro || item.FechaInicio;

  if (!startValue || !endValue) {
    return false;
  }

  const recordStart = new Date(startValue);
  const recordEnd = new Date(endValue);

  if (
    Number.isNaN(recordStart.getTime()) ||
    Number.isNaN(recordEnd.getTime())
  ) {
    return false;
  }

  return (
    recordStart.getTime() <= period.end.getTime() &&
    recordEnd.getTime() >= period.start.getTime()
  );
};

const createColumns = (): IColumn[] => [
  {
    key: 'posicion',
    name: 'Posición',
    minWidth: 65,
    maxWidth: 80,
    onRender: (_item?: IAgenteLeaderboard, index?: number) => (
      <Text variant="mediumPlus">{(index || 0) + 1}</Text>
    )
  },
  {
    fieldName: 'agente',
    isResizable: true,
    key: 'agente',
    minWidth: 160,
    name: 'Agente'
  },
  {
    key: 'productividad',
    minWidth: 105,
    name: 'Productividad',
    onRender: (item?: IAgenteLeaderboard) => (
      <Text>{formatPoints(item?.puntosProductividad || 0)}</Text>
    )
  },
  {
    key: 'emisiones',
    minWidth: 105,
    name: 'Meta Emisiones',
    onRender: (item?: IAgenteLeaderboard) => (
      <Text className={
        (item?.cumplimientoEmisiones || 0) >= 100
          ? styles.goalMet
          : styles.goalPending
      }>
        {formatPercentage(item?.cumplimientoEmisiones || 0)}
      </Text>
    )
  },
  {
    key: 'movimientos',
    minWidth: 115,
    name: 'Meta Movimientos',
    onRender: (item?: IAgenteLeaderboard) => (
      <Text className={
        (item?.cumplimientoMovimientos || 0) >= 100
          ? styles.goalMet
          : styles.goalPending
      }>
        {formatPercentage(item?.cumplimientoMovimientos || 0)}
      </Text>
    )
  },
  {
    key: 'kudos',
    minWidth: 75,
    name: 'Kudos',
    onRender: (item?: IAgenteLeaderboard) => (
      <Text>{formatPoints(item?.puntosKudos || 0)}</Text>
    )
  },
  {
    key: 'penalidades',
    minWidth: 95,
    name: 'Penalidades',
    onRender: (item?: IAgenteLeaderboard) => (
      <Text className={styles.penalty}>
        {formatPenalty(item?.puntosRestados || 0)}
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
  switch (impacto?.trim()) {
    case 'Bajo':
      return toFiniteNumber(config.PenalidadBaja);
    case 'Medio':
      return toFiniteNumber(config.PenalidadMedia);
    case 'Crítico':
      return toFiniteNumber(config.PenalidadCritica);
    default:
      return 0;
  }
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
  const sharePointService = React.useMemo(() => new SharePointService(), []);
  const currentDate = useCurrentDate();
  const temporalContext = React.useMemo(
    () => createTemporalContext(currentDate),
    [currentDate]
  );
  const productivityPeriod = React.useMemo(
    () => createProductivityPeriod(currentDate),
    [currentDate]
  );
  const columns = React.useMemo(() => createColumns(), []);

  React.useEffect(() => {
    let isMounted = true;

    const loadDashboard = async (): Promise<void> => {
      setIsLoading(true);
      setErrorMessage('');
      setPublicationError('');

      try {
        const { config, productividad, faltas, kudos } =
          await sharePointService.getDatosDashboard();
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
              emisionesPeriodo: 0,
              movimientosPeriodo: 0,
              puntosProductividad: 0,
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

          agent.puntosProductividad +=
            (toFiniteNumber(item.Casos) * toFiniteNumber(config.PesoCasos)) +
            (toFiniteNumber(item.Emisiones) * toFiniteNumber(config.PesoEmisiones)) +
            (toFiniteNumber(item.Movimientos) * toFiniteNumber(config.PesoMovimientos));

          if (isProductivityWithinPeriod(item, productivityPeriod)) {
            agent.emisionesPeriodo += toFiniteNumber(item.Emisiones);
            agent.movimientosPeriodo += toFiniteNumber(item.Movimientos);
          }
        });

        kudos.forEach((item) => {
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
          if (!isAuthorizedItem(item)) {
            return;
          }

          const agent = getAgent(item);

          if (!agent) {
            return;
          }

          if (item.Categoria?.trim().toLocaleLowerCase() === 'capacitación') {
            return;
          }

          agent.puntosRestados += getPenalty(item.Impacto, config);
        });

        const ranking = Object.keys(agents)
          .map((agentKey): IAgenteLeaderboard => {
            const agent = agents[agentKey];

            return {
              ...agent,
              cumplimientoEmisiones: getCompliance(
                agent.emisionesPeriodo,
                productivityPeriod.metaEmisiones
              ),
              cumplimientoMovimientos: getCompliance(
                agent.movimientosPeriodo,
                productivityPeriod.metaMovimientos
              ),
              puntajeTotal:
                agent.puntosProductividad +
                agent.puntosKudos -
                agent.puntosRestados
            };
          })
          .sort((first, second) => second.puntajeTotal - first.puntajeTotal);

        let activePublication: IPublicacionEmpleadoMes | undefined;
        let accumulatedMedals: IKudoMedal[] = [];
        let publicationLoadError = '';

        if (!temporalContext.isMysteryMode) {
          try {
            activePublication = await sharePointService.getPublicacionMes(
              temporalContext.recognitionMonthLabel
            );

            if (activePublication) {
              const publishedWinner = activePublication;
              const publicationPeriod = resolveRecognitionPeriod(
                activePublication.Title,
                {
                  start: temporalContext.recognitionStart,
                  end: temporalContext.recognitionEnd
                }
              );
              const periodKudos = await sharePointService.getKudosHistorial(
                publicationPeriod.start,
                publicationPeriod.end
              );
              const winnerKudos = periodKudos.filter((item) =>
                matchesPublishedWinner(item, publishedWinner)
              );

              accumulatedMedals = buildKudoMedals(winnerKudos);
            }
          } catch (publicationFailure: unknown) {
            publicationLoadError = publicationFailure instanceof Error
              ? publicationFailure.message
              : 'No fue posible cargar la publicación del período.';
          }
        }

        if (isMounted) {
          setLeaderboard(ranking);
          setPublication(activePublication);
          setWinnerMedals(accumulatedMedals);
          setPublicationError(publicationLoadError);
        }
      } catch (error: unknown) {
        if (isMounted) {
          const detail = error instanceof Error
            ? error.message
            : 'Ocurrió un error inesperado al calcular el Dashboard.';
          setLeaderboard([]);
          setPublication(undefined);
          setWinnerMedals([]);
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
    hasGlobalScope,
    sharePointService,
    productivityPeriod,
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
      <Stack>
        <Text variant="xxLarge">Dashboard de Cultura y Rendimiento</Text>
        <Text className={styles.subtitle}>
          Productividad ponderada, reconocimientos y penalidades acumuladas.
        </Text>
      </Stack>

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
            Metas proporcionales por colaborador
          </Text>
          <Text className={styles.goalsDescription}>
            {productivityPeriod.workingDays} días laborables, excluyendo
            únicamente los domingos.
          </Text>
        </div>
        <div className={styles.goalSummaryGrid}>
          <span>
            <small>Meta Emisiones</small>
            <strong>{formatPoints(productivityPeriod.metaEmisiones)}</strong>
            <em>10 por día</em>
          </span>
          <span>
            <small>Meta Movimientos</small>
            <strong>{formatPoints(productivityPeriod.metaMovimientos)}</strong>
            <em>350 por día</em>
          </span>
        </div>
      </section>

      <Stack className={styles.tableCard} tokens={{ childrenGap: 12 }}>
        <Text variant="xLarge">Ranking general</Text>
        {leaderboard.length > 0 ? (
          <DetailsList
            columns={columns}
            getKey={(item: IAgenteLeaderboard) => item.agente}
            items={leaderboard}
            layoutMode={DetailsListLayoutMode.justified}
            selectionMode={SelectionMode.none}
          />
        ) : (
          <MessageBar messageBarType={MessageBarType.info}>
            No hay datos operativos suficientes para calcular el ranking.
          </MessageBar>
        )}
      </Stack>
    </Stack>
  );
};

export default Dashboard;
