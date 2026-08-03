import * as React from 'react';
import {
  DatePicker,
  Icon,
  MessageBar,
  MessageBarType,
  Persona,
  PersonaSize,
  PrimaryButton,
  Stack,
  Text
} from '@fluentui/react';

import AgentComboBox from '../AgentSelector/AgentComboBox';
import SkeletonLoader from '../Common/SkeletonLoader';
import { getKudoMedalDefinition } from '../Dashboard/KudoMedals';
import type { RoleType } from '../../models/AppModels';
import type { IDirectReport } from '../../services/GraphService';
import SharePointService, {
  isFaltaApprovedForScoring,
  type IConfiguracionMetricas,
  type IEvaluacionFaltaItem,
  type IEvaluacionKudoItem,
  type IEvaluacionProductividadItem
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
const ALL_AGENTS_SCOPE_OPTIONS = [{
  key: ALL_AGENTS_KEY,
  text: 'Todos los Agentes'
}] as const;

const PRODUCTIVITY_METRIC_LABELS: Readonly<
  Record<ProductivityMetricKey, string>
> = {
  Casos: 'SLA Casos',
  EmisionesTx: 'Emisiones Tx',
  EmisionesPg: 'Emisiones Pg',
  MovimientosTx: 'Movimientos Tx',
  MovimientosPg: 'Movimientos Pg',
  EscaneoTx: 'Escaneo Tx',
  EscaneoPg: 'Escaneo Pg'
};

type KudoAttribute = typeof KUDO_ATTRIBUTES[number];

interface IApprovedFaltaAlertDetail {
  categoria: string;
  impacto: string;
}

interface IAgentAccumulator {
  agente: string;
  agenteEmail: string;
  agenteObjectId: string;
  faltasAprobadas: IApprovedFaltaAlertDetail[];
  metricasProductividad: IProductivityAgentRecord;
  puntosProductividad: number;
  puntosKudos: number;
  puntosRestados: number;
  hasProductividad: boolean;
}

interface IKudoLeader {
  atributo: KudoAttribute;
  agente?: string;
  puntos: number;
}

interface IProductivityRankingItem {
  agente: string;
  casosATiempo: number;
  casosAtendidos: number;
  metricas: ReadonlyArray<IProductivityMetricBreakdown>;
  puntajeTotal: number;
  puntosKudos: number;
  puntosRestados: number;
}

interface IAgentAlert {
  agente: string;
  cantidadFaltas: number;
  motivo: string;
  puntosProductividad: number;
  puntosKudos: number;
  puntosRestados: number;
  recomendacion: string;
  desviacionProductividad: number;
  desviacionKudos: number;
  bajoProductividad: boolean;
  bajoKudos: boolean;
  hasPenaltyRisk: boolean;
  isCritical: boolean;
}

interface IAnalyticsResult {
  alertas: IAgentAlert[];
  casosATiempo: number;
  casosAtendidos: number;
  diasLaborables: number;
  kudosLeaders: IKudoLeader[];
  metaEmisiones: number;
  metaMovimientos: number;
  metaEscaneo: number;
  metaSlaCasos: number;
  promedioKudos: number;
  promedioProductividad: number;
  rankingProductividad: IProductivityRankingItem[];
  slaCasos?: number;
  totalAgentes: number;
}

const getInitialStartDate = (): Date => {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), 1);
};

const normalizeText = (value: string): string => value
  .trim()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase();

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

const getPenaltyForImpact = (
  impact: string | undefined,
  config: IConfiguracionMetricas
): number => {
  switch (normalizeText(impact || '')) {
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
  item: IEvaluacionProductividadItem,
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

const getDeviation = (value: number, average: number): number => {
  if (average <= 0 || value >= average) {
    return 0;
  }

  return ((average - value) / average) * 100;
};

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
  faltas: ReadonlyArray<IEvaluacionFaltaItem>,
  config: IConfiguracionMetricas,
  rosterReports: ReadonlyArray<IDirectReport>,
  workingDays: number,
  periodStart: Date,
  periodEnd: Date,
  benchmarkProductividad: ReadonlyArray<IEvaluacionProductividadItem>,
  benchmarkKudos: ReadonlyArray<IEvaluacionKudoItem>,
  benchmarkRosterReports: ReadonlyArray<IDirectReport>
): IAnalyticsResult => {
  const agents = new Map<string, IAgentAccumulator>();
  const benchmarkAgents = new Map<string, IAgentAccumulator>();
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
    agentObjectId?: string,
    targetAgents: Map<string, IAgentAccumulator> = agents
  ): IAgentAccumulator => {
    const key = getIdentityKey(agentName, agentEmail, agentObjectId);
    const existingAgent = targetAgents.get(key);

    if (existingAgent) {
      return existingAgent;
    }

    if (!agentEmail?.trim() && !agentObjectId?.trim()) {
      const legacyAgent = Array.from(targetAgents.values()).find(
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
      faltasAprobadas: [],
      metricasProductividad: createEmptyProductivityRecord(),
      puntosProductividad: 0,
      puntosKudos: 0,
      puntosRestados: 0,
      hasProductividad: false
    };
    targetAgents.set(key, newAgent);
    return newAgent;
  };

  rosterReports.forEach((report) => {
    if (report.name.trim()) {
      getAgent(report.name, report.email, report.id);
    }
  });
  benchmarkRosterReports.forEach((report) => {
    if (report.name.trim()) {
      getAgent(report.name, report.email, report.id, benchmarkAgents);
    }
  });

  productividad.forEach((item) => {
    const agentName = item.Title?.trim() || item.AgenteEmail?.trim();
    const overlapFactor = calculateProductivityOverlapFactor(
      item,
      periodStart,
      periodEnd
    );

    if (!agentName || overlapFactor <= 0) {
      return;
    }

    const agent = getAgent(
      agentName,
      item.AgenteEmail,
      item.AgenteObjectID
    );
    agent.hasProductividad = true;
    addProductivityRecord(
      agent.metricasProductividad,
      item,
      overlapFactor
    );
  });

  benchmarkProductividad.forEach((item) => {
    const agentName = item.Title?.trim() || item.AgenteEmail?.trim();
    const overlapFactor = calculateProductivityOverlapFactor(
      item,
      periodStart,
      periodEnd
    );

    if (!agentName || overlapFactor <= 0) {
      return;
    }

    const agent = getAgent(
      agentName,
      item.AgenteEmail,
      item.AgenteObjectID,
      benchmarkAgents
    );
    agent.hasProductividad = true;
    addProductivityRecord(
      agent.metricasProductividad,
      item,
      overlapFactor
    );
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

  faltas.forEach((item) => {
    const agentName = item.Title?.trim() || item.AgenteEmail?.trim();

    if (
      !agentName ||
      !isFaltaApprovedForScoring(item.EstadoAprobacion) ||
      normalizeText(item.Categoria || '') === 'capacitacion'
    ) {
      return;
    }

    const agent = getAgent(
      agentName,
      item.AgenteEmail,
      item.AgenteObjectID
    );
    agent.puntosRestados += getPenaltyForImpact(item.Impacto, config);
    agent.faltasAprobadas.push({
      categoria: item.Categoria?.trim() || 'Falta operativa',
      impacto: item.Impacto?.trim() || 'Sin nivel informado'
    });
  });

  benchmarkKudos.forEach((item) => {
    const agentName = item.Title?.trim() || item.AgenteEmail?.trim();

    if (!agentName) {
      return;
    }

    getAgent(
      agentName,
      item.AgenteEmail,
      item.AgenteObjectID,
      benchmarkAgents
    ).puntosKudos += toFiniteNumber(item.Puntos);
  });

  const agentMetrics = Array.from(agents.values());
  const benchmarkAgentMetrics = Array.from(benchmarkAgents.values());
  const teamAverages = calculateTeamMetricAverages(
    benchmarkAgentMetrics
      .filter((agent) => agent.hasProductividad)
      .map((agent) => agent.metricasProductividad)
  );

  benchmarkAgentMetrics.forEach((agent) => {
    agent.puntosProductividad = calculateAgentProductivity(
      agent.metricasProductividad,
      config,
      teamAverages,
      workingDays
    ).productivityPercentage;
  });

  agentMetrics.forEach((agent) => {
    const productivityResult = calculateAgentProductivity(
      agent.metricasProductividad,
      config,
      teamAverages,
      workingDays
    );

    agent.puntosProductividad = productivityResult.productivityPercentage;
  });

  const totalAgentes = agentMetrics.length;
  const caseSlaTotals = agentMetrics.reduce(
    (totals, agent) => {
      const caseSla = resolveCaseSlaValues(agent.metricasProductividad);

      if (caseSla.hasSlaData && caseSla.casosAtendidos > 0) {
        totals.casosAtendidos += caseSla.casosAtendidos;
        totals.casosATiempo += caseSla.casosATiempo;
      }

      return totals;
    },
    { casosATiempo: 0, casosAtendidos: 0 }
  );
  const slaCasos = caseSlaTotals.casosAtendidos > 0
    ? (caseSlaTotals.casosATiempo / caseSlaTotals.casosAtendidos) * 100
    : undefined;
  const metaSlaCasos = resolveCaseSlaGoalPercentage(config);
  const totalBenchmarkAgents = benchmarkAgentMetrics.length;
  const promedioProductividad = totalBenchmarkAgents > 0
    ? benchmarkAgentMetrics.reduce(
      (total, agent) => total + agent.puntosProductividad,
      0
    ) / totalBenchmarkAgents
    : 0;
  const promedioKudos = totalBenchmarkAgents > 0
    ? benchmarkAgentMetrics.reduce(
      (total, agent) => total + agent.puntosKudos,
      0
    ) / totalBenchmarkAgents
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
      const hasMediumOrSevereFault = agent.faltasAprobadas.some((fault) => {
        const impact = normalizeText(fault.impacto);
        return impact === 'medio' || impact === 'grave' || impact === 'critico';
      });
      const hasSevereFault = agent.faltasAprobadas.some((fault) => {
        const impact = normalizeText(fault.impacto);
        return impact === 'grave' || impact === 'critico';
      });
      const hasPenaltyRisk = agent.puntosRestados > 0 ||
        hasMediumOrSevereFault;
      const isRecurring = agent.faltasAprobadas.length >= 2;
      const categories = Array.from(new Set(
        agent.faltasAprobadas.map((fault) => fault.categoria)
      ));
      const faultReason = categories.length > 0
        ? `Acumulación de penalizaciones por ${categories.join(' / ')}.`
        : 'Desviación frente a los indicadores promedio del área.';

      return {
        agente: agent.agente,
        cantidadFaltas: agent.faltasAprobadas.length,
        motivo: faultReason,
        puntosProductividad: agent.puntosProductividad,
        puntosKudos: agent.puntosKudos,
        puntosRestados: agent.puntosRestados,
        recomendacion: hasSevereFault || isRecurring
          ? 'Priorizar revisión y documentar un plan de acción con el colaborador.'
          : hasPenaltyRisk
            ? 'Programar seguimiento preventivo y reforzar el procedimiento aplicable.'
            : 'Revisar la distribución de trabajo y acordar acciones de mejora.',
        desviacionProductividad,
        desviacionKudos,
        bajoProductividad,
        bajoKudos,
        hasPenaltyRisk,
        isCritical:
          hasSevereFault ||
          isRecurring ||
          (bajoProductividad && bajoKudos) ||
          Math.max(desviacionProductividad, desviacionKudos) >= 50
      };
    })
    .filter((agent) =>
      agent.bajoProductividad ||
      agent.bajoKudos ||
      agent.hasPenaltyRisk
    )
    .sort((left, right) => {
      const criticalDifference = Number(right.isCritical) -
        Number(left.isCritical);

      if (criticalDifference !== 0) {
        return criticalDifference;
      }

      if (right.puntosRestados !== left.puntosRestados) {
        return right.puntosRestados - left.puntosRestados;
      }

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

  const rankingAgents = agentMetrics.filter(
    (agent) => agent.hasProductividad
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
    workingDays
  );
  const metaEmisiones =
    getMetricResult(goalReference, 'EmisionesTx')?.targetValue || 0;
  const metaMovimientos =
    getMetricResult(goalReference, 'MovimientosPg')?.targetValue || 0;
  const metaEscaneo =
    getMetricResult(goalReference, 'EscaneoPg')?.targetValue || 0;
  const rankingProductividad = rankingAgents
    .map((agent): IProductivityRankingItem => {
      const result = calculateAgentProductivity(
        agent.metricasProductividad,
        config,
        teamAverages,
        workingDays
      );

      const caseSlaValues = resolveCaseSlaValues(
        agent.metricasProductividad
      );
      const puntajeTotal = result.productivityPercentage;

      return {
        agente: agent.agente,
        casosATiempo: caseSlaValues.casosATiempo,
        casosAtendidos: caseSlaValues.casosAtendidos,
        metricas: result.metrics.filter((metric) => metric.active),
        puntajeTotal,
        puntosKudos: agent.puntosKudos,
        puntosRestados: agent.puntosRestados
      };
    })
    .sort((left, right) => right.puntajeTotal - left.puntajeTotal);

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
    casosATiempo: caseSlaTotals.casosATiempo,
    casosAtendidos: caseSlaTotals.casosAtendidos,
    diasLaborables: workingDays,
    kudosLeaders,
    metaEmisiones,
    metaMovimientos,
    metaEscaneo,
    metaSlaCasos,
    promedioKudos,
    promedioProductividad,
    rankingProductividad,
    slaCasos,
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
  const canViewPreventiveAlerts = userRole === 'Supervisor' ||
    userRole === 'Gerente' || userRole === 'Admin' || userRole === 'Master_Admin';
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
      const scopedFaltas = filterByScope(
        data.faltas,
        effectiveReports,
        hasGlobalQuery
      );
      const benchmarkProductivity = filterByScope(
        data.productividad,
        availableReports,
        hasGlobalScope
      );
      const benchmarkKudos = filterByScope(
        data.kudos,
        availableReports,
        hasGlobalScope
      );

      setAnalytics(calculateAnalytics(
        scopedProductivity,
        scopedKudos,
        scopedFaltas,
        data.config,
        hasGlobalQuery ? [] : effectiveReports,
        getWorkingDaysCount(startDate, endDate),
        startDate,
        endDate,
        benchmarkProductivity,
        benchmarkKudos,
        hasGlobalScope ? [] : availableReports
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
        <Text className={styles.subtitle}>
          Índice porcentual ponderado de productividad y cultura corporativa.
        </Text>
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
        <div className={styles.agentField}>
          <AgentComboBox
            agents={availableReports}
            disabled={isLoading}
            label="Seleccionar Agente"
            onAgentChange={(agent) => {
              if (!agent) {
                return;
              }

              setSelectedAgentKey(getReportKey(agent));
              setAnalytics(undefined);
              setHasProcessed(false);
            }}
            onScopeChange={(scopeKey) => {
              if (scopeKey !== ALL_AGENTS_KEY) {
                return;
              }

              setSelectedAgentKey(ALL_AGENTS_KEY);
              setAnalytics(undefined);
              setHasProcessed(false);
            }}
            placeholder="Escriba un nombre o correo"
            scopeOptions={ALL_AGENTS_SCOPE_OPTIONS}
            selectedAgent={selectedReport}
            selectedScopeKey={
              selectedAgentKey === ALL_AGENTS_KEY
                ? ALL_AGENTS_KEY
                : undefined
            }
          />
        </div>
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
                  El rango equivale a {analytics.diasLaborables} jornadas:
                  lunes a viernes completos, sábados a 0.5 y domingos a 0.
                </p>
              </div>
            </div>

            <div className={styles.goalsGrid}>
              <article className={styles.goalCard}>
                <span>Días laborables</span>
                <strong>{analytics.diasLaborables}</strong>
                <small>Sábados equivalen a media jornada</small>
              </article>
              <article className={styles.goalCard}>
                <span>SLA de Casos</span>
                <strong>
                  {analytics.slaCasos === undefined
                    ? 'N/A'
                    : formatPercentage(analytics.slaCasos)}
                </strong>
                <small>
                  {analytics.slaCasos === undefined
                    ? `SLA: N/A (Meta: ${formatPercentage(
                      analytics.metaSlaCasos
                    )} · 0/0 casos). El peso se redistribuye.`
                    : `SLA: ${formatPercentage(
                      analytics.slaCasos
                    )} (Meta: ${formatPercentage(
                      analytics.metaSlaCasos
                    )} · ${formatNumber(
                      analytics.casosATiempo
                    )} / ${formatNumber(
                      analytics.casosAtendidos
                    )} casos)`}
                </small>
              </article>
              <article className={styles.goalCard}>
                <span>Meta de Emisiones Tx</span>
                <strong>{formatNumber(analytics.metaEmisiones)}</strong>
                <small>Transacciones del período</small>
              </article>
              <article className={styles.goalCard}>
                <span>Meta de Movimientos Pg</span>
                <strong>{formatNumber(analytics.metaMovimientos)}</strong>
                <small>Páginas del período</small>
              </article>
              <article className={styles.goalCard}>
                <span>Meta de Escaneo Pg</span>
                <strong>{formatNumber(analytics.metaEscaneo)}</strong>
                <small>Páginas del período</small>
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
                    <Icon
                      className={styles.kudoAttributeIcon}
                      iconName={
                        getKudoMedalDefinition(leader.atributo).iconName
                      }
                    />
                    <span>{leader.atributo}</span>
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

          {canViewPreventiveAlerts ? (
          <section className={`${styles.sectionCard} ${styles.alertSection}`}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.sectionEyebrow}>
                  Detección preventiva
                </span>
                <h3>Alertas tempranas del período</h3>
                <p className={styles.sectionDescription}>
                  Promedio del índice de productividad: {
                    formatPercentage(analytics.promedioProductividad)
                  } · Promedio Kudos: {formatNumber(analytics.promedioKudos)}.
                  Incluye únicamente faltas aprobadas.
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
                          {formatPercentage(alert.puntosProductividad)}
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

                      <div className={styles.metricBlock}>
                        <span className={styles.metricLabel}>
                          Penalizaciones aprobadas
                        </span>
                        <strong className={styles.penaltyMetricValue}>
                          -{formatNumber(alert.puntosRestados)} pts
                        </strong>
                        <span>
                          {alert.cantidadFaltas} falta{
                            alert.cantidadFaltas === 1 ? '' : 's'
                          } en el período
                        </span>
                      </div>
                    </div>

                    <div className={styles.alertReason}>
                      <strong>{alert.motivo}</strong>
                      <span>{alert.recomendacion}</span>
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
                No se detectaron desviaciones ni penalizaciones aprobadas que
                requieran seguimiento en este período.
              </MessageBar>
            )}
          </section>
          ) : null}

          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.sectionEyebrow}>
                  Rendimiento operativo
                </span>
                <h3>Ranking de Productividad Acumulada</h3>
                <p className={styles.sectionDescription}>
                  Puntaje final basado exclusivamente en la productividad
                  normalizada. Kudos y penalidades se muestran como referencia.
                </p>
              </div>
            </div>

            {analytics.rankingProductividad.length > 0 ? (
              <div className={styles.rankingList}>
                <div className={styles.rankingHeader} aria-hidden="true">
                  <span>Posición y Agente</span>
                  <span>Cumplimiento de Metas (Detalle de Métricas)</span>
                  <span>Kudos (+)</span>
                  <span>Penalidades (-)</span>
                  <span>Puntaje Total</span>
                </div>
                {analytics.rankingProductividad.map((item, index) => (
                  <div className={styles.rankingRow} key={item.agente}>
                    <span className={styles.rankingName}>
                      <strong>#{index + 1}</strong> {item.agente}
                    </span>
                    <span className={styles.complianceGroup}>
                      {item.metricas.length === 0 ? (
                        <span className={styles.compliancePending}>
                          Sin métricas activas
                        </span>
                      ) : item.metricas.map((metric) => (
                        <span
                          className={
                            `${
                              metric.compliancePercentage >= 100
                                ? styles.complianceMet
                                : styles.compliancePending
                            } ${
                              metric.metric === 'Casos'
                                ? styles.slaMetricBadge
                                : ''
                            }`
                          }
                          key={metric.metric}
                        >
                          {metric.metric === 'Casos'
                            ? `SLA: ${formatPercentage(
                              item.casosAtendidos > 0
                                ? (item.casosATiempo /
                                  item.casosAtendidos) * 100
                                : 0
                            )} (Meta: ${formatPercentage(
                              analytics.metaSlaCasos
                            )} · ${formatNumber(
                              item.casosATiempo
                            )}/${formatNumber(
                              item.casosAtendidos
                            )} casos)`
                            : `${PRODUCTIVITY_METRIC_LABELS[metric.metric]} ${
                              formatNumber(metric.actualValue)
                            } · ${formatPercentage(
                              metric.compliancePercentage
                            )}`}
                        </span>
                      ))}
                    </span>
                    <span className={styles.rankingKudos}>
                      +{formatNumber(item.puntosKudos)} pts
                    </span>
                    <span className={styles.rankingPenalty}>
                      -{formatNumber(item.puntosRestados)} pts
                    </span>
                    <span className={styles.rankingValue}>
                      {formatPercentage(item.puntajeTotal)}
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
