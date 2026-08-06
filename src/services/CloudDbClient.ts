import { supabase, isSupabaseConfigured } from './supabase';
import IndexedDbAdapter, { LOCAL_STORES } from './IndexedDbAdapter';
import type { IAppUserRecord, AppUserStatus, AppUserRole } from '../auth/AuthModels';
import type { IHeadcountRow } from './PowerAutomateSyncService';
import type {
  IFaltaHistorialItem,
  IKudoHistorialItem,
  IRegistrarFaltaData,
  IRegistrarKudoData
} from '../webparts/supervisionOperaciones/services/SharePointService';

const indexedDb = new IndexedDbAdapter();

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
  agente_object_id?: string;
  rol?: string;
}

export interface ISupabaseFaltaRow {
  id?: number | string;
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
  url_evidencia?: string;
}

export interface ISupabaseKudoRow {
  id?: number | string;
  email_destino?: string;
  email_origen?: string;
  motivo?: string;
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
            AgenteObjectID: row.agente_object_id || '',
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
            AgenteObjectID: row.agente_object_id || '',
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
    if (isSupabaseConfigured()) {
      try {
        let response = await supabase.from('faltas_errores').select('*');
        if (response.error || !Array.isArray(response.data) || response.data.length === 0) {
          response = await supabase.from('faltas').select('*');
        }

        const data = response.data;
        const error = response.error;

        if (!error && Array.isArray(data) && data.length > 0) {
          const mappedFaltas: IFaltaHistorialItem[] = data.map((row: ISupabaseFaltaRow, index: number) => {
            const numericId = typeof row.id === 'number' ? row.id : (index + 1);
            return {
              Id: numericId,
              Title: row.email_empleado || '',
              AgenteEmail: row.email_empleado || '',
              FechaFalta: row.fecha || new Date().toISOString(),
              Categoria: row.motivo || '',
              CasoRef: row.id_caso_helpdesk || '',
              IdCasoHelpdesk: row.id_caso_helpdesk || '',
              HorasPerdidas: row.horas_perdidas || 0,
              MinutosTardanza: row.minutos_tardanza || 0,
              Impacto: row.impacto || 'Bajo',
              Estado: (row.estado as IFaltaHistorialItem['Estado']) || 'Aprobado',
              EstadoAprobacion: (row.estado_aprobacion as IFaltaHistorialItem['EstadoAprobacion']) || 'Aprobado',
              RolOriginador: 'Supervisor',
              SyncStatus: 'Sincronizado'
            };
          });

          // Update local cache
          try {
            await indexedDb.replaceAll(LOCAL_STORES.faltas, mappedFaltas);
          } catch {
            // Ignore cache error
          }

          return mappedFaltas;
        }
      } catch (err) {
        console.warn('CloudDbClient.getFaltas fallback to IndexedDB:', err);
      }
    }

    return indexedDb.getAll<IFaltaHistorialItem>(LOCAL_STORES.faltas);
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
      FechaFalta: fechaISO,
      Categoria: motivo,
      CasoRef: casoHelpdesk,
      IdCasoHelpdesk: casoHelpdesk,
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

    if (isSupabaseConfigured()) {
      try {
        const payload: ISupabaseFaltaRow = {
          email_empleado: emailEmpleado,
          motivo,
          id_caso_helpdesk: casoHelpdesk,
          horas_perdidas: horasPerdidas,
          minutos_tardanza: minutosTardanza,
          fecha: fechaISO,
          impacto: recordToSave.Impacto,
          estado: recordToSave.Estado,
          evidencia_url: evidenciaUrl,
          url_evidencia: evidenciaUrl
        };

        let res = await supabase.from('faltas_errores').insert([payload]).select();
        if (res.error) {
          res = await supabase.from('faltas').insert([payload]).select();
        }

        if (!res.error && res.data && res.data.length > 0) {
          const insertedRow = res.data[0] as ISupabaseFaltaRow;
          const officialItem: IFaltaHistorialItem = {
            ...recordToSave,
            Id: typeof insertedRow.id === 'number' ? insertedRow.id : Date.now(),
            SyncStatus: 'Sincronizado'
          };
          try {
            await indexedDb.add<IFaltaHistorialItem>(LOCAL_STORES.faltas, officialItem);
          } catch {
            // Ignore cache error
          }
          return officialItem;
        }
      } catch (err) {
        console.warn('CloudDbClient.createFalta error inserting to Supabase:', err);
      }
    }

    const savedLocal = await indexedDb.add<IFaltaHistorialItem>(LOCAL_STORES.faltas, recordToSave as IFaltaHistorialItem);
    return savedLocal;
  }

  // ==========================================
  // KUDOS CRUD (KudosService)
  // ==========================================

  public async getKudos(): Promise<IKudoHistorialItem[]> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('kudos')
          .select('*');

        if (!error && Array.isArray(data) && data.length > 0) {
          const mappedKudos: IKudoHistorialItem[] = data.map((row: ISupabaseKudoRow, index: number) => {
            const numericId = typeof row.id === 'number' ? row.id : (index + 1);
            return {
              Id: numericId,
              Title: row.email_destino || '',
              AgenteEmail: row.email_destino || '',
              EmailEmisor: row.email_origen || '',
              Atributo: row.motivo || '',
              Mensaje: row.motivo || '',
              Puntos: row.puntos ?? 10,
              FechaKudo: row.fecha || new Date().toISOString(),
              Remitente: row.email_origen || '',
              SyncStatus: 'Sincronizado'
            };
          });

          const deduplicated = deduplicateKudos(mappedKudos);

          // Cache to IndexedDB
          try {
            await indexedDb.replaceAll(LOCAL_STORES.kudos, deduplicated);
          } catch {
            // Ignore cache error
          }

          return deduplicated;
        }
      } catch (err) {
        console.warn('CloudDbClient.getKudos fallback to IndexedDB:', err);
      }
    }

    const localKudos = await indexedDb.getAll<IKudoHistorialItem>(LOCAL_STORES.kudos);
    return deduplicateKudos(localKudos);
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

    if (isSupabaseConfigured()) {
      try {
        const payload: ISupabaseKudoRow = {
          email_destino: emailDestino,
          email_origen: emailOrigen,
          motivo,
          puntos,
          fecha: fechaISO
        };

        const { data, error } = await supabase
          .from('kudos')
          .insert([payload])
          .select();

        if (!error && data && data.length > 0) {
          const insertedRow = data[0] as ISupabaseKudoRow;
          const officialItem: IKudoHistorialItem = {
            ...recordToSave,
            Id: typeof insertedRow.id === 'number' ? insertedRow.id : Date.now(),
            SyncStatus: 'Sincronizado'
          };
          try {
            await indexedDb.add<IKudoHistorialItem>(LOCAL_STORES.kudos, officialItem);
          } catch {
            // Ignore cache error
          }
          return officialItem;
        }
      } catch (err) {
        console.warn('CloudDbClient.createKudo error inserting to Supabase:', err);
      }
    }

    const savedLocal = await indexedDb.add<IKudoHistorialItem>(LOCAL_STORES.kudos, recordToSave as IKudoHistorialItem);
    return savedLocal;
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

        if (!error && Array.isArray(data) && data.length > 0) {
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
        const payload: ISupabaseMetaRow = {
          email_empleado: recordToSave.EmailEmpleado,
          mes: recordToSave.Mes,
          anio: recordToSave.Anio,
          meta_kpis: recordToSave.MetaKpis,
          meta_kudos: recordToSave.MetaKudos,
          fecha_creacion: recordToSave.FechaCreacion
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

export { uploadEvidenciaToSupabase, uploadFileToSupabase } from './uploadFileToSupabase';

export default cloudDbClient;
