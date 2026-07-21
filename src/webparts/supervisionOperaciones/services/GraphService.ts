import type { WebPartContext } from '@microsoft/sp-webpart-base';

export interface IDirectReport {
  id: string;
  name: string;
  email: string;
}

interface IGraphDirectReport {
  id?: string;
  displayName?: string;
  mail?: string;
}

interface IGraphDirectReportsResponse {
  value?: IGraphDirectReport[];
}

const fallbackDirectReports: IDirectReport[] = [
  {
    id: 'fallback-carlos-perez',
    name: 'Carlos Pérez',
    email: 'carlos.perez@humanoseguros.com'
  },
  {
    id: 'fallback-maria-martinez',
    name: 'María Martínez',
    email: 'maria.martinez@humanoseguros.com'
  },
  {
    id: 'fallback-juan-rodriguez',
    name: 'Juan Rodríguez',
    email: 'juan.rodriguez@humanoseguros.com'
  }
];

export default class GraphService {
  private directReportsCache: IDirectReport[] | undefined;

  public constructor(private readonly context: WebPartContext) {}

  public async getDirectReports(): Promise<IDirectReport[]> {
    if (this.directReportsCache) {
      return [...this.directReportsCache];
    }

    try {
      const graphClient = await this.context.msGraphClientFactory.getClient('3');
      const response = await graphClient
        .api('/me/directReports?$select=id,displayName,mail')
        .get() as IGraphDirectReportsResponse;

      const directReports = (response.value || [])
        .filter((item) => Boolean(item.id && item.displayName))
        .map((item): IDirectReport => ({
          id: item.id || '',
          name: item.displayName || '',
          email: item.mail || ''
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
}
