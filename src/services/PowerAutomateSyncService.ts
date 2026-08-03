import type {
  AppUserRole,
  AppUserStatus,
  IAppUserRecord
} from '../auth/AuthModels';
import {
  ACTIVE_USER_ROLES,
  APP_USER_STATUSES
} from '../auth/AuthModels';
import IndexedDbAdapter, {
  LOCAL_STORES,
  type ILocalEntity,
  type LocalStoreName
} from './IndexedDbAdapter';

export interface IHeadcountRow extends ILocalEntity {
  Id: number;
  ID?: string | number;
  EmailEmpleado: string;
  NombreEmpleado: string;
  Cargo: string;
  Departamento: string;
  EmailSupervisor: string;
  EstadoActivo: boolean;
  AgenteObjectID?: string;
  Email?: string;
  Nombre?: string;
  Rol?: AppUserRole;
  SupervisorEmail?: string;
  Activo?: boolean;
}

export interface IUsuarioExcelRow {
  ID: string;
  Email: string;
  PasswordHash: string;
  Nombre: string;
  Rol: AppUserRole;
  Estado: AppUserStatus;
  IsProfileValidatedByPA: boolean;
  FechaRegistro: string;
  FechaAprobacion: string;
}

export interface IHeadcountExcelRow {
  ID: string | number;
  EmailEmpleado: string;
  NombreEmpleado: string;
  Cargo: string;
  Departamento: string;
  EmailSupervisor: string;
  EstadoActivo: boolean;
}

export interface IFaltaExcelRow {
  ID: string;
  EmailEmpleado: string;
  NombreEmpleado: string;
  EmailSupervisor: string;
  FechaFalta: string;
  TipoFalta: string;
  Motivo: string;
  EstadoEscalado: string | number;
  RequiereAmonestacion: boolean;
  Sincronizado: boolean;
  FechaCreacion: string;
}

export interface IKudoExcelRow {
  ID: string;
  EmailEmisor: string;
  EmailReceptor: string;
  NombreReceptor: string;
  Atributo: string;
  Mensaje: string;
  Fecha: string;
  Sincronizado: boolean;
}

export interface IOcupacionExcelRow {
  ID: string;
  EmailEmpleado: string;
  Fecha: string;
  TipoAusencia: string;
  CoberturaAsignada: string;
  Observaciones: string;
  Sincronizado: boolean;
}

export interface IPowerAutomateTables {
  Tabla_Usuarios: IUsuarioExcelRow[];
  Tabla_Headcount: IHeadcountExcelRow[];
  Tabla_Faltas: IFaltaExcelRow[];
  Tabla_Kudos: IKudoExcelRow[];
  Tabla_Ocupacion: IOcupacionExcelRow[];
}

export interface IPowerAutomateExportPackage {
  schemaVersion: '2.0';
  syncMode: 'delta';
  source: 'Humano Ops Hub IndexedDB';
  targetWorkbook: 'AppDB.xlsx';
  exportedAt: string;
  tables: IPowerAutomateTables;
}

type LegacyPackage = Partial<IPowerAutomateExportPackage> & {
  schemaVersion?: string;
  tables?: Partial<IPowerAutomateTables>;
};

const normalizeEmail = (value: unknown): string =>
  typeof value === 'string' ? value.trim().toLocaleLowerCase() : '';

const toText = (value: unknown): string =>
  value === undefined || value === null ? '' : String(value).trim();

const toBoolean = (value: unknown): boolean =>
  value === true || value === 1 || String(value).toLocaleLowerCase() === 'true';

const isPending = (item: ILocalEntity): boolean =>
  item.SyncStatus !== 'Sincronizado';

const isAppUserRole = (value: string): value is AppUserRole =>
  ACTIVE_USER_ROLES.includes(value as AppUserRole);

const isAppUserStatus = (value: string): value is AppUserStatus =>
  APP_USER_STATUSES.includes(value as AppUserStatus);

const asRecord = (value: ILocalEntity): Record<string, unknown> =>
  value as Record<string, unknown>;

const getRecordId = (record: Record<string, unknown>): string =>
  toText(record.AuditID || record.ID || record.Id);

const toUsuarioExcel = (user: IAppUserRecord): IUsuarioExcelRow => ({
  ID: user.ID,
  Email: normalizeEmail(user.Email),
  PasswordHash: user.PasswordHash,
  Nombre: user.Nombre,
  Rol: user.Rol,
  Estado: user.Estado,
  IsProfileValidatedByPA: user.IsProfileValidatedByPA,
  FechaRegistro: user.FechaRegistro,
  FechaAprobacion: user.FechaAprobacion
});

const toHeadcountExcel = (row: IHeadcountRow): IHeadcountExcelRow => ({
  ID: row.ID || row.AgenteObjectID || row.Id,
  EmailEmpleado: normalizeEmail(row.EmailEmpleado || row.Email),
  NombreEmpleado: row.NombreEmpleado || row.Nombre || '',
  Cargo: row.Cargo || row.Rol || '',
  Departamento: row.Departamento || '',
  EmailSupervisor: normalizeEmail(row.EmailSupervisor || row.SupervisorEmail),
  EstadoActivo: row.EstadoActivo ?? row.Activo ?? true
});

const toFaltaExcel = (item: ILocalEntity): IFaltaExcelRow => {
  const record = asRecord(item);
  return {
    ID: getRecordId(record),
    EmailEmpleado: normalizeEmail(record.AgenteEmail),
    NombreEmpleado: toText(record.Title),
    EmailSupervisor: normalizeEmail(
      record.EmailSupervisor ||
      (record.Author as { EMail?: unknown } | undefined)?.EMail
    ),
    FechaFalta: toText(record.FechaFalta),
    TipoFalta: toText(record.Categoria),
    Motivo: toText(record.Comentarios || record.CasoRef || record.Subcategoria),
    EstadoEscalado: toText(record.EstadoEscalado || record.EstadoAprobacion || record.Estado),
    RequiereAmonestacion: toBoolean(record.RequiereAmonestacion),
    Sincronizado: item.SyncStatus === 'Sincronizado',
    FechaCreacion: toText(record.UpdatedAt || record.FechaFalta)
  };
};

const toKudoExcel = (item: ILocalEntity): IKudoExcelRow => {
  const record = asRecord(item);
  return {
    ID: getRecordId(record),
    EmailEmisor: normalizeEmail(record.EmailEmisor),
    EmailReceptor: normalizeEmail(record.AgenteEmail),
    NombreReceptor: toText(record.Title),
    Atributo: toText(record.Atributo),
    Mensaje: toText(record.Mensaje),
    Fecha: toText(record.FechaKudo),
    Sincronizado: item.SyncStatus === 'Sincronizado'
  };
};

const toOcupacionExcel = (item: ILocalEntity): IOcupacionExcelRow => {
  const record = asRecord(item);
  return {
    ID: getRecordId(record),
    EmailEmpleado: normalizeEmail(record.AgenteEmail),
    Fecha: toText(record.FechaInicio),
    TipoAusencia: toText(record.TipoAusencia),
    CoberturaAsignada: toText(record.CoberturaAsignada),
    Observaciones: toText(record.Comentarios),
    Sincronizado: item.SyncStatus === 'Sincronizado'
  };
};

/**
 * Creates the delta envelope consumed by Power Automate and merges incoming
 * workbook rows without deleting records created on another device.
 */
export class PowerAutomateSyncService {
  public constructor(
    private readonly database: IndexedDbAdapter = new IndexedDbAdapter()
  ) {}

  public async exportPackage(): Promise<IPowerAutomateExportPackage> {
    const [users, headcount, faltas, kudos, ausencias] = await Promise.all([
      this.database.getAll<IAppUserRecord>(LOCAL_STORES.users),
      this.database.getAll<IHeadcountRow>(LOCAL_STORES.headcount),
      this.database.getAll(LOCAL_STORES.faltas),
      this.database.getAll(LOCAL_STORES.kudos),
      this.database.getAll(LOCAL_STORES.ausencias)
    ]);

    return {
      schemaVersion: '2.0',
      syncMode: 'delta',
      source: 'Humano Ops Hub IndexedDB',
      targetWorkbook: 'AppDB.xlsx',
      exportedAt: new Date().toISOString(),
      tables: {
        Tabla_Usuarios: users.filter(isPending).map(toUsuarioExcel),
        Tabla_Headcount: headcount.filter(isPending).map(toHeadcountExcel),
        Tabla_Faltas: faltas.filter(isPending).map(toFaltaExcel),
        Tabla_Kudos: kudos.filter(isPending).map(toKudoExcel),
        Tabla_Ocupacion: ausencias.filter(isPending).map(toOcupacionExcel)
      }
    };
  }

  public async importPackage(
    payload: string | IPowerAutomateExportPackage
  ): Promise<void> {
    const parsed = typeof payload === 'string'
      ? JSON.parse(payload) as LegacyPackage
      : payload;
    const tables = parsed.tables;

    if (
      !tables ||
      !Array.isArray(tables.Tabla_Faltas) ||
      !Array.isArray(tables.Tabla_Kudos) ||
      !Array.isArray(tables.Tabla_Headcount) ||
      !Array.isArray(tables.Tabla_Ocupacion)
    ) {
      throw new Error(
        'El archivo no cumple el contrato AppDB.xlsx / Power Automate.'
      );
    }

    await this.mergeUsers(
      tables.Tabla_Usuarios || [],
      tables.Tabla_Headcount
    );
    await this.mergeStore(
      LOCAL_STORES.headcount,
      tables.Tabla_Headcount.map((row) => ({
        ID: row.ID,
        EmailEmpleado: normalizeEmail(row.EmailEmpleado),
        NombreEmpleado: toText(row.NombreEmpleado),
        Cargo: toText(row.Cargo),
        Departamento: toText(row.Departamento),
        EmailSupervisor: normalizeEmail(row.EmailSupervisor),
        EstadoActivo: toBoolean(row.EstadoActivo),
        SyncStatus: 'Sincronizado' as const,
        UpdatedAt: new Date().toISOString()
      })),
      (item) => normalizeEmail(item.EmailEmpleado) || toText(item.ID)
    );
    await this.mergeStore(
      LOCAL_STORES.faltas,
      tables.Tabla_Faltas.map((row) => ({
        AuditID: toText(row.ID),
        Title: toText(row.NombreEmpleado),
        AgenteEmail: normalizeEmail(row.EmailEmpleado),
        EmailSupervisor: normalizeEmail(row.EmailSupervisor),
        FechaFalta: toText(row.FechaFalta),
        Categoria: toText(row.TipoFalta),
        Comentarios: toText(row.Motivo),
        EstadoEscalado: row.EstadoEscalado,
        RequiereAmonestacion: toBoolean(row.RequiereAmonestacion),
        Impacto: '',
        Estado: 'Aprobado',
        EstadoAprobacion: 'Aprobado',
        RolOriginador: 'Supervisor',
        SyncStatus: 'Sincronizado' as const,
        UpdatedAt: toText(row.FechaCreacion) || new Date().toISOString()
      })),
      (item) => toText(item.AuditID)
    );
    await this.mergeStore(
      LOCAL_STORES.kudos,
      tables.Tabla_Kudos.map((row) => ({
        AuditID: toText(row.ID),
        Title: toText(row.NombreReceptor),
        AgenteEmail: normalizeEmail(row.EmailReceptor),
        EmailEmisor: normalizeEmail(row.EmailEmisor),
        Atributo: toText(row.Atributo),
        Mensaje: toText(row.Mensaje),
        FechaKudo: toText(row.Fecha),
        Remitente: normalizeEmail(row.EmailEmisor),
        Puntos: 10,
        SyncStatus: 'Sincronizado' as const,
        UpdatedAt: new Date().toISOString()
      })),
      (item) => toText(item.AuditID)
    );
    await this.mergeStore(
      LOCAL_STORES.ausencias,
      tables.Tabla_Ocupacion.map((row) => ({
        AuditID: toText(row.ID),
        Title: normalizeEmail(row.EmailEmpleado),
        AgenteEmail: normalizeEmail(row.EmailEmpleado),
        FechaInicio: toText(row.Fecha),
        FechaFin: toText(row.Fecha),
        TipoAusencia: toText(row.TipoAusencia),
        CoberturaAsignada: toText(row.CoberturaAsignada),
        Comentarios: toText(row.Observaciones),
        SyncStatus: 'Sincronizado' as const,
        UpdatedAt: new Date().toISOString()
      })),
      (item) => toText(item.AuditID)
    );
  }

  public async downloadExport(): Promise<void> {
    const exportPackage = await this.exportPackage();
    const blob = new Blob(
      [JSON.stringify(exportPackage, null, 2)],
      { type: 'application/json;charset=utf-8' }
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    anchor.href = url;
    anchor.download = `AppDB-Delta-${dateStamp}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private async mergeUsers(
    rows: ReadonlyArray<IUsuarioExcelRow>,
    headcountRows: ReadonlyArray<IHeadcountExcelRow>
  ): Promise<void> {
    const existing = await this.database.getAll<IAppUserRecord>(LOCAL_STORES.users);
    const byEmail = new Map(
      existing.map((item) => [normalizeEmail(item.Email), item])
    );
    const directoryNamesByEmail = new Map(
      headcountRows
        .map((item) => [
          normalizeEmail(item.EmailEmpleado),
          toText(item.NombreEmpleado)
        ] as const)
        .filter(([email, name]) => Boolean(email && name))
    );

    for (const row of rows) {
      const email = normalizeEmail(row.Email);
      if (!email) continue;
      const current = byEmail.get(email);
      const importedStatus = isAppUserStatus(row.Estado)
        ? row.Estado
        : 'Pending_Validation';
      const validated = toBoolean(row.IsProfileValidatedByPA);
      const status = validated && importedStatus === 'Pending_Validation'
        ? 'Pending_Admin_Approval'
        : importedStatus;
      const validatedDirectoryName = validated
        ? directoryNamesByEmail.get(email) || toText(row.Nombre)
        : '';
      const imported: IAppUserRecord = {
        ID: toText(row.ID),
        Email: email,
        PasswordHash: toText(row.PasswordHash) || current?.PasswordHash || '',
        Nombre: validatedDirectoryName || toText(row.Nombre) || current?.Nombre || email,
        Rol: isAppUserRole(row.Rol) ? row.Rol : current?.Rol || 'Asistente',
        Estado: status,
        IsProfileValidatedByPA: validated,
        FechaRegistro: toText(row.FechaRegistro),
        FechaAprobacion: toText(row.FechaAprobacion),
        SyncStatus: 'Sincronizado',
        UpdatedAt: new Date().toISOString()
      };

      if (current?.Id) {
        await this.database.put(LOCAL_STORES.users, {
          ...current,
          ...imported,
          Id: current.Id,
          SyncStatus: 'Sincronizado'
        });
      } else {
        const added = await this.database.add(LOCAL_STORES.users, imported);
        byEmail.set(email, added);
      }
    }
  }

  private async mergeStore<T extends ILocalEntity>(
    storeName: LocalStoreName,
    incoming: ReadonlyArray<T>,
    getKey: (item: T & Record<string, unknown>) => string
  ): Promise<void> {
    const existing = await this.database.getAll<T>(storeName);
    const byKey = new Map<string, T>();
    existing.forEach((item) => {
      const key = getKey(item as T & Record<string, unknown>);
      if (key) byKey.set(key, item);
    });

    for (const item of incoming) {
      const key = getKey(item as T & Record<string, unknown>);
      const current = key ? byKey.get(key) : undefined;
      if (current?.Id) {
        await this.database.put(storeName, {
          ...current,
          ...item,
          Id: current.Id
        } as T & { Id: number });
      } else {
        const added = await this.database.add(storeName, item);
        if (key) byKey.set(key, added);
      }
    }
  }
}

export default PowerAutomateSyncService;
