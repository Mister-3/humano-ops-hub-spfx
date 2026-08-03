import IndexedDbAdapter, {
  LOCAL_STORES,
  type ILocalEntity
} from './IndexedDbAdapter';

export interface IHeadcountRow extends ILocalEntity {
  Id: number;
  AgenteObjectID: string;
  Nombre: string;
  Email: string;
  Rol: 'Admin' | 'Gerente' | 'Supervisor' | 'Analista' | 'Asistente' | 'Oficial';
  Departamento: string;
  SupervisorEmail: string;
  Activo: boolean;
}

export interface IPowerAutomateTables {
  Tabla_Faltas: Array<Record<string, unknown>>;
  Tabla_Kudos: Array<Record<string, unknown>>;
  Tabla_Headcount: IHeadcountRow[];
  Tabla_Ocupacion: Array<Record<string, unknown>>;
}

export interface IPowerAutomateExportPackage {
  schemaVersion: '1.0';
  source: 'Humano Ops Hub IndexedDB';
  targetWorkbook: 'AppDB.xlsx';
  exportedAt: string;
  tables: IPowerAutomateTables;
}

const asRecord = (value: ILocalEntity): Record<string, unknown> =>
  value as Record<string, unknown>;

const sanitizeForExcel = (
  record: Record<string, unknown>
): Record<string, unknown> => Object.keys(record).reduce<Record<string, unknown>>(
  (result, key) => {
    const value = record[key];

    if (key === 'SyncStatus' || key === 'UpdatedAt') {
      return result;
    }

    if (value instanceof Blob) {
      return result;
    }

    if (
      Array.isArray(value) &&
      value.some((entry) =>
        entry instanceof Blob ||
        (
          entry !== null &&
          typeof entry === 'object' &&
          'content' in entry &&
          (entry as { content?: unknown }).content instanceof Blob
        )
      )
    ) {
      result.Evidencias = value
        .map((entry) => {
          if (entry && typeof entry === 'object' && 'name' in entry) {
            return String((entry as { name?: unknown }).name || 'archivo');
          }

          return 'archivo';
        })
        .join('; ');
      return result;
    }

    if (value !== undefined) {
      result[key] = value;
    }

    return result;
  },
  {}
);

/**
 * Builds the exact table envelope consumed by Power Automate. The flow can
 * iterate each property and insert/update rows in the homonymous AppDB.xlsx
 * table without calling SharePoint or Microsoft Graph from the browser.
 */
export class PowerAutomateSyncService {
  public constructor(
    private readonly database: IndexedDbAdapter = new IndexedDbAdapter()
  ) {}

  public async exportPackage(): Promise<IPowerAutomateExportPackage> {
    const [faltas, kudos, headcount, llamadas, correos] = await Promise.all([
      this.database.getAll(LOCAL_STORES.faltas),
      this.database.getAll(LOCAL_STORES.kudos),
      this.database.getAll<IHeadcountRow>(LOCAL_STORES.headcount),
      this.database.getAll(LOCAL_STORES.llamadas),
      this.database.getAll(LOCAL_STORES.correos)
    ]);

    const tablaOcupacion = [
      ...llamadas.map((item) => ({
        ...sanitizeForExcel(asRecord(item)),
        TipoRegistro: 'LlamadaFlota'
      })),
      ...correos.map((item) => ({
        ...sanitizeForExcel(asRecord(item)),
        TipoRegistro: 'Correo'
      }))
    ];

    return {
      schemaVersion: '1.0',
      source: 'Humano Ops Hub IndexedDB',
      targetWorkbook: 'AppDB.xlsx',
      exportedAt: new Date().toISOString(),
      tables: {
        Tabla_Faltas: faltas.map((item) => sanitizeForExcel(asRecord(item))),
        Tabla_Kudos: kudos.map((item) => sanitizeForExcel(asRecord(item))),
        Tabla_Headcount: headcount,
        Tabla_Ocupacion: tablaOcupacion
      }
    };
  }

  public async importPackage(
    payload: string | IPowerAutomateExportPackage
  ): Promise<void> {
    const parsed = typeof payload === 'string'
      ? JSON.parse(payload) as IPowerAutomateExportPackage
      : payload;

    if (
      parsed.schemaVersion !== '1.0' ||
      !parsed.tables ||
      !Array.isArray(parsed.tables.Tabla_Faltas) ||
      !Array.isArray(parsed.tables.Tabla_Kudos) ||
      !Array.isArray(parsed.tables.Tabla_Headcount) ||
      !Array.isArray(parsed.tables.Tabla_Ocupacion)
    ) {
      throw new Error(
        'El archivo no cumple el contrato AppDB.xlsx / Power Automate versión 1.0.'
      );
    }

    const llamadas = parsed.tables.Tabla_Ocupacion.filter(
      (item) => item.TipoRegistro === 'LlamadaFlota'
    );
    const correos = parsed.tables.Tabla_Ocupacion.filter(
      (item) => item.TipoRegistro === 'Correo'
    );

    await this.database.replaceAll(LOCAL_STORES.faltas, parsed.tables.Tabla_Faltas);
    await this.database.replaceAll(LOCAL_STORES.kudos, parsed.tables.Tabla_Kudos);
    await this.database.replaceAll(LOCAL_STORES.headcount, parsed.tables.Tabla_Headcount);
    await this.database.replaceAll(LOCAL_STORES.llamadas, llamadas);
    await this.database.replaceAll(LOCAL_STORES.correos, correos);
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
    anchor.download = `AppDB-PowerAutomate-${dateStamp}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}

export default PowerAutomateSyncService;
