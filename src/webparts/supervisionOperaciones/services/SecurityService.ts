import type { IUsuario, RoleType } from '../models/AppModels';
import { normalizeRoleType } from '../../../types';
import GraphService, {
  type IDirectReport,
  type IGraphCurrentUser
} from './GraphService';
import { SharePointService } from './SharePointService';

const stableNumericId = (value: string): number => {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }

  return Math.abs(hash) || 1;
};

/**
 * Local RBAC resolver. Identity and hierarchy come from Tabla_Headcount in
 * IndexedDB, never from SharePoint REST or Entra ID.
 */
export default class SecurityService {
  private readonly sharePointService: SharePointService;
  private readonly graphService: GraphService;

  public constructor(
    _legacyDataContext?: unknown,
    graphService?: GraphService
  ) {
    this.graphService = graphService ||
      GraphService.getActiveInstance() ||
      new GraphService();
    this.sharePointService = new SharePointService();
  }

  public async getCurrentUser(): Promise<IUsuario> {
    const currentUser = await this.graphService.getCurrentUser();
    const role = await this.getUserRole(currentUser.email);

    return {
      id: stableNumericId(currentUser.id || currentUser.email),
      email: currentUser.email,
      displayName: currentUser.displayName,
      rol: role
    };
  }

  public async getUserRole(email: string): Promise<RoleType> {
    const normalizedEmail = email.trim().toLocaleLowerCase();
    const overrides = await this.sharePointService.getRoleOverrides();
    const matchingOverride = overrides.find(
      (item) => item.Title.trim().toLocaleLowerCase() === normalizedEmail
    );

    if (matchingOverride?.RolAsignado) {
      return normalizeRoleType(matchingOverride.RolAsignado);
    }

    const currentUser = await this.graphService.getCurrentUser();

    if (
      currentUser.email.trim().toLocaleLowerCase() === normalizedEmail &&
      currentUser.role
    ) {
      return normalizeRoleType(currentUser.role);
    }

    const jobTitle = currentUser.jobTitle.trim().toLocaleLowerCase();

    if (jobTitle.includes('master_admin') || jobTitle.includes('master admin')) return 'Admin';
    if (jobTitle.includes('admin')) return 'Admin';
    if (jobTitle.includes('gerente')) return 'Gerente';
    if (jobTitle.includes('supervisor')) return 'Supervisor';
    if (jobTitle.includes('analista') || jobTitle.includes('asistente') || jobTitle.includes('custodio')) {
      return 'Asistente';
    }
    return 'Agente';
  }

  public async getVisibleAgents(userRole: RoleType): Promise<IDirectReport[]> {
    const currentUser = await this.graphService.getCurrentUser();
    const currentUserAsAgent = this.toVisibleAgent(currentUser);
    const normalizedRole = (userRole || '').toString().toLowerCase();

    if (normalizedRole === 'agente') {
      return [currentUserAsAgent];
    }

    switch (userRole) {
      case 'Admin':
        return this.deduplicateAgents(await this.graphService.getAllUsers());

      case 'Gerente':
        return currentUser.department.trim()
          ? this.deduplicateAgents(
              await this.graphService.getDepartmentMembers(currentUser.department)
            )
          : [];

      case 'Supervisor':
        return this.deduplicateAgents(
          await this.graphService.getDirectReports()
        );

      case 'Asistente':
        return this.deduplicateAgents([
          ...(await this.graphService.getSupervisorPeers()),
          currentUserAsAgent
        ]);

      case 'Agente':
      default:
        return [currentUserAsAgent];
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
    const seen = new Set<string>();

    return agents.filter((agent) => {
      const key = agent.email.trim().toLocaleLowerCase() ||
        agent.id.trim().toLocaleLowerCase() ||
        agent.name.trim().toLocaleLowerCase();

      if (!key || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }
}
