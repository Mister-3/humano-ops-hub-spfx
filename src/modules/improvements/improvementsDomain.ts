import type {
  IAcceptanceCriterion,
  InitiativeLifecycleStatus,
  InitiativePriority,
  ISolicitudMejora
} from '../../types';

export interface IInitiativeFilters {
  search: string;
  status: string;
  module: string;
  priority: string;
  owner: string;
}

export interface IInitiativeKpis {
  total: number;
  drafts: number;
  inReview: number;
  approvedOrImplemented: number;
}

export const EMPTY_INITIATIVE_FILTERS: Readonly<IInitiativeFilters> = {
  search: '',
  status: '',
  module: '',
  priority: '',
  owner: ''
};

export const INITIATIVE_MODULES = [
  'End-to-End',
  'Faltas y Errores',
  'Reconocimientos',
  'Seguridad / RBAC',
  'Dashboard General',
  'Productividad',
  'Ausencias',
  'Ocupación',
  'Iniciativas y Mejoras'
] as const;

export const INITIATIVE_PRIORITIES: ReadonlyArray<InitiativePriority> = [
  'Baja', 'Media', 'Alta', 'Critica'
];

export const INITIATIVE_STATUSES: ReadonlyArray<InitiativeLifecycleStatus> = [
  'Borrador', 'En Revision', 'Aprobada', 'En Desarrollo', 'Implementada', 'Descartada'
];

export const createAcceptanceCriterion = (
  mode: IAcceptanceCriterion['mode'] = 'checklist',
  sequence = Date.now()
): IAcceptanceCriterion => ({
  id: `criterion-${sequence}`,
  mode,
  text: '',
  given: '',
  when: '',
  then: '',
  verified: false
});

export const criterionToText = (criterion: IAcceptanceCriterion): string => {
  if (criterion.mode === 'gherkin') {
    return `Dado ${criterion.given?.trim() || '[contexto]'}, cuando ${criterion.when?.trim() || '[acción]'}, entonces ${criterion.then?.trim() || '[resultado]'}.`;
  }
  return criterion.text.trim();
};

export const isCriterionComplete = (criterion: IAcceptanceCriterion): boolean =>
  criterion.mode === 'gherkin'
    ? Boolean(criterion.given?.trim() && criterion.when?.trim() && criterion.then?.trim())
    : Boolean(criterion.text.trim());

export const buildUserStory = (actor: string, need: string, benefit: string): string =>
  `Como ${actor.trim() || '[rol / actor]'}, quiero ${need.trim() || '[necesidad / acción]'}, para ${benefit.trim() || '[beneficio / valor]'}.`;

export const criteriaToLegacyText = (
  criteria: ReadonlyArray<IAcceptanceCriterion>
): string => criteria
  .filter(isCriterionComplete)
  .map((criterion, index) => `${index + 1}. ${criterionToText(criterion)}`)
  .join('\n');

export const calculateInitiativeKpis = (
  initiatives: ReadonlyArray<ISolicitudMejora>
): IInitiativeKpis => ({
  total: initiatives.length,
  drafts: initiatives.filter((item) => item.estado_ciclo === 'Borrador').length,
  inReview: initiatives.filter((item) => item.estado_ciclo === 'En Revision').length,
  approvedOrImplemented: initiatives.filter((item) =>
    item.estado_ciclo === 'Aprobada' || item.estado_ciclo === 'Implementada'
  ).length
});

const normalize = (value?: string): string => value?.trim().toLocaleLowerCase() || '';

export const filterInitiatives = (
  initiatives: ReadonlyArray<ISolicitudMejora>,
  filters: IInitiativeFilters
): ISolicitudMejora[] => {
  const search = normalize(filters.search);
  return initiatives.filter((item) => {
    const searchable = normalize([
      item.titulo,
      item.actor,
      item.necesidad,
      item.beneficio,
      item.descripcion,
      item.criterios_aceptacion
    ].filter(Boolean).join(' '));
    return (!search || searchable.includes(search)) &&
      (!filters.status || item.estado_ciclo === filters.status) &&
      (!filters.module || (item.modulo_clave || item.modulo_afectado) === filters.module) &&
      (!filters.priority || item.prioridad === filters.priority) &&
      (!filters.owner || normalize(item.autor_email) === normalize(filters.owner));
  });
};

export const formatInitiativeMarkdown = (item: ISolicitudMejora): string => {
  const criteria = item.criterios_aceptacion_json?.length
    ? item.criterios_aceptacion_json.map((criterion) =>
      `- [${criterion.verified ? 'x' : ' '}] ${criterionToText(criterion)}`
    ).join('\n')
    : item.criterios_aceptacion.split(/\r?\n/).filter(Boolean).map((line) => `- [ ] ${line.replace(/^\d+\.\s*/, '')}`).join('\n');
  return [
    `# ${item.titulo}`,
    '',
    `**Historia de Usuario:** ${item.descripcion}`,
    '',
    `**Módulo:** ${item.modulo_clave || item.modulo_afectado}`,
    `**Prioridad:** ${item.prioridad || 'Media'}`,
    `**Estado:** ${item.estado_ciclo || 'En Revision'}`,
    '',
    '## Criterios de aceptación',
    criteria || '- [ ] Sin criterios registrados'
  ].join('\n');
};

export const formatInitiativeHtml = (item: ISolicitudMejora): string => {
  const escape = (value: string): string => value
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const criteria = item.criterios_aceptacion_json?.length
    ? item.criterios_aceptacion_json.map((criterion) => `<li>${escape(criterionToText(criterion))}</li>`).join('')
    : `<li>${escape(item.criterios_aceptacion)}</li>`;
  return `<article><h1>${escape(item.titulo)}</h1><p><strong>Historia de Usuario:</strong> ${escape(item.descripcion)}</p><p><strong>Módulo:</strong> ${escape(item.modulo_clave || item.modulo_afectado)} · <strong>Prioridad:</strong> ${escape(item.prioridad || 'Media')} · <strong>Estado:</strong> ${escape(item.estado_ciclo || 'En Revision')}</p><h2>Criterios de aceptación</h2><ul>${criteria}</ul></article>`;
};

export const formatInitiativesTsv = (items: ReadonlyArray<ISolicitudMejora>): string => [
  ['ID', 'Título', 'Historia de Usuario', 'Módulo', 'Prioridad', 'Estado', 'Propietario'].join('\t'),
  ...items.map((item) => [
    item.audit_id || item.id || '', item.titulo, item.descripcion,
    item.modulo_clave || item.modulo_afectado, item.prioridad || 'Media',
    item.estado_ciclo || 'En Revision', item.autor_email
  ].map((value) => String(value).replace(/[\t\r\n]+/g, ' ')).join('\t'))
].join('\n');
