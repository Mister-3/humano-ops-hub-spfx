import type { SPFI } from '@pnp/sp';
import '@pnp/sp/webs';
import '@pnp/sp/site-users/web';

import type { IUsuario, RoleType } from '../models/AppModels';
import GraphService, {
  type IDirectReport,
  type IGraphCurrentUser
} from './GraphService';
import { getSP } from './pnpjsConfig';
import { SharePointService } from './SharePointService';

export default class SecurityService {
  private readonly sharePointService: SharePointService;

  public constructor(
    private readonly sp: SPFI = getSP(),
    private readonly graphService?: GraphService
  ) {
    this.sharePointService = new SharePointService(sp);
  }

  public async getCurrentUser(): Promise<IUsuario> {
    try {
      const currentUser = await this.sp.web.currentUser();
      const email = currentUser.Email || '';
      const rol = await this.getUserRole(email);

      return {
        id: currentUser.Id,
        email,
        displayName: currentUser.Title,
        rol
      };
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`No fue posible obtener el usuario actual: ${detail}`);
    }
  }

  public async getUserRole(email: string): Promise<RoleType> {
    const normalizedEmail = email.trim().toLocaleLowerCase();

    if (normalizedEmail) {
      try {
        const overrides = await this.sharePointService.getRoleOverrides();
        const matchingOverride = overrides.find(
          (item) => item.Title.trim().toLocaleLowerCase() === normalizedEmail
        );

        if (
          matchingOverride &&
          this.isRoleType(matchingOverride.RolAsignado)
        ) {
          return matchingOverride.RolAsignado;
        }
      } catch {
        // Un fallo de aprovisionamiento o lectura no debe bloquear el acceso:
        // se continúa con la asignación automática de mínimo privilegio.
      }
    }

    try {
      const graphService =
        this.graphService || GraphService.getActiveInstance();

      if (!graphService) {
        return 'Oficial';
      }

      const currentUser = await graphService.getCurrentUser();
      const normalizedJobTitle = currentUser.jobTitle
        .trim()
        .toLocaleLowerCase();

      if (normalizedJobTitle.indexOf('gerente') >= 0) {
        return 'Gerente';
      }

      if (normalizedJobTitle.indexOf('supervisor') >= 0) {
        return 'Supervisor';
      }

      if (normalizedJobTitle.indexOf('analista') >= 0) {
        return 'Analista';
      }
    } catch {
      return 'Oficial';
    }

    return 'Oficial';
  }

  /**
   * Resolves the directory identities the current user is authorized to see.
   * The result is intentionally role-scoped here so callers do not need to
   * duplicate Graph hierarchy or department authorization rules.
   */
  public async getVisibleAgents(
    userRole: RoleType
  ): Promise<IDirectReport[]> {
    const graphService =
      this.graphService || GraphService.getActiveInstance();

    if (!graphService) {
      return [];
    }

    let currentUser: IGraphCurrentUser;

    try {
      currentUser = await graphService.getCurrentUser();
    } catch {
      return [];
    }

    const currentUserAsAgent = this.toVisibleAgent(currentUser);

    try {
      switch (userRole) {
        case 'Admin':
          return this.deduplicateAgents(
            await graphService.getAllUsers()
          );

        case 'Gerente': {
          const department = currentUser.department.trim();

          if (!department) {
            // Fail closed: without a verified department there is no safe
            // organization-wide scope to return.
            return [];
          }

          return this.deduplicateAgents(
            await graphService.getDepartmentMembers(department)
          );
        }

        case 'Supervisor':
          return this.deduplicateAgents(
            await graphService.getDirectReports()
          );

        case 'Analista':
        case 'Asistente': {
          const peers = await graphService.getSupervisorPeers();
          return this.deduplicateAgents([
            ...peers,
            currentUserAsAgent
          ]);
        }

        case 'Oficial':
          return [currentUserAsAgent];

        default:
          return [currentUserAsAgent];
      }
    } catch {
      // Least-privilege degradation. A directory outage must never expand the
      // Gerente/Admin/Supervisor scope; individual roles retain only self.
      return userRole === 'Analista' ||
        userRole === 'Asistente' ||
        userRole === 'Oficial'
        ? [currentUserAsAgent]
        : [];
    }
  }

  private toVisibleAgent(user: IGraphCurrentUser): IDirectReport {
    return {
      id: user.id,
      name: user.displayName,
      email: user.email,
      department: user.department
    };
  }

  private deduplicateAgents(
    agents: ReadonlyArray<IDirectReport>
  ): IDirectReport[] {
    const uniqueAgents: { [key: string]: IDirectReport } = {};

    agents
      .filter((agent) => Boolean(agent.id || agent.email))
      .forEach((agent) => {
        const key = agent.id
          ? `id:${agent.id.toLocaleLowerCase()}`
          : `email:${agent.email.trim().toLocaleLowerCase()}`;

        uniqueAgents[key] = { ...agent };
      });

    return Object.keys(uniqueAgents)
      .map((key) => uniqueAgents[key])
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  private isRoleType(value: string): value is RoleType {
    return value === 'Admin' ||
      value === 'Gerente' ||
      value === 'Supervisor' ||
      value === 'Analista' ||
      value === 'Asistente' ||
      value === 'Oficial';
  }
}
