import { authenticatedSupabase, isSupabaseConfigured } from '../../services/supabase';
import type {
  IAcceptanceCriterion,
  InitiativeLifecycleStatus,
  InitiativePriority,
  ISolicitudMejora
} from '../../types';
import { criteriaToLegacyText } from './improvementsDomain';

export interface ISaveInitiativeInput {
  id?: string;
  autorNombre: string;
  autorEmail: string;
  aplicativo?: string;
  aplicativoId?: string;
  moduloAfectado: string;
  moduloId?: string;
  pantallaAfectada?: string;
  pantallaId?: string;
  moduloClave: string;
  titulo: string;
  actor: string;
  necesidad: string;
  beneficio: string;
  criterios: IAcceptanceCriterion[];
  prioridad: InitiativePriority;
  estadoCiclo: InitiativeLifecycleStatus;
  adjuntoUrl?: string;
  adjuntoNombre?: string;
  adjuntoTamano?: number;
}

const generateAuditId = (): string =>
  `MEJ-${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

const ensureConfigured = (): void => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase no está configurado; la iniciativa no puede sincronizarse.');
  }
};

const isMissingUpdatedAtError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const details = error as { code?: unknown; message?: unknown; details?: unknown };
  const diagnostic = `${String(details.message || '')} ${String(details.details || '')}`.toLocaleLowerCase();
  return diagnostic.includes('updated_at') && (
    details.code === '42703' ||
    details.code === 'PGRST204' ||
    diagnostic.includes('does not exist') ||
    diagnostic.includes('schema cache')
  );
};

const mapLegacyStatus = (status?: string): InitiativeLifecycleStatus => {
  if (status === 'Aprobada') return 'Aprobada';
  if (status === 'Declinada') return 'Descartada';
  return 'En Revision';
};

const parseCriteria = (jsonValue: unknown, legacyText?: string): IAcceptanceCriterion[] => {
  if (Array.isArray(jsonValue)) {
    return jsonValue.map((raw, index) => {
      const item = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
      return {
        id: String(item.id || `criterion-${index + 1}`),
        mode: item.mode === 'gherkin' ? 'gherkin' : 'checklist',
        text: String(item.text || ''),
        given: String(item.given || ''),
        when: String(item.when || ''),
        then: String(item.then || ''),
        verified: Boolean(item.verified)
      };
    });
  }
  return (legacyText || '').split(/\r?\n/).filter(Boolean).map((text, index) => ({
    id: `legacy-${index + 1}`,
    mode: 'checklist' as const,
    text: text.replace(/^\d+\.\s*/, ''),
    verified: false
  }));
};

const mapRow = (row: Record<string, unknown>): ISolicitudMejora => ({
  id: row.id ? String(row.id) : undefined,
  audit_id: String(row.audit_id || ''),
  owner_id: row.owner_id ? String(row.owner_id) : undefined,
  autor_nombre: String(row.autor_nombre || ''),
  autor_email: String(row.autor_email || ''),
  aplicativo: String(row.aplicativo || ''),
  modulo_afectado: String(row.modulo_afectado || ''),
  pantalla_afectada: String(row.pantalla_afectada || ''),
  titulo: String(row.titulo || ''),
  descripcion: String(row.descripcion || ''),
  criterios_aceptacion: String(row.criterios_aceptacion || ''),
  criterios_aceptacion_json: parseCriteria(row.criterios_aceptacion_json, String(row.criterios_aceptacion || '')),
  actor: String(row.actor || ''),
  necesidad: String(row.necesidad || ''),
  beneficio: String(row.beneficio || ''),
  modulo_clave: String(row.modulo_clave || row.modulo_afectado || ''),
  prioridad: (row.prioridad || 'Media') as InitiativePriority,
  estado_ciclo: (row.estado_ciclo || mapLegacyStatus(String(row.estado || ''))) as InitiativeLifecycleStatus,
  estado: (row.estado || 'Pendiente_Aprobacion') as ISolicitudMejora['estado'],
  adjunto_url: row.adjunto_url ? String(row.adjunto_url) : undefined,
  adjunto_nombre: row.adjunto_nombre ? String(row.adjunto_nombre) : undefined,
  adjunto_tamano: typeof row.adjunto_tamano === 'number' ? row.adjunto_tamano : undefined,
  comentario_supervisor: String(row.comentario_supervisor || ''),
  supervisor_email: String(row.supervisor_email || ''),
  supervisor_nombre: String(row.supervisor_nombre || ''),
  fecha_revision: row.fecha_revision ? String(row.fecha_revision) : undefined,
  created_at: row.created_at ? String(row.created_at) : undefined,
  updated_at: row.updated_at ? String(row.updated_at) : undefined
});

export class ImprovementsRepository {
  public async getCurrentUserId(): Promise<string> {
    ensureConfigured();
    const { data, error } = await authenticatedSupabase.auth.getUser();
    if (error || !data.user) throw new Error('La sesión segura de Supabase expiró. Inicia sesión nuevamente.');
    return data.user.id;
  }

  public async list(): Promise<ISolicitudMejora[]> {
    ensureConfigured();
    const primaryResult = await authenticatedSupabase
      .from('solicitudes_mejora')
      .select('*')
      .order('updated_at', { ascending: false })
      .order('created_at', { ascending: false });
    if (!primaryResult.error) {
      return (primaryResult.data || []).map((row) => mapRow(row as Record<string, unknown>));
    }
    if (!isMissingUpdatedAtError(primaryResult.error)) {
      throw new Error(`No se pudieron consultar las iniciativas: ${primaryResult.error.message}`);
    }

    const fallbackResult = await authenticatedSupabase
      .from('solicitudes_mejora')
      .select('*')
      .order('created_at', { ascending: false });
    if (fallbackResult.error) {
      throw new Error(`No se pudieron consultar las iniciativas: ${fallbackResult.error.message}`);
    }
    return (fallbackResult.data || []).map((row) => mapRow(row as Record<string, unknown>));
  }

  public async save(input: ISaveInitiativeInput): Promise<ISolicitudMejora> {
    ensureConfigured();
    const ownerId = await this.getCurrentUserId();
    const isDraft = input.estadoCiclo === 'Borrador';
    const payload = {
      owner_id: ownerId,
      autor_nombre: input.autorNombre.trim(),
      autor_email: input.autorEmail.trim().toLocaleLowerCase(),
      aplicativo: input.aplicativo?.trim() || '',
      aplicativo_id: input.aplicativoId || null,
      modulo_afectado: input.moduloAfectado.trim(),
      modulo_id: input.moduloId || null,
      pantalla_afectada: input.pantallaAfectada?.trim() || '',
      pantalla_id: input.pantallaId || null,
      modulo_clave: input.moduloClave,
      titulo: input.titulo.trim(),
      actor: input.actor.trim(),
      necesidad: input.necesidad.trim(),
      beneficio: input.beneficio.trim(),
      descripcion: `Como ${input.actor.trim()}, quiero ${input.necesidad.trim()}, para ${input.beneficio.trim()}.`,
      criterios_aceptacion: criteriaToLegacyText(input.criterios),
      criterios_aceptacion_json: input.criterios,
      prioridad: input.prioridad,
      estado_ciclo: input.estadoCiclo,
      estado: isDraft ? 'Pendiente_Aprobacion' : input.estadoCiclo === 'Descartada' ? 'Declinada' : input.estadoCiclo === 'Aprobada' ? 'Aprobada' : 'Pendiente_Aprobacion',
      adjunto_url: input.adjuntoUrl || null,
      adjunto_nombre: input.adjuntoNombre || null,
      adjunto_tamano: input.adjuntoTamano || null,
      updated_at: new Date().toISOString()
    };

    let response = input.id
      ? await authenticatedSupabase.from('solicitudes_mejora').update(payload).eq('id', input.id).select('*').single()
      : await authenticatedSupabase.from('solicitudes_mejora').insert([{ ...payload, audit_id: generateAuditId() }]).select('*').single();

    if (response.error && (response.error.code === '42703' || String(response.error.message).includes('adjunto'))) {
      const { adjunto_url: _url, adjunto_nombre: _nom, adjunto_tamano: _tam, ...fallbackPayload } = payload;
      response = input.id
        ? await authenticatedSupabase.from('solicitudes_mejora').update(fallbackPayload).eq('id', input.id).select('*').single()
        : await authenticatedSupabase.from('solicitudes_mejora').insert([{ ...fallbackPayload, audit_id: generateAuditId() }]).select('*').single();
    }

    if (response.error || !response.data) {
      throw new Error(`No se pudo guardar la iniciativa: ${response.error?.message || 'Supabase no retornó datos.'}`);
    }
    return mapRow(response.data as Record<string, unknown>);
  }

  public async remove(id: string): Promise<void> {
    ensureConfigured();
    const { data, error } = await authenticatedSupabase
      .from('solicitudes_mejora').delete().eq('id', id).select('id');
    if (error) throw new Error(`No se pudo eliminar la iniciativa: ${error.message}`);
    if (!data?.length) throw new Error('La iniciativa no existe o no posee permiso para eliminarla.');
  }

  public async review(
    id: string,
    status: 'Aprobada' | 'Descartada',
    comment: string,
    reviewerEmail: string,
    reviewerName: string
  ): Promise<void> {
    ensureConfigured();
    const { error } = await authenticatedSupabase.rpc('iniciativas_review', {
      target_id: id,
      target_status: status,
      review_comment: comment.trim(),
      reviewer_email: reviewerEmail.trim().toLocaleLowerCase(),
      reviewer_name: reviewerName.trim()
    });
    if (error) throw new Error(`No se pudo revisar la iniciativa: ${error.message}`);
  }
}

export const improvementsRepository = new ImprovementsRepository();
