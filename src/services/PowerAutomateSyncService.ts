import type {
  AppUserRole,
  AppUserStatus,
  IAdminNotificationRecord,
  IAppUserRecord
} from '../auth/AuthModels';
import type {
  CellValue,
  Workbook as ExcelWorkbook,
  Worksheet
} from 'exceljs';
import {
  ACTIVE_USER_ROLES,
  APP_USER_STATUSES
} from '../auth/AuthModels';
import IndexedDbAdapter, {
  LOCAL_STORES,
  type ILocalEntity,
  type LocalStoreName
} from './IndexedDbAdapter';
import { cloudDbClient } from './CloudDbClient';

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
  Nombre: string;
  Rol: AppUserRole;
  Estado: AppUserStatus;
  PasswordHash?: string;
  CalculatedRol?: AppUserRole | string;
  IsProfileValidatedByPA?: boolean;
  FechaRegistro?: string;
  FechaAprobacion?: string;
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
  IdCasoHelpdesk?: string;
  ProcesoArea?: string;
  HorasPerdidas?: number;
  MinutosTardanza?: number;
  HoraLlegada?: string;
  OrigenError?: string;
  SubcategoriaError?: string;
  ComentariosCapacitacion?: string;
  IdAuditoria?: string;
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

export interface INotificacionExcelRow {
  ID: string;
  Tipo: string;
  Destinatario: string;
  Mensaje: string;
  Fecha: string;
  Sincronizado: boolean;
}

export interface IPowerAutomateTables {
  Tabla_Usuarios: IUsuarioExcelRow[];
  Tabla_Headcount: IHeadcountExcelRow[];
  Tabla_Faltas: IFaltaExcelRow[];
  Tabla_Kudos: IKudoExcelRow[];
  Tabla_Ocupacion: IOcupacionExcelRow[];
  Tabla_Notificaciones: INotificacionExcelRow[];
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
  value === undefined || value === null
    ? ''
    : value instanceof Date
      ? value.toISOString()
      : String(value).trim();

const toBoolean = (value: unknown): boolean =>
  value === true || value === 1 || String(value).toLocaleLowerCase() === 'true';

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isPending = (item: ILocalEntity): boolean =>
  item.SyncStatus !== 'Sincronizado';

const isPendingUser = (user: IAppUserRecord): boolean =>
  user.SyncStatus !== 'Sincronizado' ||
  user.Estado === 'Pending_Admin_Approval' ||
  user.Estado === 'Pending_Validation' ||
  user.IsProfileValidatedByPA === false;

const isAppUserRole = (value: string): value is AppUserRole =>
  ACTIVE_USER_ROLES.includes(value as AppUserRole);

const isAppUserStatus = (value: string): value is AppUserStatus =>
  APP_USER_STATUSES.includes(value as AppUserStatus);

const asRecord = (value: ILocalEntity): Record<string, unknown> =>
  value as Record<string, unknown>;

type ExcelTableName = keyof IPowerAutomateTables;

interface IExcelTableDefinition {
  tableName: ExcelTableName;
  sheetAliases: ReadonlyArray<string>;
  requiredHeaders: ReadonlyArray<string>;
}

const EXCEL_TABLE_DEFINITIONS: ReadonlyArray<IExcelTableDefinition> = [
  {
    tableName: 'Tabla_Usuarios',
    sheetAliases: ['Tabla_Usuarios', 'Usuarios'],
    requiredHeaders: ['ID', 'Email', 'Nombre', 'Estado', 'IsProfileValidatedByPA']
  },
  {
    tableName: 'Tabla_Headcount',
    sheetAliases: ['Tabla_Headcount', 'Headcount'],
    requiredHeaders: ['ID', 'EmailEmpleado', 'NombreEmpleado', 'EmailSupervisor']
  },
  {
    tableName: 'Tabla_Faltas',
    sheetAliases: ['Tabla_Faltas', 'Faltas'],
    requiredHeaders: ['ID', 'EmailEmpleado', 'FechaFalta', 'TipoFalta']
  },
  {
    tableName: 'Tabla_Kudos',
    sheetAliases: ['Tabla_Kudos', 'Kudos'],
    requiredHeaders: ['ID', 'EmailEmisor', 'EmailReceptor', 'Fecha']
  },
  {
    tableName: 'Tabla_Ocupacion',
    sheetAliases: ['Tabla_Ocupacion', 'Ocupacion'],
    requiredHeaders: ['ID', 'EmailEmpleado', 'Fecha', 'TipoAusencia']
  },
  {
    tableName: 'Tabla_Notificaciones',
    sheetAliases: ['Tabla_Notificaciones', 'Notificaciones'],
    requiredHeaders: ['ID', 'Tipo', 'Destinatario', 'Fecha']
  }
];

const normalizeCellValue = (value: CellValue): unknown => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== 'object') return value;

  if ('result' in value) {
    return normalizeCellValue(value.result as CellValue);
  }
  if ('richText' in value) {
    return value.richText.map((part) => part.text).join('');
  }
  if ('text' in value) {
    return value.text;
  }
  if ('error' in value) {
    return value.error;
  }

  return String(value);
};

const getRowCellValues = (
  worksheet: Worksheet,
  rowNumber: number
): CellValue[] => {
  const values = worksheet.getRow(rowNumber).values;
  return Array.isArray(values)
    ? (values as CellValue[]).slice(1)
    : Object.values(values);
};

const findWorksheet = (
  workbook: ExcelWorkbook,
  definition: IExcelTableDefinition
): Worksheet | undefined => {
  for (const alias of definition.sheetAliases) {
    const worksheet = workbook.getWorksheet(alias);
    if (worksheet) return worksheet;
  }

  return workbook.worksheets.find((worksheet) => {
    for (let rowNumber = 1; rowNumber <= Math.min(10, worksheet.rowCount); rowNumber += 1) {
      const headers = getRowCellValues(worksheet, rowNumber)
        .map((value) => toText(normalizeCellValue(value as CellValue)));
      if (definition.requiredHeaders.every((header) => headers.includes(header))) {
        return true;
      }
    }
    return false;
  });
};

const readWorksheetRows = (
  worksheet: Worksheet,
  definition: IExcelTableDefinition
): Array<Record<string, unknown>> => {
  let headerRowNumber = 0;
  let headers: string[] = [];

  for (let rowNumber = 1; rowNumber <= Math.min(10, worksheet.rowCount); rowNumber += 1) {
    const candidateHeaders = getRowCellValues(worksheet, rowNumber)
      .map((value) => toText(normalizeCellValue(value as CellValue)));
    if (definition.requiredHeaders.every((header) => candidateHeaders.includes(header))) {
      headerRowNumber = rowNumber;
      headers = candidateHeaders;
      break;
    }
  }

  if (!headerRowNumber) {
    throw new Error(
      `La hoja ${worksheet.name} no contiene los encabezados de ${definition.tableName}.`
    );
  }

  const rows: Array<Record<string, unknown>> = [];
  for (let rowNumber = headerRowNumber + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const record: Record<string, unknown> = {};
    let hasValues = false;

    headers.forEach((header, index) => {
      if (!header) return;
      const value = normalizeCellValue(row.getCell(index + 1).value);
      record[header] = value;
      if (toText(value)) hasValues = true;
    });

    if (hasValues) rows.push(record);
  }

  return rows;
};

const getRecordId = (record: Record<string, unknown>): string =>
  toText(record.AuditID || record.ID || record.Id);

const toUsuarioExcel = (user: IAppUserRecord): IUsuarioExcelRow => ({
  ID: user.ID || String(user.Id || ''),
  Email: normalizeEmail(user.Email),
  Nombre: user.Nombre,
  Rol: user.Rol,
  Estado: user.Estado
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
    FechaCreacion: toText(record.UpdatedAt || record.FechaFalta),
    IdCasoHelpdesk: toText(record.IdCasoHelpdesk || record.CasoRef),
    ProcesoArea: toText(record.ProcesoArea),
    HorasPerdidas: toNumber(record.HorasPerdidas),
    MinutosTardanza: toNumber(record.MinutosTardanza),
    HoraLlegada: toText(record.HoraLlegada),
    OrigenError: toText(record.OrigenError),
    SubcategoriaError: toText(record.SubcategoriaError || record.Subcategoria),
    ComentariosCapacitacion: toText(record.ComentariosCapacitacion),
    IdAuditoria: toText(record.IdAuditoria || record.AuditID || record.ID)
  };
};

const toNotificacionExcel = (
  item: IAdminNotificationRecord
): INotificacionExcelRow => ({
  ID: item.ID,
  Tipo: item.Tipo,
  Destinatario: item.Destinatario,
  Mensaje: item.Mensaje,
  Fecha: item.Fecha,
  Sincronizado: item.SyncStatus === 'Sincronizado' || item.Sincronizado
});

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
    const [users, headcount, faltas, kudos, ausencias, notifications] = await Promise.all([
      cloudDbClient.getUsuarios(),
      this.database.getAll<IHeadcountRow>(LOCAL_STORES.headcount),
      cloudDbClient.getFaltas(),
      cloudDbClient.getKudos(),
      this.database.getAll(LOCAL_STORES.ausencias),
      this.database.getAll<IAdminNotificationRecord>(LOCAL_STORES.notifications)
    ]);

    return {
      schemaVersion: '2.0',
      syncMode: 'delta',
      source: 'Humano Ops Hub IndexedDB',
      targetWorkbook: 'AppDB.xlsx',
      exportedAt: new Date().toISOString(),
      tables: {
        Tabla_Usuarios: users.filter(isPendingUser).map(toUsuarioExcel),
        Tabla_Headcount: headcount.filter(isPending).map(toHeadcountExcel),
        Tabla_Faltas: faltas.filter(isPending).map(toFaltaExcel),
        Tabla_Kudos: kudos.filter(isPending).map(toKudoExcel),
        Tabla_Ocupacion: ausencias.filter(isPending).map(toOcupacionExcel),
        Tabla_Notificaciones: notifications
          .filter(isPending)
          .map(toNotificacionExcel)
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
        CasoRef: toText(row.IdCasoHelpdesk),
        IdCasoHelpdesk: toText(row.IdCasoHelpdesk),
        ProcesoArea: toText(row.ProcesoArea),
        HorasPerdidas: toNumber(row.HorasPerdidas),
        MinutosTardanza: toNumber(row.MinutosTardanza),
        HoraLlegada: toText(row.HoraLlegada),
        OrigenError: toText(row.OrigenError),
        Subcategoria: toText(row.SubcategoriaError),
        SubcategoriaError: toText(row.SubcategoriaError),
        ComentariosCapacitacion: toText(row.ComentariosCapacitacion),
        IdAuditoria: toText(row.IdAuditoria || row.ID),
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

    await this.mergeStore(
      LOCAL_STORES.notifications,
      (tables.Tabla_Notificaciones || []).map((row) => ({
        ID: toText(row.ID),
        AuditID: toText(row.ID),
        Tipo: 'MasterAdminRecovery' as const,
        Destinatario: normalizeEmail(row.Destinatario),
        Mensaje: toText(row.Mensaje),
        Fecha: toText(row.Fecha),
        Sincronizado: toBoolean(row.Sincronizado),
        SyncStatus: 'Sincronizado' as const,
        UpdatedAt: new Date().toISOString()
      })),
      (item) => toText(item.ID)
    );
  }

  public async importFile(file: File): Promise<void> {
    const extension = file.name.split('.').pop()?.toLocaleLowerCase();

    if (extension === 'json') {
      await this.importPackage(await file.text());
      return;
    }

    if (extension !== 'xlsx' && extension !== 'xls') {
      throw new Error('Selecciona un archivo .xlsx, .xls o .json válido.');
    }

    try {
      const { default: ExcelJS } = await import('exceljs');
      const buffer = await file.arrayBuffer();
      let workbook = new ExcelJS.Workbook();

      try {
        await workbook.xlsx.load(buffer as unknown as Buffer);
      } catch (initialError: unknown) {
        // AppDB.xlsx can be generated with valid namespace-prefixed OpenXML.
        // ExcelJS does not recognize that representation, so normalize an
        // in-memory copy without changing the original workbook selected.
        const { default: JSZip } = await import('jszip');
        const archive = await JSZip.loadAsync(buffer);
        let normalizedFiles = 0;

        for (const path of Object.keys(archive.files)) {
          const entry = archive.file(path);
          if (!entry || !path.toLocaleLowerCase().endsWith('.xml')) continue;
          const xml = await entry.async('string');
          const normalizedXml = xml
            .replace(/(<\/?)(x):/g, '$1')
            .replace(/ xmlns:x=/g, ' xmlns=')
            // We read rows directly. Removing table relationships avoids an
            // ExcelJS incompatibility with absolute OpenXML table targets.
            .replace(/<tableParts[\s\S]*?<\/tableParts>/g, '');

          if (normalizedXml !== xml) {
            archive.file(path, normalizedXml);
            normalizedFiles += 1;
          }
        }

        if (!normalizedFiles) throw initialError;
        const normalizedBuffer = await archive.generateAsync({ type: 'arraybuffer' });
        workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(normalizedBuffer as unknown as Buffer);
      }

      const parsedTables: Partial<IPowerAutomateTables> = {};

      for (const definition of EXCEL_TABLE_DEFINITIONS) {
        const worksheet = findWorksheet(workbook, definition);
        if (!worksheet) {
          if (definition.tableName === 'Tabla_Notificaciones') continue;
          throw new Error(
            `No se encontró la hoja o tabla ${definition.tableName} en el libro.`
          );
        }
        parsedTables[definition.tableName] = readWorksheetRows(
          worksheet,
          definition
        ) as never;
      }

      await this.importPackage({
        schemaVersion: '2.0',
        syncMode: 'delta',
        source: 'Humano Ops Hub IndexedDB',
        targetWorkbook: 'AppDB.xlsx',
        exportedAt: new Date().toISOString(),
        tables: {
          Tabla_Usuarios: parsedTables.Tabla_Usuarios || [],
          Tabla_Headcount: parsedTables.Tabla_Headcount || [],
          Tabla_Faltas: parsedTables.Tabla_Faltas || [],
          Tabla_Kudos: parsedTables.Tabla_Kudos || [],
          Tabla_Ocupacion: parsedTables.Tabla_Ocupacion || [],
          Tabla_Notificaciones: parsedTables.Tabla_Notificaciones || []
        }
      });
    } catch (error: unknown) {
      if (extension === 'xls') {
        throw new Error(
          'No fue posible leer el archivo .xls legado. Guárdalo como .xlsx desde Excel e inténtalo nuevamente.'
        );
      }
      throw error;
    }
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
    const cloudUsers = await cloudDbClient.getUsuarios();
    const cloudUserMap = new Map(cloudUsers.map(u => [normalizeEmail(u.Email), u]));

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
      const currentLocal = byEmail.get(email);
      const currentCloud = cloudUserMap.get(email);
      const current = currentCloud || currentLocal;

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

      const rawCalculatedRol = toText(row.CalculatedRol || row.Rol);
      const calculatedRol: AppUserRole = isAppUserRole(rawCalculatedRol)
        ? (rawCalculatedRol as AppUserRole)
        : 'Agente';

      const currentRole = current?.Rol;
      const isRoleOverridden = Boolean(current?.IsRoleManuallyOverridden);
      const isAdminOrMaster = currentRole === 'Master_Admin' || (currentRole as string) === 'Master Admin' || currentRole === 'Admin';

      let finalRole: AppUserRole;
      if ((isRoleOverridden || isAdminOrMaster) && currentRole) {
        finalRole = currentRole;
      } else {
        finalRole = calculatedRol;
      }

      const imported: IAppUserRecord = {
        ID: toText(row.ID),
        Email: email,
        PasswordHash: toText(row.PasswordHash) || current?.PasswordHash || '',
        Nombre: validatedDirectoryName || toText(row.Nombre) || current?.Nombre || email,
        Rol: finalRole,
        Estado: status,
        IsProfileValidatedByPA: validated,
        IsRoleManuallyOverridden: isRoleOverridden,
        FechaRegistro: toText(row.FechaRegistro),
        FechaAprobacion: toText(row.FechaAprobacion),
        SyncStatus: 'Sincronizado',
        UpdatedAt: new Date().toISOString()
      };

      if (currentLocal?.Id) {
        await this.database.put(LOCAL_STORES.users, {
          ...currentLocal,
          ...imported,
          Id: currentLocal.Id,
          SyncStatus: 'Sincronizado'
        });
      } else {
        const added = await this.database.add(LOCAL_STORES.users, imported);
        byEmail.set(email, added);
      }
      await cloudDbClient.updateUsuarioStatus(email, imported.Estado, imported.Rol, imported.IsProfileValidatedByPA, false);
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
