import type {
  IEndToEndIssue,
  IEndToEndNormalizedRow,
  IEndToEndParsedReport,
  IEndToEndRowSource
} from '../../types';
import {
  classifyEndToEndFlow,
  DEFAULT_CANCELLATION_ALIASES,
  isApiEmissionUser,
  isExcludedEndToEndStatus,
  normalizeEndToEndText,
  normalizeHeader,
  parseGenerationDateTime,
  parseProcessDateTime,
  parseRadicationDateTime
} from './endToEndDomain.ts';

type EndToEndColumnKey =
  | 'radicacion'
  | 'fechaRadicacion'
  | 'horaRadicacion'
  | 'usuarioRadicacion'
  | 'tipoLote'
  | 'descripcionNovedad'
  | 'estadoRadicacion'
  | 'fechaEscaneo'
  | 'fechaAprobacion'
  | 'fechaSincronizado'
  | 'escalado'
  | 'estadoDistro'
  | 'canal'
  | 'modalidad'
  | 'cantidadMovimientos'
  | 'cantidadFormularios';

const ESSENTIAL_COLUMNS: Record<EndToEndColumnKey, { label: string; aliases: string[] }> = {
  radicacion: { label: 'Radicación', aliases: ['Radicación'] },
  fechaRadicacion: { label: 'Fecha Radicación', aliases: ['Fecha Radicación'] },
  horaRadicacion: { label: 'Hora Radicación', aliases: ['Hora Radicación'] },
  usuarioRadicacion: { label: 'Usuario Radicación', aliases: ['Usuario Radicación'] },
  tipoLote: { label: 'Tipo de Lote', aliases: ['Tipo de Lote'] },
  descripcionNovedad: { label: 'Descripción Novedad', aliases: ['Descripción Novedad'] },
  estadoRadicacion: { label: 'Estado Radicación', aliases: ['Estado Radicación'] },
  fechaEscaneo: { label: 'Fecha Escaneo', aliases: ['Fecha Escaneo'] },
  fechaAprobacion: { label: 'Fecha Aprobación', aliases: ['Fecha Aprobación'] },
  fechaSincronizado: { label: 'Fecha Sincronizado', aliases: ['Fecha Sincronizado'] },
  escalado: { label: 'Escalado', aliases: ['Escalado'] },
  estadoDistro: { label: 'ESTADO DISTRO', aliases: ['ESTADO DISTRO', 'Estado Distro'] },
  canal: { label: 'Canal', aliases: ['Canal'] },
  modalidad: { label: 'Modalidad Solicitud', aliases: ['Modalidad Solicitud'] },
  cantidadMovimientos: { label: 'Cantidad Movimientos', aliases: ['Cantidad Movimientos'] },
  cantidadFormularios: { label: 'Cantidad Formularios', aliases: ['Cantidad Formularios'] }
};

const OPTIONAL_COLUMNS: Record<string, string[]> = {
  compania: ['Compañía'],
  director: ['Director'],
  gerente: ['Gerente'],
  intermediario: ['Intermediario'],
  localidad: ['Localidad'],
  poliza: ['Póliza'],
  fechaEntradaCola: ['Fecha Entrada Cola'],
  fechaAsignacion: ['Fecha Asignación'],
  fechaEscalado: ['Fecha Escalado'],
  fechaDevolucion: ['Fecha Devolución'],
  fechaRechazado: ['Fecha Rechazado']
};

const KNOWN_STATES = new Set([
  'recibida',
  'entregado operaciones',
  'pendiente asignacion',
  'asignado',
  'en proceso',
  'devuelto plataforma',
  'recibido sin revisar',
  'recibido sin revisar ofv',
  'completada',
  'devuelto',
  'cancelada'
]);

const KNOWN_CHANNELS = new Set([
  'afp intermediario', 'app intermediario', 'digital', 'oficina virtual', 'presencial'
]);

const KNOWN_MODALITIES = new Set(['automatica', 'manual', 'presencial']);

const KNOWN_LOT_TYPES = new Set([
  'actualizacion de poliza', 'actualizacion onbase', 'emision de poliza colectiva',
  'emision de poliza individual', 'movimiento de afiliados',
  ...DEFAULT_CANCELLATION_ALIASES.map(normalizeEndToEndText)
]);

export interface IEndToEndMatrixInput {
  fileName: string;
  fileHash: string;
  importedBy: string;
  rows: unknown[][];
  sourceSheet?: string;
  generationOverride?: Date;
  cancellationAliases?: ReadonlyArray<string>;
}

const cellText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const candidate = value as {
      text?: unknown;
      result?: unknown;
      richText?: Array<{ text?: string }>;
    };
    if (candidate.result !== undefined) return cellText(candidate.result);
    if (candidate.text !== undefined) return String(candidate.text);
    if (candidate.richText) return candidate.richText.map((part) => part.text || '').join('');
  }
  return String(value).trim();
};

const normalizeMatrix = (rows: ReadonlyArray<ReadonlyArray<unknown>>): string[][] =>
  rows.map((row) => row.map(cellText));

const findHeader = (rows: ReadonlyArray<ReadonlyArray<string>>): number =>
  rows.findIndex((row) => {
    const headers = new Set(row.map(normalizeHeader));
    return headers.has(normalizeHeader('Radicación')) &&
      headers.has(normalizeHeader('Tipo de Lote'));
  });

const buildColumnIndex = (headers: ReadonlyArray<string>): Map<string, number> => {
  const normalized = headers.map(normalizeHeader);
  const indexes = new Map<string, number>();
  Object.entries({ ...ESSENTIAL_COLUMNS, ...OPTIONAL_COLUMNS }).forEach(([key, definition]) => {
    const aliases = Array.isArray(definition)
      ? definition
      : definition.aliases;
    const index = normalized.findIndex((header) =>
      aliases.some((alias) => normalizeHeader(alias) === header)
    );
    if (index >= 0) indexes.set(key, index);
  });
  return indexes;
};

const getValue = (
  row: ReadonlyArray<string>,
  indexes: ReadonlyMap<string, number>,
  key: string
): string => {
  const index = indexes.get(key);
  return index === undefined ? '' : (row[index] || '').trim();
};

const parseNonNegativeNumber = (value: string): number | undefined => {
  const clean = value.trim();
  if (!clean) return undefined;
  const parsed = Number(clean.replace(/,/g, ''));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
};

const buildOriginalRow = (
  row: ReadonlyArray<string>,
  headers: ReadonlyArray<string>,
  rowNumber: number
): IEndToEndRowSource => {
  const values: Record<string, string | number | boolean | null> = {};
  headers.forEach((header, index) => {
    if (header.trim()) values[header.trim()] = row[index] || null;
  });
  return { rowNumber, values };
};

const findMetadataValue = (
  rows: ReadonlyArray<ReadonlyArray<string>>,
  headerIndex: number,
  label: string
): string | undefined => {
  const target = normalizeHeader(label);
  for (let index = 0; index < Math.max(0, headerIndex); index += 1) {
    const row = rows[index];
    const labelIndex = row.findIndex((cell) => normalizeHeader(cell) === target);
    if (labelIndex >= 0) return row[labelIndex + 1]?.trim() || undefined;
  }
  return undefined;
};

const stableRowKey = (row: ReadonlyArray<string>): string =>
  JSON.stringify(row.map((value) => value.trim()));

export const parseEndToEndMatrix = (
  input: IEndToEndMatrixInput
): IEndToEndParsedReport => {
  const matrix = normalizeMatrix(input.rows);
  const headerIndex = findHeader(matrix);
  const issues: IEndToEndIssue[] = [];
  if (headerIndex < 0) {
    return {
      rows: [],
      summary: {
        fileName: input.fileName,
        fileHash: input.fileHash,
        importedBy: input.importedBy,
        detectedRows: 0,
        uniqueRadicaciones: 0,
        totalPages: 0,
        excludedRecords: 0,
        duplicateRows: 0,
        repeatedRadicaciones: 0,
        missingColumns: Object.values(ESSENTIAL_COLUMNS).map((column) => column.label),
        issues: [{
          code: 'HEADER_NOT_FOUND',
          level: 'critical',
          message: 'No se encontró un encabezado End-to-End con Radicación y Tipo de Lote.'
        }],
        criticalRows: [],
        sourceSheet: input.sourceSheet,
        headerRow: 0
      }
    };
  }

  const headers = matrix[headerIndex];
  const indexes = buildColumnIndex(headers);
  const missingColumns = Object.entries(ESSENTIAL_COLUMNS)
    .filter(([key]) => !indexes.has(key))
    .map(([, definition]) => definition.label);
  missingColumns.forEach((column) => issues.push({
    code: 'MISSING_COLUMN',
    level: 'critical',
    field: column,
    message: `Falta la columna esencial “${column}”.`
  }));

  const generationText = findMetadataValue(matrix, headerIndex, 'Fecha de Generación:') ||
    findMetadataValue(matrix, headerIndex, 'Fecha de Generación');
  const generationAt = input.generationOverride ||
    (generationText ? parseGenerationDateTime(generationText) : undefined);
  if (!generationAt) {
    issues.push({
      code: 'GENERATION_DATE_REQUIRED',
      level: 'critical',
      message: 'No se pudo determinar o confirmar la fecha de generación.'
    });
  }
  const declaredText = findMetadataValue(matrix, headerIndex, 'Total Registros:') ||
    findMetadataValue(matrix, headerIndex, 'Total Registros');
  const declaredTotal = declaredText && Number.isFinite(Number(declaredText))
    ? Number(declaredText)
    : undefined;

  const dataRows = matrix.slice(headerIndex + 1)
    .map((row, index) => ({ row, rowNumber: headerIndex + index + 2 }))
    .filter(({ row }) => row.some((value) => value.trim() !== ''));
  if (dataRows.length === 0) {
    issues.push({
      code: 'EMPTY_REPORT',
      level: 'critical',
      message: 'El reporte está vacío.'
    });
  }

  const seenExact = new Set<string>();
  const aliases = input.cancellationAliases || DEFAULT_CANCELLATION_ALIASES;
  const knownLotTypes = new Set([
    ...KNOWN_LOT_TYPES,
    ...aliases.map(normalizeEndToEndText)
  ]);
  const normalizedRows: IEndToEndNormalizedRow[] = dataRows.map(({ row, rowNumber }) => {
    const dataWarnings: string[] = [];
    const radicacion = getValue(row, indexes, 'radicacion');
    const fechaRadicacion = getValue(row, indexes, 'fechaRadicacion');
    const horaRadicacion = getValue(row, indexes, 'horaRadicacion');
    const start = parseRadicationDateTime(fechaRadicacion, horaRadicacion);
    if (!radicacion || !/^\d+$/.test(radicacion)) {
      issues.push({
        code: 'INVALID_RADICATION',
        level: 'critical',
        rowNumber,
        field: 'Radicación',
        message: `Fila ${rowNumber}: radicación inválida.`
      });
    }
    if (!start) {
      issues.push({
        code: 'INVALID_START_DATE',
        level: 'critical',
        rowNumber,
        field: 'Fecha Radicación',
        message: `Fila ${rowNumber}: fecha u hora de radicación inválida.`
      });
    }

    const tipoLote = getValue(row, indexes, 'tipoLote');
    const descripcionNovedad = getValue(row, indexes, 'descripcionNovedad');
    const flow = classifyEndToEndFlow(tipoLote, descripcionNovedad, aliases);
    const usuarioRadicacion = getValue(row, indexes, 'usuarioRadicacion');
    const estadoRadicacion = getValue(row, indexes, 'estadoRadicacion');
    const processValues = {
      fechaEscaneo: getValue(row, indexes, 'fechaEscaneo'),
      fechaAprobacion: getValue(row, indexes, 'fechaAprobacion'),
      fechaSincronizado: getValue(row, indexes, 'fechaSincronizado')
    };
    const parsedProcessDates = Object.fromEntries(
      Object.entries(processValues).map(([key, value]) => [key, parseProcessDateTime(value)])
    ) as Record<keyof typeof processValues, Date | undefined>;
    Object.entries(processValues).forEach(([field, value]) => {
      if (value && normalizeEndToEndText(value) !== 'n a' && !parseProcessDateTime(value)) {
        const message = `Fila ${rowNumber}: ${field} no cumple MM/DD/YYYY HH:mm:ss.`;
        dataWarnings.push(message);
        issues.push({
          code: 'INVALID_PROCESS_DATE',
          level: 'warning',
          rowNumber,
          field,
          message
        });
      }
    });
    Object.entries(parsedProcessDates).forEach(([field, date]) => {
      if (start && date && date.getTime() < start.getTime()) {
        const message = `Fila ${rowNumber}: ${field} es anterior a la fecha de radicación.`;
        dataWarnings.push(message);
        issues.push({
          code: 'INCONSISTENT_TIMELINE', level: 'warning', rowNumber, field, message
        });
      }
    });

    const movementsText = getValue(row, indexes, 'cantidadMovimientos');
    const formsText = getValue(row, indexes, 'cantidadFormularios');
    const movements = parseNonNegativeNumber(movementsText);
    const forms = parseNonNegativeNumber(formsText);
    const pagesValue = flow === 'emision' ? movements : forms;
    if (pagesValue === undefined) {
      const message = `Fila ${rowNumber}: volumen de páginas vacío, negativo o no numérico.`;
      dataWarnings.push(message);
      issues.push({
        code: 'INVALID_PAGES',
        level: 'warning',
        rowNumber,
        message
      });
    }
    if (!KNOWN_STATES.has(normalizeEndToEndText(estadoRadicacion))) {
      const message = `Fila ${rowNumber}: estado de radicación desconocido “${estadoRadicacion || 'vacío'}”.`;
      dataWarnings.push(message);
      issues.push({
        code: 'UNKNOWN_STATUS',
        level: 'warning',
        rowNumber,
        field: 'Estado Radicación',
        message
      });
    }

    const channel = getValue(row, indexes, 'canal');
    const modality = getValue(row, indexes, 'modalidad');
    const unknownValues = [
      { field: 'Canal', value: channel, known: KNOWN_CHANNELS },
      { field: 'Modalidad Solicitud', value: modality, known: KNOWN_MODALITIES },
      { field: 'Tipo de Lote', value: tipoLote, known: knownLotTypes }
    ];
    unknownValues.forEach(({ field, value, known }) => {
      if (!known.has(normalizeEndToEndText(value))) {
        const message = `Fila ${rowNumber}: ${field} desconocido “${value || 'vacío'}”.`;
        dataWarnings.push(message);
        issues.push({ code: 'UNKNOWN_CATALOG_VALUE', level: 'warning', rowNumber, field, message });
      }
    });

    const exactKey = stableRowKey(row);
    const duplicateExact = seenExact.has(exactKey);
    seenExact.add(exactKey);
    if (duplicateExact) {
      const message = `Fila ${rowNumber}: duplicado exacto; se conservará y sumará mientras no se excluya.`;
      dataWarnings.push(message);
      issues.push({
        code: 'EXACT_DUPLICATE',
        level: 'warning',
        rowNumber,
        message
      });
    }

    const hasRequiredFinalDates = flow === 'cancelacion'
      ? Boolean(parsedProcessDates.fechaEscaneo)
      : Boolean(parsedProcessDates.fechaAprobacion && parsedProcessDates.fechaSincronizado);
    if (normalizeEndToEndText(estadoRadicacion) === 'completada' && !hasRequiredFinalDates) {
      const message = `Fila ${rowNumber}: el estado indica completada, pero faltan fechas finales requeridas.`;
      dataWarnings.push(message);
      issues.push({
        code: 'COMPLETED_WITHOUT_FINAL_DATES', level: 'warning', rowNumber,
        field: 'Estado Radicación', message
      });
    }

    return {
      rowNumber,
      radicacion,
      radicacionAt: start?.toISOString(),
      usuarioRadicacion,
      tipoLote,
      descripcionNovedad,
      estadoRadicacion,
      fechaEscaneo: parsedProcessDates.fechaEscaneo?.toISOString(),
      fechaAprobacion: parsedProcessDates.fechaAprobacion?.toISOString(),
      fechaSincronizado: parsedProcessDates.fechaSincronizado?.toISOString(),
      escalado: normalizeEndToEndText(getValue(row, indexes, 'escalado')) === 'si',
      estadoDistro: getValue(row, indexes, 'estadoDistro'),
      canal: channel,
      modalidad: modality,
      cantidadMovimientos: movements,
      cantidadFormularios: forms,
      director: getValue(row, indexes, 'director') || undefined,
      gerente: getValue(row, indexes, 'gerente') || undefined,
      compania: getValue(row, indexes, 'compania') || undefined,
      intermediario: getValue(row, indexes, 'intermediario') || undefined,
      poliza: getValue(row, indexes, 'poliza') || undefined,
      localidad: getValue(row, indexes, 'localidad') || undefined,
      flow,
      excludedByRule: isExcludedEndToEndStatus(estadoRadicacion, hasRequiredFinalDates),
      apiEmissionExcluded: flow === 'emision' && isApiEmissionUser(usuarioRadicacion),
      pages: pagesValue || 0,
      duplicateExact,
      dataWarnings,
      original: buildOriginalRow(row, headers, rowNumber)
    };
  });

  const radicationCounts = new Map<string, number>();
  normalizedRows.forEach((row) => {
    if (row.radicacion) radicationCounts.set(row.radicacion, (radicationCounts.get(row.radicacion) || 0) + 1);
  });
  const repeatedRadicaciones = Array.from(radicationCounts.values()).filter((count) => count > 1).length;
  if (repeatedRadicaciones > 0) {
    issues.push({
      code: 'REPEATED_RADICATIONS',
      level: 'warning',
      message: `${repeatedRadicaciones} radicaciones aparecen en más de una fila.`
    });
  }
  if (declaredTotal !== undefined && declaredTotal !== normalizedRows.length) {
    issues.push({
      code: 'DECLARED_TOTAL_MISMATCH',
      level: 'warning',
      message: `El reporte declara ${declaredTotal} registros, pero se detectaron ${normalizedRows.length} filas.`
    });
  }
  const validRadications = normalizedRows.filter((row) => /^\d+$/.test(row.radicacion));
  if (normalizedRows.length > 0 && validRadications.length === 0) {
    issues.push({
      code: 'ALL_RADICATIONS_INVALID',
      level: 'critical',
      message: 'Todas las radicaciones del reporte son inválidas.'
    });
  }

  return {
    rows: normalizedRows,
    summary: {
      fileName: input.fileName,
      fileHash: input.fileHash,
      generationAt: generationAt?.toISOString(),
      importedBy: input.importedBy,
      detectedRows: normalizedRows.length,
      uniqueRadicaciones: radicationCounts.size,
      totalPages: normalizedRows.reduce((sum, row) => sum + row.pages, 0),
      excludedRecords: normalizedRows.filter((row) => row.excludedByRule || row.apiEmissionExcluded).length,
      duplicateRows: normalizedRows.filter((row) => row.duplicateExact).length,
      repeatedRadicaciones,
      declaredTotal,
      missingColumns,
      issues,
      criticalRows: Array.from(new Set(
        issues.filter((issue) => issue.level === 'critical' && issue.rowNumber).map((issue) => issue.rowNumber as number)
      )),
      sourceSheet: input.sourceSheet,
      headerRow: headerIndex + 1
    }
  };
};

const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => value !== '')) rows.push(row);
  return rows;
};

export const hashEndToEndFile = async (buffer: ArrayBuffer): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

export const parseEndToEndFile = async (
  file: File,
  importedBy: string,
  generationOverride?: Date,
  cancellationAliases?: ReadonlyArray<string>
): Promise<IEndToEndParsedReport> => {
  const extension = file.name.split('.').pop()?.toLocaleLowerCase();
  if (extension !== 'xlsx' && extension !== 'csv') {
    throw new Error('Seleccione un archivo .xlsx o .csv válido.');
  }
  const buffer = await file.arrayBuffer();
  const fileHash = await hashEndToEndFile(buffer);
  if (extension === 'csv') {
    const text = new TextDecoder('utf-8').decode(buffer);
    return parseEndToEndMatrix({
      fileName: file.name,
      fileHash,
      importedBy,
      rows: parseCsv(text),
      generationOverride,
      cancellationAliases
    });
  }

  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as Buffer);
  let selectedRows: unknown[][] | undefined;
  let selectedSheet: string | undefined;
  workbook.eachSheet((worksheet) => {
    if (selectedRows) return;
    const rows: unknown[][] = [];
    worksheet.eachRow({ includeEmpty: true }, (row) => {
      const values: unknown[] = [];
      for (let column = 1; column <= Math.max(worksheet.columnCount, 1); column += 1) {
        values.push(row.getCell(column).value);
      }
      rows.push(values);
    });
    if (findHeader(normalizeMatrix(rows)) >= 0) {
      selectedRows = rows;
      selectedSheet = worksheet.name;
    }
  });

  return parseEndToEndMatrix({
    fileName: file.name,
    fileHash,
    importedBy,
    rows: selectedRows || [],
    sourceSheet: selectedSheet,
    generationOverride,
    cancellationAliases
  });
};

export const END_TO_END_ESSENTIAL_COLUMNS = Object.values(ESSENTIAL_COLUMNS)
  .map((column) => column.label);
