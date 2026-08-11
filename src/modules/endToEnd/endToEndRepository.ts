import { isSupabaseConfigured, supabase } from '../../services/supabase';
import type {
  IEndToEndAnalyzedRow,
  IEndToEndClosure,
  IEndToEndParsedReport,
  IEndToEndReportAction,
  IEndToEndSnapshot,
  IEndToEndVersionConflict
} from '../../types';
import {
  getRetentionCutoff,
  groupEndToEndRows,
  resolveRecurrentToday,
  resolveReportedRadications,
  resolveSnapshotStatus
} from './endToEndDomain';

interface IDatabaseSnapshot {
  id: string;
  file_name: string;
  file_hash: string;
  generation_at: string;
  imported_at: string;
  imported_by: string;
  status: IEndToEndSnapshot['status'];
  declared_total?: number;
  detected_rows: number;
  unique_radicaciones: number;
  total_pages: number;
}

interface IDatabaseRow {
  row_number: number;
  normalized_data: IEndToEndAnalyzedRow;
  sla_result: IEndToEndAnalyzedRow['sla'];
  manually_excluded: boolean;
  exclusion_reason?: string;
}

interface IDatabaseAction {
  id: string;
  snapshot_id: string;
  radicaciones: string[];
  action: IEndToEndReportAction['action'];
  user_email: string;
  created_at: string;
}

interface IDatabaseVersionConflict {
  id: string;
  generation_at: string;
  first_snapshot_id: string;
  candidate_snapshot_id: string;
  created_at: string;
}

export interface IEndToEndWorkspace {
  activeSnapshot?: IEndToEndSnapshot;
  snapshots: IEndToEndSnapshot[];
  closures: IEndToEndClosure[];
  cancellationAliases: string[];
  reportedRadications: Set<string>;
  previousRadications: Set<string>;
  recurrentToday: Set<string>;
  conflicts: IEndToEndVersionConflict[];
  disappearedRadications: string[];
}

const databaseError = (operation: string, error: { message?: string; code?: string }): Error =>
  new Error(`${operation}: ${error.message || 'error desconocido'}${error.code ? ` (${error.code})` : ''}`);

const requireDatabase = (): void => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase no está configurado para el módulo End-to-End.');
  }
};

const snapshotFromDatabase = (
  row: IDatabaseSnapshot,
  rows: IEndToEndAnalyzedRow[] = []
): IEndToEndSnapshot => ({
  id: row.id,
  fileName: row.file_name,
  fileHash: row.file_hash,
  generationAt: row.generation_at,
  importedAt: row.imported_at,
  importedBy: row.imported_by,
  status: row.status,
  declaredTotal: row.declared_total,
  detectedRows: row.detected_rows,
  uniqueRadicaciones: row.unique_radicaciones,
  totalPages: Number(row.total_pages) || 0,
  rows
});

const actionFromDatabase = (row: IDatabaseAction): IEndToEndReportAction => ({
  id: row.id,
  snapshotId: row.snapshot_id,
  radicaciones: row.radicaciones || [],
  action: row.action,
  userEmail: row.user_email,
  createdAt: row.created_at
});

export class EndToEndRepository {
  public async purgeExpiredData(): Promise<void> {
    requireDatabase();
    const cutoff = getRetentionCutoff();
    const { error } = await supabase.from('e2e_snapshots').delete().lt('imported_at', cutoff);
    if (error) throw databaseError('No se pudo aplicar la retención de siete días', error);
  }

  public async loadWorkspace(): Promise<IEndToEndWorkspace> {
    requireDatabase();
    await this.purgeExpiredData();
    const cutoff = getRetentionCutoff();
    const [snapshotsResponse, closuresResponse, aliasesResponse, actionsResponse, conflictsResponse] = await Promise.all([
      supabase.from('e2e_snapshots').select('*').gte('imported_at', cutoff).order('generation_at', { ascending: false }),
      supabase.from('e2e_non_working_periods').select('*').eq('active', true).order('date'),
      supabase.from('e2e_cancellation_aliases').select('alias').eq('active', true).order('alias'),
      supabase.from('e2e_report_actions').select('*').gte('created_at', cutoff).order('created_at', { ascending: true }),
      supabase.from('e2e_version_conflicts').select('*').is('resolved_at', null).order('created_at', { ascending: false })
    ]);
    if (snapshotsResponse.error) throw databaseError('No se pudieron consultar las fotografías End-to-End', snapshotsResponse.error);
    if (closuresResponse.error) throw databaseError('No se pudo consultar el calendario laborable', closuresResponse.error);
    if (aliasesResponse.error) throw databaseError('No se pudieron consultar los alias de cancelación', aliasesResponse.error);
    if (actionsResponse.error) throw databaseError('No se pudo consultar la auditoría operativa', actionsResponse.error);
    if (conflictsResponse.error) throw databaseError('No se pudieron consultar los conflictos de versión', conflictsResponse.error);

    const snapshots = (snapshotsResponse.data as IDatabaseSnapshot[]).map((row) => snapshotFromDatabase(row));
    const activeMetadata = snapshots.find((snapshot) => snapshot.status === 'active') || snapshots[0];
    if (activeMetadata) {
      const { data, error } = await supabase
        .from('e2e_rows')
        .select('row_number,normalized_data,sla_result,manually_excluded,exclusion_reason')
        .eq('snapshot_id', activeMetadata.id)
        .order('row_number');
      if (error) throw databaseError('No se pudieron consultar las filas de la fotografía activa', error);
      activeMetadata.rows = (data as IDatabaseRow[]).map((row) => ({
        ...row.normalized_data,
        sla: row.sla_result,
        manuallyExcluded: row.manually_excluded,
        exclusionReason: row.exclusion_reason
      }));
    }

    const actions = (actionsResponse.data as IDatabaseAction[]).map(actionFromDatabase);
    const reportedRadications = activeMetadata
      ? resolveReportedRadications(actions, activeMetadata.id)
      : new Set<string>();

    const previousRadications = new Set<string>();
    const previousSnapshotIds = snapshots
      .filter((snapshot) => snapshot.id !== activeMetadata?.id)
      .map((snapshot) => snapshot.id);
    if (previousSnapshotIds.length > 0) {
      const { data, error } = await supabase
        .from('e2e_rows')
        .select('radicacion')
        .in('snapshot_id', previousSnapshotIds);
      if (error) throw databaseError('No se pudo calcular la memoria operativa', error);
      (data as Array<{ radicacion: string }>).forEach((row) => previousRadications.add(row.radicacion));
    }

    const recurrentToday = activeMetadata
      ? resolveRecurrentToday(
        activeMetadata.id,
        activeMetadata.generationAt,
        new Set(activeMetadata.rows.map((row) => row.radicacion)),
        new Map(snapshots.map((snapshot) => [snapshot.id, snapshot.generationAt])),
        actions
      )
      : new Set<string>();

    let disappearedRadications: string[] = [];
    if (activeMetadata) {
      const { data, error } = await supabase
        .from('e2e_presence_events')
        .select('radicacion')
        .eq('snapshot_id', activeMetadata.id)
        .eq('status', 'Ya no aparece en el reporte');
      if (error) throw databaseError('No se pudieron consultar las desapariciones del reporte', error);
      disappearedRadications = (data || []).map((row: { radicacion: string }) => row.radicacion);
    }

    const snapshotById = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
    const conflicts = (conflictsResponse.data as IDatabaseVersionConflict[]).map((conflict) => ({
      id: conflict.id,
      generationAt: conflict.generation_at,
      firstSnapshotId: conflict.first_snapshot_id,
      candidateSnapshotId: conflict.candidate_snapshot_id,
      firstFileName: snapshotById.get(conflict.first_snapshot_id)?.fileName || 'Primera versión',
      candidateFileName: snapshotById.get(conflict.candidate_snapshot_id)?.fileName || 'Versión candidata',
      createdAt: conflict.created_at
    }));

    return {
      activeSnapshot: activeMetadata,
      snapshots,
      closures: (closuresResponse.data || []).map((row: Record<string, unknown>) => ({
        id: String(row.id),
        date: String(row.date),
        description: String(row.description),
        type: row.type === 'nacional' ? 'nacional' : 'interno',
        allDay: Boolean(row.all_day),
        startTime: row.start_time ? String(row.start_time).slice(0, 5) : undefined,
        endTime: row.end_time ? String(row.end_time).slice(0, 5) : undefined,
        scope: row.scope ? String(row.scope) : undefined,
        active: Boolean(row.active),
        observation: row.observation ? String(row.observation) : undefined,
        source: row.source ? String(row.source) : undefined
      })),
      cancellationAliases: (aliasesResponse.data || []).map((row: { alias: string }) => row.alias),
      reportedRadications,
      previousRadications,
      recurrentToday,
      conflicts,
      disappearedRadications
    };
  }

  public async saveSnapshot(
    report: IEndToEndParsedReport,
    analyzedRows: ReadonlyArray<IEndToEndAnalyzedRow>,
    exclusions: ReadonlyMap<number, string>,
    importedBy: string
  ): Promise<IEndToEndSnapshot> {
    requireDatabase();
    if (!report.summary.generationAt) throw new Error('La fecha de generación es obligatoria.');
    const duplicate = await supabase
      .from('e2e_snapshots')
      .select('id')
      .eq('file_hash', report.summary.fileHash)
      .maybeSingle();
    if (duplicate.error) throw databaseError('No se pudo verificar el hash del archivo', duplicate.error);
    if (duplicate.data) throw new Error('Este archivo ya fue importado; no se creó una fotografía duplicada.');

    const current = await supabase
      .from('e2e_snapshots')
      .select('*')
      .eq('status', 'active')
      .order('generation_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (current.error) throw databaseError('No se pudo determinar la fotografía activa', current.error);
    const currentSnapshot = current.data as IDatabaseSnapshot | null;
    const generationAt = report.summary.generationAt;
    const status: IEndToEndSnapshot['status'] = resolveSnapshotStatus(
      generationAt,
      currentSnapshot?.generation_at
    );

    const snapshotResponse = await supabase.from('e2e_snapshots').insert({
      file_name: report.summary.fileName,
      file_hash: report.summary.fileHash,
      generation_at: generationAt,
      imported_by: importedBy.trim().toLocaleLowerCase(),
      status,
      declared_total: report.summary.declaredTotal,
      detected_rows: report.summary.detectedRows,
      unique_radicaciones: report.summary.uniqueRadicaciones,
      total_pages: report.summary.totalPages,
      metadata: {
        sourceSheet: report.summary.sourceSheet,
        headerRow: report.summary.headerRow,
        issues: report.summary.issues
      }
    }).select('*').single();
    if (snapshotResponse.error) throw databaseError('No se pudo crear la fotografía End-to-End', snapshotResponse.error);
    const inserted = snapshotResponse.data as IDatabaseSnapshot;

    try {
      for (let index = 0; index < analyzedRows.length; index += 100) {
        const batch = analyzedRows.slice(index, index + 100).map((row) => ({
          snapshot_id: inserted.id,
          row_number: row.rowNumber,
          radicacion: row.radicacion,
          flow: row.flow,
          original_data: row.original,
          normalized_data: row,
          sla_result: row.sla,
          manually_excluded: Boolean(row.manuallyExcluded),
          exclusion_reason: row.exclusionReason || null
        }));
        const { error } = await supabase.from('e2e_rows').insert(batch);
        if (error) throw databaseError('No se pudieron guardar las filas originales', error);
      }
      const groupedRows = groupEndToEndRows(analyzedRows);
      for (let index = 0; index < groupedRows.length; index += 100) {
        const { error } = await supabase.from('e2e_groups').insert(
          groupedRows.slice(index, index + 100).map((group) => ({
            snapshot_id: inserted.id,
            radicacion: group.radicacion,
            group_result: group
          }))
        );
        if (error) throw databaseError('No se pudieron guardar los resultados agrupados', error);
      }
      if (exclusions.size > 0) {
        const { error } = await supabase.from('e2e_exclusions').insert(
          Array.from(exclusions.entries()).map(([rowNumber, reason]) => ({
            snapshot_id: inserted.id,
            row_number: rowNumber,
            excluded_by: importedBy.trim().toLocaleLowerCase(),
            reason
          }))
        );
        if (error) throw databaseError('No se pudo auditar la exclusión manual', error);
      }
      if (status === 'active' && currentSnapshot) {
        const [{ data: previousRows, error: previousError }] = await Promise.all([
          supabase.from('e2e_rows').select('radicacion').eq('snapshot_id', currentSnapshot.id)
        ]);
        if (previousError) throw databaseError('No se pudo conciliar la fotografía anterior', previousError);
        const currentRadications = new Set(analyzedRows.map((row) => row.radicacion));
        const disappeared = Array.from(new Set(
          (previousRows as Array<{ radicacion: string }>).map((row) => row.radicacion)
        )).filter((radicacion) => !currentRadications.has(radicacion));
        if (disappeared.length > 0) {
          const { error } = await supabase.from('e2e_presence_events').insert(
            disappeared.map((radicacion) => ({
              snapshot_id: inserted.id,
              previous_snapshot_id: currentSnapshot.id,
              radicacion,
              status: 'Ya no aparece en el reporte'
            }))
          );
          if (error) throw databaseError('No se pudieron registrar las radicaciones ausentes', error);
        }
      }
      if (status === 'active' && currentSnapshot) {
        const { error } = await supabase
          .from('e2e_snapshots')
          .update({ status: 'older' })
          .eq('id', currentSnapshot.id);
        if (error) throw databaseError('No se pudo cambiar la fotografía activa anterior', error);
      }
      if (status === 'conflict' && currentSnapshot) {
        const { error } = await supabase.from('e2e_version_conflicts').insert({
          generation_at: generationAt,
          first_snapshot_id: currentSnapshot.id,
          candidate_snapshot_id: inserted.id
        });
        if (error) throw databaseError('No se pudo registrar el conflicto de versiones', error);
      }
    } catch (error) {
      await supabase.from('e2e_snapshots').delete().eq('id', inserted.id);
      throw error;
    }

    return snapshotFromDatabase(inserted, [...analyzedRows]);
  }

  public async recordAction(action: Omit<IEndToEndReportAction, 'id' | 'createdAt'>): Promise<void> {
    requireDatabase();
    const { error } = await supabase.from('e2e_report_actions').insert({
      snapshot_id: action.snapshotId,
      radicaciones: action.radicaciones,
      action: action.action,
      user_email: action.userEmail.trim().toLocaleLowerCase()
    });
    if (error) throw databaseError('No se pudo auditar la acción de copiado/marcado', error);
  }

  public async resolveConflict(
    conflictId: string,
    resolvedSnapshotId: string,
    resolvedBy: string
  ): Promise<void> {
    requireDatabase();
    const { error } = await supabase.rpc('e2e_resolve_version_conflict', {
      p_conflict_id: conflictId,
      p_resolved_snapshot_id: resolvedSnapshotId,
      p_resolved_by: resolvedBy.trim().toLocaleLowerCase()
    });
    if (error) throw databaseError('No se pudo resolver y auditar el conflicto', error);
  }

  public async saveClosure(closure: IEndToEndClosure): Promise<void> {
    requireDatabase();
    const payload = {
      date: closure.date,
      description: closure.description.trim(),
      type: closure.type,
      all_day: closure.allDay,
      start_time: closure.allDay ? null : closure.startTime,
      end_time: closure.allDay ? null : closure.endTime,
      scope: closure.scope?.trim() || null,
      active: closure.active,
      observation: closure.observation?.trim() || null,
      source: closure.source?.trim() || null
    };
    const response = closure.id
      ? await supabase.from('e2e_non_working_periods').update(payload).eq('id', closure.id)
      : await supabase.from('e2e_non_working_periods').insert(payload);
    if (response.error) throw databaseError('No se pudo guardar el período no laborable', response.error);
  }
}

export const endToEndRepository = new EndToEndRepository();
