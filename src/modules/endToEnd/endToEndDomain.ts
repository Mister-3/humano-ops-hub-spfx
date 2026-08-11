import type {
  EndToEndFlow,
  EndToEndSeverity,
  EndToEndStage,
  IEndToEndAnalyzedRow,
  IEndToEndClosure,
  IEndToEndCapabilities,
  IEndToEndGroup,
  IEndToEndNormalizedRow,
  IEndToEndReportAction,
  IEndToEndSlaResult
} from '../../types';

export const END_TO_END_TIME_ZONE = 'America/Santo_Domingo';
export const END_TO_END_SLA_MINUTES = 8 * 60;

export const DEFAULT_END_TO_END_CAPABILITIES: Readonly<IEndToEndCapabilities> = {
  canImport: true,
  canResolveConflicts: true,
  canManageCalendar: true,
  canExcludeRows: true,
  canMarkReported: true
};

export const DEFAULT_CANCELLATION_ALIASES: ReadonlyArray<string> = [
  'CANCELACION POLIZA INDIVIDUAL',
  'CANCELACION DE POLIZA INDIVIDUAL',
  'CANCELACION POLIZA COLECTIVA',
  'CANCELACION DE POLIZA COLECTIVA'
];

const ALWAYS_EXCLUDED_STATUSES = new Set([
  'recibido sin revisar',
  'devuelto',
  'cancelada'
]);

const OPEN_STATUS_WORDS = [
  'recibida',
  'entregado operaciones',
  'pendiente asignacion',
  'asignado',
  'en proceso'
];

const SEVERITY_SCORE: Record<EndToEndSeverity, number> = {
  gris: 0,
  verde: 1,
  amarillo: 2,
  naranja: 3,
  rojo: 4,
  error: 5
};

export const normalizeEndToEndText = (value: unknown): string => (
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase()
);

export const normalizeHeader = (value: unknown): string =>
  normalizeEndToEndText(value);

export const classifyEndToEndFlow = (
  tipoLote: string,
  descripcionNovedad: string,
  cancellationAliases: ReadonlyArray<string> = DEFAULT_CANCELLATION_ALIASES
): EndToEndFlow => {
  const tipo = normalizeEndToEndText(tipoLote);
  const novedad = normalizeEndToEndText(descripcionNovedad);
  const aliases = cancellationAliases.map(normalizeEndToEndText);

  if (aliases.some((alias) => tipo === alias || novedad === alias)) {
    return 'cancelacion';
  }
  if (tipo.includes('emision')) {
    return 'emision';
  }
  return 'movimiento';
};

export const isApiEmissionUser = (value: string): boolean =>
  normalizeEndToEndText(value) === 'api emision usr';

export const isExcludedEndToEndStatus = (
  value: string,
  hasRequiredFinalDates = true
): boolean => {
  const normalized = normalizeEndToEndText(value);
  return ALWAYS_EXCLUDED_STATUSES.has(normalized) ||
    (normalized === 'completada' && hasRequiredFinalDates);
};

const LOCAL_OFFSET_MS = 4 * 60 * 60 * 1000;

const localParts = (date: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} => {
  const shifted = new Date(date.getTime() - LOCAL_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds()
  };
};

const dateKeyFromParts = (year: number, month: number, day: number): string =>
  `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export const createSantoDomingoDate = (
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0
): Date => new Date(Date.UTC(year, month - 1, day, hour + 4, minute, second));

export const parseSantoDomingoLocalInput = (value: string): Date | undefined => {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return undefined;
  const [, year, month, day, hour, minute] = match;
  const result = createSantoDomingoDate(
    Number(year), Number(month), Number(day), Number(hour), Number(minute)
  );
  const parts = localParts(result);
  return parts.year === Number(year) && parts.month === Number(month) &&
    parts.day === Number(day) && parts.hour === Number(hour) && parts.minute === Number(minute)
    ? result
    : undefined;
};

export const formatSantoDomingoLocalInput = (value: Date): string => {
  const parts = localParts(value);
  return `${dateKeyFromParts(parts.year, parts.month, parts.day)}T${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
};

export const parseRadicationDateTime = (
  dateValue: string,
  timeValue: string
): Date | undefined => {
  const dateMatch = dateValue.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const timeMatch = timeValue.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!dateMatch || !timeMatch) return undefined;

  const [, day, month, year] = dateMatch;
  const [, hour, minute, second = '0'] = timeMatch;
  const result = createSantoDomingoDate(
    Number(year), Number(month), Number(day),
    Number(hour), Number(minute), Number(second)
  );
  const parts = localParts(result);
  return parts.year === Number(year) && parts.month === Number(month) && parts.day === Number(day)
    ? result
    : undefined;
};

export const parseProcessDateTime = (value: string): Date | undefined => {
  const clean = value.trim();
  if (!clean || normalizeEndToEndText(clean) === 'n a') return undefined;
  const match = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return undefined;
  const [, month, day, year, hour, minute, second = '0'] = match;
  const result = createSantoDomingoDate(
    Number(year), Number(month), Number(day),
    Number(hour), Number(minute), Number(second)
  );
  const parts = localParts(result);
  return parts.year === Number(year) && parts.month === Number(month) && parts.day === Number(day)
    ? result
    : undefined;
};

export const parseGenerationDateTime = (value: string): Date | undefined => {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return undefined;
  const [, day, month, year, hour, minute, second = '0'] = match;
  return createSantoDomingoDate(
    Number(year), Number(month), Number(day),
    Number(hour), Number(minute), Number(second)
  );
};

interface IMinuteInterval {
  start: number;
  end: number;
}

const subtractInterval = (
  source: ReadonlyArray<IMinuteInterval>,
  blocked: IMinuteInterval
): IMinuteInterval[] => source.flatMap((interval) => {
  if (blocked.end <= interval.start || blocked.start >= interval.end) return [interval];
  const result: IMinuteInterval[] = [];
  if (blocked.start > interval.start) result.push({ start: interval.start, end: blocked.start });
  if (blocked.end < interval.end) result.push({ start: blocked.end, end: interval.end });
  return result;
});

const parseClockMinutes = (value?: string): number | undefined => {
  const match = value?.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return undefined;
  return Number(match[1]) * 60 + Number(match[2]);
};

const businessIntervals = (
  dateKey: string,
  closures: ReadonlyArray<IEndToEndClosure>
): IMinuteInterval[] => {
  const [year, month, day] = dateKey.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  let intervals: IMinuteInterval[] = weekday === 0
    ? []
    : weekday === 6
      ? [{ start: 9 * 60, end: 13 * 60 }]
      : [{ start: 8 * 60, end: 17 * 60 }];

  closures
    .filter((closure) => closure.active && closure.date === dateKey)
    .forEach((closure) => {
      if (closure.allDay) {
        intervals = [];
        return;
      }
      const start = parseClockMinutes(closure.startTime);
      const end = parseClockMinutes(closure.endTime);
      if (start !== undefined && end !== undefined && end > start) {
        intervals = subtractInterval(intervals, { start, end });
      }
    });
  return intervals;
};

const addLocalDays = (dateKey: string, amount: number): string => {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return dateKeyFromParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
};

const epochForLocalMinute = (dateKey: string, minute: number): number => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return createSantoDomingoDate(
    year, month, day, Math.floor(minute / 60), minute % 60
  ).getTime();
};

export const calculateBusinessMinutes = (
  start: Date,
  end: Date,
  closures: ReadonlyArray<IEndToEndClosure>
): number => {
  if (end.getTime() <= start.getTime()) return 0;
  const startParts = localParts(start);
  const endParts = localParts(end);
  let dateKey = dateKeyFromParts(startParts.year, startParts.month, startParts.day);
  const endKey = dateKeyFromParts(endParts.year, endParts.month, endParts.day);
  let total = 0;

  while (dateKey <= endKey) {
    businessIntervals(dateKey, closures).forEach((interval) => {
      const intervalStart = epochForLocalMinute(dateKey, interval.start);
      const intervalEnd = epochForLocalMinute(dateKey, interval.end);
      const overlapStart = Math.max(start.getTime(), intervalStart);
      const overlapEnd = Math.min(end.getTime(), intervalEnd);
      if (overlapEnd > overlapStart) total += (overlapEnd - overlapStart) / 60000;
    });
    dateKey = addLocalDays(dateKey, 1);
  }
  return Math.round(total);
};

export const addBusinessMinutes = (
  start: Date,
  minutes: number,
  closures: ReadonlyArray<IEndToEndClosure>
): Date => {
  const startParts = localParts(start);
  let dateKey = dateKeyFromParts(startParts.year, startParts.month, startParts.day);
  let cursor = start.getTime();
  let remaining = Math.max(0, minutes);

  for (let safety = 0; safety < 370 && remaining > 0; safety += 1) {
    for (const interval of businessIntervals(dateKey, closures)) {
      const intervalStart = epochForLocalMinute(dateKey, interval.start);
      const intervalEnd = epochForLocalMinute(dateKey, interval.end);
      const effectiveStart = Math.max(cursor, intervalStart);
      if (effectiveStart >= intervalEnd) continue;
      const available = Math.round((intervalEnd - effectiveStart) / 60000);
      if (remaining <= available) return new Date(effectiveStart + remaining * 60000);
      remaining -= available;
      cursor = intervalEnd;
    }
    dateKey = addLocalDays(dateKey, 1);
    cursor = epochForLocalMinute(dateKey, 0);
  }
  return new Date(cursor);
};

const resolveStage = (
  row: IEndToEndNormalizedRow,
  excluded: boolean
): EndToEndStage => {
  if (excluded) return 'Excluida / no aplicable';
  if (!row.radicacionAt) return 'Error de datos';
  if (row.flow === 'cancelacion') {
    return row.fechaEscaneo ? 'Completada para SLA' : 'Pendiente de escaneo';
  }
  if (!row.fechaEscaneo) return 'Pendiente de escaneo';
  if (!row.fechaAprobacion && !row.fechaSincronizado) return 'Pendiente de digitación/aprobación';
  if (row.fechaAprobacion && !row.fechaSincronizado) return 'Pendiente de sincronización';
  if (!row.fechaAprobacion && row.fechaSincronizado) return 'Inconsistencia / aprobación pendiente';
  return 'Completada para SLA';
};

const actionForStage = (stage: EndToEndStage, escalado: boolean): string => {
  const base: Record<EndToEndStage, string> = {
    'Pendiente de escaneo': 'Priorizar escaneo',
    'Pendiente de digitación/aprobación': 'Priorizar digitación y aprobación',
    'Pendiente de sincronización': 'Priorizar sincronización',
    'Inconsistencia / aprobación pendiente': 'Conciliar aprobación y sincronización',
    'Completada para SLA': 'Validar cierre operativo',
    'Excluida / no aplicable': 'Sin gestión SLA',
    'Error de datos': 'Corregir calidad de datos'
  };
  return escalado
    ? `${base[stage]}; notificar a supervisores y encargados`
    : base[stage];
};

const severityFor = (
  completed: boolean,
  consumedMinutes: number,
  excluded: boolean
): EndToEndSeverity => {
  if (excluded) return 'gris';
  if (completed) return consumedMinutes <= END_TO_END_SLA_MINUTES ? 'verde' : 'rojo';
  if (consumedMinutes >= END_TO_END_SLA_MINUTES) return 'rojo';
  if (consumedMinutes >= 6 * 60) return 'naranja';
  if (consumedMinutes >= 4 * 60) return 'amarillo';
  return 'verde';
};

export const calculateEndToEndSla = (
  row: IEndToEndNormalizedRow,
  generationAt: Date,
  closures: ReadonlyArray<IEndToEndClosure>,
  manuallyExcluded = false
): IEndToEndSlaResult => {
  const excluded = row.excludedByRule || row.apiEmissionExcluded || manuallyExcluded;
  const stage = resolveStage(row, excluded);
  const referenceAt = generationAt.toISOString();
  if (excluded) {
    return {
      referenceAt,
      completed: false,
      severity: 'gris',
      stage,
      action: actionForStage(stage, row.escalado),
      reconciliationRequired: false
    };
  }
  if (!row.radicacionAt) {
    return {
      referenceAt,
      completed: false,
      severity: 'error',
      stage: 'Error de datos',
      action: actionForStage('Error de datos', row.escalado),
      reconciliationRequired: false,
      dataError: 'Fecha u hora inicial inválida.'
    };
  }

  const start = new Date(row.radicacionAt);
  const finalDates = row.flow === 'cancelacion'
    ? [row.fechaEscaneo]
    : row.fechaAprobacion && row.fechaSincronizado
      ? [row.fechaAprobacion, row.fechaSincronizado]
      : [];
  const completed = finalDates.length > 0;
  const end = completed
    ? new Date(Math.max(...finalDates.map((value) => new Date(value as string).getTime())))
    : generationAt;
  if (end.getTime() < start.getTime()) {
    return {
      startAt: start.toISOString(),
      referenceAt,
      completed,
      severity: 'error',
      stage: 'Error de datos',
      action: actionForStage('Error de datos', row.escalado),
      reconciliationRequired: false,
      dataError: 'La fecha final es anterior a la radicación.'
    };
  }

  const consumedMinutes = calculateBusinessMinutes(start, end, closures);
  const deadline = addBusinessMinutes(start, END_TO_END_SLA_MINUTES, closures);
  const stateIsOpen = OPEN_STATUS_WORDS.some((status) =>
    normalizeEndToEndText(row.estadoRadicacion).includes(status)
  );
  const stateSaysCompleted = normalizeEndToEndText(row.estadoRadicacion) === 'completada';
  const reconciliationRequired = (completed && stateIsOpen) || (stateSaysCompleted && !completed);

  return {
    startAt: start.toISOString(),
    endAt: completed ? end.toISOString() : undefined,
    deadlineAt: deadline.toISOString(),
    referenceAt,
    consumedMinutes,
    remainingMinutes: END_TO_END_SLA_MINUTES - consumedMinutes,
    completed,
    compliant: completed ? consumedMinutes <= END_TO_END_SLA_MINUTES : undefined,
    severity: severityFor(completed, consumedMinutes, false),
    stage,
    action: actionForStage(stage, row.escalado),
    reconciliationRequired
  };
};

export const analyzeEndToEndRows = (
  rows: ReadonlyArray<IEndToEndNormalizedRow>,
  generationAt: Date,
  closures: ReadonlyArray<IEndToEndClosure>,
  exclusions: ReadonlyMap<number, string> = new Map()
): IEndToEndAnalyzedRow[] => rows.map((row) => ({
  ...row,
  manuallyExcluded: exclusions.has(row.rowNumber),
  exclusionReason: exclusions.get(row.rowNumber),
  sla: calculateEndToEndSla(row, generationAt, closures, exclusions.has(row.rowNumber))
}));

export const groupEndToEndRows = (
  rows: ReadonlyArray<IEndToEndAnalyzedRow>,
  reportedRadications: ReadonlySet<string> = new Set(),
  previousRadications: ReadonlySet<string> = new Set(),
  recurrentToday: ReadonlySet<string> = new Set()
): IEndToEndGroup[] => {
  const grouped = new Map<string, IEndToEndAnalyzedRow[]>();
  rows.forEach((row) => {
    const existing = grouped.get(row.radicacion) || [];
    existing.push(row);
    grouped.set(row.radicacion, existing);
  });

  return Array.from(grouped.entries()).map(([radicacion, groupRows]) => {
    const applicable = groupRows.filter((row) => row.sla.severity !== 'gris');
    const scoringRows = applicable.length > 0 ? applicable : groupRows;
    const worst = scoringRows.reduce((current, row) =>
      SEVERITY_SCORE[row.sla.severity] > SEVERITY_SCORE[current.sla.severity]
        ? row
        : current
    );
    const ends = applicable
      .map((row) => row.sla.endAt)
      .filter((value): value is string => Boolean(value));
    const primary = groupRows[0];
    return {
      radicacion,
      flow: primary.flow,
      rows: groupRows,
      pages: applicable.reduce((sum, row) => sum + row.pages, 0),
      severity: worst.sla.severity,
      stage: worst.sla.stage,
      action: worst.sla.action,
      consumedMinutes: worst.sla.consumedMinutes,
      remainingMinutes: worst.sla.remainingMinutes,
      completed: applicable.length > 0 && applicable.every((row) => row.sla.completed),
      effectiveEndAt: ends.length > 0
        ? new Date(Math.max(...ends.map((value) => new Date(value).getTime()))).toISOString()
        : undefined,
      tipoLote: primary.tipoLote,
      novedades: Array.from(new Set(groupRows.map((row) => row.descripcionNovedad).filter(Boolean))),
      radicacionAt: primary.radicacionAt,
      canal: primary.canal,
      modalidad: primary.modalidad,
      estadoRadicacion: primary.estadoRadicacion,
      estadoDistro: primary.estadoDistro,
      escalado: groupRows.some((row) => row.escalado),
      reconciliationRequired: groupRows.some((row) => row.sla.reconciliationRequired),
      hasDataError: groupRows.some((row) => Boolean(row.sla.dataError) || (row.dataWarnings?.length || 0) > 0),
      reincidenteHoy: recurrentToday.has(radicacion),
      vistaAnteriormente: previousRadications.has(radicacion),
      reported: reportedRadications.has(radicacion),
      director: primary.director,
      gerente: primary.gerente,
      poliza: primary.poliza,
      intermediario: primary.intermediario
    };
  }).sort((left, right) => {
    const severityDifference = SEVERITY_SCORE[right.severity] - SEVERITY_SCORE[left.severity];
    if (severityDifference !== 0) return severityDifference;
    const leftRemaining = left.remainingMinutes ?? Number.POSITIVE_INFINITY;
    const rightRemaining = right.remainingMinutes ?? Number.POSITIVE_INFINITY;
    if (leftRemaining !== rightRemaining) return leftRemaining - rightRemaining;
    return left.radicacion.localeCompare(right.radicacion, 'es', { numeric: true });
  });
};

export const formatSantoDomingoDateTime = (value?: string | Date): string => {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat('es-DO', {
    timeZone: END_TO_END_TIME_ZONE,
    dateStyle: 'short',
    timeStyle: 'short',
    hour12: true
  }).format(date);
};

export const getSantoDomingoDayKey = (value: string | Date): string => {
  const parts = localParts(value instanceof Date ? value : new Date(value));
  return dateKeyFromParts(parts.year, parts.month, parts.day);
};

export const resolveReportFreshness = (
  generationAt: string,
  now = new Date()
): { label: 'Actualizado' | 'Requiere actualización' | 'Fuera del ciclo'; minutes: number } => {
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(generationAt).getTime()) / 60000));
  return {
    minutes,
    label: minutes <= 30
      ? 'Actualizado'
      : minutes <= 120
        ? 'Requiere actualización'
        : 'Fuera del ciclo'
  };
};

export const resolveSnapshotStatus = (
  candidateGenerationAt: string,
  activeGenerationAt?: string
): 'active' | 'older' | 'conflict' => {
  if (!activeGenerationAt || candidateGenerationAt > activeGenerationAt) return 'active';
  if (candidateGenerationAt === activeGenerationAt) return 'conflict';
  return 'older';
};

export const getRetentionCutoff = (now = new Date()): string =>
  new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

export const resolveReportedRadications = (
  actions: ReadonlyArray<IEndToEndReportAction>,
  snapshotId: string
): Set<string> => {
  const reported = new Set<string>();
  actions
    .filter((action) => action.snapshotId === snapshotId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .forEach((action) => action.radicaciones.forEach((radicacion) => {
      if (action.action === 'copy_mark') reported.add(radicacion);
      if (action.action === 'undo_reported') reported.delete(radicacion);
    }));
  return reported;
};

export const resolveRecurrentToday = (
  activeSnapshotId: string,
  activeGenerationAt: string,
  activeRadications: ReadonlySet<string>,
  generationBySnapshot: ReadonlyMap<string, string>,
  actions: ReadonlyArray<IEndToEndReportAction>
): Set<string> => {
  const activeDay = getSantoDomingoDayKey(activeGenerationAt);
  const recurrent = new Set<string>();
  actions
    .filter((action) => action.action === 'copy_mark' && action.snapshotId !== activeSnapshotId)
    .filter((action) => {
      const generation = generationBySnapshot.get(action.snapshotId);
      return Boolean(
        generation &&
        generation < activeGenerationAt &&
        getSantoDomingoDayKey(action.createdAt) === activeDay
      );
    })
    .forEach((action) => action.radicaciones.forEach((radicacion) => {
      if (activeRadications.has(radicacion)) recurrent.add(radicacion);
    }));
  return recurrent;
};
