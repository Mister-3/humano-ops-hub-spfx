import { supabase, isSupabaseConfigured } from './supabase';
import IndexedDbAdapter, { LOCAL_STORES } from './IndexedDbAdapter';
import type { IAppUserRecord, AppUserStatus, AppUserRole } from '../auth/AuthModels';
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
}

export interface ISupabaseKudoRow {
  id?: number | string;
  email_destino?: string;
  email_origen?: string;
  motivo?: string;
  puntos?: number;
  fecha?: string;
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
  // FALTAS CRUD
  // ==========================================

  public async getFaltas(): Promise<IFaltaHistorialItem[]> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('faltas')
          .select('*');

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

    const savedLocal = await indexedDb.add<IFaltaHistorialItem>(LOCAL_STORES.faltas, recordToSave as IFaltaHistorialItem);

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
          estado: recordToSave.Estado
        };

        const { data, error } = await supabase
          .from('faltas')
          .insert([payload])
          .select();

        if (!error && data && data.length > 0) {
          const insertedRow = data[0] as ISupabaseFaltaRow;
          if (insertedRow.id && typeof insertedRow.id === 'number') {
            savedLocal.Id = insertedRow.id;
            savedLocal.SyncStatus = 'Sincronizado';
            await indexedDb.put(LOCAL_STORES.faltas, savedLocal);
          }
        }
      } catch (err) {
        console.warn('CloudDbClient.createFalta error inserting to Supabase:', err);
      }
    }

    return savedLocal;
  }

  // ==========================================
  // KUDOS CRUD
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

    const savedLocal = await indexedDb.add<IKudoHistorialItem>(LOCAL_STORES.kudos, recordToSave as IKudoHistorialItem);

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
          if (insertedRow.id && typeof insertedRow.id === 'number') {
            savedLocal.Id = insertedRow.id;
            savedLocal.SyncStatus = 'Sincronizado';
            await indexedDb.put(LOCAL_STORES.kudos, savedLocal);
          }
        }
      } catch (err) {
        console.warn('CloudDbClient.createKudo error inserting to Supabase:', err);
      }
    }

    return savedLocal;
  }
}

export const cloudDbClient = new CloudDbClient();
export default cloudDbClient;
