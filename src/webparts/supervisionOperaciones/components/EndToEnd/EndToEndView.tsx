import * as React from 'react';
import { Icon, Spinner, SpinnerSize } from '@fluentui/react';

import type {
  EndToEndFlow,
  EndToEndSeverity,
  IEndToEndClosure,
  IEndToEndGroup,
  IEndToEndParsedReport
} from '../../../../types';
import {
  analyzeEndToEndRows,
  formatSantoDomingoLocalInput,
  formatSantoDomingoDateTime,
  groupEndToEndRows,
  isCriticalEndToEndGroup,
  normalizeEndToEndText,
  parseSantoDomingoLocalInput,
  resolveReportFreshness
} from '../../../../modules/endToEnd/endToEndDomain';
import { useRBAC } from '../../../../auth/RBACContext';
import { parseEndToEndFile } from '../../../../modules/endToEnd/endToEndParser';
import {
  endToEndRepository,
  type IEndToEndWorkspace
} from '../../../../modules/endToEnd/endToEndRepository';
import {
  buildEndToEndClipboardPayload,
  copyEndToEndThenAudit,
  type EndToEndOptionalCopyColumn
} from '../../../../modules/endToEnd/endToEndClipboard';
import {
  applyEndToEndFilters,
  EMPTY_END_TO_END_FILTERS,
  type IEndToEndFilters
} from '../../../../modules/endToEnd/endToEndViewModel';
import CopyColumnsPortal from './CopyColumnsPortal';
import styles from './EndToEndView.module.scss';

interface IEndToEndViewProps {
  currentUserEmail: string;
  currentUserName: string;
}

const SEVERITY_LABELS: Record<EndToEndSeverity, string> = {
  verde: 'Cumple / < 4 h',
  amarillo: 'Atención · 4–6 h',
  naranja: 'Crítica · 6–<8 h',
  rojo: 'Vencida / incumplida',
  gris: 'Excluida',
  error: 'Error de datos'
};

const FLOW_LABELS: Record<EndToEndFlow, string> = {
  emision: 'Emisión',
  movimiento: 'Movimiento / Actualización',
  cancelacion: 'Cancelación'
};

const formatMinutes = (minutes?: number): string => {
  if (minutes === undefined) return 'No calculable';
  const sign = minutes < 0 ? 'Vencida por ' : '';
  const absolute = Math.abs(minutes);
  return `${sign}${Math.floor(absolute / 60)} h ${absolute % 60} min`;
};

const uniqueValues = (groups: ReadonlyArray<IEndToEndGroup>, getter: (group: IEndToEndGroup) => string): string[] =>
  Array.from(new Set(groups.map(getter).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es'));

const isOperationalGroup = (group: IEndToEndGroup): boolean =>
  group.rows.some((row) => row.sla.severity !== 'gris');

const EndToEndView: React.FC<IEndToEndViewProps> = ({
  currentUserEmail,
  currentUserName
}) => {
  const { hasPermission } = useRBAC();
  const [workspace, setWorkspace] = React.useState<IEndToEndWorkspace>();
  const [workspaceError, setWorkspaceError] = React.useState('');
  const [parsedReport, setParsedReport] = React.useState<IEndToEndParsedReport>();
  const [isLoading, setIsLoading] = React.useState(true);
  const [isParsing, setIsParsing] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');
  const [selectedFile, setSelectedFile] = React.useState<File>();
  const [csvGeneration, setCsvGeneration] = React.useState('');
  const [csvConfirmed, setCsvConfirmed] = React.useState(false);
  const [exclusions, setExclusions] = React.useState<Map<number, string>>(new Map());
  const [activeTab, setActiveTab] = React.useState<'emisiones' | 'movimientos'>('emisiones');
  const [filters, setFilters] = React.useState<IEndToEndFilters>({ ...EMPTY_END_TO_END_FILTERS });
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [reported, setReported] = React.useState<Set<string>>(new Set());
  const [loadUnit, setLoadUnit] = React.useState<'radicaciones' | 'paginas'>('radicaciones');
  const [calendarOpen, setCalendarOpen] = React.useState(false);
  const [copyColumns, setCopyColumns] = React.useState<Set<EndToEndOptionalCopyColumn>>(new Set());
  const capabilities = React.useMemo(() => ({
    canImport: hasPermission('modulo:end_to_end:importar'),
    canResolveConflicts: hasPermission('modulo:end_to_end:resolver_conflictos'),
    canManageCalendar: hasPermission('modulo:end_to_end:gestionar_calendario'),
    canExcludeRows: hasPermission('modulo:end_to_end:excluir_filas'),
    canMarkReported: hasPermission('modulo:end_to_end:marcar_reportada')
  }), [hasPermission]);
  const [calendarDraft, setCalendarDraft] = React.useState<IEndToEndClosure>({
    date: '', description: '', type: 'interno', allDay: true, active: true
  });
  const activeIdentityRef = React.useRef(currentUserEmail.trim().toLocaleLowerCase());

  const loadWorkspace = React.useCallback(async (): Promise<void> => {
    const requestedIdentity = currentUserEmail.trim().toLocaleLowerCase();
    setIsLoading(true);
    setWorkspaceError('');
    try {
      const loaded = await endToEndRepository.loadWorkspace();
      if (activeIdentityRef.current !== requestedIdentity) return;
      setWorkspace(loaded);
      setReported(new Set(loaded.reportedRadications));
    } catch (loadError: unknown) {
      if (activeIdentityRef.current !== requestedIdentity) return;
      setWorkspaceError(loadError instanceof Error
        ? `${loadError.message}. Aplique la migración End-to-End incluida en el repositorio.`
        : 'No se pudo cargar el módulo End-to-End.');
    } finally {
      if (activeIdentityRef.current === requestedIdentity) {
        setIsLoading(false);
      }
    }
  }, [currentUserEmail]);

  React.useEffect(() => {
    const requestedIdentity = currentUserEmail.trim().toLocaleLowerCase();
    activeIdentityRef.current = requestedIdentity;
    // Toda referencia de la identidad anterior se purga antes de consultar RLS.
    setWorkspace(undefined);
    setParsedReport(undefined);
    setSelectedFile(undefined);
    setExclusions(new Map());
    setSelected(new Set());
    setExpanded(new Set());
    setReported(new Set());
    setFilters({ ...EMPTY_END_TO_END_FILTERS });
    setCopyColumns(new Set());
    setMessage('');
    setError('');
    setWorkspaceError('');
    setActiveTab('emisiones');
    setCalendarOpen(false);
    loadWorkspace().catch(() => undefined);
    return () => {
      if (activeIdentityRef.current === requestedIdentity) {
        activeIdentityRef.current = '';
      }
    };
  }, [currentUserEmail, loadWorkspace]);

  const activeRows = React.useMemo(() => {
    const snapshot = workspace?.activeSnapshot;
    if (!snapshot) return [];
    const manualExclusions = new Map<number, string>(
      snapshot.rows
        .filter((row) => row.manuallyExcluded)
        .map((row) => [row.rowNumber, row.exclusionReason || 'Exclusión auditada'])
    );
    return analyzeEndToEndRows(
      snapshot.rows,
      new Date(snapshot.generationAt),
      workspace?.closures || [],
      manualExclusions
    );
  }, [workspace]);

  const allGroups = React.useMemo(() => groupEndToEndRows(
    activeRows,
    reported,
    workspace?.previousRadications || new Set(),
    workspace?.recurrentToday || new Set()
  ), [activeRows, reported, workspace]);

  const operationalGroups = React.useMemo(() => allGroups.filter(isOperationalGroup), [allGroups]);
  const tabGroups = React.useMemo(() => operationalGroups.filter((group) =>
    activeTab === 'emisiones' ? group.flow === 'emision' : group.flow !== 'emision'
  ), [activeTab, operationalGroups]);
  const filteredGroups = React.useMemo(() => {
    return applyEndToEndFilters(tabGroups, filters);
  }, [filters, tabGroups]);
  const snapshot = workspace?.activeSnapshot;
  const freshness = snapshot ? resolveReportFreshness(snapshot.generationAt) : undefined;

  const parseSelectedFile = async (): Promise<void> => {
    if (!selectedFile) {
      setError('Seleccione un archivo .xlsx o .csv.');
      return;
    }
    const isCsv = selectedFile.name.toLocaleLowerCase().endsWith('.csv');
    if (isCsv && (!csvGeneration || !csvConfirmed)) {
      setError('Confirme explícitamente la fecha de generación del CSV.');
      return;
    }
    setIsParsing(true);
    setError('');
    setMessage('');
    try {
      const generation = isCsv ? parseSantoDomingoLocalInput(csvGeneration) : undefined;
      if (isCsv && !generation) {
        throw new Error('La fecha de generación del CSV no es válida.');
      }
      const report = await parseEndToEndFile(
        selectedFile,
        currentUserEmail,
        generation,
        workspace?.cancellationAliases
      );
      if (workspace?.activeSnapshot && report.summary.generationAt &&
        report.summary.generationAt < workspace.activeSnapshot.generationAt) {
        report.summary.issues.push({
          code: 'OLDER_REPORT', level: 'warning',
          message: 'El reporte es más antiguo que la fotografía activa; se conservará, pero no se activará.'
        });
      }
      setParsedReport(report);
      setExclusions(new Map());
      setMessage('Archivo procesado. Revise la validación antes de activar la fotografía.');
    } catch (parseError: unknown) {
      setError(parseError instanceof Error ? parseError.message : 'No se pudo analizar el archivo.');
    } finally {
      setIsParsing(false);
    }
  };

  const setExclusion = (rowNumber: number, reason: string): void => {
    setExclusions((current) => {
      const next = new Map(current);
      if (reason.trim()) next.set(rowNumber, reason);
      else next.delete(rowNumber);
      return next;
    });
  };

  const globalCritical = parsedReport?.summary.issues.filter((issue) =>
    issue.level === 'critical' && issue.rowNumber === undefined
  ) || [];
  const pendingCriticalRows = parsedReport?.summary.criticalRows.filter((rowNumber) =>
    !exclusions.get(rowNumber)?.trim()
  ) || [];
  const canActivate = Boolean(
    parsedReport?.summary.generationAt &&
    globalCritical.length === 0 &&
    pendingCriticalRows.length === 0 &&
    parsedReport.rows.length > 0 &&
    !workspaceError
  );

  const activateReport = async (): Promise<void> => {
    if (!parsedReport?.summary.generationAt || !canActivate) return;
    setIsSaving(true);
    setError('');
    try {
      const analyzed = analyzeEndToEndRows(
        parsedReport.rows,
        new Date(parsedReport.summary.generationAt),
        workspace?.closures || [],
        exclusions
      );
      const saved = await endToEndRepository.saveSnapshot(
        parsedReport, analyzed, exclusions, currentUserEmail
      );
      setMessage(saved.status === 'active'
        ? 'Fotografía activada correctamente.'
        : saved.status === 'older'
          ? 'Fotografía conservada como anterior; la activa no cambió.'
          : 'Se registró un conflicto de versión para resolución.');
      setParsedReport(undefined);
      setSelectedFile(undefined);
      await loadWorkspace();
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo activar la fotografía.');
    } finally {
      setIsSaving(false);
    }
  };

  const updateFilter = (key: keyof IEndToEndFilters, value: string): void =>
    setFilters((current) => ({ ...current, [key]: value }));

  const selectDecisionFilter = (partial: Partial<IEndToEndFilters>, tab?: typeof activeTab): void => {
    setFilters({ ...EMPTY_END_TO_END_FILTERS, ...partial });
    if (tab) setActiveTab(tab);
  };

  const performCopy = async (mark: boolean): Promise<void> => {
    if (!snapshot || selected.size === 0) {
      setError('Seleccione al menos una radicación para copiar.');
      return;
    }
    const selectedGroups = filteredGroups.filter((group) => selected.has(group.radicacion));
    setError('');
    try {
      await copyEndToEndThenAudit(
        buildEndToEndClipboardPayload(selectedGroups, snapshot.generationAt, copyColumns),
        () => endToEndRepository.recordAction({
          snapshotId: snapshot.id,
          radicaciones: selectedGroups.map((group) => group.radicacion),
          action: mark ? 'copy_mark' : 'copy_only',
          userEmail: currentUserEmail
        })
      );
      if (mark) {
        setReported((current) => new Set([...current, ...selectedGroups.map((group) => group.radicacion)]));
      }
      setMessage(mark
        ? 'Copiado confirmado y radicaciones marcadas como reportadas.'
        : 'Tabla copiada sin modificar marcas.');
    } catch (copyError: unknown) {
      setError(copyError instanceof Error ? copyError.message : 'No se pudo copiar la tabla. No se aplicaron marcas.');
    }
  };

  const undoReported = async (): Promise<void> => {
    if (!snapshot) return;
    const targets = Array.from(selected).filter((radicacion) => reported.has(radicacion));
    if (targets.length === 0) {
      setError('Seleccione radicaciones que estén marcadas como reportadas.');
      return;
    }
    try {
      await endToEndRepository.recordAction({
        snapshotId: snapshot.id,
        radicaciones: targets,
        action: 'undo_reported',
        userEmail: currentUserEmail
      });
      setReported((current) => {
        const next = new Set(current);
        targets.forEach((target) => next.delete(target));
        return next;
      });
      setMessage('Reversión auditada correctamente.');
    } catch (undoError: unknown) {
      setError(undoError instanceof Error ? undoError.message : 'No se pudo revertir el marcado.');
    }
  };

  const saveClosure = async (): Promise<void> => {
    if (!calendarDraft.date || !calendarDraft.description.trim()) {
      setError('Fecha y descripción son obligatorias para el período no laborable.');
      return;
    }
    if (!calendarDraft.allDay && (!calendarDraft.startTime || !calendarDraft.endTime)) {
      setError('Indique hora inicial y final para un cierre parcial.');
      return;
    }
    try {
      await endToEndRepository.saveClosure(calendarDraft);
      setCalendarDraft({ date: '', description: '', type: 'interno', allDay: true, active: true });
      setMessage('Calendario actualizado. Los SLA visibles fueron recalculados.');
      await loadWorkspace();
    } catch (calendarError: unknown) {
      setError(calendarError instanceof Error ? calendarError.message : 'No se pudo actualizar el calendario.');
    }
  };

  const resolveConflict = async (conflictId: string, snapshotId: string): Promise<void> => {
    setError('');
    try {
      await endToEndRepository.resolveConflict(conflictId, snapshotId, currentUserEmail);
      setMessage('Conflicto resuelto y decisión auditada.');
      await loadWorkspace();
    } catch (conflictError: unknown) {
      setError(conflictError instanceof Error
        ? conflictError.message
        : 'No se pudo resolver el conflicto de versiones.');
    }
  };

  if (isLoading) {
    return <div className={styles.loading}><Spinner label="Cargando custodia End-to-End..." size={SpinnerSize.large} /></div>;
  }

  const distribution = (['rojo', 'naranja', 'amarillo', 'verde', 'error'] as EndToEndSeverity[])
    .map((severity) => ({
      severity,
      count: severity === 'naranja'
        ? operationalGroups.filter(isCriticalEndToEndGroup).length
        : operationalGroups.filter((group) => group.severity === severity).length
    }));
  const maximumDistribution = Math.max(1, ...distribution.map((item) => item.count));
  const stageLoads = Array.from(new Set(operationalGroups.map((group) => group.stage))).map((stage) => ({
    stage,
    value: operationalGroups.filter((group) => group.stage === stage).reduce(
      (sum, group) => sum + (loadUnit === 'paginas' ? group.pages : 1), 0
    )
  }));
  const maxStageLoad = Math.max(1, ...stageLoads.map((item) => item.value));
  const channelLoads = uniqueValues(operationalGroups, (group) => group.canal).map((channel) => ({
    channel,
    pages: operationalGroups.filter((group) => group.canal === channel && !group.completed)
      .reduce((sum, group) => sum + group.pages, 0)
  })).sort((left, right) => right.pages - left.pages).slice(0, 8);
  const maxChannelPages = Math.max(1, ...channelLoads.map((item) => item.pages));
  const soonToExpire = operationalGroups
    .filter((group) => !group.completed && (group.remainingMinutes ?? -1) >= 0)
    .sort((a, b) => (a.remainingMinutes || 0) - (b.remainingMinutes || 0)).slice(0, 10);
  const escalatedGroups = operationalGroups.filter((group) => group.escalado);
  const reconciliations = operationalGroups.filter((group) => group.reconciliationRequired);
  const dataErrors = operationalGroups.filter((group) => group.hasDataError);
  const rawExcluded = activeRows.filter((row) => row.sla.severity === 'gris');

  return (
    <section className={styles.root} aria-label="Análisis End-to-End y custodia de radicaciones">
      <div className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Custodia operativa · SLA laborable</span>
          <h3>Análisis End-to-End</h3>
          <p>Importa fotografías completas, prioriza decisiones y conserva siete días de memoria operativa.</p>
        </div>
        <div className={styles.heroActions}>
          {capabilities.canManageCalendar && <button type="button" className={styles.secondaryButton} onClick={() => setCalendarOpen((value) => !value)}>
            <Icon iconName="Calendar" /> Calendario laborable
          </button>}
          {capabilities.canImport && <label className={styles.fileButton}>
            <Icon iconName="CloudUpload" /> Seleccionar reporte
            <input
              type="file"
              accept=".xlsx,.csv"
              onChange={(event) => {
                const file = event.target.files?.[0];
                setSelectedFile(file);
                setParsedReport(undefined);
                setCsvConfirmed(false);
                setCsvGeneration(formatSantoDomingoLocalInput(new Date()));
              }}
            />
          </label>}
        </div>
      </div>

      {workspaceError && <div className={styles.errorBanner} role="alert">{workspaceError}</div>}
      {error && <div className={styles.errorBanner} role="alert">{error}</div>}
      {message && <div className={styles.successBanner} role="status">{message}</div>}

      {capabilities.canResolveConflicts && workspace?.conflicts.map((conflict) => (
        <section className={styles.conflictPanel} key={conflict.id}>
          <div>
            <span>Conflicto de versión · {formatSantoDomingoDateTime(conflict.generationAt)}</span>
            <strong>Dos archivos distintos declaran la misma fecha de generación.</strong>
            <small>Seleccione la fotografía correcta. La identidad y la hora de la decisión quedarán auditadas.</small>
          </div>
          <div>
            <button type="button" className={styles.secondaryButton} onClick={() => void resolveConflict(conflict.id, conflict.firstSnapshotId)}>
              Usar {conflict.firstFileName}
            </button>
            <button type="button" className={styles.primaryButton} onClick={() => void resolveConflict(conflict.id, conflict.candidateSnapshotId)}>
              Usar {conflict.candidateFileName}
            </button>
          </div>
        </section>
      ))}

      {calendarOpen && (
        <section className={styles.calendarPanel}>
          <div className={styles.sectionHeading}>
            <div><span>Configuración mantenible</span><h4>Feriados y cierres internos</h4></div>
            <span>{workspace?.closures.length || 0} períodos activos</span>
          </div>
          <div className={styles.calendarGrid}>
            <input type="date" value={calendarDraft.date} onChange={(e) => setCalendarDraft({ ...calendarDraft, date: e.target.value })} aria-label="Fecha no laborable" />
            <input value={calendarDraft.description} onChange={(e) => setCalendarDraft({ ...calendarDraft, description: e.target.value })} placeholder="Descripción" aria-label="Descripción" />
            <select value={calendarDraft.type} onChange={(e) => setCalendarDraft({ ...calendarDraft, type: e.target.value as IEndToEndClosure['type'] })} aria-label="Tipo de cierre">
              <option value="interno">Interno</option><option value="nacional">Nacional</option>
            </select>
            <label className={styles.checkboxLabel}><input type="checkbox" checked={calendarDraft.allDay} onChange={(e) => setCalendarDraft({ ...calendarDraft, allDay: e.target.checked })} /> Día completo</label>
            {!calendarDraft.allDay && <><input type="time" value={calendarDraft.startTime || ''} onChange={(e) => setCalendarDraft({ ...calendarDraft, startTime: e.target.value })} aria-label="Hora inicial" /><input type="time" value={calendarDraft.endTime || ''} onChange={(e) => setCalendarDraft({ ...calendarDraft, endTime: e.target.value })} aria-label="Hora final" /></>}
            <input value={calendarDraft.scope || ''} onChange={(e) => setCalendarDraft({ ...calendarDraft, scope: e.target.value })} placeholder="Alcance (opcional)" aria-label="Alcance" />
            <input value={calendarDraft.source || ''} onChange={(e) => setCalendarDraft({ ...calendarDraft, source: e.target.value })} placeholder="Fuente o referencia" aria-label="Fuente" />
            <button type="button" className={styles.primaryButton} onClick={() => void saveClosure()}>Guardar período</button>
          </div>
          <div className={styles.closureList}>{workspace?.closures.slice(0, 12).map((closure) => (
            <span key={`${closure.date}-${closure.description}`}><strong>{closure.date}</strong> · {closure.description}{closure.allDay ? '' : ` (${closure.startTime}–${closure.endTime})`}</span>
          ))}</div>
        </section>
      )}

      {selectedFile && !parsedReport && (
        <section className={styles.importPanel}>
          <div><strong>{selectedFile.name}</strong><span>{(selectedFile.size / 1024).toFixed(1)} KB</span></div>
          {selectedFile.name.toLocaleLowerCase().endsWith('.csv') && (
            <div className={styles.csvConfirmation}>
              <label>Fecha de generación confirmada<input type="datetime-local" value={csvGeneration} onChange={(e) => { setCsvGeneration(e.target.value); setCsvConfirmed(false); }} /></label>
              <label className={styles.checkboxLabel}><input type="checkbox" checked={csvConfirmed} onChange={(e) => setCsvConfirmed(e.target.checked)} /> Confirmo que esta es la fecha de generación del reporte</label>
            </div>
          )}
          <button type="button" className={styles.primaryButton} disabled={isParsing} onClick={() => void parseSelectedFile()}>
            {isParsing ? 'Analizando…' : 'Validar estructura'}
          </button>
        </section>
      )}

      {parsedReport && (
        <section className={styles.validationPanel}>
          <div className={styles.sectionHeading}><div><span>Preactivación obligatoria</span><h4>Validación de fotografía</h4></div><span>{parsedReport.summary.fileName}</span></div>
          <div className={styles.validationCards}>
            {[
              ['Generación', formatSantoDomingoDateTime(parsedReport.summary.generationAt)],
              ['Usuario', currentUserName || currentUserEmail],
              ['Filas', parsedReport.summary.detectedRows],
              ['Radicaciones', parsedReport.summary.uniqueRadicaciones],
              ['Páginas', parsedReport.summary.totalPages],
              ['Excluidos', parsedReport.summary.excludedRecords],
              ['Duplicados', parsedReport.summary.duplicateRows],
              ['Total declarado', parsedReport.summary.declaredTotal ?? 'No indicado']
            ].map(([label, value]) => <div key={String(label)}><span>{label}</span><strong>{value}</strong></div>)}
          </div>
          <div className={styles.validationColumns}>
            <div><h5>Errores críticos</h5>{parsedReport.summary.issues.filter((issue) => issue.level === 'critical').length === 0 ? <p className={styles.okText}>Sin errores críticos.</p> : parsedReport.summary.issues.filter((issue) => issue.level === 'critical').map((issue, index) => <p key={`${issue.code}-${index}`} className={styles.issueCritical}>{issue.message}</p>)}</div>
            <div><h5>Advertencias</h5>{parsedReport.summary.issues.filter((issue) => issue.level === 'warning').map((issue, index) => <p key={`${issue.code}-${index}`} className={styles.issueWarning}>{issue.message}</p>)}</div>
          </div>
          {capabilities.canExcludeRows && parsedReport.summary.criticalRows.length > 0 && (
            <div className={styles.exclusionPanel}>
              <h5>Exclusión manual auditada</h5><p>Una fila crítica bloquea toda la fotografía. Indique un motivo explícito para excluirla.</p>
              {parsedReport.summary.criticalRows.map((rowNumber) => <label key={rowNumber}>Fila {rowNumber}<input value={exclusions.get(rowNumber) || ''} onChange={(e) => setExclusion(rowNumber, e.target.value)} placeholder="Motivo obligatorio de exclusión" /></label>)}
            </div>
          )}
          <div className={styles.validationActions}>
            <button type="button" className={styles.secondaryButton} onClick={() => { setParsedReport(undefined); setSelectedFile(undefined); }}>Cancelar</button>
            <button type="button" className={styles.primaryButton} disabled={!canActivate || isSaving} onClick={() => void activateReport()}>{isSaving ? 'Guardando…' : 'Activar fotografía'}</button>
          </div>
        </section>
      )}

      {snapshot ? (
        <>
          <section className={styles.snapshotStrip}>
            <div><span>Fotografía activa</span><strong>{formatSantoDomingoDateTime(snapshot.generationAt)}</strong></div>
            <div><span>Antigüedad</span><strong className={freshness?.label === 'Actualizado' ? styles.fresh : styles.stale}>{freshness?.label} · {freshness?.minutes} min</strong></div>
            <div><span>Importada por</span><strong>{snapshot.importedBy}</strong></div>
            <div><span>Archivo</span><strong>{snapshot.fileName}</strong></div>
          </section>

          <section className={styles.kpiGrid}>
            {[
              ['Radicaciones gestionables', operationalGroups.length, () => setFilters({ ...EMPTY_END_TO_END_FILTERS })],
              ['Páginas pendientes', operationalGroups.filter((group) => !group.completed).reduce((sum, group) => sum + group.pages, 0), () => setFilters({ ...EMPTY_END_TO_END_FILTERS })],
              ['SLA vencidas', operationalGroups.filter((group) => group.severity === 'rojo').length, () => selectDecisionFilter({ severity: 'rojo' })],
              ['Críticas', operationalGroups.filter(isCriticalEndToEndGroup).length, () => selectDecisionFilter({ severity: 'critica' })],
              ['Escaladas', escalatedGroups.length, () => selectDecisionFilter({ escalated: 'true' })],
              ['Reincidentes hoy', operationalGroups.filter((group) => group.reincidenteHoy).length, () => selectDecisionFilter({ recurrent: 'true' })],
              ['Errores / advertencias', dataErrors.length + (parsedReport?.summary.issues.length || 0), () => selectDecisionFilter({ dataError: 'true' })],
              ['Volumen bruto excluido', rawExcluded.length, () => setMessage(`${rawExcluded.length} filas permanecen informadas fuera de gestión SLA.`)]
            ].map(([label, value, action]) => <button type="button" key={String(label)} className={styles.kpiCard} onClick={action as () => void}><span>{label}</span><strong className="tabular-nums font-mono">{value as number}</strong></button>)}
          </section>

          {freshness?.label !== 'Actualizado' && <div className={styles.warningBanner}>⚠️ El reporte está {freshness?.label.toLocaleLowerCase()}. Puede consultar y copiar, pero se recomienda importar una fotografía reciente.</div>}
          {(workspace?.disappearedRadications.length || 0) > 0 && (
            <div className={styles.warningBanner}>
              {workspace?.disappearedRadications.length} radicaciones ya no aparecen en esta fotografía. Se registraron para conciliación sin marcarlas como completadas.
            </div>
          )}

          <section className={styles.dashboardGrid}>
            <article className={styles.chartCard}><h4>Distribución por semáforo</h4>{distribution.map((item) => <button type="button" key={item.severity} onClick={() => selectDecisionFilter({ severity: item.severity === 'naranja' ? 'critica' : item.severity })} className={styles.barRow}><span>{SEVERITY_LABELS[item.severity]}</span><i style={{ width: `${(item.count / maximumDistribution) * 100}%` }} data-severity={item.severity} /><strong className="tabular-nums font-mono">{item.count}</strong></button>)}</article>
            <article className={styles.chartCard}><div className={styles.chartTitle}><h4>Carga por etapa</h4><select value={loadUnit} onChange={(e) => setLoadUnit(e.target.value as typeof loadUnit)}><option value="radicaciones">Radicaciones</option><option value="paginas">Páginas</option></select></div>{stageLoads.map((item) => <button type="button" key={item.stage} onClick={() => selectDecisionFilter({ stage: item.stage })} className={styles.barRow}><span>{item.stage}</span><i style={{ width: `${(item.value / maxStageLoad) * 100}%` }} /><strong className="tabular-nums font-mono">{item.value}</strong></button>)}</article>
            <article className={styles.chartCard}><h4>Páginas pendientes por canal</h4>{channelLoads.map((item) => <button type="button" key={item.channel} onClick={() => selectDecisionFilter({ channel: item.channel })} className={styles.barRow}><span>{item.channel}</span><i style={{ width: `${(item.pages / maxChannelPages) * 100}%` }} /><strong className="tabular-nums font-mono">{item.pages}</strong></button>)}</article>
            <article className={styles.chartCard}><h4>Escaladas · Estado Distro</h4><button type="button" className={styles.distroSplit} onClick={() => selectDecisionFilter({ escalated: 'true' })}><span><strong className="tabular-nums font-mono">{escalatedGroups.filter((group) => normalizeEndToEndText(group.estadoDistro).includes('revisado') && !normalizeEndToEndText(group.estadoDistro).includes('no revisado')).length}</strong>Revisadas</span><span><strong className="tabular-nums font-mono">{escalatedGroups.filter((group) => normalizeEndToEndText(group.estadoDistro).includes('no revisado') || normalizeEndToEndText(group.estadoDistro) === 'n a').length}</strong>No revisadas</span></button></article>
          </section>

          <section className={styles.decisionsGrid}>
            <button type="button" onClick={() => selectDecisionFilter({ priority: 'soon' })}><span>Próximas a vencer</span><strong className="tabular-nums font-mono">{soonToExpire.length}</strong><small>{soonToExpire.slice(0, 3).map((group) => `${group.radicacion} · ${formatMinutes(group.remainingMinutes)}`).join(' / ') || 'Sin casos'}</small></button>
            <button type="button" onClick={() => selectDecisionFilter({ escalated: 'true' })}><span>Escaladas</span><strong className="tabular-nums font-mono">{escalatedGroups.length}</strong><small>Notificar supervisores y encargados</small></button>
            <button type="button" onClick={() => selectDecisionFilter({ priority: 'reconciliation' })}><span>Conciliaciones</span><strong className="tabular-nums font-mono">{reconciliations.length}</strong><small>Fechas finales vs. estado operativo</small></button>
            <button type="button" onClick={() => selectDecisionFilter({ dataError: 'true' })}><span>Calidad de datos</span><strong className="tabular-nums font-mono">{dataErrors.length}</strong><small>Requiere corrección en la fuente</small></button>
            {activeTab === 'movimientos' && <button type="button" onClick={() => selectDecisionFilter({ priority: 'officeAutomatic' }, 'movimientos')}><span>Oficina Virtual automática</span><strong className="tabular-nums font-mono">{operationalGroups.filter((group) => normalizeEndToEndText(group.canal) === 'oficina virtual' && normalizeEndToEndText(group.modalidad) === 'automatica' && !group.completed).length}</strong><small>Cola prioritaria mientras esté incompleta</small></button>}
          </section>

          <div className={styles.tabs} role="tablist" aria-label="Flujos End-to-End">
            <button type="button" role="tab" aria-selected={activeTab === 'emisiones'} className={activeTab === 'emisiones' ? styles.activeTab : ''} onClick={() => { setActiveTab('emisiones'); setFilters({ ...EMPTY_END_TO_END_FILTERS }); setSelected(new Set()); }}>Emisiones</button>
            <button type="button" role="tab" aria-selected={activeTab === 'movimientos'} className={activeTab === 'movimientos' ? styles.activeTab : ''} onClick={() => { setActiveTab('movimientos'); setFilters({ ...EMPTY_END_TO_END_FILTERS }); setSelected(new Set()); }}>Movimientos y Cancelaciones</button>
          </div>

          <section className={styles.flowIndicators}>
            {activeTab === 'emisiones' ? (
              <>{[['Radicaciones', tabGroups.length], ['Páginas', tabGroups.reduce((sum, group) => sum + group.pages, 0)], ['Pend. escaneo', tabGroups.filter((group) => group.stage === 'Pendiente de escaneo').length], ['Pend. digitación', tabGroups.filter((group) => group.stage === 'Pendiente de digitación/aprobación').length], ['Pend. sincronización', tabGroups.filter((group) => group.stage === 'Pendiente de sincronización').length], ['Escaladas revisadas', tabGroups.filter((group) => group.escalado && normalizeEndToEndText(group.estadoDistro).includes('revisado') && !normalizeEndToEndText(group.estadoDistro).includes('no revisado')).length], ['Escaladas no revisadas', tabGroups.filter((group) => group.escalado && (normalizeEndToEndText(group.estadoDistro).includes('no revisado') || normalizeEndToEndText(group.estadoDistro) === 'n a')).length]].map(([label, value]) => <div key={String(label)}><span>{label}</span><strong className="tabular-nums font-mono">{value}</strong></div>)}</>
            ) : (
              <>{[['Radicaciones', tabGroups.length], ['Páginas', tabGroups.reduce((sum, group) => sum + group.pages, 0)], ['Pend. escaneo', tabGroups.filter((group) => group.stage === 'Pendiente de escaneo').length], ['Pend. digitación', tabGroups.filter((group) => group.stage === 'Pendiente de digitación/aprobación').length], ['Pend. sincronización', tabGroups.filter((group) => group.stage === 'Pendiente de sincronización').length], ['Cancelaciones sin escaneo', tabGroups.filter((group) => group.flow === 'cancelacion' && group.stage === 'Pendiente de escaneo').length], ['Escaladas', tabGroups.filter((group) => group.escalado).length], ['Oficina Virtual automática', tabGroups.filter((group) => normalizeEndToEndText(group.canal) === 'oficina virtual' && normalizeEndToEndText(group.modalidad) === 'automatica' && !group.completed).length]].map(([label, value]) => <div key={String(label)}><span>{label}</span><strong className="tabular-nums font-mono">{value}</strong></div>)}</>
            )}
          </section>

          <section className={styles.filtersPanel}>
            <input value={filters.search} onChange={(e) => updateFilter('search', e.target.value)} placeholder="Buscar radicación" aria-label="Buscar radicación" />
            <select value={filters.severity} onChange={(e) => updateFilter('severity', e.target.value)}><option value="">Todos los semáforos</option><option value="critica">Críticas (naranja · 6–&lt;8 h)</option>{Object.entries(SEVERITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <select value={filters.stage} onChange={(e) => updateFilter('stage', e.target.value)}><option value="">Todas las etapas</option>{uniqueValues(tabGroups, (group) => group.stage).map((value) => <option key={value}>{value}</option>)}</select>
            <select value={filters.flow} onChange={(e) => updateFilter('flow', e.target.value)}><option value="">Todos los flujos</option>{Object.entries(FLOW_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <select value={filters.lotType} onChange={(e) => updateFilter('lotType', e.target.value)}><option value="">Todos los lotes</option>{uniqueValues(tabGroups, (group) => group.tipoLote).map((value) => <option key={value}>{value}</option>)}</select>
            <select value={filters.channel} onChange={(e) => updateFilter('channel', e.target.value)}><option value="">Todos los canales</option>{uniqueValues(tabGroups, (group) => group.canal).map((value) => <option key={value}>{value}</option>)}</select>
            <select value={filters.modality} onChange={(e) => updateFilter('modality', e.target.value)}><option value="">Todas las modalidades</option>{uniqueValues(tabGroups, (group) => group.modalidad).map((value) => <option key={value}>{value}</option>)}</select>
            <select value={filters.escalated} onChange={(e) => updateFilter('escalated', e.target.value)}><option value="">Escalado: todos</option><option value="true">Sí</option><option value="false">No</option></select>
            <select value={filters.distro} onChange={(e) => updateFilter('distro', e.target.value)}><option value="">Estado Distro: todos</option>{uniqueValues(tabGroups, (group) => group.estadoDistro).map((value) => <option key={value}>{value}</option>)}</select>
            <select value={filters.recurrent} onChange={(e) => updateFilter('recurrent', e.target.value)}><option value="">Reincidencia: todas</option><option value="true">Reincidente hoy</option><option value="false">No reincidente</option></select>
            <select value={filters.dataError} onChange={(e) => updateFilter('dataError', e.target.value)}><option value="">Calidad de datos: todas</option><option value="true">Con error</option><option value="false">Sin error</option></select>
            <select value={filters.leader} onChange={(e) => updateFilter('leader', e.target.value)}><option value="">Director / gerente: todos</option>{Array.from(new Set(tabGroups.flatMap((group) => [group.director, group.gerente]).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b, 'es')).map((value) => <option key={value}>{value}</option>)}</select>
            <button type="button" className={styles.resetButton} onClick={() => setFilters({ ...EMPTY_END_TO_END_FILTERS })}>Restablecer filtros</button>
          </section>

          <div className={styles.tableToolbar}>
            <span className="tabular-nums font-mono">{filteredGroups.length} radicaciones · {selected.size} seleccionadas</span>
            {capabilities.canMarkReported && <div>
              <CopyColumnsPortal
                selectedColumns={copyColumns}
                onChange={setCopyColumns}
              />
              <button type="button" className={styles.primaryButton} onClick={() => void performCopy(true)}>Copiar y marcar como reportadas</button>
              <button type="button" className={styles.secondaryButton} onClick={() => void performCopy(false)}>Copiar sin marcar</button>
              <button type="button" className={styles.secondaryButton} onClick={() => void undoReported()}>Deshacer marcado</button>
            </div>}
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.operationalTable}>
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 bg-slate-950/95 backdrop-blur-sm border-r border-slate-800/80">
                    <input type="checkbox" aria-label="Seleccionar resultados visibles" checked={filteredGroups.length > 0 && filteredGroups.every((group) => selected.has(group.radicacion))} onChange={(e) => setSelected(e.target.checked ? new Set(filteredGroups.map((group) => group.radicacion)) : new Set())} />
                  </th>
                  <th>Semáforo</th>
                  <th className="tabular-nums font-mono text-right">Tiempo restante</th>
                  <th className="sticky left-[42px] z-20 bg-slate-950/95 backdrop-blur-sm border-r border-slate-800/80">Radicación</th>
                  <th className="tabular-nums font-mono text-right">Páginas</th>
                  <th>Tipo de lote / novedades</th>
                  <th>Fecha de radicación</th>
                  <th>Etapa</th>
                  <th>Canal / modalidad</th>
                  <th>Estado</th>
                  <th>Distro / escalado</th>
                  <th>Acción</th>
                  <th className="sticky right-0 z-20 bg-slate-950/95 backdrop-blur-sm border-l border-slate-800/80 text-center" />
                </tr>
              </thead>
              <tbody>
                {filteredGroups.map((group) => (
                  <React.Fragment key={group.radicacion}>
                    <tr className={group.reported ? styles.reportedRow : ''}>
                      <td className="sticky left-0 z-10 bg-slate-900/95 backdrop-blur-sm border-r border-slate-800/80">
                        <input type="checkbox" aria-label={`Seleccionar ${group.radicacion}`} checked={selected.has(group.radicacion)} onChange={(e) => setSelected((current) => { const next = new Set(current); if (e.target.checked) next.add(group.radicacion); else next.delete(group.radicacion); return next; })} />
                      </td>
                      <td><span className={styles.severityBadge} data-severity={group.severity}><i />{SEVERITY_LABELS[group.severity]}</span></td>
                      <td className="tabular-nums font-mono text-right"><strong>{formatMinutes(group.remainingMinutes)}</strong></td>
                      <td className="sticky left-[42px] z-10 bg-slate-900/95 backdrop-blur-sm border-r border-slate-800/80">
                        <strong className="tabular-nums font-mono">{group.radicacion}</strong>
                        {group.reincidenteHoy && <span className={styles.recurrentBadge}>Reincidente hoy</span>}
                        {!group.reincidenteHoy && group.vistaAnteriormente && <span className={styles.seenBadge}>Vista anteriormente</span>}
                        {group.reported && <span className={styles.reportedBadge}>Reportada</span>}
                      </td>
                      <td className="tabular-nums font-mono text-right font-bold text-slate-100">{group.pages}</td>
                      <td><strong>{group.tipoLote}</strong><small>{group.novedades.join(' · ')}</small></td>
                      <td className="tabular-nums font-mono">{formatSantoDomingoDateTime(group.radicacionAt)}</td>
                      <td>{group.stage}{group.reconciliationRequired && <span className={styles.conciliationBadge}>Conciliar</span>}</td>
                      <td>{group.canal}<small>{group.modalidad}</small></td>
                      <td>{group.estadoRadicacion}</td>
                      <td>{group.estadoDistro}<small>{group.escalado ? '⚠️ Escalada' : 'No escalada'}</small></td>
                      <td>{group.action}{group.reincidenteHoy && <small>Notificar al supervisor de piso</small>}</td>
                      <td className="sticky right-0 z-10 bg-slate-900/95 backdrop-blur-sm border-l border-slate-800/80 text-center">
                        <button type="button" className={styles.expandButton} aria-expanded={expanded.has(group.radicacion)} onClick={() => setExpanded((current) => { const next = new Set(current); if (next.has(group.radicacion)) next.delete(group.radicacion); else next.add(group.radicacion); return next; })}>
                          <Icon iconName={expanded.has(group.radicacion) ? 'ChevronUp' : 'ChevronDown'} />
                        </button>
                      </td>
                    </tr>
                    {expanded.has(group.radicacion) && (
                      <tr className={styles.detailRow}>
                        <td colSpan={13}>
                          <div>
                            <h5>Filas originales inmutables</h5>
                            {group.rows.map((row) => (
                              <article key={row.rowNumber}>
                                <header>Fila {row.rowNumber} · {FLOW_LABELS[row.flow]} · {SEVERITY_LABELS[row.sla.severity]}</header>
                                <dl>
                                  {Object.entries(row.original.values).map(([key, value]) => (
                                    <React.Fragment key={key}>
                                      <dt>{key}</dt>
                                      <dd className="tabular-nums font-mono">{String(value ?? '—')}</dd>
                                    </React.Fragment>
                                  ))}
                                </dl>
                                {row.sla.dataError && <p>{row.sla.dataError}</p>}
                              </article>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
            {filteredGroups.length === 0 && <div className={styles.emptyState}>No hay radicaciones que coincidan con los filtros.</div>}
          </div>
        </>
      ) : (
        <div className={styles.emptyWorkspace}><Icon iconName="ExcelDocument" /><h4>Importe la primera fotografía End-to-End</h4><p>El dashboard se habilitará después de validar y activar un archivo.</p></div>
      )}
    </section>
  );
};

export default EndToEndView;
