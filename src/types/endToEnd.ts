export type EndToEndFlow = 'emision' | 'movimiento' | 'cancelacion';

export type EndToEndSeverity =
  | 'verde'
  | 'amarillo'
  | 'naranja'
  | 'rojo'
  | 'gris'
  | 'error';

export type EndToEndStage =
  | 'Pendiente de escaneo'
  | 'Pendiente de digitación/aprobación'
  | 'Pendiente de sincronización'
  | 'Inconsistencia / aprobación pendiente'
  | 'Completada para SLA'
  | 'Excluida / no aplicable'
  | 'Error de datos';

export type EndToEndIssueLevel = 'critical' | 'warning';

export interface IEndToEndIssue {
  code: string;
  level: EndToEndIssueLevel;
  message: string;
  rowNumber?: number;
  field?: string;
}

export interface IEndToEndClosure {
  id?: string;
  date: string;
  description: string;
  type: 'nacional' | 'interno';
  allDay: boolean;
  startTime?: string;
  endTime?: string;
  scope?: string;
  active: boolean;
  observation?: string;
  source?: string;
}

export interface IEndToEndRowSource {
  rowNumber: number;
  values: Record<string, string | number | boolean | null>;
}

export interface IEndToEndNormalizedRow {
  rowNumber: number;
  radicacion: string;
  radicacionAt?: string;
  usuarioRadicacion: string;
  tipoLote: string;
  descripcionNovedad: string;
  estadoRadicacion: string;
  fechaEscaneo?: string;
  fechaAprobacion?: string;
  fechaSincronizado?: string;
  escalado: boolean;
  estadoDistro: string;
  canal: string;
  modalidad: string;
  cantidadMovimientos?: number;
  cantidadFormularios?: number;
  director?: string;
  gerente?: string;
  compania?: string;
  intermediario?: string;
  poliza?: string;
  localidad?: string;
  flow: EndToEndFlow;
  excludedByRule: boolean;
  apiEmissionExcluded: boolean;
  pages: number;
  duplicateExact: boolean;
  dataWarnings: string[];
  original: IEndToEndRowSource;
}

export interface IEndToEndSlaResult {
  startAt?: string;
  endAt?: string;
  deadlineAt?: string;
  referenceAt: string;
  consumedMinutes?: number;
  remainingMinutes?: number;
  completed: boolean;
  compliant?: boolean;
  severity: EndToEndSeverity;
  stage: EndToEndStage;
  action: string;
  reconciliationRequired: boolean;
  dataError?: string;
}

export interface IEndToEndAnalyzedRow extends IEndToEndNormalizedRow {
  sla: IEndToEndSlaResult;
  manuallyExcluded?: boolean;
  exclusionReason?: string;
}

export interface IEndToEndGroup {
  radicacion: string;
  flow: EndToEndFlow;
  rows: IEndToEndAnalyzedRow[];
  pages: number;
  severity: EndToEndSeverity;
  stage: EndToEndStage;
  action: string;
  consumedMinutes?: number;
  remainingMinutes?: number;
  completed: boolean;
  effectiveEndAt?: string;
  tipoLote: string;
  novedades: string[];
  radicacionAt?: string;
  canal: string;
  modalidad: string;
  estadoRadicacion: string;
  estadoDistro: string;
  escalado: boolean;
  reconciliationRequired: boolean;
  hasDataError: boolean;
  reincidenteHoy: boolean;
  vistaAnteriormente: boolean;
  reported: boolean;
  director?: string;
  gerente?: string;
  poliza?: string;
  intermediario?: string;
}

export interface IEndToEndValidationSummary {
  fileName: string;
  fileHash: string;
  generationAt?: string;
  importedBy: string;
  detectedRows: number;
  uniqueRadicaciones: number;
  totalPages: number;
  excludedRecords: number;
  duplicateRows: number;
  repeatedRadicaciones: number;
  declaredTotal?: number;
  missingColumns: string[];
  issues: IEndToEndIssue[];
  criticalRows: number[];
  sourceSheet?: string;
  headerRow: number;
}

export interface IEndToEndParsedReport {
  summary: IEndToEndValidationSummary;
  rows: IEndToEndNormalizedRow[];
}

export interface IEndToEndSnapshot {
  id: string;
  fileName: string;
  fileHash: string;
  generationAt: string;
  importedAt: string;
  importedBy: string;
  status: 'active' | 'older' | 'conflict';
  declaredTotal?: number;
  detectedRows: number;
  uniqueRadicaciones: number;
  totalPages: number;
  rows: IEndToEndAnalyzedRow[];
}

export interface IEndToEndVersionConflict {
  id: string;
  generationAt: string;
  firstSnapshotId: string;
  candidateSnapshotId: string;
  firstFileName: string;
  candidateFileName: string;
  createdAt: string;
}

export interface IEndToEndReportAction {
  id?: string;
  snapshotId: string;
  radicaciones: string[];
  action: 'copy_mark' | 'copy_only' | 'undo_reported';
  userEmail: string;
  createdAt: string;
}

export interface IEndToEndCapabilities {
  canImport: boolean;
  canResolveConflicts: boolean;
  canManageCalendar: boolean;
  canExcludeRows: boolean;
  canMarkReported: boolean;
}
