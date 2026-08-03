import IndexedDbAdapter, {
  LOCAL_STORES
} from '../../../services/IndexedDbAdapter';
import type { IHeadcountRow } from '../../../services/PowerAutomateSyncService';

export interface IDirectReport {
  id: string;
  name: string;
  email: string;
  department?: string;
  isFallback?: boolean;
}

export interface IGraphCurrentUser {
  id: string;
  displayName: string;
  email: string;
  jobTitle: string;
  department: string;
  role?: IHeadcountRow['Rol'];
}

export const LOCAL_USER_STORAGE_KEY = 'humanoOps.currentUser';

const DEFAULT_HEADCOUNT: ReadonlyArray<Omit<IHeadcountRow, 'Id'>> = [
  {
    AgenteObjectID: 'local-admin-001',
    Nombre: 'Administrador Local',
    Email: 'admin@demo.invalid',
    Rol: 'Admin',
    Departamento: 'Operaciones',
    SupervisorEmail: '',
    Activo: true,
    SyncStatus: 'Sincronizado'
  },
  {
    AgenteObjectID: 'local-supervisor-001',
    Nombre: 'Supervisor Local',
    Email: 'supervisor@demo.invalid',
    Rol: 'Supervisor',
    Departamento: 'Operaciones',
    SupervisorEmail: 'admin@demo.invalid',
    Activo: true,
    SyncStatus: 'Sincronizado'
  },
  {
    AgenteObjectID: 'local-carlos-perez',
    Nombre: 'Colaborador Demo 01',
    Email: 'colaborador01@demo.invalid',
    Rol: 'Oficial',
    Departamento: 'Operaciones',
    SupervisorEmail: 'supervisor@demo.invalid',
    Activo: true,
    SyncStatus: 'Sincronizado'
  },
  {
    AgenteObjectID: 'local-maria-martinez',
    Nombre: 'Colaborador Demo 02',
    Email: 'colaborador02@demo.invalid',
    Rol: 'Asistente',
    Departamento: 'Operaciones',
    SupervisorEmail: 'supervisor@demo.invalid',
    Activo: true,
    SyncStatus: 'Sincronizado'
  },
  {
    AgenteObjectID: 'local-juan-rodriguez',
    Nombre: 'Colaborador Demo 03',
    Email: 'colaborador03@demo.invalid',
    Rol: 'Analista',
    Departamento: 'Operaciones',
    SupervisorEmail: 'supervisor@demo.invalid',
    Activo: true,
    SyncStatus: 'Sincronizado'
  }
];

const normalizeEmail = (value?: string): string =>
  value?.trim().toLocaleLowerCase() || '';

const toDirectReport = (row: IHeadcountRow): IDirectReport => ({
  id: row.AgenteObjectID || `headcount-${row.Id}`,
  name: row.Nombre,
  email: row.Email,
  department: row.Departamento
});

const getConfiguredEmail = (): string => {
  if (typeof localStorage !== 'undefined') {
    try {
      const stored = JSON.parse(
        localStorage.getItem(LOCAL_USER_STORAGE_KEY) || '{}'
      ) as { email?: string };

      if (stored.email) {
        return normalizeEmail(stored.email);
      }
    } catch {
      // A malformed local preference is ignored in favor of the safe default.
    }
  }

  return normalizeEmail(import.meta.env.VITE_DEFAULT_USER_EMAIL) ||
    'admin@demo.invalid';
};

/**
 * Local directory facade. It deliberately performs no HTTP calls to Entra ID
 * or Microsoft Graph; organization scope comes from Tabla_Headcount imported
 * from AppDB.xlsx through the Power Automate exchange package.
 */
export default class GraphService {
  private static activeInstance: GraphService | undefined;
  private readonly database: IndexedDbAdapter;

  public constructor(_legacyContext?: unknown) {
    this.database = new IndexedDbAdapter();
    GraphService.activeInstance = this;
  }

  public static getActiveInstance(): GraphService | undefined {
    return GraphService.activeInstance;
  }

  public async request<TResponse>(
    _resourcePath: string,
    _headers?: Readonly<Record<string, string>>
  ): Promise<TResponse> {
    // Calendar/Graph integration is intentionally disabled in standalone mode.
    return { value: [] } as TResponse;
  }

  public async getCurrentUser(): Promise<IGraphCurrentUser> {
    const rows = await this.getHeadcount();
    const configuredEmail = getConfiguredEmail();
    const row = rows.find((item) => normalizeEmail(item.Email) === configuredEmail) ||
      rows.find((item) => item.Rol === 'Admin') ||
      rows[0];

    if (!row) {
      throw new Error(
        'Tabla_Headcount no contiene una identidad activa para iniciar la aplicación.'
      );
    }

    const identity: IGraphCurrentUser = {
      id: row.AgenteObjectID || `headcount-${row.Id}`,
      displayName: row.Nombre,
      email: normalizeEmail(row.Email),
      jobTitle: row.Rol,
      department: row.Departamento,
      role: row.Rol
    };

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_USER_STORAGE_KEY, JSON.stringify(identity));
    }

    return identity;
  }

  public async getDirectReports(): Promise<IDirectReport[]> {
    const [currentUser, rows] = await Promise.all([
      this.getCurrentUser(),
      this.getHeadcount()
    ]);

    return rows
      .filter((row) => normalizeEmail(row.SupervisorEmail) === currentUser.email)
      .map(toDirectReport)
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  public async getSupervisorPeers(): Promise<IDirectReport[]> {
    const [currentUser, rows] = await Promise.all([
      this.getCurrentUser(),
      this.getHeadcount()
    ]);
    const currentRow = rows.find(
      (row) => normalizeEmail(row.Email) === currentUser.email
    );
    const supervisorEmail = normalizeEmail(currentRow?.SupervisorEmail);

    if (!supervisorEmail) {
      return [toDirectReport(currentRow || rows[0])];
    }

    return rows
      .filter((row) => normalizeEmail(row.SupervisorEmail) === supervisorEmail)
      .map(toDirectReport)
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  public async getDepartmentMembers(
    departmentName: string
  ): Promise<IDirectReport[]> {
    const department = departmentName.trim().toLocaleLowerCase();
    const rows = await this.getHeadcount();

    return rows
      .filter((row) => row.Departamento.trim().toLocaleLowerCase() === department)
      .map(toDirectReport)
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  public async getAllUsers(): Promise<IDirectReport[]> {
    const rows = await this.getHeadcount();
    return rows.map(toDirectReport).sort((left, right) =>
      left.name.localeCompare(right.name)
    );
  }

  private async getHeadcount(): Promise<IHeadcountRow[]> {
    let rows = await this.database.getAll<IHeadcountRow>(LOCAL_STORES.headcount);

    if (rows.length === 0) {
      for (const seed of DEFAULT_HEADCOUNT) {
        await this.database.add(LOCAL_STORES.headcount, seed);
      }

      rows = await this.database.getAll<IHeadcountRow>(LOCAL_STORES.headcount);
    }

    return rows.filter((row) => row.Activo !== false);
  }
}
