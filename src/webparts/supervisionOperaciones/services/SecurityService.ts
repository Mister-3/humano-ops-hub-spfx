import type { IUsuario, RoleType } from '../models/AppModels';
import GraphService, {
  type IDirectReport,
  type IGraphCurrentUser
} from './GraphService';
import { SharePointService } from './SharePointService';

const ROLES: ReadonlyArray<RoleType> = [
  'Master_Admin',
  'Admin',
  'Gerente',
  'Supervisor',
  'Analista',
  'Asistente',
  'Oficial'
];

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

    if (matchingOverride && this.isRoleType(matchingOverride.RolAsignado)) {
      return matchingOverride.RolAsignado;
    }

    const currentUser = await this.graphService.getCurrentUser();

    if (
      currentUser.email.trim().toLocaleLowerCase() === normalizedEmail &&
      currentUser.role &&
      this.isRoleType(currentUser.role)
    ) {
      return currentUser.role;
    }

    const jobTitle = currentUser.jobTitle.trim().toLocaleLowerCase();

    if (jobTitle.includes('master_admin') || jobTitle.includes('master admin')) return 'Master_Admin';
    if (jobTitle.includes('admin')) return 'Admin';
    if (jobTitle.includes('gerente')) return 'Gerente';
    if (jobTitle.includes('supervisor')) return 'Supervisor';
    if (jobTitle.includes('analista')) return 'Analista';
    if (jobTitle.includes('asistente')) return 'Asistente';
    return 'Oficial';
  }

  public async getVisibleAgents(userRole: RoleType): Promise<IDirectReport[]> {
    const currentUser = await this.graphService.getCurrentUser();
    const currentUserAsAgent = this.toVisibleAgent(currentUser);
    const normalizedRole = (userRole || '').toString().toLowerCase();

    if (normalizedRole === 'agente' || normalizedRole === 'oficial') {
      return [currentUserAsAgent];
    }

    switch (userRole) {
      case 'Master_Admin':
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

      case 'Analista':
      case 'Asistente':
        return this.deduplicateAgents([
          ...(await this.graphService.getSupervisorPeers()),
          currentUserAsAgent
        ]);

      case 'Agente':
      case 'Oficial':
      default:
        return [currentUserAsAgent];
    }
  }

  private isRoleType(value: string): value is RoleType {
    return ROLES.indexOf(value as RoleType) >= 0;
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
