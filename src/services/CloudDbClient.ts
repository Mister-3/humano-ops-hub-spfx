import { supabase, isSupabaseConfigured } from './supabase';
import IndexedDbAdapter, { LOCAL_STORES } from './IndexedDbAdapter';
import type { IAppUserRecord, AppUserStatus, AppUserRole } from '../auth/AuthModels';
import type { IHeadcountRow } from './PowerAutomateSyncService';
import type {
  AusenciaType,
  CatalogCategory,
  IFaltaHistorialItem,
  IFaltaAprobacionItem,
  IKudoHistorialItem,
  ICatalogoItem,
  IEmpleadoDelMes,
  IProductividadHistorialItem,
  IRegistrarProductividadData,
  IAusenciaItem,
  IRegistrarAusenciaData,
  IRegistrarFaltaData,
  IRegistrarKudoData,
  ISolicitudMejora
} from '../types';
import type {
  ILlamadaFlotaItem,
  IRegistrarLlamadaFlotaData
} from '../webparts/supervisionOperaciones/services/SharePointService';

import { generateAuditID } from '../webparts/supervisionOperaciones/utils/auditUtils';

const indexedDb = new IndexedDbAdapter();

const formatSupabaseError = (operation: string, error: unknown): Error => {
  const candidate = error as {
    code?: string;
    details?: string;
    hint?: string;
    message?: string;
  } | null;
  const parts = [
    candidate?.message,
    candidate?.details,
    candidate?.hint,
    candidate?.code ? `Código: ${candidate.code}` : undefined
  ].filter(Boolean);

  return new Error(
    parts.length > 0
      ? `${operation}: ${parts.join(' · ')}`
      : `${operation}: Supabase no devolvió detalles del error.`
  );
};

export interface ISupabaseUserRow {
  id?: number | string;
  email?: string;
  nombre?: string;
  rol?: string;
  estado?: string;
  is_profile_validated_pa?: boolean;
  is_role_manually_overridden?: boolean;
  fecha_registro?: string;
  password_hash?: string;
}

export interface ISupabaseHeadcountRow {
  id?: number | string;
  member_email?: string;
  email_empleado?: string;
  member_name?: string;
  nombre_empleado?: string;
  supervisor_email?: string;
  email_supervisor?: string;
  member_puesto?: string;
  cargo?: string;
  member_area?: string;
  departamento?: string;
  estado_activo?: boolean;
  rol?: string;
}

export interface ISupabaseFaltaRow {
  id?: number | string;
  audit_id?: string;
  email_empleado?: string;
  motivo?: string;
  id_caso_helpdesk?: string;
  horas_perdidas?: number;
  minutos_tardanza?: number;
  fecha?: string;
  impacto?: string;
  estado?: string;
  estado_aprobacion?: string;
  evidencia_url?: string;
}

export interface ISupabaseKudoRow {
  id?: number | string;
  email_destino?: string;
  email_origen?: string;
  motivo?: string;
  categoria?: string;
  puntos?: number;
  fecha?: string;
}

export interface ISupabaseMetaRow {
  id?: number | string;
  email_empleado?: string;
  email?: string;
  mes?: number | string;
  anio?: number | string;
  year?: number | string;
  meta_kpis?: number;
  meta_kudos?: number;
  fecha_creacion?: string;
}

export interface IMetaRecord {
  Id?: number;
  ID?: string;
  EmailEmpleado: string;
  Mes: number;
  Anio: number;
  MetaKpis: number;
  MetaKudos: number;
  FechaCreacion?: string;
  SyncStatus?: 'Pendiente' | 'Sincronizado';
  UpdatedAt?: string;
}

export const deduplicateKudos = <T extends Partial<IKudoHistorialItem> & {
  id?: number | string;
  email_destino?: string;
  email_origen?: string;
  fecha?: string;
  motivo?: string;
}>(
  items: ReadonlyArray<T>
): T[] => {
  const seenKeys = new Set<string>();
  const result: T[] = [];

  for (const kudo of items) {
    const numericId = typeof kudo.Id === 'number' && kudo.Id > 0
      ? kudo.Id
      : (typeof kudo.id === 'number' && kudo.id > 0 ? kudo.id : 0);
    const auditId = (kudo.AuditID || (typeof kudo.id === 'string' ? kudo.id : '')).trim();
    const email = (kudo.AgenteEmail || kudo.email_destino || kudo.Title || '').trim().toLowerCase();
    const fecha = (kudo.FechaKudo || kudo.fecha || '').trim();
    const motivo = (kudo.Atributo || kudo.Mensaje || kudo.motivo || '').trim().toLowerCase();

    const key = numericId > 0
      ? `id:${numericId}`
      : (auditId && auditId !== '-')
        ? `audit:${auditId}`
        : `composite:${email}_${fecha}_${motivo}`;

    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      result.push(kudo);
    }
  }

  return result;
};

export class CloudDbClient {
  // ==========================================
  // USUARIOS CRUD
  // ==========================================

  public async getUsuarios(): Promise<IAppUserRecord[]> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('usuarios')
          .select('*');

        if (!error && Array.isArray(data) && data.length > 0) {
          const mappedUsers: IAppUserRecord[] = data.map((row: ISupabaseUserRow, index: number) => {
            const numericId = typeof row.id === 'number' ? row.id : (index + 1);
            return {
              Id: numericId,
              ID: String(row.id || `USR-${numericId}`),
              Email: row.email || '',
              Nombre: row.nombre || '',
              Rol: (row.rol as AppUserRole) || 'Agente',
              Estado: (row.estado as AppUserStatus) || 'Pending_Admin_Approval',
              IsProfileValidatedByPA: Boolean(row.is_profile_validated_pa),
              IsRoleManuallyOverridden: Boolean(row.is_role_manually_overridden),
              FechaRegistro: row.fecha_registro || new Date().toISOString(),
              FechaAprobacion: '',
              PasswordHash: row.password_hash || '',
              SyncStatus: 'Sincronizado'
            };
          });

          // Sync / cache into IndexedDB
          try {
            await indexedDb.replaceAll(LOCAL_STORES.users, mappedUsers);
          } catch {
            // Ignore cache write errors
          }

          return mappedUsers;
        }
      } catch (err) {
        console.warn('CloudDbClient.getUsuarios fallback to IndexedDB:', err);
      }
    }

    // Fallback to IndexedDB
    return indexedDb.getAll<IAppUserRecord>(LOCAL_STORES.users);
  }

  public async createUsuario(user: Partial<IAppUserRecord>): Promise<IAppUserRecord> {
    const newUserRecord: IAppUserRecord = {
      ID: user.ID || `USR-${Date.now().toString(36).toUpperCase()}`,
      Email: user.Email || '',
      Nombre: user.Nombre || '',
      Rol: user.Rol || 'Agente',
      Estado: user.Estado || 'Pending_Admin_Approval',
      IsProfileValidatedByPA: Boolean(user.IsProfileValidatedByPA),
      FechaRegistro: user.FechaRegistro || new Date().toISOString(),
      FechaAprobacion: user.FechaAprobacion || '',
      PasswordHash: user.PasswordHash || '',
      SyncStatus: 'Pendiente',
      UpdatedAt: new Date().toISOString()
    };

    if (isSupabaseConfigured()) {
      const payload: ISupabaseUserRow = {
        email: newUserRecord.Email,
        nombre: newUserRecord.Nombre,
        rol: newUserRecord.Rol,
        estado: newUserRecord.Estado,
        is_profile_validated_pa: newUserRecord.IsProfileValidatedByPA,
        fecha_registro: newUserRecord.FechaRegistro,
        password_hash: newUserRecord.PasswordHash
      };

      const { data, error } = await supabase
        .from('usuarios')
        .insert([payload])
        .select();

      if (error) {
        console.error('[CRITICAL SUPABASE INSERT ERROR]:', error);
        throw error;
      }

      if (data && data.length > 0) {
        const insertedRow = data[0] as ISupabaseUserRow;
        if (insertedRow.id && typeof insertedRow.id === 'number') {
          newUserRecord.Id = insertedRow.id;
          newUserRecord.SyncStatus = 'Sincronizado';
        }
      }
    }

    // Store in IndexedDB local cache after successful Supabase insertion (or if offline)
    const savedLocal = await indexedDb.add<IAppUserRecord>(LOCAL_STORES.users, newUserRecord);

    return savedLocal;
  }

  public async updateUsuarioStatus(
    identifier: number | string,
    estado: AppUserStatus,
    rol?: AppUserRole,
    isProfileValidatedByPA?: boolean,
    isManualOverride?: boolean
  ): Promise<void> {
    if (isSupabaseConfigured()) {
      try {
        const updatePayload: Record<string, unknown> = {};
        if (estado) updatePayload.estado = estado;
        if (rol) updatePayload.rol = rol;
        if (typeof isProfileValidatedByPA === 'boolean') {
          updatePayload.is_profile_validated_pa = isProfileValidatedByPA;
        }

        console.log('Enviando PATCH a Supabase para:', identifier, updatePayload);

        const strId = String(identifier).trim();
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(strId);
        const isNumeric = typeof identifier === 'number' || /^\d+$/.test(strId);

        let query = supabase.from('usuarios').update(updatePayload);
        if (isUuid) {
          query = query.eq('id', strId);
        } else if (isNumeric) {
          query = query.eq('id', typeof identifier === 'number' ? identifier : parseInt(strId, 10));
        } else {
          query = query.eq('email', strId.toLowerCase());
        }

        await query;
      } catch (err) {
        console.warn('CloudDbClient.updateUsuarioStatus Supabase error:', err);
      }
    }

    // Update IndexedDB
    try {
      const users = await indexedDb.getAll<IAppUserRecord>(LOCAL_STORES.users);
      const target = users.find(u =>
        typeof identifier === 'number'
          ? u.Id === identifier
          : u.Email.toLowerCase() === String(identifier).trim().toLowerCase()
      );

      if (target && target.Id) {
        const nextOverride = typeof isManualOverride === 'boolean'
          ? isManualOverride
          : (rol ? true : Boolean(target.IsRoleManuallyOverridden));
        await indexedDb.put(LOCAL_STORES.users, {
          ...target,
          Id: target.Id,
          Estado: estado,
          Rol: rol || target.Rol,
          IsProfileValidatedByPA: typeof isProfileValidatedByPA === 'boolean'
            ? isProfileValidatedByPA
            : target.IsProfileValidatedByPA,
          IsRoleManuallyOverridden: nextOverride,
          SyncStatus: 'Pendiente'
        });
      }
    } catch (err) {
      console.warn('CloudDbClient.updateUsuarioStatus IndexedDB error:', err);
    }
  }

  public async updateUsuarioRole(
    identifier: number | string,
    newRole: AppUserRole | string
  ): Promise<void> {
    if (isSupabaseConfigured()) {
      try {
        const updatePayload = {
          rol: newRole
        };
        console.log('Enviando PATCH a Supabase para:', identifier, updatePayload);

        const strId = String(identifier).trim();
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(strId);
        const isNumeric = typeof identifier === 'number' || /^\d+$/.test(strId);

        let query = supabase.from('usuarios').update(updatePayload);
        if (isUuid) {
          query = query.eq('id', strId);
        } else if (isNumeric) {
          query = query.eq('id', typeof identifier === 'number' ? identifier : parseInt(strId, 10));
        } else {
          query = query.eq('email', strId.toLowerCase());
        }

        await query;
      } catch (err) {
        console.warn('CloudDbClient.updateUsuarioRole Supabase error:', err);
      }
    }

    // Update IndexedDB
    try {
      const users = await indexedDb.getAll<IAppUserRecord>(LOCAL_STORES.users);
      const target = users.find(u =>
        typeof identifier === 'number'
          ? u.Id === identifier
          : u.Email.toLowerCase() === identifier.toLowerCase()
      );

      if (target && target.Id) {
        await indexedDb.put(LOCAL_STORES.users, {
          ...target,
          Id: target.Id,
          Rol: newRole as AppUserRole,
          IsRoleManuallyOverridden: true,
          SyncStatus: 'Pendiente'
        });
      }
    } catch (err) {
      console.warn('CloudDbClient.updateUsuarioRole IndexedDB error:', err);
    }
  }

  // ==========================================
  // HEADCOUNT CRUD (HeadcountService)
  // ==========================================

  public async getHeadcount(): Promise<IHeadcountRow[]> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('headcount')
          .select('*');

        if (!error && Array.isArray(data) && data.length > 0) {
          const mapped: IHeadcountRow[] = data.map((row: ISupabaseHeadcountRow, index: number) => ({
            Id: typeof row.id === 'number' ? row.id : (index + 1),
            ID: String(row.id || `HC-${index + 1}`),
            EmailEmpleado: row.member_email || row.email_empleado || (row as any).email || '',
            NombreEmpleado: row.member_name || row.nombre_empleado || (row as any).nombre || '',
            EmailSupervisor: row.supervisor_email || row.email_supervisor || '',
            Cargo: row.member_puesto || row.cargo || 'Oficial',
            Departamento: row.member_area || row.departamento || 'Operaciones',
            EstadoActivo: row.estado_activo !== false,
            AgenteObjectID: (row as any).agente_object_id || '',
            Rol: (row.rol as any) || 'Oficial',
            SyncStatus: 'Sincronizado'
          }));

          try {
            await indexedDb.replaceAll(LOCAL_STORES.headcount, mapped);
          } catch {
            // Ignore cache error
          }
          return mapped;
        }
      } catch (err) {
        console.warn('CloudDbClient.getHeadcount fallback to IndexedDB:', err);
      }
    }

    return indexedDb.getAll<IHeadcountRow>(LOCAL_STORES.headcount);
  }

  public async getHeadcountBySupervisor(supervisorEmail: string): Promise<IHeadcountRow[]> {
    const normSupervisor = (supervisorEmail || '').trim().toLowerCase();
    if (!normSupervisor) return [];

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('headcount')
          .select('*')
          .or(`supervisor_email.ilike.${normSupervisor},email_supervisor.ilike.${normSupervisor}`);

        if (!error && Array.isArray(data) && data.length > 0) {
          return data.map((row: ISupabaseHeadcountRow, index: number) => ({
            Id: typeof row.id === 'number' ? row.id : (index + 1),
            ID: String(row.id || `HC-${index + 1}`),
            EmailEmpleado: row.member_email || row.email_empleado || (row as any).email || '',
            NombreEmpleado: row.member_name || row.nombre_empleado || (row as any).nombre || '',
            EmailSupervisor: row.supervisor_email || row.email_supervisor || '',
            Cargo: row.member_puesto || row.cargo || 'Oficial',
            Departamento: row.member_area || row.departamento || 'Operaciones',
            EstadoActivo: row.estado_activo !== false,
            AgenteObjectID: (row as any).agente_object_id || '',
            Rol: (row.rol as any) || 'Oficial',
            SyncStatus: 'Sincronizado'
          }));
        }
      } catch (err) {
        console.warn('CloudDbClient.getHeadcountBySupervisor fallback to IndexedDB:', err);
      }
    }

    const allLocal = await indexedDb.getAll<IHeadcountRow>(LOCAL_STORES.headcount);
    return allLocal.filter(row => {
      const sup = (row.EmailSupervisor || (row as any).SupervisorEmail || '').trim().toLowerCase();
      return sup === normSupervisor;
    });
  }

  public async upsertHeadcount(
    rows: ReadonlyArray<unknown>
  ): Promise<void> {
    if (!rows || rows.length === 0) return;

    const registrosHeadcount = rows.map((r: any) => {
      const memberEmail = (
        r.member_email || r.memberemail || r.MemberEmail || r.EmailEmpleado || r.email_empleado || r.emailempleado || r.email || r.Correo || r.correo || ''
      ).toString().trim().toLowerCase();
      const memberName = (
        r.member_name || r.membername || r.MemberName || r.NombreEmpleado || r.nombre_empleado || r.nombreempleado || r.nombre || ''
      ).toString().trim();
      const supervisorEmail = (
        r.supervisor_email || r.supervisoremail || r.SupervisorEmail || r.EmailSupervisor || r.email_supervisor || r.emailsupervisor || ''
      ).toString().trim().toLowerCase();
      const memberPuesto = (
        r.member_puesto || r.memberpuesto || r.MemberPuesto || r.Cargo || r.cargo || r.puesto || ''
      ).toString().trim() || 'Oficial';
      const memberArea = (
        r.member_area || r.memberarea || r.MemberArea || r.Departamento || r.departamento || r.area || ''
      ).toString().trim() || 'Operaciones';
      const estadoActivo = r.EstadoActivo ?? r.estado_activo ?? true;

      return {
        member_email: memberEmail,
        member_name: memberName,
        supervisor_email: supervisorEmail,
        member_puesto: memberPuesto,
        member_area: memberArea,
        estado_activo: Boolean(estadoActivo)
      };
    }).filter(item => Boolean(item.member_email));

    if (registrosHeadcount.length === 0) return;

    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase
          .from('headcount')
          .upsert(registrosHeadcount, { onConflict: 'member_email' });

        if (!error) {
          console.log('Headcount importado exitosamente:', registrosHeadcount.length);
        } else {
          console.warn('CloudDbClient.upsertHeadcount Supabase error (intentando insert):', error);
          await supabase.from('headcount').insert(registrosHeadcount);
          console.log('Headcount importado exitosamente:', registrosHeadcount.length);
        }
      } catch (err) {
        console.warn('CloudDbClient.upsertHeadcount error:', err);
      }
    }
  }

  // ==========================================
  // FALTAS Y ERRORES CRUD (OperacionalService)
  // ==========================================

  public async getFaltas(): Promise<IFaltaHistorialItem[]> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase no está configurado; no se puede consultar el histórico de faltas.');
    }

    const { data, error } = await supabase
      .from('faltas_errores')
      .select('*')
      .order('fecha', { ascending: false });

    if (error) {
      throw formatSupabaseError('No se pudo consultar faltas_errores', error);
    }

    const mappedFaltas: IFaltaHistorialItem[] = (data || []).map((row: any, index: number) => {
      const numericId = typeof row.id === 'number' ? row.id : (index + 1);
      const email = row.email_empleado || row.colaborador_email || row.agente_email || '';
      const categoria = row.tipo_registro || row.categoria || row.motivo || '';
      return {
        Id: numericId,
        rawId: row.id ? String(row.id) : undefined,
        Title: row.colaborador_nombre || row.agente_nombre || email,
        AgenteEmail: email,
        EmailSupervisor: row.supervisor_email || '',
        FechaFalta: row.fecha || row.fecha_falta || '',
        Categoria: categoria,
        Subcategoria: row.subcategoria || '',
        CasoRef: row.id_caso_helpdesk || '',
        IdCasoHelpdesk: row.id_caso_helpdesk || '',
        ProcesoArea: row.proceso_area || '',
        Comentarios: row.comentarios || row.descripcion || '',
        ComentariosCapacitacion: row.comentarios_capacitacion || '',
        HoraLlegada: row.hora_llegada || '',
        HorasPerdidas: Number(row.horas_perdidas) || 0,
        MinutosTardanza: Number(row.minutos_tardanza ?? row.tardanza_minutos) || 0,
        Impacto: row.impacto || row.gravedad || row.categoria_impacto || 'Bajo',
        Estado: (row.estado as IFaltaHistorialItem['Estado']) || 'Aprobado',
        EstadoAprobacion: (row.estado_aprobacion as IFaltaHistorialItem['EstadoAprobacion']) || 'Registrado',
        RolOriginador: (row.rol_originador as IFaltaHistorialItem['RolOriginador']) || 'Supervisor',
        AuditID: row.audit_id || '',
        IdAuditoria: row.audit_id || row.id_auditoria || '',
        SyncStatus: 'Sincronizado'
      };
    });

    try {
      await indexedDb.replaceAll(LOCAL_STORES.faltas, mappedFaltas);
    } catch {
      // Cache writes never replace the Supabase response as source of truth.
    }

    return mappedFaltas;
  }

  public async createFalta(
    faltaData: IRegistrarFaltaData | Partial<IFaltaHistorialItem>
  ): Promise<IFaltaHistorialItem> {
    const isRegistrarData = 'agente' in faltaData;
    const emailEmpleado = isRegistrarData
      ? (faltaData.agenteEmail || faltaData.agente)
      : (faltaData.AgenteEmail || faltaData.Title || '');
    const motivo = isRegistrarData ? faltaData.categoria : (faltaData.Categoria || '');
    const casoHelpdesk = isRegistrarData
      ? (faltaData.casoRef || '')
      : (faltaData.IdCasoHelpdesk || faltaData.CasoRef || '');
    const horasPerdidas = isRegistrarData ? (faltaData.horasPerdidas || 0) : (faltaData.HorasPerdidas || 0);
    const minutosTardanza = isRegistrarData ? (faltaData.minutosTardanza || 0) : (faltaData.MinutosTardanza || 0);
    const fechaISO = isRegistrarData
      ? (faltaData.fecha instanceof Date ? faltaData.fecha.toISOString() : new Date().toISOString())
      : (faltaData.FechaFalta || new Date().toISOString());

    const recordToSave: Omit<IFaltaHistorialItem, 'Id'> = {
      Title: isRegistrarData ? faltaData.agente : (faltaData.Title || emailEmpleado),
      AgenteEmail: emailEmpleado,
      EmailSupervisor: isRegistrarData
        ? (faltaData.emailSupervisor || '')
        : (faltaData.EmailSupervisor || ''),
      FechaFalta: fechaISO,
      Categoria: motivo,
      Subcategoria: isRegistrarData ? (faltaData.subcategoria || '') : (faltaData.Subcategoria || ''),
      CasoRef: casoHelpdesk,
      IdCasoHelpdesk: casoHelpdesk,
      ProcesoArea: isRegistrarData ? (faltaData.procesoArea || '') : (faltaData.ProcesoArea || ''),
      Comentarios: isRegistrarData ? (faltaData.comentarios || '') : (faltaData.Comentarios || ''),
      ComentariosCapacitacion: isRegistrarData
        ? (faltaData.comentariosCapacitacion || '')
        : (faltaData.ComentariosCapacitacion || ''),
      HoraLlegada: isRegistrarData ? (faltaData.horaLlegada || '') : (faltaData.HoraLlegada || ''),
      HorasPerdidas: horasPerdidas,
      MinutosTardanza: minutosTardanza,
      Impacto: isRegistrarData ? faltaData.impacto : (faltaData.Impacto || 'Bajo'),
      Estado: isRegistrarData ? faltaData.estado : (faltaData.Estado || 'Aprobado'),
      EstadoAprobacion: 'Aprobado',
      RolOriginador: isRegistrarData ? faltaData.rolOriginador : (faltaData.RolOriginador || 'Supervisor'),
      SyncStatus: 'Pendiente',
      UpdatedAt: new Date().toISOString()
    };

    const evidenciaUrl = isRegistrarData
      ? (faltaData.evidenciaUrl || '')
      : ((faltaData as any).evidencia_url || (faltaData as any).evidenciaUrl || '');
    const estadoAprobacion = isRegistrarData
      ? (faltaData.estadoAprobacion || 'Registrado')
      : ((faltaData as any).estado_aprobacion || (faltaData as any).estadoAprobacion || 'Registrado');

    const auditId = isRegistrarData
      ? ((faltaData as any).auditId || (faltaData as any).audit_id || (faltaData as any).idAuditoria || generateAuditID())
      : ((faltaData as any).audit_id || (faltaData as any).AuditID || (faltaData as any).IdAuditoria || generateAuditID());

    if (!emailEmpleado.trim() || !motivo.trim()) {
      throw new Error('El correo del colaborador y el tipo de falta son obligatorios.');
    }

    if (!isSupabaseConfigured()) {
      throw new Error('Supabase no está configurado; la falta no fue guardada.');
    }

    const payload: Record<string, any> = {
      audit_id: auditId,
      email_empleado: emailEmpleado.trim().toLowerCase(),
      colaborador_email: emailEmpleado.trim().toLowerCase(),
      colaborador_nombre: isRegistrarData ? faltaData.agente : (faltaData.Title || emailEmpleado),
      tipo_registro: motivo,
      motivo,
      supervisor_email: recordToSave.EmailSupervisor || '',
      id_caso_helpdesk: casoHelpdesk,
      horas_perdidas: horasPerdidas,
      minutos_tardanza: minutosTardanza,
      fecha: fechaISO,
      impacto: recordToSave.Impacto,
      categoria_impacto: recordToSave.Impacto,
      descripcion: recordToSave.Comentarios || recordToSave.ComentariosCapacitacion || motivo,
      estado: recordToSave.Estado,
      estado_aprobacion: estadoAprobacion,
      evidencia_url: evidenciaUrl
    };

    const { data: insertedRows, error } = await supabase
      .from('faltas_errores')
      .insert([payload])
      .select();

    if (error) {
      throw formatSupabaseError('No se pudo guardar la falta en faltas_errores', error);
    }

    if (!insertedRows || insertedRows.length !== 1) {
      throw new Error('Supabase no confirmó la creación de la falta.');
    }

    const insertedRow = insertedRows[0] as ISupabaseFaltaRow;
    const officialItem: IFaltaHistorialItem = {
      ...recordToSave,
      Id: typeof insertedRow.id === 'number' ? insertedRow.id : Date.now(),
      rawId: insertedRow.id ? String(insertedRow.id) : undefined,
      AuditID: auditId,
      SyncStatus: 'Sincronizado'
    };
    try {
      await indexedDb.add<IFaltaHistorialItem>(LOCAL_STORES.faltas, officialItem);
    } catch {
      // The confirmed Supabase insert remains authoritative.
    }
    return officialItem;
  }

  // ==========================================
  // KUDOS CRUD (KudosService)
  // ==========================================

  public async getKudos(): Promise<IKudoHistorialItem[]> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase no está configurado; no se puede consultar el histórico de Kudos.');
    }

    const { data, error } = await supabase
      .from('kudos')
      .select('*')
      .order('fecha', { ascending: false });

    if (error) {
      throw formatSupabaseError('No se pudo consultar kudos', error);
    }

    const mappedKudos: IKudoHistorialItem[] = (data || []).map((row: ISupabaseKudoRow, index: number) => {
      const numericId = typeof row.id === 'number' ? row.id : (index + 1);
      return {
        Id: numericId,
        rawId: row.id ? String(row.id) : undefined,
        Title: row.email_destino || '',
        AgenteEmail: row.email_destino || '',
        EmailEmisor: row.email_origen || '',
        Atributo: row.categoria || '',
        Mensaje: row.motivo || '',
        Puntos: row.puntos ?? 10,
        FechaKudo: row.fecha || '',
        Remitente: row.email_origen || '',
        SyncStatus: 'Sincronizado'
      };
    });
    const deduplicated = deduplicateKudos(mappedKudos);

    try {
      await indexedDb.replaceAll(LOCAL_STORES.kudos, deduplicated);
    } catch {
      // Cache writes never replace the Supabase response as source of truth.
    }

    return deduplicated;
  }

  public async createKudo(
    kudoData: IRegistrarKudoData | Partial<IKudoHistorialItem>
  ): Promise<IKudoHistorialItem> {
    const isRegistrarData = 'agente' in kudoData;
    const emailDestino = isRegistrarData
      ? (kudoData.agenteEmail || kudoData.agente)
      : (kudoData.AgenteEmail || kudoData.Title || '');
    const emailOrigen = isRegistrarData
      ? (kudoData.remitenteEmail || kudoData.remitente)
      : (kudoData.EmailEmisor || kudoData.Remitente || '');
    const motivo = isRegistrarData
      ? `${kudoData.atributo}: ${kudoData.mensaje}`
      : (kudoData.Atributo || kudoData.Mensaje || '');
    const puntos = isRegistrarData ? kudoData.puntos : (kudoData.Puntos || 10);
    const fechaISO = isRegistrarData
      ? (kudoData.fecha instanceof Date ? kudoData.fecha.toISOString() : new Date().toISOString())
      : (kudoData.FechaKudo || new Date().toISOString());

    const recordToSave: Omit<IKudoHistorialItem, 'Id'> = {
      Title: isRegistrarData ? kudoData.agente : (kudoData.Title || emailDestino),
      AgenteEmail: emailDestino,
      EmailEmisor: emailOrigen,
      Atributo: isRegistrarData ? kudoData.atributo : (kudoData.Atributo || motivo),
      Mensaje: isRegistrarData ? kudoData.mensaje : (kudoData.Mensaje || motivo),
      Puntos: puntos,
      FechaKudo: fechaISO,
      Remitente: isRegistrarData ? kudoData.remitente : (kudoData.Remitente || emailOrigen),
      SyncStatus: 'Pendiente',
      UpdatedAt: new Date().toISOString()
    };

    if (!isSupabaseConfigured()) {
      throw new Error('Supabase no está configurado; el Kudo no fue guardado.');
    }

    const payload: ISupabaseKudoRow = {
      email_destino: emailDestino.trim().toLowerCase(),
      email_origen: emailOrigen.trim().toLowerCase(),
      motivo: isRegistrarData ? kudoData.mensaje.trim() : motivo,
      categoria: isRegistrarData ? kudoData.atributo.trim() : recordToSave.Atributo,
      fecha: fechaISO
    };

    const { data: insertedRows, error } = await supabase
      .from('kudos')
      .insert([payload])
      .select();

    if (error) {
      throw formatSupabaseError('No se pudo guardar el reconocimiento en kudos', error);
    }

    if (!insertedRows || insertedRows.length !== 1) {
      throw new Error('Supabase no confirmó la creación del Kudo.');
    }

    const insertedRow = insertedRows[0] as ISupabaseKudoRow;
    const officialItem: IKudoHistorialItem = {
      ...recordToSave,
      Id: typeof insertedRow.id === 'number' ? insertedRow.id : Date.now(),
      rawId: insertedRow.id ? String(insertedRow.id) : undefined,
      SyncStatus: 'Sincronizado'
    };
    try {
      await indexedDb.add<IKudoHistorialItem>(LOCAL_STORES.kudos, officialItem);
    } catch {
      // The confirmed Supabase insert remains authoritative.
    }
    return officialItem;
  }

  // ==========================================
  // METAS CRUD (AdminService)
  // ==========================================

  public async getMetas(emailEmpleado?: string): Promise<IMetaRecord[]> {
    if (isSupabaseConfigured()) {
      try {
        let query = supabase.from('metas').select('*');
        if (emailEmpleado) {
          query = query.ilike('email_empleado', emailEmpleado.trim());
        }
        const { data, error } = await query;

        if (!error && Array.isArray(data)) {
          const mapped: IMetaRecord[] = data.map((row: ISupabaseMetaRow, index: number) => ({
            Id: typeof row.id === 'number' ? row.id : (index + 1),
            ID: String(row.id || `META-${index + 1}`),
            EmailEmpleado: row.email_empleado || row.email || '',
            Mes: Number(row.mes) || (new Date().getMonth() + 1),
            Anio: Number(row.anio || row.year) || new Date().getFullYear(),
            MetaKpis: Number(row.meta_kpis) || 0,
            MetaKudos: Number(row.meta_kudos) || 0,
            FechaCreacion: row.fecha_creacion || new Date().toISOString(),
            SyncStatus: 'Sincronizado'
          }));

          try {
            await indexedDb.replaceAll(LOCAL_STORES.metas, mapped);
          } catch {
            // Ignore cache error
          }
          return mapped;
        }
      } catch (err) {
        console.warn('CloudDbClient.getMetas fallback to IndexedDB:', err);
      }
    }

    const localMetas = await indexedDb.getAll<IMetaRecord>(LOCAL_STORES.metas);
    if (emailEmpleado) {
      const norm = emailEmpleado.trim().toLowerCase();
      return localMetas.filter(m => (m.EmailEmpleado || '').trim().toLowerCase() === norm);
    }
    return localMetas;
  }

  public async createMeta(metaData: Partial<IMetaRecord>): Promise<IMetaRecord> {
    const recordToSave: IMetaRecord = {
      ID: metaData.ID || `META-${Date.now().toString(36).toUpperCase()}`,
      EmailEmpleado: metaData.EmailEmpleado || '',
      Mes: metaData.Mes || (new Date().getMonth() + 1),
      Anio: metaData.Anio || new Date().getFullYear(),
      MetaKpis: metaData.MetaKpis || 0,
      MetaKudos: metaData.MetaKudos || 0,
      FechaCreacion: metaData.FechaCreacion || new Date().toISOString(),
      SyncStatus: 'Pendiente',
      UpdatedAt: new Date().toISOString()
    };

    if (isSupabaseConfigured()) {
      try {
        const payload: Record<string, any> = {
          email_empleado: recordToSave.EmailEmpleado,
          mes: recordToSave.Mes,
          anio: recordToSave.Anio,
          meta_kpis: recordToSave.MetaKpis,
          meta_kudos: recordToSave.MetaKudos,
          fecha_creacion: recordToSave.FechaCreacion,
          titulo: `Meta ${recordToSave.Mes}/${recordToSave.Anio} - ${recordToSave.EmailEmpleado}`,
          meta_objetivo: recordToSave.MetaKpis || 0
        };

        const { data, error } = await supabase.from('metas').insert([payload]).select();
        if (!error && data && data.length > 0) {
          const insertedRow = data[0] as ISupabaseMetaRow;
          const officialItem: IMetaRecord = {
            ...recordToSave,
            Id: typeof insertedRow.id === 'number' ? insertedRow.id : Date.now(),
            SyncStatus: 'Sincronizado'
          };
          try {
            await indexedDb.add<IMetaRecord>(LOCAL_STORES.metas, officialItem);
          } catch {
            // Ignore cache error
          }
          return officialItem;
        }
      } catch (err) {
        console.warn('CloudDbClient.createMeta error inserting to Supabase:', err);
      }
    }

    const savedLocal = await indexedDb.add<IMetaRecord>(LOCAL_STORES.metas, recordToSave);
    return savedLocal;
  }

  // ==========================================
  // CONFIGURACIONES DEL SISTEMA (tabla: configuraciones_sistema)
  // ==========================================

  public async getConfiguracionSistema(): Promise<Record<string, any>> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.from('configuraciones_sistema').select('*');
        if (!error && Array.isArray(data)) {
          const configMap: Record<string, any> = {};
          data.forEach((row: any) => {
            if (row.clave) {
              configMap[row.clave] = row.valor ?? row.val_num;
            }
          });
          return configMap;
        }
      } catch (err) {
        console.warn('Error al leer configuraciones_sistema:', err);
      }
    }
    return {};
  }

  public async saveConfiguracionSistema(clave: string, valor: any): Promise<void> {
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('configuraciones_sistema').upsert([
          { clave, valor: String(valor) }
        ], { onConflict: 'clave' });
      } catch (err) {
        console.warn('Error al guardar configuraciones_sistema:', err);
      }
    }
  }

  // ==========================================
  // COLA DE APROBACIÓN DE FALTAS
  // ==========================================

  public async getFaltasPendientes(
    allowedAuthorEmails?: ReadonlyArray<string>
  ): Promise<IFaltaAprobacionItem[]> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase no está configurado; no se puede consultar la cola de faltas.');
    }

    const { data, error } = await supabase
          .from('faltas_errores')
          .select('*')
          .in('estado_aprobacion', ['Pendiente_Aprobacion', 'Pendiente']);

    if (error) {
      throw formatSupabaseError('No se pudo consultar la cola de faltas', error);
    }

          const allowed = allowedAuthorEmails === undefined
            ? undefined
            : new Set(allowedAuthorEmails.map((e) => (e || '').trim().toLowerCase()).filter(Boolean));

          const mapped: IFaltaAprobacionItem[] = data
            .map((row: ISupabaseFaltaRow & Record<string, any>, index: number) => {
              const numericId = typeof row.id === 'number' ? row.id : (index + 1);
              const emailEmpleado = row.email_empleado || '';
              return {
                Id: numericId,
                rawId: row.id ? String(row.id) : undefined,
                Title: row.colaborador_nombre || row.agente_nombre || emailEmpleado,
                AgenteEmail: emailEmpleado,
                FechaFalta: row.fecha || new Date().toISOString(),
                Categoria: row.tipo_registro || row.categoria || row.motivo || '',
                Subcategoria: row.subcategoria || '',
                CasoRef: row.id_caso_helpdesk || '',
                IdCasoHelpdesk: row.id_caso_helpdesk || '',
                HorasPerdidas: row.horas_perdidas || 0,
                MinutosTardanza: row.minutos_tardanza || 0,
                Impacto: row.impacto || row.categoria_impacto || 'Bajo',
                Estado: (row.estado as any) || 'Borrador',
                EstadoAprobacion: 'Pendiente_Aprobacion' as any,
                RolOriginador: 'Asistente' as any,
                AuditID: row.audit_id || '',
                Author: { EMail: emailEmpleado, Title: emailEmpleado },
                AttachmentFiles: row.evidencia_url ? [{
                  FileName: 'Evidencia',
                  ServerRelativeUrl: row.evidencia_url
                }] : [],
                SyncStatus: 'Sincronizado'
              };
            })
            .filter((item) =>
              !allowed ||
              allowed.has((item.AgenteEmail || '').trim().toLowerCase()) ||
              allowed.has((item.Author?.EMail || '').trim().toLowerCase())
            )
            .sort((left, right) => right.FechaFalta.localeCompare(left.FechaFalta));

    return mapped;
  }

  public async actualizarEstadoAprobacion(
    id: number | string,
    nuevoEstado: 'Aprobado' | 'Rechazado'
  ): Promise<void> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase no está configurado; la aprobación no fue guardada.');
    }

    const estadoRegistro = nuevoEstado === 'Aprobado' ? 'Aprobado' : 'Rechazado';
    const { data, error } = await supabase
      .from('faltas_errores')
      .update({ estado_aprobacion: nuevoEstado, estado: estadoRegistro })
      .eq('id', id)
      .select('id');

    if (error) {
      throw formatSupabaseError('No se pudo actualizar la aprobación de la falta', error);
    }
    if (!data || data.length !== 1) {
      throw new Error('Supabase no confirmó la actualización de la falta.');
    }
  }

  // ==========================================
  // CATÁLOGOS (tabla: catalogos)
  // ==========================================

  public async getCatalogos(categoria?: CatalogCategory, parentId?: string | number): Promise<ICatalogoItem[]> {
    if (isSupabaseConfigured()) {
      try {
        let query = supabase.from('catalogos').select('*');
        if (categoria) {
          query = query.eq('categoria', categoria);
        }
        if (parentId !== undefined && parentId !== null && parentId !== '') {
          const parentIdStr = String(parentId);
          query = query.or(`parent_id.eq.${parentIdStr},parent_id.eq.${parentId}`);
        }
        const { data, error } = await query;
        if (!error && Array.isArray(data)) {
          const mapped: ICatalogoItem[] = data
            .filter((row: any) => row.activo !== false)
            .map((row: any, index: number) => ({
              Id: typeof row.id === 'number' ? row.id : (index + 1),
              rawId: row.id || row.id_catalogo || (index + 1),
              Title: (row.categoria || row.title || categoria || 'Falta') as CatalogCategory,
              Valor: row.valor || row.title || row.nombre || row.descripcion || row.value || '',
              parent_id: row.parent_id || row.padre_id || undefined,
              activo: row.activo !== false
            }));
          try {
            await indexedDb.replaceAll(LOCAL_STORES.catalogos, mapped);
          } catch {
            // Ignore cache error
          }
          return mapped.sort((a, b) => a.Valor.localeCompare(b.Valor));
        }
      } catch (err) {
        console.warn('CloudDbClient.getCatalogos fallback to IndexedDB:', err);
      }
    }

    const items = await indexedDb.getAll<ICatalogoItem>(LOCAL_STORES.catalogos);
    return items
      .filter((item) => {
        if (categoria && item.Title !== categoria) return false;
        if (parentId !== undefined && parentId !== null && parentId !== '') {
          return String(item.parent_id) === String(parentId);
        }
        return true;
      })
      .sort((left, right) => left.Valor.localeCompare(right.Valor));
  }

  public async addCatalogo(categoria: CatalogCategory, valor: string, parentId?: string | number): Promise<void> {
    const normValue = valor.trim();
    const parentVal = parentId !== undefined && parentId !== null && parentId !== '' ? String(parentId) : null;
    if (isSupabaseConfigured()) {
      try {
        let res = await supabase.from('catalogos').insert([{ categoria, valor: normValue, parent_id: parentVal }]).select();
        if (res.error) {
          res = await supabase.from('catalogos').insert([{ categoria, title: normValue, parent_id: parentVal }]).select();
          if (res.error) {
            await supabase.from('catalogos').insert([{ categoria, nombre: normValue, parent_id: parentVal }]);
          }
        }
      } catch (err) {
        console.warn('CloudDbClient.addCatalogo error:', err);
      }
    }

    try {
      await indexedDb.add(LOCAL_STORES.catalogos, {
        Title: categoria,
        Valor: normValue,
        parent_id: parentVal || undefined,
        SyncStatus: 'Pendiente'
      });
    } catch {
      // Ignore local cache error
    }
  }

  public async deleteCatalogo(id: number | string): Promise<void> {
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('catalogos').delete().eq('id', id);
      } catch (err) {
        console.warn('CloudDbClient.deleteCatalogo error:', err);
      }
    }

    try {
      const numericId = typeof id === 'number' ? id : Number(id);
      if (!isNaN(numericId)) {
        await indexedDb.remove(LOCAL_STORES.catalogos, numericId);
      }
    } catch {
      // Ignore local cache error
    }
  }

  // ==========================================
  // PRODUCTIVIDAD CRUD (tabla: productividad)
  // ==========================================

  public async getProductividad(): Promise<IProductividadHistorialItem[]> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase no está configurado; no se puede consultar productividad.');
    }

    const { data, error } = await supabase
      .from('productividad')
      .select('*')
      .order('fecha_inicio', { ascending: false, nullsFirst: false });

    if (error) {
      throw formatSupabaseError('No se pudo consultar productividad', error);
    }

    const mapped: IProductividadHistorialItem[] = data.map((row: any, index: number) => {
      const numericId = typeof row.id === 'number' ? row.id : (index + 1);
      const email = row.email_empleado || row.email || '';
      return {
              Id: numericId,
              rawId: row.id ? String(row.id) : (row.audit_id || row.id_auditoria || undefined),
              Title: email,
              AgenteEmail: email,
              FechaRegistro: row.created_at || row.fecha_registro || row.fecha_inicio || row.fecha || '',
              FechaInicio: row.fecha_inicio || row.fecha || '',
              FechaFin: row.fecha_fin || row.fecha_inicio || row.fecha || '',
              Casos: Number(row.casos_atendidos) || 0,
              CasosAtendidos: Number(row.casos_atendidos) || 0,
              CasosATiempo: Number(row.casos_a_tiempo) || 0,
              TieneDatosSLA: true,
              Emisiones: Number(row.emisiones_tx) || 0,
              Movimientos: Number(row.movimientos_pg) || 0,
              EmisionesTx: Number(row.emisiones_tx) || 0,
              EmisionesPg: Number(row.emisiones_pg) || 0,
              DevolucionesEmisiones: Number(row.devoluciones_emisiones) || 0,
              MovimientosTx: Number(row.movimientos_tx) || 0,
              MovimientosPg: Number(row.movimientos_pg) || 0,
              DevolucionesMovimientos: Number(row.devoluciones_movimientos) || 0,
              EscaneoTx: Number(row.escaneo_tx) || 0,
              EscaneoPg: Number(row.escaneo_pg) || 0,
              DevolucionesEscaneo: Number(row.devoluciones_escaneo) || 0,
              CarnetsTx: Number(row.carnets_tx) || 0,
              CarnetsPg: Number(row.carnets_pg) || 0,
              AuditID: row.audit_id || row.id_auditoria || ''
      };
    });

    try {
      await indexedDb.replaceAll(LOCAL_STORES.productividad, mapped);
    } catch {
      // Cache writes never replace the Supabase response as source of truth.
    }
    return mapped;
  }

  public async createProductividad(data: IRegistrarProductividadData): Promise<void> {
    const startIso = data.fechaInicio.toISOString();
    const endIso = data.fechaFin.toISOString();
    const auditId = generateAuditID();
    const emailEmpleado = (data.agenteEmail || data.agente || '').trim().toLowerCase();

    if (!emailEmpleado) {
      throw new Error('El correo del colaborador es obligatorio para registrar productividad.');
    }

    if (!isSupabaseConfigured()) {
      throw new Error('Supabase no está configurado; la productividad no fue guardada.');
    }

    const payload = {
      audit_id: auditId,
      email_empleado: emailEmpleado,
      fecha_inicio: startIso,
      fecha_fin: endIso,
      casos_atendidos: data.casosAtendidos || 0,
      casos_a_tiempo: data.casosATiempo || 0,
      emisiones_tx: data.emisionesTx || 0,
      emisiones_pg: data.emisionesPg || 0,
      devoluciones_emisiones: data.devolucionesEmisiones || 0,
      movimientos_tx: data.movimientosTx || 0,
      movimientos_pg: data.movimientosPg || 0,
      devoluciones_movimientos: data.devolucionesMovimientos || 0,
      escaneo_tx: data.escaneoTx || 0,
      escaneo_pg: data.escaneoPg || 0,
      devoluciones_escaneo: data.devolucionesEscaneo || 0,
      carnets_tx: data.carnetsTx || 0,
      carnets_pg: data.carnetsPg || 0
    };

    const { data: insertedRows, error } = await supabase
      .from('productividad')
      .insert([payload])
      .select();

    if (error) {
      throw formatSupabaseError('No se pudo guardar la productividad', error);
    }

    if (!insertedRows || insertedRows.length !== 1) {
      throw new Error('Supabase no confirmó la creación de la productividad.');
    }

    const insertedRow = insertedRows[0];
    const officialItem: IProductividadHistorialItem = {
            Id: typeof insertedRow.id === 'number' ? insertedRow.id : Date.now(),
            rawId: insertedRow.id ? String(insertedRow.id) : auditId,
            Title: emailEmpleado,
            AgenteEmail: emailEmpleado,
            FechaRegistro: new Date().toISOString(),
            FechaInicio: startIso,
            FechaFin: endIso,
            Casos: data.casosAtendidos || 0,
            CasosAtendidos: data.casosAtendidos || 0,
            CasosATiempo: data.casosATiempo || 0,
            TieneDatosSLA: true,
            Emisiones: data.emisionesTx || 0,
            Movimientos: data.movimientosPg || 0,
            EmisionesTx: data.emisionesTx || 0,
            EmisionesPg: data.emisionesPg || 0,
            DevolucionesEmisiones: data.devolucionesEmisiones || 0,
            MovimientosTx: data.movimientosTx || 0,
            MovimientosPg: data.movimientosPg || 0,
            DevolucionesMovimientos: data.devolucionesMovimientos || 0,
            EscaneoTx: data.escaneoTx || 0,
            EscaneoPg: data.escaneoPg || 0,
            DevolucionesEscaneo: data.devolucionesEscaneo || 0,
            CarnetsTx: data.carnetsTx || 0,
            CarnetsPg: data.carnetsPg || 0,
            AuditID: auditId
    };
    try {
      await indexedDb.add(LOCAL_STORES.productividad, officialItem);
    } catch {
      // The confirmed Supabase insert remains authoritative.
    }
    return;
  }

  public async deleteProductividad(id: number | string): Promise<void> {
    const idStr = String(id);
    if (isSupabaseConfigured()) {
      try {
        if (idStr.includes('-')) {
          const { error } = await supabase.from('productividad').delete().eq('id', idStr);
          if (error) {
            console.warn('Error deleting by UUID id, retrying by audit_id:', error);
            await supabase.from('productividad').delete().eq('audit_id', idStr);
          }
        } else {
          const { error } = await supabase.from('productividad').delete().eq('id', id);
          if (error) {
            await supabase.from('productividad').delete().eq('audit_id', idStr);
          }
        }
      } catch (err) {
        console.warn('CloudDbClient.deleteProductividad error:', err);
      }
    }

    try {
      const numericId = typeof id === 'number' ? id : Number(id);
      if (!isNaN(numericId)) {
        await indexedDb.remove(LOCAL_STORES.productividad, numericId);
      }
    } catch {
      // Ignore cache error
    }
  }

  // ==========================================
  // OCUPACIÓN / LLAMADAS CRUD (tabla: ocupacion_llamadas)
  // ==========================================

  public async getLlamadasFlota(supervisorEmail?: string): Promise<ILlamadaFlotaItem[]> {
    if (isSupabaseConfigured()) {
      try {
        let query = supabase
          .from('ocupacion_llamadas')
          .select('*')
          .order('fecha_hora', { ascending: false });
        if (supervisorEmail) {
          query = query.ilike('supervisor_email', supervisorEmail.trim());
        }
        const { data, error } = await query;
        if (!error && Array.isArray(data)) {
          const mapped: ILlamadaFlotaItem[] = data.map((row: any, index: number) => ({
            Id: typeof row.id === 'number' ? row.id : (index + 1),
            Title: row.caso_contacto || row.title || '',
            SupervisorEmail: row.supervisor_email || row.email_supervisor || '',
            FechaHora: row.fecha_hora || row.created_at || new Date().toISOString(),
            DuracionMinutos: Number(row.duracion_minutos) || 0,
            Comentarios: row.comentarios || '',
            AuditID: row.audit_id || row.id_auditoria || ''
          }));
          try {
            await indexedDb.replaceAll(LOCAL_STORES.llamadas, mapped);
          } catch {
            // Ignore cache error
          }
          return mapped;
        }
      } catch (err) {
        console.warn('CloudDbClient.getLlamadasFlota fallback to IndexedDB:', err);
      }
    }

    return indexedDb.getAll<ILlamadaFlotaItem>(LOCAL_STORES.llamadas);
  }

  public async createLlamadaFlota(data: IRegistrarLlamadaFlotaData): Promise<void> {
    const auditId = generateAuditID();
    const supervisorEmail = (data.supervisorEmail || '').trim().toLowerCase();
    const fechaHoraIso = data.fechaHora.toISOString();

    if (isSupabaseConfigured()) {
      try {
        const payload = {
          audit_id: auditId,
          supervisor_email: supervisorEmail,
          caso_contacto: data.casoContacto.trim(),
          fecha_hora: fechaHoraIso,
          duracion_minutos: data.duracionMinutos || 0,
          comentarios: data.comentarios?.trim() || ''
        };

        const res = await supabase.from('ocupacion_llamadas').insert([payload]).select();
        if (!res.error && res.data && res.data.length > 0) {
          const insertedRow = res.data[0];
          const officialItem: ILlamadaFlotaItem = {
            Id: typeof insertedRow.id === 'number' ? insertedRow.id : Date.now(),
            Title: data.casoContacto.trim(),
            SupervisorEmail: supervisorEmail,
            FechaHora: fechaHoraIso,
            DuracionMinutos: data.duracionMinutos,
            Comentarios: data.comentarios?.trim() || '',
            AuditID: auditId
          };
          try {
            await indexedDb.add(LOCAL_STORES.llamadas, officialItem);
          } catch {
            // Ignore cache error
          }
          return;
        }
      } catch (err) {
        console.warn('CloudDbClient.createLlamadaFlota error inserting to Supabase:', err);
      }
    }

    await indexedDb.add(LOCAL_STORES.llamadas, {
      Title: data.casoContacto.trim(),
      SupervisorEmail: supervisorEmail,
      FechaHora: fechaHoraIso,
      DuracionMinutos: data.duracionMinutos,
      Comentarios: data.comentarios?.trim() || '',
      AuditID: auditId,
      SyncStatus: 'Pendiente'
    });
  }

  // ==========================================
  // AUSENCIAS Y VACACIONES CRUD (tabla: ausencias)
  // ==========================================

  public async getAusencias(startDate?: Date, endDate?: Date): Promise<IAusenciaItem[]> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase no está configurado; no se pueden consultar las ausencias.');
    }

    const { data, error } = await supabase
      .from('ausencias')
      .select('*')
      .order('fecha_inicio', { ascending: false, nullsFirst: false });

    if (error) {
      throw formatSupabaseError('No se pudo consultar ausencias', error);
    }

    const mapped: IAusenciaItem[] = data.map((row: any, index: number) => {
      const numericId = typeof row.id === 'number' ? row.id : (index + 1);
      const email = row.email_empleado || row.agente_email || row.colaborador_email || '';
      const nombre = row.colaborador_nombre || row.agente_nombre || row.title || email;
      return {
              Id: numericId,
              Title: nombre,
              AgenteEmail: email,
              AgenteObjectID: row.agente_object_id || '',
              TipoAusencia: row.tipo_ausencia as AusenciaType,
              FechaInicio: row.fecha_inicio || new Date().toISOString(),
              FechaFin: row.fecha_fin || new Date().toISOString(),
              Comentarios: row.comentarios || '',
              AuditID: row.audit_id || '',
              PeriodoAnio: row.periodo_anio,
              PremioEmpleadoMesID: row.empleado_mes_id || row.premio_empleado_mes_id
      };
    });

    try {
      await indexedDb.replaceAll(LOCAL_STORES.ausencias, mapped);
    } catch {
      // Cache writes never replace the Supabase response as source of truth.
    }

    if (startDate || endDate) {
      const startMs = startDate ? startDate.getTime() : 0;
      const endMs = endDate ? endDate.getTime() : Infinity;
      return mapped.filter((item) => {
        const itemStart = new Date(item.FechaInicio).getTime();
        const itemEnd = new Date(item.FechaFin).getTime();
        return itemStart <= endMs && itemEnd >= startMs;
      });
    }

    return mapped;
  }

  public async createEmpleadoMesAward(data: {
    email_empleado: string;
    nombre_empleado?: string;
    mes: number;
    anio: number;
    supervisor_email?: string;
    supervisor_nombre?: string;
    dedicatoria?: string;
  }): Promise<void> {
    const normEmail = data.email_empleado.trim().toLowerCase();
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase no está configurado; el Empleado del Mes no fue publicado.');
    }

    const payload = {
      email_empleado: normEmail,
      colaborador_nombre: data.nombre_empleado || '',
      mes: data.mes,
      anio: data.anio,
      supervisor_email: (data.supervisor_email || '').trim().toLowerCase(),
      supervisor_nombre: data.supervisor_nombre || '',
      dia_libre_reclamado: false
    };
    const { data: insertedRows, error } = await supabase
      .from('empleado_del_mes')
      .insert([payload])
      .select();

    if (error) {
      throw formatSupabaseError('No se pudo publicar el Empleado del Mes', error);
    }

    if (!insertedRows || insertedRows.length !== 1) {
      throw new Error('Supabase no confirmó la publicación del Empleado del Mes.');
    }
  }

  public async getHistorialEmpleadoMes(): Promise<IEmpleadoDelMes[]> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase no está configurado; no se puede consultar Empleado del Mes.');
    }

    const { data, error } = await supabase
      .from('empleado_del_mes')
      .select('*')
      .order('anio', { ascending: false })
      .order('mes', { ascending: false });

    if (error) {
      throw formatSupabaseError('No se pudo consultar empleado_del_mes', error);
    }

    return (data || []).map((row: any) => ({
      ...row,
      nombre_empleado: row.nombre_empleado || row.colaborador_nombre || ''
    }));
  }

  public async createSolicitudMejora(data: {
    autor_nombre: string;
    autor_email: string;
    aplicativo?: string;
    modulo_afectado: string;
    pantalla_afectada?: string;
    aplicativo_id?: string;
    modulo_id?: string;
    pantalla_id?: string;
    titulo: string;
    descripcion: string;
    criterios_aceptacion: string;
  }): Promise<void> {
    const auditId = generateAuditID();
    const normEmail = data.autor_email.trim().toLowerCase();

    if (!isSupabaseConfigured()) {
      throw new Error('Supabase no está configurado; la iniciativa no fue guardada.');
    }

    const payload = {
      audit_id: auditId,
      autor_nombre: data.autor_nombre.trim(),
      autor_email: normEmail,
      aplicativo: data.aplicativo?.trim() || '',
      aplicativo_id: data.aplicativo_id || null,
      modulo_afectado: data.modulo_afectado.trim(),
      modulo_id: data.modulo_id || null,
      pantalla_afectada: data.pantalla_afectada?.trim() || '',
      pantalla_id: data.pantalla_id || null,
      titulo: data.titulo.trim(),
      descripcion: data.descripcion.trim(),
      criterios_aceptacion: data.criterios_aceptacion.trim(),
      estado: 'Pendiente_Aprobacion'
    };
    const { data: insertedRows, error } = await supabase
      .from('solicitudes_mejora')
      .insert([payload])
      .select();

    if (error) {
      throw formatSupabaseError('No se pudo guardar la iniciativa', error);
    }

    if (!insertedRows || insertedRows.length !== 1) {
      throw new Error('Supabase no confirmó la creación de la iniciativa.');
    }
  }

  public async getSolicitudesMejora(emailFilter?: string): Promise<ISolicitudMejora[]> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase no está configurado; no se pueden consultar las iniciativas.');
    }

    let query = supabase
      .from('solicitudes_mejora')
      .select('*')
      .order('created_at', { ascending: false });

    if (emailFilter) {
      query = query.ilike('autor_email', emailFilter.trim());
    }

    const { data, error } = await query;
    if (error) {
      throw formatSupabaseError('No se pudieron consultar las iniciativas', error);
    }

    return (data || []).map((row: any) => ({
      id: row.id ? String(row.id) : undefined,
            audit_id: row.audit_id || row.id_auditoria || '',
            autor_nombre: row.autor_nombre || row.colaborador_nombre || '',
            autor_email: row.autor_email || row.email_empleado || '',
            aplicativo: row.aplicativo || row.app || '',
            modulo_afectado: row.modulo_afectado || row.modulo || '',
            pantalla_afectada: row.pantalla_afectada || '',
            titulo: row.titulo || row.title || '',
            descripcion: row.descripcion || '',
            criterios_aceptacion: row.criterios_aceptacion || '',
            estado: row.estado || 'Pendiente_Aprobacion',
            comentario_supervisor: row.comentario_supervisor || row.comentarios || '',
            supervisor_email: row.supervisor_email || '',
            supervisor_nombre: row.supervisor_nombre || '',
            fecha_revision: row.fecha_revision || '',
      created_at: row.created_at || new Date().toISOString()
    }));
  }

  public async responderSolicitudMejora(
    id: string,
    estado: 'Aprobada' | 'Declinada',
    comentario: string,
    supervisorEmail: string,
    supervisorNombre: string
  ): Promise<void> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase no está configurado; la respuesta no fue guardada.');
    }
    if (id) {
        const payload = {
          estado,
          comentario_supervisor: comentario.trim(),
          supervisor_email: supervisorEmail.trim().toLowerCase(),
          supervisor_nombre: supervisorNombre.trim(),
          fecha_revision: new Date().toISOString()
        };

        const isUuid = id.includes('-');
      const response = isUuid
        ? await supabase.from('solicitudes_mejora').update(payload).eq('id', id).select('id')
        : await supabase.from('solicitudes_mejora').update(payload).or(`id.eq.${id},audit_id.eq.${id}`).select('id');

      if (response.error) {
        throw formatSupabaseError('No se pudo responder la iniciativa', response.error);
      }
      if (!response.data || response.data.length !== 1) {
        throw new Error('Supabase no confirmó la actualización de la iniciativa.');
      }
    }
  }

  public async getPremiosEmpleadoMesPendientes(email: string): Promise<IEmpleadoDelMes[]> {
    if (!email) return [];
    const normEmail = email.trim().toLowerCase();
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase no está configurado; no se pueden consultar los premios pendientes.');
    }

    const { data, error } = await supabase
      .from('empleado_del_mes')
      .select('*')
      .eq('email_empleado', normEmail)
      .eq('dia_libre_reclamado', false);

    if (error) {
      throw formatSupabaseError('No se pudieron consultar los premios pendientes', error);
    }

    return (data || []).map((row: any) => ({
      id: row.id,
            email_empleado: row.email_empleado,
            nombre_empleado: row.nombre_empleado || row.colaborador_nombre || '',
            mes: Number(row.mes) || 1,
            anio: Number(row.anio) || new Date().getFullYear(),
            dia_libre_reclamado: Boolean(row.dia_libre_reclamado),
      fecha_reclamado: row.fecha_reclamado
    }));
  }

  public async marcarPremioEmpleadoMesReclamado(premioId: string | number, fechaReclamado?: string): Promise<void> {
    if (isSupabaseConfigured() && premioId) {
      const nowIso = fechaReclamado || new Date().toISOString();
      const { data, error } = await supabase
        .from('empleado_del_mes')
        .update({
          dia_libre_reclamado: true,
          fecha_reclamado: nowIso
        })
        .eq('id', premioId)
        .eq('dia_libre_reclamado', false)
        .select('id');

      if (error) {
        throw new Error(`No se pudo marcar el premio como reclamado: ${error.message}`);
      }

      if (!data || data.length !== 1) {
        throw new Error('El premio seleccionado ya fue reclamado o dejó de estar disponible.');
      }
    }
  }

  public async createAusencia(data: IRegistrarAusenciaData): Promise<void> {
    const auditId = generateAuditID();
    const emailEmpleado = (data.agenteEmail || data.agente || '').trim().toLowerCase();
    const startIso = data.fechaInicio.toISOString();
    const endIso = data.fechaFin.toISOString();

    if (!isSupabaseConfigured()) {
      throw new Error('Supabase no está configurado; la ausencia no fue guardada.');
    }

    const payload: Record<string, any> = {
      audit_id: auditId,
      email_empleado: emailEmpleado,
      agente_email: emailEmpleado,
      colaborador_nombre: data.agente.trim(),
      agente_nombre: data.agente.trim(),
      agente_object_id: data.agenteObjectId || '',
      tipo_ausencia: data.tipoAusencia,
      fecha_inicio: startIso,
      fecha_fin: endIso,
      comentarios: data.comentarios?.trim() || '',
      periodo_anio: data.periodoAnio || new Date().getFullYear(),
      empleado_mes_id: data.premioEmpleadoMesId || null
    };

    const { data: insertedRows, error: insertError } = await supabase
      .from('ausencias')
      .insert([payload])
      .select();

    if (insertError) {
      throw formatSupabaseError('No se pudo registrar la ausencia', insertError);
    }

    if (!insertedRows || insertedRows.length !== 1) {
      throw new Error('Supabase no confirmó la creación de la ausencia.');
    }

    const insertedRow = insertedRows[0];

    if (data.premioEmpleadoMesId) {
      try {
        await this.marcarPremioEmpleadoMesReclamado(data.premioEmpleadoMesId, startIso);
      } catch (claimError) {
        const { error: rollbackError } = await supabase
          .from('ausencias')
          .delete()
          .eq('id', insertedRow.id);

        if (rollbackError) {
          console.error('No se pudo revertir la ausencia tras fallar el reclamo del premio:', rollbackError);
        }

        throw claimError;
      }
    }

    const officialItem: IAusenciaItem = {
      Id: typeof insertedRow.id === 'number' ? insertedRow.id : Date.now(),
        Title: data.agente.trim(),
        AgenteEmail: emailEmpleado,
        AgenteObjectID: data.agenteObjectId || '',
        TipoAusencia: data.tipoAusencia,
        FechaInicio: startIso,
        FechaFin: endIso,
        Comentarios: data.comentarios?.trim() || '',
        AuditID: auditId,
        PeriodoAnio: data.periodoAnio,
      PremioEmpleadoMesID: data.premioEmpleadoMesId
    };
    try {
      await indexedDb.add(LOCAL_STORES.ausencias, officialItem);
    } catch {
      // The confirmed Supabase insert remains authoritative.
    }
    return;
  }
}

export const cloudDbClient = new CloudDbClient();

export async function fetchHeadcountBySupervisor(supervisorEmail: string) {
  if (!supervisorEmail) return [];
  const normSupervisor = supervisorEmail.trim().toLowerCase();

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('headcount')
        .select('*')
        .or(`supervisor_email.ilike.${normSupervisor},email_supervisor.ilike.${normSupervisor}`);

      if (error) {
        console.error('Error al obtener headcount:', error);
        return [];
      }

      if (Array.isArray(data) && data.length > 0) {
        return data.map((row: ISupabaseHeadcountRow) => ({
          member_name: row.member_name || row.nombre_empleado || (row as any).nombre || '',
          member_email: row.member_email || row.email_empleado || (row as any).email || '',
          member_puesto: row.member_puesto || row.cargo || 'Oficial',
          member_area: row.member_area || row.departamento || 'Operaciones',
          supervisor_email: row.supervisor_email || row.email_supervisor || normSupervisor,
          estado_activo: row.estado_activo !== false
        }));
      }
    } catch (err) {
      console.error('Error al obtener headcount:', err);
    }
  }

  const localRows = await cloudDbClient.getHeadcountBySupervisor(normSupervisor);
  return localRows.map((row) => ({
    member_name: row.NombreEmpleado,
    member_email: row.EmailEmpleado,
    member_puesto: row.Cargo,
    member_area: row.Departamento,
    supervisor_email: row.EmailSupervisor,
    estado_activo: row.EstadoActivo !== false
  }));
}

export const HeadcountService = {
  getHeadcount: () => cloudDbClient.getHeadcount(),
  getHeadcountBySupervisor: (supervisorEmail: string) => cloudDbClient.getHeadcountBySupervisor(supervisorEmail),
  fetchHeadcountBySupervisor: (supervisorEmail: string) => fetchHeadcountBySupervisor(supervisorEmail)
};

export const KudosService = {
  getKudos: () => cloudDbClient.getKudos(),
  createKudo: (data: IRegistrarKudoData | Partial<IKudoHistorialItem>) => cloudDbClient.createKudo(data)
};

export const OperacionalService = {
  getFaltas: () => cloudDbClient.getFaltas(),
  createFalta: (data: IRegistrarFaltaData | Partial<IFaltaHistorialItem>) => cloudDbClient.createFalta(data)
};

export const AdminService = {
  getMetas: (email?: string) => cloudDbClient.getMetas(email),
  createMeta: (data: Partial<IMetaRecord>) => cloudDbClient.createMeta(data)
};

export const getHistorialEmpleadoMes = async () => cloudDbClient.getHistorialEmpleadoMes();

export { uploadEvidenciaToSupabase, uploadFileToSupabase } from './uploadFileToSupabase';

export default cloudDbClient;
