import * as React from 'react';
import {
  DetailsList,
  DetailsListLayoutMode,
  type IColumn,
  MessageBar,
  MessageBarType,
  Persona,
  PersonaSize,
  SelectionMode,
  Spinner,
  SpinnerSize,
  Stack,
  Text
} from '@fluentui/react';

import SharePointService, {
  type IConfiguracionMetricas
} from '../../services/SharePointService';
import styles from './Dashboard.module.scss';

interface IAgenteLeaderboard {
  agente: string;
  puntosProductividad: number;
  puntosKudos: number;
  puntosRestados: number;
  puntajeTotal: number;
}

type IAgenteAccumulator = Omit<IAgenteLeaderboard, 'puntajeTotal'>;

const toFiniteNumber = (value: unknown): number => (
  typeof value === 'number' && Number.isFinite(value) ? value : 0
);

const formatPoints = (value: number): string => value.toLocaleString('es-DO', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0
});

const formatPenalty = (value: number): string => (
  value > 0 ? `-${formatPoints(value)}` : '0'
);

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

const Dashboard: React.FC = () => {
  const [leaderboard, setLeaderboard] = React.useState<IAgenteLeaderboard[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [errorMessage, setErrorMessage] = React.useState<string>('');
  const sharePointService = React.useMemo(() => new SharePointService(), []);
  const columns = React.useMemo(() => createColumns(), []);

  React.useEffect(() => {
    let isMounted = true;

    const loadDashboard = async (): Promise<void> => {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const { config, productividad, faltas, kudos } =
          await sharePointService.getDatosDashboard();
        const agents: Record<string, IAgenteAccumulator> = {};

        const getAgent = (agentName: string): IAgenteAccumulator => {
          if (!agents[agentName]) {
            agents[agentName] = {
              agente: agentName,
              puntosProductividad: 0,
              puntosKudos: 0,
              puntosRestados: 0
            };
          }

          return agents[agentName];
        };

        productividad.forEach((item) => {
          const agentName = item.Title?.trim();

          if (!agentName) {
            return;
          }

          const agent = getAgent(agentName);
          agent.puntosProductividad +=
            (toFiniteNumber(item.Casos) * toFiniteNumber(config.PesoCasos)) +
            (toFiniteNumber(item.Emisiones) * toFiniteNumber(config.PesoEmisiones)) +
            (toFiniteNumber(item.Movimientos) * toFiniteNumber(config.PesoMovimientos));
        });

        kudos.forEach((item) => {
          const agentName = item.Title?.trim();

          if (!agentName) {
            return;
          }

          getAgent(agentName).puntosKudos += toFiniteNumber(item.Puntos);
        });

        faltas.forEach((item) => {
          const agentName = item.Title?.trim();

          if (!agentName) {
            return;
          }

          getAgent(agentName).puntosRestados += getPenalty(item.Impacto, config);
        });

        const ranking = Object.keys(agents)
          .map((agentName): IAgenteLeaderboard => {
            const agent = agents[agentName];

            return {
              ...agent,
              puntajeTotal:
                agent.puntosProductividad +
                agent.puntosKudos -
                agent.puntosRestados
            };
          })
          .sort((first, second) => second.puntajeTotal - first.puntajeTotal);

        if (isMounted) {
          setLeaderboard(ranking);
        }
      } catch (error: unknown) {
        if (isMounted) {
          const detail = error instanceof Error
            ? error.message
            : 'Ocurrió un error inesperado al calcular el Dashboard.';
          setLeaderboard([]);
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
  }, [sharePointService]);

  if (isLoading) {
    return (
      <Stack className={styles.loading} horizontalAlign="center" verticalAlign="center">
        <Spinner
          label="Calculando empleado del mes..."
          size={SpinnerSize.large}
        />
      </Stack>
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

  if (leaderboard.length === 0) {
    return (
      <Stack className={styles.dashboard}>
        <MessageBar messageBarType={MessageBarType.info}>
          No hay datos operativos suficientes para calcular el ranking.
        </MessageBar>
      </Stack>
    );
  }

  const leader = leaderboard[0];

  return (
    <Stack className={styles.dashboard} tokens={{ childrenGap: 24 }}>
      <Stack>
        <Text variant="xxLarge">Dashboard de Cultura y Rendimiento</Text>
        <Text className={styles.subtitle}>
          Productividad ponderada, reconocimientos y penalidades acumuladas.
        </Text>
      </Stack>

      <Stack
        className={styles.leaderCard}
        horizontal
        verticalAlign="center"
        tokens={{ childrenGap: 24 }}
      >
        <Persona
          secondaryText="Mayor puntaje integral del equipo"
          size={PersonaSize.size100}
          text={leader.agente}
        />
        <Stack className={styles.heroContent} tokens={{ childrenGap: 6 }}>
          <Text className={styles.heroTitle}>🏆 Empleado del Mes</Text>
          <Text variant="xxLarge"><strong>{leader.agente}</strong></Text>
          <Text variant="xLarge">
            Puntaje Total: <strong>{formatPoints(leader.puntajeTotal)}</strong>
          </Text>
        </Stack>
      </Stack>

      <Stack className={styles.tableCard} tokens={{ childrenGap: 12 }}>
        <Text variant="xLarge">Ranking general</Text>
        <DetailsList
          columns={columns}
          getKey={(item: IAgenteLeaderboard) => item.agente}
          items={leaderboard}
          layoutMode={DetailsListLayoutMode.justified}
          selectionMode={SelectionMode.none}
        />
      </Stack>
    </Stack>
  );
};

export default Dashboard;
