import assert from 'node:assert/strict';
import test from 'node:test';

import { createRBACPolicy } from './rbacPolicy.ts';
import {
  BASE_RBAC_ROLES,
  createRoleSlug,
  isValidCustomRoleSlug,
  mergeRBACRoleCatalog
} from './rbacRoleCatalog.ts';
import {
  CANONICAL_ROLES,
  CANONICAL_ROLE_SLUGS,
  normalizeRoleType,
  toRoleSlug
} from '../types/index.ts';

test('admin tiene acceso irrestricto sin depender de permisos explícitos', () => {
  const policy = createRBACPolicy({
    roles: ['Admin', ' Asistente '],
    permissions: ['modulo:end_to_end:ver', ' MODULO:FALTAS:APROBAR ']
  });

  assert.equal(policy.hasRole('admin'), true);
  assert.equal(policy.hasRole('asistente'), true);
  assert.equal(policy.hasPermission('modulo:end_to_end:ver'), true);
  assert.equal(policy.hasPermission('modulo:faltas:aprobar'), true);
  assert.equal(policy.hasPermission('modulo:admin:ver'), true);
  assert.equal(policy.hasPermission('modulo:iniciativas:ver'), true);
  assert.equal(policy.hasAnyPermission(['modulo:iniciativas:ver']), true);
  assert.equal(policy.hasAllPermissions([
    'modulo:iniciativas:crear',
    'modulo:iniciativas:editar',
    'modulo:iniciativas:eliminar',
    'modulo:iniciativas:aprobar'
  ]), true);
  assert.equal(policy.hasAnyPermission([]), false);
});

test('hasAnyPermission autoriza cuando al menos un código coincide', () => {
  const policy = createRBACPolicy({
    roles: ['agente'],
    permissions: ['modulo:kudos:ver']
  });

  assert.equal(policy.hasAnyPermission([
    'modulo:productividad:ver',
    'modulo:kudos:ver'
  ]), true);
  assert.equal(policy.hasAnyPermission(['modulo:admin:ver']), false);
  assert.equal(policy.hasAnyPermission([]), false);
});

test('hasAllPermissions exige la colección completa', () => {
  const policy = createRBACPolicy({
    roles: ['supervisor'],
    permissions: [
      'modulo:faltas:ver',
      'modulo:faltas:aprobar'
    ]
  });

  assert.equal(policy.hasAllPermissions([
    'modulo:faltas:ver',
    'modulo:faltas:aprobar'
  ]), true);
  assert.equal(policy.hasAllPermissions([
    'modulo:faltas:ver',
    'modulo:admin:ver'
  ]), false);
  assert.equal(policy.hasAllPermissions([]), true);
});

test('una sesión vacía aplica denegación por defecto', () => {
  const policy = createRBACPolicy({ roles: [], permissions: [] });

  assert.equal(policy.hasRole('admin'), false);
  assert.equal(policy.hasPermission('modulo:dashboard:ver'), false);
  assert.equal(policy.hasAnyPermission(['modulo:dashboard:ver']), false);
});

test('el catálogo RBAC conserva los cinco roles base y agrega roles personalizados', () => {
  const catalog = mergeRBACRoleCatalog([
    {
      id: 'supervisor',
      name: 'Supervisor incompleto',
      description: 'Descripción actualizada desde Supabase.',
      isSystem: false
    },
    {
      id: 'auditor_operativo',
      name: 'Auditor Operativo',
      description: 'Consulta y auditoría.',
      isSystem: false
    }
  ]);

  assert.deepEqual(catalog.slice(0, 5).map((role) => role.id), BASE_RBAC_ROLES.map((role) => role.id));
  assert.equal(catalog.find((role) => role.id === 'supervisor')?.name, 'Supervisor');
  assert.equal(catalog.find((role) => role.id === 'supervisor')?.isSystem, true);
  assert.equal(catalog.find((role) => role.id === 'auditor_operativo')?.isSystem, false);
});

test('los slugs personalizados se generan y validan de forma determinista', () => {
  assert.equal(createRoleSlug('  Líder Técnico QA  '), 'lider_tecnico_qa');
  assert.equal(isValidCustomRoleSlug('lider_tecnico_qa'), true);
  assert.equal(isValidCustomRoleSlug('custodio'), false);
  assert.equal(isValidCustomRoleSlug('2auditor'), false);

  const policy = createRBACPolicy({ roles: ['auditor_operativo'], permissions: [] });
  assert.equal(policy.hasRole('Auditor Operativo'), true);
});

test('el catálogo se limita a cinco roles y homologa valores legacy', () => {
  assert.deepEqual(CANONICAL_ROLES, [
    'Admin',
    'Gerente',
    'Supervisor',
    'Asistente',
    'Agente'
  ]);
  assert.deepEqual(CANONICAL_ROLE_SLUGS, [
    'admin',
    'gerente',
    'supervisor',
    'asistente',
    'agente'
  ]);
  assert.equal(normalizeRoleType('Master_Admin'), 'Admin');
  assert.equal(normalizeRoleType('custodio'), 'Asistente');
  assert.equal(normalizeRoleType('Analista'), 'Asistente');
  assert.equal(normalizeRoleType('colaborador'), 'Agente');
  assert.equal(normalizeRoleType('Oficial'), 'Agente');
  assert.equal(toRoleSlug('Gerente'), 'gerente');
});
