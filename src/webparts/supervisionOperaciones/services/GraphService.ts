import IndexedDbAdapter, {
  LOCAL_STORES
} from '../../../services/IndexedDbAdapter';
import { cloudDbClient } from '../../../services/CloudDbClient';
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
    ID: 'HC-000001',
    EmailEmpleado: 'admin@humano.com.do',
    NombreEmpleado: 'Administrador de Plataforma',
    Cargo: 'Admin',
    Departamento: 'Operaciones',
    EmailSupervisor: '',
    EstadoActivo: true,
    AgenteObjectID: 'local-master-admin-001',
    Rol: 'Admin',
    SyncStatus: 'Sincronizado'
  }
];

const normalizeEmail = (value?: string): string =>
  value?.trim().toLocaleLowerCase() || '';

const getRowEmail = (row: IHeadcountRow): string => {
  const r = row as unknown as Record<string, unknown>;
  return normalizeEmail(
    (r.EmailEmpleado || r.Email || r.memberemail || r.emailempleado || r.email || r.Correo || r.correo) as string | undefined
  );
};

const getRowName = (row: IHeadcountRow): string => {
  const r = row as unknown as Record<string, unknown>;
  return ((r.NombreEmpleado || r.Nombre || r.membername || r.nombreempleado || r.nombre) as string) || getRowEmail(row);
};

const getSupervisorEmail = (row: IHeadcountRow): string => {
  const r = row as unknown as Record<string, unknown>;
  return normalizeEmail(
    (r.EmailSupervisor || r.SupervisorEmail || r.supervisoremail || r.emailsupervisor || r.Supervisor_Email || r.Email_Supervisor) as string | undefined
  );
};

const getRowRole = (row: IHeadcountRow): IHeadcountRow['Rol'] =>
  row.Rol || (
    (row.Cargo || '').toLocaleLowerCase().includes('supervisor')
      ? 'Supervisor'
      : 'Agente'
  );

const toDirectReport = (row: IHeadcountRow): IDirectReport => ({
  id: row.AgenteObjectID || `headcount-${row.Id}`,
  name: getRowName(row),
  email: getRowEmail(row),
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
    'admin@humano.com.do';
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
    const row = rows.find((item) => getRowEmail(item) === configuredEmail);

    if (!row && typeof localStorage !== 'undefined') {
      try {
        const stored = JSON.parse(
          localStorage.getItem(LOCAL_USER_STORAGE_KEY) || '{}'
        ) as Partial<IGraphCurrentUser>;
        if (normalizeEmail(stored.email) === configuredEmail) {
          return {
            id: stored.id || `local-${configuredEmail}`,
            displayName: stored.displayName || configuredEmail,
            email: configuredEmail,
            jobTitle: stored.jobTitle || stored.role || 'Agente',
            department: stored.department || '',
            role: stored.role
          };
        }
      } catch {
        // La sesión inválida será resuelta por AuthService.
      }
    }

    if (!row) {
      throw new Error(
        'Tabla_Headcount no contiene una identidad activa para iniciar la aplicación.'
      );
    }

    const identity: IGraphCurrentUser = {
      id: row.AgenteObjectID || `headcount-${row.Id}`,
      displayName: getRowName(row),
      email: getRowEmail(row),
      jobTitle: getRowRole(row) || 'Agente',
      department: row.Departamento,
      role: getRowRole(row)
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
      .filter((row) => getSupervisorEmail(row) === currentUser.email)
      .map(toDirectReport)
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  public async getSupervisorPeers(): Promise<IDirectReport[]> {
    const [currentUser, rows] = await Promise.all([
      this.getCurrentUser(),
      this.getHeadcount()
    ]);
    const currentRow = rows.find(
      (row) => getRowEmail(row) === currentUser.email
    );
    const supervisorEmail = currentRow ? getSupervisorEmail(currentRow) : '';

    if (!supervisorEmail) {
      return currentRow ? [toDirectReport(currentRow)] : [];
    }

    return rows
      .filter((row) => getSupervisorEmail(row) === supervisorEmail)
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
    let rows: IHeadcountRow[] = [];
    try {
      rows = await cloudDbClient.getHeadcount();
    } catch {
      rows = await this.database.getAll<IHeadcountRow>(LOCAL_STORES.headcount);
    }

    if (!rows || rows.length === 0) {
      for (const seed of DEFAULT_HEADCOUNT) {
        await this.database.add(LOCAL_STORES.headcount, seed);
      }

      rows = await this.database.getAll<IHeadcountRow>(LOCAL_STORES.headcount);
    }

    return rows.filter((row) => row.EstadoActivo !== false && (row as any).Activo !== false);
  }
}
