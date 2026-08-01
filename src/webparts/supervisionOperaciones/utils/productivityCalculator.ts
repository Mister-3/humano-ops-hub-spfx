import { getWorkingDaysCount } from './workingDays';

export type ProductivityMetricKey =
  | 'Casos'
  | 'EmisionesTx'
  | 'EmisionesPg'
  | 'MovimientosTx'
  | 'MovimientosPg'
  | 'EscaneoTx'
  | 'EscaneoPg';

export type ProductivityProcess =
  | 'Casos'
  | 'Emisiones'
  | 'Movimientos'
  | 'Escaneo';

export type ProductivityGoalMode = 'fixed' | 'sla' | 'teamAverage';

export interface IProductivityAgentRecord {
  CasosAtendidos?: number;
  CasosATiempo?: number;
  /** Campo histórico anterior a v4.5; se usa solo como volumen atendido. */
  Casos?: number;
  EmisionesTx?: number;
  EmisionesPg?: number;
  MovimientosTx?: number;
  MovimientosPg?: number;
  EscaneoTx?: number;
  EscaneoPg?: number;
  /**
   * Campos heredados de v3.5. Se interpretan como Emisiones Tx y
   * Movimientos Pg cuando el registro no contiene actividad v4.
   */
  Emisiones?: number;
  Movimientos?: number;
  /** Indicador entregado por la capa de datos para distinguir SLA 0 de legado. */
  TieneDatosSLA?: boolean;
  /** Indicador interno utilizado al acumular varios registros por agente. */
  hasCaseSlaData?: boolean;
  /**
   * Permite declarar una métrica aplicable aunque su resultado sea cero.
   * Si se omite, la actividad positiva determina las métricas activas.
   */
  applicableMetrics?: ReadonlyArray<ProductivityMetricKey>;
}

export interface IProductivityPeriodRecord {
  FechaFin?: Date | string;
  FechaInicio?: Date | string;
  FechaRegistro?: Date | string;
}

export interface IProductivityCalculationConfig {
  MetaSlaCasos?: number;
  MetaEmisionesTx?: number;
  MetaMovimientosPg?: number;
  MetaEscaneoPg?: number;
  PesoCasos?: number;
  PesoEmisionesTx?: number;
  PesoEmisionesPg?: number;
  PesoMovimientosTx?: number;
  PesoMovimientosPg?: number;
  PesoEscaneoTx?: number;
  PesoEscaneoPg?: number;
  /** Compatibilidad con la configuración anterior a v4.0. */
  MetaDiaria?: number;
  PesoEmisiones?: number;
  PesoMovimientos?: number;
}

export type ITeamMetricAverages = Partial<
  Record<ProductivityMetricKey, number>
>;

export interface IProductivityMetricBreakdown {
  active: boolean;
  actualValue: number;
  compliancePercentage: number;
  goalMode: ProductivityGoalMode;
  metric: ProductivityMetricKey;
  process: ProductivityProcess;
  targetValue: number;
  weight: number;
  weightedContribution: number;
}

export interface IProductivityProcessBreakdown {
  activeWeight: number;
  metrics: IProductivityMetricBreakdown[];
  process: ProductivityProcess;
  productivityPercentage: number;
}

export interface IAgentProductivityResult {
  activeMetrics: ProductivityMetricKey[];
  activeWeight: number;
  metrics: IProductivityMetricBreakdown[];
  processes: IProductivityProcessBreakdown[];
  productivityPercentage: number;
}

interface IMetricDefinition {
  goalMode: ProductivityGoalMode;
  key: ProductivityMetricKey;
  process: ProductivityProcess;
}

export const PRODUCTIVITY_METRIC_KEYS: ReadonlyArray<ProductivityMetricKey> = [
  'Casos',
  'EmisionesTx',
  'EmisionesPg',
  'MovimientosTx',
  'MovimientosPg',
  'EscaneoTx',
  'EscaneoPg'
];

export const DEFAULT_PRODUCTIVITY_WEIGHTS: Readonly<
  Record<ProductivityMetricKey, number>
> = {
  Casos: 20,
  EmisionesTx: 15,
  EmisionesPg: 10,
  MovimientosTx: 15,
  MovimientosPg: 15,
  EscaneoTx: 10,
  EscaneoPg: 15
};

export const DEFAULT_DAILY_PRODUCTIVITY_GOALS = {
  MetaEmisionesTx: 10,
  MetaMovimientosPg: 350,
  MetaEscaneoPg: 350
} as const;

export const DEFAULT_CASE_SLA_GOAL_PERCENTAGE = 90;

const METRIC_DEFINITIONS: ReadonlyArray<IMetricDefinition> = [
  { key: 'Casos', process: 'Casos', goalMode: 'sla' },
  { key: 'EmisionesTx', process: 'Emisiones', goalMode: 'fixed' },
  { key: 'EmisionesPg', process: 'Emisiones', goalMode: 'teamAverage' },
  { key: 'MovimientosTx', process: 'Movimientos', goalMode: 'teamAverage' },
  { key: 'MovimientosPg', process: 'Movimientos', goalMode: 'fixed' },
  { key: 'EscaneoTx', process: 'Escaneo', goalMode: 'teamAverage' },
  { key: 'EscaneoPg', process: 'Escaneo', goalMode: 'fixed' }
];

const PROCESS_ORDER: ReadonlyArray<ProductivityProcess> = [
  'Casos',
  'Emisiones',
  'Movimientos',
  'Escaneo'
];

const createProcessActivityMap = (
  values: Readonly<Record<ProductivityMetricKey, number>>
): Record<ProductivityProcess, boolean> => ({
  Casos: values.Casos > 0,
  Emisiones: values.EmisionesTx > 0 || values.EmisionesPg > 0,
  Movimientos: values.MovimientosTx > 0 || values.MovimientosPg > 0,
  Escaneo: values.EscaneoTx > 0 || values.EscaneoPg > 0
});

const toNonNegativeFinite = (value: unknown): number => (
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : 0
);

export const resolveCaseSlaGoalPercentage = (
  config: IProductivityCalculationConfig
): number => {
  const configuredGoal = config.MetaSlaCasos;

  return typeof configuredGoal === 'number' &&
    Number.isFinite(configuredGoal) &&
    configuredGoal > 0 &&
    configuredGoal <= 100
    ? configuredGoal
    : DEFAULT_CASE_SLA_GOAL_PERCENTAGE;
};

const getDirectMetricValue = (
  record: IProductivityAgentRecord,
  metric: ProductivityMetricKey
): number => toNonNegativeFinite(record[metric]);

export interface ICaseSlaValues {
  casosATiempo: number;
  casosAtendidos: number;
  hasSlaData: boolean;
  slaPercentage?: number;
}

/**
 * Resuelve los datos de SLA sin confundir un cero explícito con un registro
 * histórico que todavía no capturaba CasosATiempo.
 */
export const resolveCaseSlaValues = (
  record: IProductivityAgentRecord
): ICaseSlaValues => {
  const directCases = toNonNegativeFinite(record.CasosAtendidos);
  const legacyCases = toNonNegativeFinite(record.Casos);
  const casosAtendidos = directCases > 0 ? directCases : legacyCases;
  const hasExplicitOnTimeValue =
    typeof record.CasosATiempo === 'number' &&
    Number.isFinite(record.CasosATiempo) &&
    record.CasosATiempo >= 0;
  const hasSlaData = typeof record.hasCaseSlaData === 'boolean'
    ? record.hasCaseSlaData
    : typeof record.TieneDatosSLA === 'boolean'
      ? record.TieneDatosSLA
      : hasExplicitOnTimeValue;
  const casosATiempo = hasExplicitOnTimeValue
    ? record.CasosATiempo as number
    : 0;

  return {
    casosATiempo,
    casosAtendidos,
    hasSlaData,
    slaPercentage: hasSlaData && casosAtendidos > 0
      ? (casosATiempo / casosAtendidos) * 100
      : undefined
  };
};

/**
 * Normaliza un registro v4 o histórico a las siete métricas operativas.
 */
export const resolveProductivityMetricValues = (
  record: IProductivityAgentRecord
): Record<ProductivityMetricKey, number> => {
  const caseSla = resolveCaseSlaValues(record);
  const values: Record<ProductivityMetricKey, number> = {
    Casos: caseSla.casosAtendidos,
    EmisionesTx: getDirectMetricValue(record, 'EmisionesTx'),
    EmisionesPg: getDirectMetricValue(record, 'EmisionesPg'),
    MovimientosTx: getDirectMetricValue(record, 'MovimientosTx'),
    MovimientosPg: getDirectMetricValue(record, 'MovimientosPg'),
    EscaneoTx: getDirectMetricValue(record, 'EscaneoTx'),
    EscaneoPg: getDirectMetricValue(record, 'EscaneoPg')
  };

  if (
    values.EmisionesTx === 0 &&
    values.EmisionesPg === 0
  ) {
    values.EmisionesTx = toNonNegativeFinite(record.Emisiones);
  }

  if (
    values.MovimientosTx === 0 &&
    values.MovimientosPg === 0
  ) {
    values.MovimientosPg = toNonNegativeFinite(record.Movimientos);
  }

  return values;
};

const getWeight = (
  metric: ProductivityMetricKey,
  config: IProductivityCalculationConfig
): number => {
  const directWeightByMetric: Record<
    ProductivityMetricKey,
    number | undefined
  > = {
    Casos: config.PesoCasos,
    EmisionesTx: config.PesoEmisionesTx,
    EmisionesPg: config.PesoEmisionesPg,
    MovimientosTx: config.PesoMovimientosTx,
    MovimientosPg: config.PesoMovimientosPg,
    EscaneoTx: config.PesoEscaneoTx,
    EscaneoPg: config.PesoEscaneoPg
  };
  const directWeight = directWeightByMetric[metric];

  if (
    typeof directWeight === 'number' &&
    Number.isFinite(directWeight) &&
    directWeight >= 0
  ) {
    return directWeight;
  }

  if (
    (metric === 'EmisionesTx' || metric === 'EmisionesPg') &&
    typeof config.PesoEmisiones === 'number' &&
    Number.isFinite(config.PesoEmisiones) &&
    config.PesoEmisiones >= 0
  ) {
    return config.PesoEmisiones;
  }

  if (
    (metric === 'MovimientosTx' || metric === 'MovimientosPg') &&
    typeof config.PesoMovimientos === 'number' &&
    Number.isFinite(config.PesoMovimientos) &&
    config.PesoMovimientos >= 0
  ) {
    return config.PesoMovimientos;
  }

  return DEFAULT_PRODUCTIVITY_WEIGHTS[metric];
};

const getFixedDailyGoal = (
  metric: ProductivityMetricKey,
  config: IProductivityCalculationConfig
): number => {
  switch (metric) {
    case 'EmisionesTx':
      return toNonNegativeFinite(config.MetaEmisionesTx) ||
        DEFAULT_DAILY_PRODUCTIVITY_GOALS.MetaEmisionesTx;
    case 'MovimientosPg':
      return toNonNegativeFinite(config.MetaMovimientosPg) ||
        DEFAULT_DAILY_PRODUCTIVITY_GOALS.MetaMovimientosPg;
    case 'EscaneoPg':
      return toNonNegativeFinite(config.MetaEscaneoPg) ||
        DEFAULT_DAILY_PRODUCTIVITY_GOALS.MetaEscaneoPg;
    default:
      return 0;
  }
};

/**
 * Calcula promedios por métrica entre los colaboradores a quienes esa métrica
 * les aplica. Una actividad positiva en cualquier métrica de un proceso hace
 * aplicables sus métricas hermanas, incluyendo resultados en cero, sin mezclar
 * especialistas de procesos distintos.
 */
export const calculateTeamMetricAverages = (
  records: ReadonlyArray<IProductivityAgentRecord>
): ITeamMetricAverages => {
  const totals: Record<ProductivityMetricKey, number> = {
    Casos: 0,
    EmisionesTx: 0,
    EmisionesPg: 0,
    MovimientosTx: 0,
    MovimientosPg: 0,
    EscaneoTx: 0,
    EscaneoPg: 0
  };
  const counts: Record<ProductivityMetricKey, number> = {
    Casos: 0,
    EmisionesTx: 0,
    EmisionesPg: 0,
    MovimientosTx: 0,
    MovimientosPg: 0,
    EscaneoTx: 0,
    EscaneoPg: 0
  };

  records.forEach((record) => {
    const values = resolveProductivityMetricValues(record);
    const applicableMetrics = new Set(record.applicableMetrics || []);
    const processHasActivity = createProcessActivityMap(values);

    METRIC_DEFINITIONS.forEach((definition) => {
      const isApplicable =
        values[definition.key] > 0 ||
        applicableMetrics.has(definition.key) ||
        processHasActivity[definition.process];

      if (isApplicable) {
        totals[definition.key] += values[definition.key];
        counts[definition.key] += 1;
      }
    });
  });

  return PRODUCTIVITY_METRIC_KEYS.reduce<ITeamMetricAverages>(
    (averages, metric) => {
      averages[metric] = counts[metric] > 0
        ? totals[metric] / counts[metric]
        : 0;
      return averages;
    },
    {}
  );
};

const toValidDate = (value?: Date | string): Date | undefined => {
  if (!value) {
    return undefined;
  }

  const parsed = value instanceof Date
    ? new Date(value.getTime())
    : new Date(value);

  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

/**
 * Devuelve la proporción laborable de un registro que pertenece al período
 * consultado. Los rangos que cruzan meses se prorratean y los registros
 * históricos de fecha única conservan un factor 1 cuando están dentro.
 */
export const calculateProductivityOverlapFactor = (
  record: IProductivityPeriodRecord,
  periodStart: Date,
  periodEnd: Date
): number => {
  const normalizedPeriodStart = new Date(
    periodStart.getFullYear(),
    periodStart.getMonth(),
    periodStart.getDate()
  );
  const normalizedPeriodEnd = new Date(
    periodEnd.getFullYear(),
    periodEnd.getMonth(),
    periodEnd.getDate()
  );
  const recordStart = toValidDate(
    record.FechaInicio || record.FechaRegistro
  );
  const recordEnd = toValidDate(
    record.FechaFin || record.FechaInicio || record.FechaRegistro
  );

  if (
    !recordStart ||
    !recordEnd ||
    Number.isNaN(normalizedPeriodStart.getTime()) ||
    Number.isNaN(normalizedPeriodEnd.getTime()) ||
    normalizedPeriodStart.getTime() > normalizedPeriodEnd.getTime()
  ) {
    return 0;
  }

  const normalizedRecordStart = new Date(
    recordStart.getFullYear(),
    recordStart.getMonth(),
    recordStart.getDate()
  );
  const normalizedRecordEnd = new Date(
    recordEnd.getFullYear(),
    recordEnd.getMonth(),
    recordEnd.getDate()
  );

  if (
    normalizedRecordStart.getTime() > normalizedRecordEnd.getTime() ||
    normalizedRecordStart.getTime() > normalizedPeriodEnd.getTime() ||
    normalizedRecordEnd.getTime() < normalizedPeriodStart.getTime()
  ) {
    return 0;
  }

  const overlapStart = new Date(Math.max(
    normalizedRecordStart.getTime(),
    normalizedPeriodStart.getTime()
  ));
  const overlapEnd = new Date(Math.min(
    normalizedRecordEnd.getTime(),
    normalizedPeriodEnd.getTime()
  ));
  const recordWorkingDays = getWorkingDaysCount(
    normalizedRecordStart,
    normalizedRecordEnd
  );
  const overlapWorkingDays = getWorkingDaysCount(overlapStart, overlapEnd);

  if (recordWorkingDays <= 0 || overlapWorkingDays <= 0) {
    return 0;
  }

  return Math.min(1, overlapWorkingDays / recordWorkingDays);
};

/**
 * Evalúa productividad con pesos normalizados sobre las métricas realmente
 * activas. Un especialista y un colaborador mixto conservan así una escala
 * comparable de cumplimiento porcentual. Una métrica con meta fija o
 * benchmark colectivo también se considera aplicable cuando existe actividad
 * en otra métrica de su mismo proceso.
 */
export const calculateAgentProductivity = (
  agentRecord: IProductivityAgentRecord,
  config: IProductivityCalculationConfig,
  teamAverages: ITeamMetricAverages,
  workingDays: number
): IAgentProductivityResult => {
  const metricValues = resolveProductivityMetricValues(agentRecord);
  const caseSla = resolveCaseSlaValues(agentRecord);
  const caseSlaGoal = resolveCaseSlaGoalPercentage(config);
  const applicableMetrics = new Set(agentRecord.applicableMetrics || []);
  const safeWorkingDays = Number.isFinite(workingDays) && workingDays > 0
    ? workingDays
    : 0;
  const processHasActivity = createProcessActivityMap(metricValues);

  const metrics = METRIC_DEFINITIONS.map(
    (definition): IProductivityMetricBreakdown => {
      const isCaseSla = definition.goalMode === 'sla';
      const actualValue = isCaseSla
        ? caseSla.slaPercentage || 0
        : metricValues[definition.key];
      const weight = getWeight(definition.key, config);
      const targetValue = isCaseSla
        ? caseSlaGoal
        : definition.goalMode === 'fixed'
          ? getFixedDailyGoal(definition.key, config) * safeWorkingDays
          : toNonNegativeFinite(teamAverages[definition.key]);
      const active = isCaseSla
        ? caseSla.hasSlaData && caseSla.casosAtendidos > 0
        : actualValue > 0 ||
          applicableMetrics.has(definition.key) ||
          (
            processHasActivity[definition.process] &&
            targetValue > 0
          );
      const compliancePercentage = !active || targetValue <= 0
        ? 0
        : isCaseSla
          ? actualValue < targetValue
            ? actualValue
            : Math.max(100, actualValue)
          : (actualValue / targetValue) * 100;

      return {
        active,
        actualValue,
        compliancePercentage,
        goalMode: definition.goalMode,
        metric: definition.key,
        process: definition.process,
        targetValue,
        weight,
        weightedContribution: active
          ? compliancePercentage * weight
          : 0
      };
    }
  );

  const activeMetrics = metrics.filter((metric) => metric.active);
  const activeWeight = activeMetrics.reduce(
    (total, metric) => total + metric.weight,
    0
  );
  const productivityPercentage = activeWeight > 0
    ? activeMetrics.reduce(
      (total, metric) => total + metric.weightedContribution,
      0
    ) / activeWeight
    : 0;
  const processes = PROCESS_ORDER.map(
    (process): IProductivityProcessBreakdown => {
      const processMetrics = metrics.filter(
        (metric) => metric.process === process
      );
      const activeProcessMetrics = processMetrics.filter(
        (metric) => metric.active
      );
      const processWeight = activeProcessMetrics.reduce(
        (total, metric) => total + metric.weight,
        0
      );

      return {
        activeWeight: processWeight,
        metrics: processMetrics,
        process,
        productivityPercentage: processWeight > 0
          ? activeProcessMetrics.reduce(
            (total, metric) => total + metric.weightedContribution,
            0
          ) / processWeight
          : 0
      };
    }
  );

  return {
    activeMetrics: activeMetrics.map((metric) => metric.metric),
    activeWeight,
    metrics,
    processes,
    productivityPercentage
  };
};
