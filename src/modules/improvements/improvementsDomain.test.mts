import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildUserStory,
  calculateInitiativeKpis,
  createAcceptanceCriterion,
  criteriaToLegacyText,
  EMPTY_INITIATIVE_FILTERS,
  filterInitiatives,
  formatInitiativeHtml,
  formatInitiativeMarkdown,
  formatInitiativesTsv,
  isCriterionComplete
} from './improvementsDomain.ts';
import type { ISolicitudMejora } from '../../types/index.ts';

const initiative = (overrides: Partial<ISolicitudMejora> = {}): ISolicitudMejora => ({
  id: '11111111-1111-1111-1111-111111111111',
  audit_id: 'MEJ-001',
  owner_id: 'owner-a',
  autor_nombre: 'Ada Lovelace',
  autor_email: 'ada@example.com',
  aplicativo: 'Humano Ops Hub',
  modulo_afectado: 'Operaciones',
  pantalla_afectada: 'End-to-End',
  titulo: 'Priorizar radicaciones críticas',
  actor: 'Asistente',
  necesidad: 'filtrar radicaciones críticas',
  beneficio: 'reducir riesgo de SLA',
  descripcion: 'Como Asistente, quiero filtrar radicaciones críticas, para reducir riesgo de SLA.',
  criterios_aceptacion: '1. Solo muestra el rango crítico.',
  criterios_aceptacion_json: [{ id: 'c1', mode: 'checklist', text: 'Solo muestra el rango crítico.', verified: false }],
  modulo_clave: 'End-to-End',
  prioridad: 'Alta',
  estado_ciclo: 'En Revision',
  estado: 'Pendiente_Aprobacion',
  ...overrides
});

test('construye la narrativa ágil estándar', () => {
  assert.equal(
    buildUserStory('Asistente', 'filtrar críticas', 'evitar penalizaciones'),
    'Como Asistente, quiero filtrar críticas, para evitar penalizaciones.'
  );
});

test('valida y serializa criterios checklist y Gherkin en orden', () => {
  const checklist = { ...createAcceptanceCriterion('checklist', 1), text: 'Mostrar solo críticas.' };
  const gherkin = { ...createAcceptanceCriterion('gherkin', 2), given: 'hay una radicación', when: 'filtro', then: 'aparece' };
  assert.equal(isCriterionComplete(checklist), true);
  assert.equal(isCriterionComplete(gherkin), true);
  assert.match(criteriaToLegacyText([checklist, gherkin]), /^1\. Mostrar solo críticas\.\n2\. Dado hay una radicación/);
});

test('calcula KPIs sin mezclar borradores, revisión e implementadas', () => {
  const result = calculateInitiativeKpis([
    initiative({ estado_ciclo: 'Borrador' }),
    initiative({ id: '2', estado_ciclo: 'En Revision' }),
    initiative({ id: '3', estado_ciclo: 'Aprobada' }),
    initiative({ id: '4', estado_ciclo: 'Implementada' })
  ]);
  assert.deepEqual(result, { total: 4, drafts: 1, inReview: 1, approvedOrImplemented: 2 });
});

test('filtra por texto, estado, módulo, prioridad y propietario', () => {
  const data = [
    initiative(),
    initiative({ id: '2', titulo: 'Seguridad granular', actor: 'Administrador', descripcion: 'Como Administrador, quiero gestionar permisos, para aplicar mínimo privilegio.', modulo_clave: 'Seguridad / RBAC', prioridad: 'Critica', estado_ciclo: 'Borrador', autor_email: 'grace@example.com' })
  ];
  assert.equal(filterInitiatives(data, { ...EMPTY_INITIATIVE_FILTERS, search: 'asistente' }).length, 1);
  assert.equal(filterInitiatives(data, { ...EMPTY_INITIATIVE_FILTERS, module: 'Seguridad / RBAC', priority: 'Critica', status: 'Borrador', owner: 'grace@example.com' }).length, 1);
});

test('exporta Markdown, HTML escapado y TSV sin saltos destructivos', () => {
  const item = initiative({ titulo: '<Historia segura>' });
  assert.match(formatInitiativeMarkdown(item), /^# <Historia segura>/);
  assert.match(formatInitiativeHtml(item), /&lt;Historia segura&gt;/);
  const tsv = formatInitiativesTsv([item]);
  assert.equal(tsv.split('\n').length, 2);
  assert.match(tsv, /MEJ-001\t<Historia segura>/);
});
