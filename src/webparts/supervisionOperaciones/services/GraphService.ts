import type { WebPartContext } from '@microsoft/sp-webpart-base';

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
}

interface IGraphDirectoryUser {
  id?: string;
  displayName?: string;
  mail?: string;
  department?: string;
}

interface IGraphDirectReportsResponse {
  value?: IGraphDirectoryUser[];
  '@odata.nextLink'?: string;
}

interface IGraphUsersResponse {
  value?: IGraphDirectoryUser[];
  '@odata.nextLink'?: string;
}

interface IGraphCurrentUserResponse {
  id?: string;
  displayName?: string;
  mail?: string;
  jobTitle?: string;
  department?: string;
}

interface IGraphManagerResponse {
  id?: string;
}

const fallbackDirectReports: IDirectReport[] = [
  {
    id: 'fallback-carlos-perez',
    name: 'Carlos Pérez',
    email: 'carlos.perez@humanoseguros.com',
    isFallback: true
  },
  {
    id: 'fallback-maria-martinez',
    name: 'María Martínez',
    email: 'maria.martinez@humanoseguros.com',
    isFallback: true
  },
  {
    id: 'fallback-juan-rodriguez',
    name: 'Juan Rodríguez',
    email: 'juan.rodriguez@humanoseguros.com',
    isFallback: true
  }
];

export default class GraphService {
  private static activeInstance: GraphService | undefined;

  private currentUserCache: IGraphCurrentUser | undefined;
  private directReportsCache: IDirectReport[] | undefined;
  private supervisorPeersCache: IDirectReport[] | undefined;
  private allUsersCache: IDirectReport[] | undefined;
  private readonly departmentMembersCache: {
    [normalizedDepartment: string]: IDirectReport[];
  } = {};

  public constructor(private readonly context: WebPartContext) {
    GraphService.activeInstance = this;
  }

  /**
   * Returns the Graph service initialized by the Web Part, if available.
   * SecurityService uses this accessor to preserve its parameterless
   * construction contract while still resolving the Microsoft 365 profile.
   */
  public static getActiveInstance(): GraphService | undefined {
    return GraphService.activeInstance;
  }

  /**
   * Executes a typed GET against Microsoft Graph using the SPFx v3 client.
   * The endpoint may be a relative Graph path or an opaque @odata.nextLink.
   */
  public async request<TResponse>(
    resourcePath: string,
    headers?: Readonly<Record<string, string>>
  ): Promise<TResponse> {
    const normalizedResourcePath = resourcePath.trim();

    if (!normalizedResourcePath) {
      throw new Error('La ruta de Microsoft Graph es obligatoria.');
    }

    try {
      const graphClient = await this.context.msGraphClientFactory.getClient('3');
      let request = graphClient.api(normalizedResourcePath);

      Object.keys(headers || {}).forEach((headerName) => {
        const headerValue = headers?.[headerName];

        if (headerValue) {
          request = request.header(headerName, headerValue);
        }
      });

      return await request.get() as TResponse;
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `No fue posible consultar Microsoft Graph: ${detail}`
      );
    }
  }

  public async getCurrentUser(): Promise<IGraphCurrentUser> {
    if (this.currentUserCache) {
      return { ...this.currentUserCache };
    }

    try {
      const graphClient = await this.context.msGraphClientFactory.getClient('3');
      const response = await graphClient
        .api('/me?$select=id,displayName,mail,jobTitle,department')
        .get() as IGraphCurrentUserResponse;

      if (!response.id || !response.displayName) {
        throw new Error(
          'Microsoft Graph no devolvió una identidad válida para el usuario actual.'
        );
      }

      this.currentUserCache = {
        id: response.id,
        displayName: response.displayName,
        email: response.mail || '',
        jobTitle: response.jobTitle || '',
        department: response.department || ''
      };

      return { ...this.currentUserCache };
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `No fue posible consultar el perfil actual en Microsoft Graph: ${detail}`
      );
    }
  }

  public async getDirectReports(): Promise<IDirectReport[]> {
    if (this.directReportsCache) {
      return [...this.directReportsCache];
    }

    try {
      const graphClient = await this.context.msGraphClientFactory.getClient('3');
      const response = await graphClient
        .api('/me/directReports?$select=id,displayName,mail,department')
        .get() as IGraphDirectReportsResponse;

      const directReports = (response.value || [])
        .filter((item) => Boolean(item.id && item.displayName))
        .map((item): IDirectReport => ({
          id: item.id || '',
          name: item.displayName || '',
          email: item.mail || '',
          department: item.department || ''
        }));

      this.directReportsCache = directReports.length > 0
        ? directReports
        : fallbackDirectReports;

      return [...this.directReportsCache];
    } catch {
      this.directReportsCache = fallbackDirectReports;
      return [...this.directReportsCache];
    }
  }

  public async getSupervisorPeers(): Promise<IDirectReport[]> {
    if (this.supervisorPeersCache) {
      return [...this.supervisorPeersCache];
    }

    try {
      const graphClient = await this.context.msGraphClientFactory.getClient('3');
      const manager = await graphClient
        .api('/me/manager?$select=id')
        .get() as IGraphManagerResponse;

      if (!manager.id) {
        this.supervisorPeersCache = [];
        return [...this.supervisorPeersCache];
      }

      const response = await graphClient
        .api(
          `/users/${encodeURIComponent(manager.id)}` +
          '/directReports?$select=id,displayName,mail,department'
        )
        .get() as IGraphDirectReportsResponse;

      const peers = (response.value || [])
        .filter((item) => Boolean(item.id && item.displayName))
        .map((item): IDirectReport => ({
          id: item.id || '',
          name: item.displayName || '',
          email: item.mail || '',
          department: item.department || ''
        }));

      this.supervisorPeersCache = peers;

      return [...this.supervisorPeersCache];
    } catch {
      this.supervisorPeersCache = [];
      return [...this.supervisorPeersCache];
    }
  }

  /**
   * Returns only directory users whose department matches the supplied value.
   * This method intentionally has no simulated or global fallback because it is
   * used as an authorization boundary for the Gerente role.
   */
  public async getDepartmentMembers(
    departmentName: string
  ): Promise<IDirectReport[]> {
    const trimmedDepartment = departmentName.trim();
    const normalizedDepartment = trimmedDepartment.toLocaleLowerCase();

    if (!normalizedDepartment) {
      return [];
    }

    const cachedMembers = this.departmentMembersCache[normalizedDepartment];

    if (cachedMembers) {
      return cachedMembers.map((member) => ({ ...member }));
    }

    try {
      const graphClient = await this.context.msGraphClientFactory.getClient('3');
      const escapedDepartment = trimmedDepartment.replace(/'/g, "''");
      const departmentFilter = encodeURIComponent(
        `department eq '${escapedDepartment}'`
      );
      const usersById: { [id: string]: IDirectReport } = {};
      let nextLink: string | undefined =
        `/users?$filter=${departmentFilter}` +
        '&$select=id,displayName,mail,department&$top=999';

      while (nextLink) {
        const response = await graphClient
          .api(nextLink)
          .get() as IGraphUsersResponse;

        (response.value || [])
          .filter((item) => Boolean(item.id && item.displayName))
          .forEach((item) => {
            const id = item.id || '';

            usersById[id] = {
              id,
              name: item.displayName || '',
              email: item.mail || '',
              department: item.department || trimmedDepartment
            };
          });

        nextLink = response['@odata.nextLink'];
      }

      const members = Object.keys(usersById)
        .map((id) => usersById[id])
        .sort((left, right) => left.name.localeCompare(right.name));

      this.departmentMembersCache[normalizedDepartment] = members;
      return members.map((member) => ({ ...member }));
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `No fue posible consultar los miembros del departamento ` +
        `"${trimmedDepartment}" en Microsoft Graph: ${detail}`
      );
    }
  }

  public async getAllUsers(): Promise<IDirectReport[]> {
    if (this.allUsersCache) {
      return [...this.allUsersCache];
    }

    try {
      const graphClient = await this.context.msGraphClientFactory.getClient('3');
      const usersById: { [id: string]: IDirectReport } = {};
      let nextLink: string | undefined =
        '/users?$select=id,displayName,mail,department&$top=999';

      while (nextLink) {
        const response = await graphClient
          .api(nextLink)
          .get() as IGraphUsersResponse;

        (response.value || [])
          .filter((item) => Boolean(item.id && item.displayName))
          .forEach((item) => {
            const id = item.id || '';

            usersById[id] = {
              id,
              name: item.displayName || '',
              email: item.mail || '',
              department: item.department || ''
            };
          });

        nextLink = response['@odata.nextLink'];
      }

      const users = Object.keys(usersById)
        .map((id) => usersById[id])
        .sort((left, right) => left.name.localeCompare(right.name));

      this.allUsersCache = users.length > 0
        ? users
        : fallbackDirectReports;

      return [...this.allUsersCache];
    } catch {
      this.allUsersCache = fallbackDirectReports;
      return [...this.allUsersCache];
    }
  }
}
