import { canonicalizeRoleSlug } from '../types/index.ts';

export interface IRBACRole {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
}

export const BASE_RBAC_ROLES: ReadonlyArray<IRBACRole> = [
  {
    id: 'admin',
    name: 'Admin',
    description: 'Administrador de la plataforma con control técnico total y bypass irrestricto.',
    isSystem: true
  },
  {
    id: 'gerente',
    name: 'Gerente',
    description: 'Gestión gerencial y visibilidad transversal de KPIs, reportes e iniciativas.',
    isSystem: true
  },
  {
    id: 'supervisor',
    name: 'Supervisor',
    description: 'Supervisión operativa directa, aprobaciones y gestión de equipo.',
    isSystem: true
  },
  {
    id: 'asistente',
    name: 'Asistente',
    description: 'Apoyo operativo, reportería y custodia de radicaciones.',
    isSystem: true
  },
  {
    id: 'agente',
    name: 'Agente',
    description: 'Operador base y colaborador de línea.',
    isSystem: true
  }
];

const BASE_ROLE_INDEX = new Map(BASE_RBAC_ROLES.map((role, index) => [role.id, index]));
const LEGACY_ROLE_IDS = new Set(['master_admin', 'custodio', 'analista', 'colaborador', 'oficial']);

export const createRoleSlug = (value: string): string => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLocaleLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '')
  .slice(0, 50);

export const normalizeRBACRoleId = (value?: string | null): string => {
  const canonical = canonicalizeRoleSlug(value);
  if (canonical) return canonical;
  return createRoleSlug(value || '');
};

export const isValidCustomRoleSlug = (value: string): boolean =>
  /^[a-z][a-z0-9_]{2,49}$/.test(value) && !LEGACY_ROLE_IDS.has(value);

export const mergeRBACRoleCatalog = (
  databaseRoles: ReadonlyArray<IRBACRole>
): IRBACRole[] => {
  const rolesById = new Map(BASE_RBAC_ROLES.map((role) => [role.id, { ...role }]));

  databaseRoles.forEach((role) => {
    const id = normalizeRBACRoleId(role.id);
    if (!id || LEGACY_ROLE_IDS.has(createRoleSlug(role.id))) return;
    const baseRole = BASE_RBAC_ROLES.find((candidate) => candidate.id === id);
    rolesById.set(id, baseRole ? {
      ...baseRole,
      description: role.description || baseRole.description
    } : {
      id,
      name: role.name.trim() || id,
      description: role.description || '',
      isSystem: Boolean(role.isSystem)
    });
  });

  return Array.from(rolesById.values()).sort((left, right) => {
    const leftIndex = BASE_ROLE_INDEX.get(left.id);
    const rightIndex = BASE_ROLE_INDEX.get(right.id);
    if (leftIndex !== undefined || rightIndex !== undefined) {
      return (leftIndex ?? Number.MAX_SAFE_INTEGER) - (rightIndex ?? Number.MAX_SAFE_INTEGER);
    }
    return left.name.localeCompare(right.name, 'es');
  });
};
