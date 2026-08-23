import * as React from 'react';
import { Icon, MessageBar, MessageBarType, Spinner, SpinnerSize } from '@fluentui/react';

import { useRBAC } from '../../../../auth/RBACContext';
import {
  buildUserStory,
  createAcceptanceCriterion,
  criteriaToLegacyText,
  formatInitiativeHtml,
  formatInitiativeMarkdown,
  INITIATIVE_MODULES,
  INITIATIVE_PRIORITIES,
  INITIATIVE_STATUSES,
  isCriterionComplete
} from '../../../../modules/improvements/improvementsDomain';
import {
  improvementsRepository,
  type ISaveInitiativeInput
} from '../../../../modules/improvements/improvementsRepository';
import type {
  AcceptanceCriterionMode,
  IAcceptanceCriterion,
  InitiativeLifecycleStatus,
  InitiativePriority,
  ISolicitudMejora
} from '../../../../types';

export interface IIniciativasMejorasViewProps {
  currentUserEmail: string;
  currentUserName: string;
  userRole?: string;
}

type InitiativeScreen = 'dashboard' | 'editor';

const STATUS_STYLES: Record<string, string> = {
  Borrador: 'border-slate-700 bg-slate-800 text-slate-300',
  'En Revision': 'border-amber-700/50 bg-amber-500/10 text-amber-300',
  Aprobada: 'border-emerald-700/50 bg-emerald-500/10 text-emerald-300',
  'En Desarrollo': 'border-cyan-700/50 bg-cyan-500/10 text-cyan-300',
  Implementada: 'border-purple-700/50 bg-purple-500/10 text-purple-300',
  Descartada: 'border-rose-700/50 bg-rose-500/10 text-rose-300'
};

const PRIORITY_STYLES: Record<string, string> = {
  Baja: 'border-slate-700 bg-slate-800/60 text-slate-300',
  Media: 'border-cyan-700/50 bg-cyan-500/10 text-cyan-300',
  Alta: 'border-amber-700/50 bg-amber-500/10 text-amber-300',
  Critica: 'border-rose-700/50 bg-rose-500/10 text-rose-300'
};

const OPTION_CLASS = 'bg-slate-900 text-white';
const FILTER_CLASS = 'block w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50';
const STORY_FIELD_CLASS = 'block w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50';
const CRITERION_FIELD_CLASS = 'block w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40';

const copyRichText = async (markdown: string, html: string): Promise<void> => {
  if (!navigator.clipboard) {
    throw new Error('El portapapeles no está disponible en este navegador.');
  }

  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/plain': new Blob([markdown], { type: 'text/plain' }),
        'text/html': new Blob([html], { type: 'text/html' })
      })
    ]);
    return;
  }

  await navigator.clipboard.writeText(markdown);
};

const formatCriterion = (criterion: IAcceptanceCriterion): string =>
  criterion.mode === 'gherkin'
    ? `Dado ${criterion.given || '[contexto]'}, cuando ${criterion.when || '[acción]'}, entonces ${criterion.then || '[resultado]'}.`
    : criterion.text || '[criterio pendiente]';

export const IniciativasMejorasView: React.FC<IIniciativasMejorasViewProps> = ({
  currentUserEmail,
  currentUserName
}) => {
  const { hasPermission, hasRole } = useRBAC();
  const canCreate = hasPermission('modulo:iniciativas:crear');
  const canEdit = hasPermission('modulo:iniciativas:editar');
  const canDelete = hasPermission('modulo:iniciativas:eliminar');
  const isAdmin = hasRole('admin');

  const [screen, setScreen] = React.useState<InitiativeScreen>('dashboard');
  const [initiatives, setInitiatives] = React.useState<ISolicitudMejora[]>([]);
  const [currentUserId, setCurrentUserId] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [message, setMessage] = React.useState<{
    type: MessageBarType;
    text: string;
  }>();
  const [deleteTarget, setDeleteTarget] = React.useState<ISolicitudMejora>();
  const [editingItem, setEditingItem] = React.useState<ISolicitudMejora>();

  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [priorityFilter, setPriorityFilter] = React.useState('');

  const [titulo, setTitulo] = React.useState('');
  const [modulo, setModulo] = React.useState<string>(INITIATIVE_MODULES[0]);
  const [prioridad, setPrioridad] = React.useState<InitiativePriority>('Media');
  const [estado, setEstado] = React.useState<InitiativeLifecycleStatus>('Borrador');
  const [actor, setActor] = React.useState('');
  const [necesidad, setNecesidad] = React.useState('');
  const [beneficio, setBeneficio] = React.useState('');
  const [criteriaMode, setCriteriaMode] = React.useState<AcceptanceCriterionMode>('gherkin');
  const [criterios, setCriterios] = React.useState<IAcceptanceCriterion[]>([
    createAcceptanceCriterion('gherkin', 1)
  ]);

  const loadInitiatives = React.useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const [items, userId] = await Promise.all([
        improvementsRepository.list(),
        improvementsRepository.getCurrentUserId()
      ]);
      setInitiatives(items);
      setCurrentUserId(userId);
    } catch (error: unknown) {
      setMessage({
        type: MessageBarType.error,
        text: error instanceof Error
          ? error.message
          : 'No se pudieron cargar las iniciativas.'
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadInitiatives();
  }, [loadInitiatives]);

  const canMutate = React.useCallback((item: ISolicitudMejora): boolean =>
    isAdmin || Boolean(item.owner_id && item.owner_id === currentUserId),
  [currentUserId, isAdmin]);

  const filteredInitiatives = React.useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return initiatives.filter((item) => {
      const searchable = [
        item.titulo,
        item.actor,
        item.descripcion,
        item.modulo_clave
      ].filter(Boolean).join(' ').toLocaleLowerCase();

      return (!normalizedSearch || searchable.includes(normalizedSearch)) &&
        (!statusFilter || item.estado_ciclo === statusFilter) &&
        (!priorityFilter || item.prioridad === priorityFilter);
    });
  }, [initiatives, priorityFilter, search, statusFilter]);

  const kpis = React.useMemo(() => ({
    total: initiatives.length,
    drafts: initiatives.filter((item) => item.estado_ciclo === 'Borrador').length,
    review: initiatives.filter((item) => item.estado_ciclo === 'En Revision').length,
    approved: initiatives.filter((item) => item.estado_ciclo === 'Aprobada').length
  }), [initiatives]);

  const story = React.useMemo(
    () => buildUserStory(actor, necesidad, beneficio),
    [actor, beneficio, necesidad]
  );
  const completedCriteria = React.useMemo(
    () => criterios.filter(isCriterionComplete),
    [criterios]
  );
  const previewItem = React.useMemo<ISolicitudMejora>(() => ({
    audit_id: editingItem?.audit_id,
    owner_id: editingItem?.owner_id,
    autor_nombre: editingItem?.autor_nombre || currentUserName,
    autor_email: editingItem?.autor_email || currentUserEmail,
    titulo: titulo || 'Título de la Historia de Usuario',
    aplicativo: 'Humano Ops Hub',
    modulo_afectado: modulo,
    pantalla_afectada: modulo,
    modulo_clave: modulo,
    prioridad,
    estado_ciclo: estado,
    actor,
    necesidad,
    beneficio,
    descripcion: story,
    criterios_aceptacion: criteriaToLegacyText(criterios),
    criterios_aceptacion_json: criterios,
    estado: estado === 'Aprobada'
      ? 'Aprobada'
      : estado === 'Descartada'
        ? 'Declinada'
        : 'Pendiente_Aprobacion'
  }), [
    actor,
    beneficio,
    criterios,
    currentUserEmail,
    currentUserName,
    editingItem,
    estado,
    modulo,
    necesidad,
    prioridad,
    story,
    titulo
  ]);

  const resetEditor = (item?: ISolicitudMejora): void => {
    const loadedCriteria = item?.criterios_aceptacion_json?.length
      ? item.criterios_aceptacion_json
      : [createAcceptanceCriterion('gherkin', Date.now())];
    const mode = loadedCriteria[0]?.mode || 'gherkin';

    setEditingItem(item);
    setTitulo(item?.titulo || '');
    setModulo(item?.modulo_clave || item?.modulo_afectado || INITIATIVE_MODULES[0]);
    setPrioridad(item?.prioridad || 'Media');
    setEstado(item?.estado_ciclo || 'Borrador');
    setActor(item?.actor || '');
    setNecesidad(item?.necesidad || '');
    setBeneficio(item?.beneficio || '');
    setCriteriaMode(mode);
    setCriterios(loadedCriteria.map((criterion) => ({ ...criterion, mode })));
  };

  const openNew = (): void => {
    if (!canCreate) return;
    resetEditor();
    setMessage(undefined);
    setScreen('editor');
  };

  const openEdit = (item: ISolicitudMejora): void => {
    if (!canEdit || !canMutate(item)) return;
    resetEditor(item);
    setMessage(undefined);
    setScreen('editor');
  };

  const returnToList = (): void => {
    resetEditor();
    setMessage(undefined);
    setScreen('dashboard');
  };

  const changeCriteriaMode = (mode: AcceptanceCriterionMode): void => {
    setCriteriaMode(mode);
    setCriterios((current) => current.map((criterion) => ({
      ...criterion,
      mode
    })));
  };

  const updateCriterion = (
    id: string,
    patch: Partial<IAcceptanceCriterion>
  ): void => {
    setCriterios((current) => current.map((criterion) =>
      criterion.id === id ? { ...criterion, ...patch } : criterion
    ));
  };

  const moveCriterion = (index: number, offset: -1 | 1): void => {
    setCriterios((current) => {
      const nextIndex = index + offset;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const reordered = [...current];
      [reordered[index], reordered[nextIndex]] = [
        reordered[nextIndex],
        reordered[index]
      ];
      return reordered;
    });
  };

  const saveStory = async (
    targetStatus: InitiativeLifecycleStatus
  ): Promise<void> => {
    if (editingItem ? !canEdit : !canCreate) return;
    if (!titulo.trim()) {
      setMessage({
        type: MessageBarType.error,
        text: 'El título de la Historia es obligatorio.'
      });
      return;
    }

    if (targetStatus === 'En Revision' && (
      !actor.trim() ||
      !necesidad.trim() ||
      !beneficio.trim() ||
      completedCriteria.length === 0
    )) {
      setMessage({
        type: MessageBarType.error,
        text: 'Complete Como, Quiero, Para y al menos un criterio antes de enviar a revisión.'
      });
      return;
    }

    setIsSaving(true);
    setMessage(undefined);
    try {
      const input: ISaveInitiativeInput = {
        id: editingItem?.id,
        autorNombre: editingItem?.autor_nombre || currentUserName || 'Colaborador',
        autorEmail: editingItem?.autor_email || currentUserEmail,
        aplicativo: 'Humano Ops Hub',
        moduloAfectado: modulo,
        pantallaAfectada: modulo,
        moduloClave: modulo,
        titulo,
        actor,
        necesidad,
        beneficio,
        criterios,
        prioridad,
        estadoCiclo: targetStatus
      };

      await improvementsRepository.save(input);
      await loadInitiatives();
      resetEditor();
      setScreen('dashboard');
      setMessage({
        type: MessageBarType.success,
        text: targetStatus === 'En Revision'
          ? 'Historia enviada a revisión.'
          : 'Historia guardada correctamente.'
      });
    } catch (error: unknown) {
      setMessage({
        type: MessageBarType.error,
        text: error instanceof Error
          ? error.message
          : 'No se pudo guardar la Historia.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const removeStory = async (): Promise<void> => {
    if (!deleteTarget?.id || !canDelete || !canMutate(deleteTarget)) return;
    setIsDeleting(true);
    try {
      await improvementsRepository.remove(deleteTarget.id);
      setDeleteTarget(undefined);
      await loadInitiatives();
      setMessage({
        type: MessageBarType.success,
        text: 'Historia eliminada correctamente.'
      });
    } catch (error: unknown) {
      setMessage({
        type: MessageBarType.error,
        text: error instanceof Error ? error.message : 'No se pudo eliminar.'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const copyPreview = async (): Promise<void> => {
    try {
      await copyRichText(
        formatInitiativeMarkdown(previewItem),
        formatInitiativeHtml(previewItem)
      );
      setMessage({
        type: MessageBarType.success,
        text: 'Historia copiada como HTML y Markdown.'
      });
    } catch (error: unknown) {
      setMessage({
        type: MessageBarType.error,
        text: error instanceof Error ? error.message : 'No se pudo copiar.'
      });
    }
  };

  return (
    <main className="min-h-screen space-y-6 bg-slate-950 p-4 text-slate-100 md:p-6">
      {message && (
        <MessageBar
          messageBarType={message.type}
          onDismiss={() => setMessage(undefined)}
        >
          {message.text}
        </MessageBar>
      )}

      <header className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl">
        <div className="flex min-w-0 items-start gap-4">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-xl text-cyan-400"
          >
            <Icon iconName="Lightbulb" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-white">
              Iniciativas &amp; Historias de Usuario
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Redacta, revisa y administra historias operativas con estructura ágil.
            </p>
          </div>
        </div>
        {(screen === 'editor' || canCreate) && (
          <button
            className="shrink-0 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-600/25 transition-all hover:bg-cyan-500"
            onClick={screen === 'dashboard' ? openNew : returnToList}
            type="button"
          >
            {screen === 'dashboard' ? '+ Nueva Historia' : '← Volver al listado'}
          </button>
        )}
      </header>

      {screen === 'dashboard' ? (
        <>
          <section
            aria-label="Indicadores de iniciativas"
            className="grid grid-cols-2 gap-4 lg:grid-cols-4"
          >
            {[
              ['Total', kpis.total, 'text-cyan-400'],
              ['Borradores', kpis.drafts, 'text-slate-300'],
              ['En Revisión', kpis.review, 'text-amber-300'],
              ['Aprobadas', kpis.approved, 'text-emerald-300']
            ].map(([label, value, color]) => (
              <article
                className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl"
                key={String(label)}
              >
                <strong className={`block text-3xl ${color}`}>{value}</strong>
                <span className="mt-2 block text-sm font-medium text-slate-400">
                  {label}
                </span>
              </article>
            ))}
          </section>

          <section className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl md:grid-cols-2 lg:grid-cols-4">
            <label className="block lg:col-span-2">
              <span className="sr-only">Buscar historias</span>
              <input
                className={FILTER_CLASS}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por título, rol o palabra clave"
                value={search}
              />
            </label>
            <select
              aria-label="Filtrar por estado"
              className={FILTER_CLASS}
              onChange={(event) => setStatusFilter(event.target.value)}
              value={statusFilter}
            >
              <option className={OPTION_CLASS} value="">Todos los estados</option>
              {INITIATIVE_STATUSES.map((value: InitiativeLifecycleStatus) => (
                <option className={OPTION_CLASS} key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <select
              aria-label="Filtrar por prioridad"
              className={FILTER_CLASS}
              onChange={(event) => setPriorityFilter(event.target.value)}
              value={priorityFilter}
            >
              <option className={OPTION_CLASS} value="">Todas las prioridades</option>
              {INITIATIVE_PRIORITIES.map((value: InitiativePriority) => (
                <option className={OPTION_CLASS} key={value} value={value}>
                  {value === 'Critica' ? 'Crítica' : value}
                </option>
              ))}
            </select>
          </section>

          {isLoading ? (
            <section className="rounded-2xl border border-slate-800 bg-slate-900/90 p-12 shadow-xl">
              <Spinner
                label="Cargando Historias de Usuario..."
                size={SpinnerSize.large}
              />
            </section>
          ) : (
            <section className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl">
              <table className="w-full min-w-[850px] border-collapse text-left text-sm">
                <thead className="bg-slate-950/90 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-5 py-4">Historia</th>
                    <th className="px-5 py-4">Módulo</th>
                    <th className="px-5 py-4">Prioridad</th>
                    <th className="px-5 py-4">Estado</th>
                    <th className="px-5 py-4">Autor</th>
                    <th className="px-5 py-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredInitiatives.map((item) => {
                    const mutable = canMutate(item);
                    return (
                      <tr
                        className="transition-colors hover:bg-slate-800/40"
                        key={item.id || item.audit_id}
                      >
                        <td className="px-5 py-4">
                          <strong className="block text-white">{item.titulo}</strong>
                          <span className="mt-1 block max-w-md truncate text-xs text-slate-500">
                            {item.descripcion}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-slate-300">
                          {item.modulo_clave || item.modulo_afectado}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-block rounded-full border px-2.5 py-1 text-xs font-semibold ${PRIORITY_STYLES[item.prioridad || 'Media']}`}>
                            {item.prioridad === 'Critica'
                              ? 'Crítica'
                              : item.prioridad || 'Media'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-block rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[item.estado_ciclo || 'En Revision']}`}>
                            {item.estado_ciclo || 'En Revision'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="block text-slate-300">{item.autor_nombre}</span>
                          <small className="text-slate-500">{item.autor_email}</small>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            {canEdit && mutable && (
                              <button
                                className="rounded-lg border border-cyan-700/50 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-300 transition-colors hover:bg-cyan-500/20"
                                onClick={() => openEdit(item)}
                                type="button"
                              >
                                Editar
                              </button>
                            )}
                            {canDelete && mutable && (
                              <button
                                className="rounded-lg border border-rose-700/50 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 transition-colors hover:bg-rose-500/20"
                                onClick={() => setDeleteTarget(item)}
                                type="button"
                              >
                                Eliminar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredInitiatives.length === 0 && (
                <div className="p-12 text-center text-sm text-slate-500">
                  No hay Historias de Usuario que coincidan con los filtros.
                </div>
              )}
            </section>
          )}
        </>
      ) : (
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-7">
            <article className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                  Metadatos
                </span>
                <h2 className="mt-1 text-lg font-bold text-white">
                  {editingItem ? 'Editar Historia de Usuario' : 'Nueva Historia de Usuario'}
                </h2>
              </div>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-200">
                  Título de la Historia *
                </span>
                <input
                  className="block w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  onChange={(event) => setTitulo(event.target.value)}
                  placeholder="Ej. Priorización automática de casos críticos"
                  value={titulo}
                />
              </label>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold text-slate-400">Módulo</span>
                  <select
                    className="block w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-slate-200 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    onChange={(event) => setModulo(event.target.value)}
                    value={modulo}
                  >
                    {INITIATIVE_MODULES.map((value: string) => (
                      <option className={OPTION_CLASS} key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold text-slate-400">Prioridad</span>
                  <select
                    className="block w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-slate-200 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    onChange={(event) => setPrioridad(event.target.value as InitiativePriority)}
                    value={prioridad}
                  >
                    {INITIATIVE_PRIORITIES.map((value: InitiativePriority) => (
                      <option className={OPTION_CLASS} key={value} value={value}>
                        {value === 'Critica' ? 'Crítica' : value}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold text-slate-400">Estado</span>
                  <select
                    className="block w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-slate-200 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    onChange={(event) => setEstado(event.target.value as InitiativeLifecycleStatus)}
                    value={estado}
                  >
                    {INITIATIVE_STATUSES.map((value: InitiativeLifecycleStatus) => (
                      <option className={OPTION_CLASS} key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </article>

            <article className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl">
              <div>
                <h2 className="text-lg font-bold text-white">Estructura Ágil</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Completa la narrativa Como / Quiero / Para en bloques amplios.
                </p>
              </div>
              <label className="block">
                <span className="mb-2 inline-block rounded-md border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-xs font-bold text-cyan-400">
                  COMO [Rol / Actor]
                </span>
                <input
                  className={STORY_FIELD_CLASS}
                  onChange={(event) => setActor(event.target.value)}
                  placeholder="Ej. Supervisor de Emisiones, Custodio de Radicaciones..."
                  value={actor}
                />
              </label>
              <label className="block">
                <span className="mb-2 inline-block rounded-md border border-purple-500/20 bg-purple-500/10 px-2.5 py-1 text-xs font-bold text-purple-400">
                  QUIERO [Acción / Funcionalidad]
                </span>
                <textarea
                  className={`${STORY_FIELD_CLASS} resize-y`}
                  onChange={(event) => setNecesidad(event.target.value)}
                  placeholder="Ej. filtrar automáticamente las radicaciones críticas entre 6 y 8 horas..."
                  rows={3}
                  value={necesidad}
                />
              </label>
              <label className="block">
                <span className="mb-2 inline-block rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-400">
                  PARA [Beneficio / Propósito]
                </span>
                <textarea
                  className={`${STORY_FIELD_CLASS} resize-y`}
                  onChange={(event) => setBeneficio(event.target.value)}
                  placeholder="Ej. priorizar oportunamente la digitación y evitar penalizaciones de SLA..."
                  rows={3}
                  value={beneficio}
                />
              </label>
            </article>

            <article className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-white">Criterios de Aceptación</h2>
                  <div className="mt-2 flex rounded-lg border border-slate-800 bg-slate-950 p-1">
                    <button
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${criteriaMode === 'gherkin' ? 'bg-purple-500/20 text-purple-300' : 'text-slate-400 hover:text-slate-200'}`}
                      onClick={() => changeCriteriaMode('gherkin')}
                      type="button"
                    >
                      Gherkin
                    </button>
                    <button
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${criteriaMode === 'checklist' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-slate-200'}`}
                      onClick={() => changeCriteriaMode('checklist')}
                      type="button"
                    >
                      Checklist
                    </button>
                  </div>
                </div>
                <button
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-cyan-400 transition-colors hover:bg-slate-700"
                  onClick={() => setCriterios((current) => [
                    ...current,
                    createAcceptanceCriterion(criteriaMode, Date.now())
                  ])}
                  type="button"
                >
                  + Agregar Criterio
                </button>
              </div>

              {criterios.map((criterion, index) => (
                <section
                  className="space-y-2 rounded-xl border border-slate-800/80 bg-slate-950/80 p-4"
                  key={criterion.id}
                >
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-xs font-bold uppercase tracking-wide text-slate-400">
                      Criterio {index + 1}
                    </strong>
                    <div className="flex gap-1">
                      <button
                        aria-label="Mover criterio hacia arriba"
                        className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-30"
                        disabled={index === 0}
                        onClick={() => moveCriterion(index, -1)}
                        type="button"
                      >
                        ↑
                      </button>
                      <button
                        aria-label="Mover criterio hacia abajo"
                        className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-30"
                        disabled={index === criterios.length - 1}
                        onClick={() => moveCriterion(index, 1)}
                        type="button"
                      >
                        ↓
                      </button>
                      <button
                        aria-label="Eliminar criterio"
                        className="rounded-md px-2 py-1 text-xs text-rose-400 hover:bg-rose-500/10 disabled:opacity-30"
                        disabled={criterios.length === 1}
                        onClick={() => setCriterios((current) =>
                          current.filter((item) => item.id !== criterion.id)
                        )}
                        type="button"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>

                  {criteriaMode === 'gherkin' ? (
                    <>
                      <label className="block">
                        <span className="mb-1 block text-[11px] font-bold text-cyan-400">DADO</span>
                        <input
                          className={CRITERION_FIELD_CLASS}
                          onChange={(event) => updateCriterion(criterion.id, {
                            given: event.target.value
                          })}
                          placeholder="Contexto o precondición"
                          value={criterion.given}
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[11px] font-bold text-purple-400">CUANDO</span>
                        <input
                          className={CRITERION_FIELD_CLASS}
                          onChange={(event) => updateCriterion(criterion.id, {
                            when: event.target.value
                          })}
                          placeholder="Acción o evento"
                          value={criterion.when}
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[11px] font-bold text-emerald-400">ENTONCES</span>
                        <input
                          className={CRITERION_FIELD_CLASS}
                          onChange={(event) => updateCriterion(criterion.id, {
                            then: event.target.value
                          })}
                          placeholder="Resultado esperado y verificable"
                          value={criterion.then}
                        />
                      </label>
                    </>
                  ) : (
                    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
                      <input
                        aria-label="Criterio verificado"
                        checked={criterion.verified}
                        className="h-5 w-5 accent-cyan-500"
                        onChange={(event) => updateCriterion(criterion.id, {
                          verified: event.target.checked
                        })}
                        type="checkbox"
                      />
                      <input
                        className={CRITERION_FIELD_CLASS}
                        onChange={(event) => updateCriterion(criterion.id, {
                          text: event.target.value
                        })}
                        placeholder="Resultado verificable..."
                        value={criterion.text}
                      />
                    </div>
                  )}
                </section>
              ))}
            </article>

            <footer className="flex flex-col-reverse gap-3 sm:flex-row">
              <button
                className="rounded-xl border border-slate-700 bg-slate-800 px-6 py-3 text-sm font-semibold text-slate-300 transition-all hover:bg-slate-700"
                disabled={isSaving}
                onClick={returnToList}
                type="button"
              >
                Cancelar / Volver
              </button>
              <button
                className="flex-1 rounded-xl bg-cyan-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-600/25 transition-all hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSaving}
                onClick={() => void saveStory(estado)}
                type="button"
              >
                {isSaving ? 'Guardando…' : 'Guardar Historia de Usuario'}
              </button>
              <button
                className="rounded-xl border border-purple-700/60 bg-purple-500/10 px-6 py-3 text-sm font-semibold text-purple-300 transition-all hover:bg-purple-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSaving}
                onClick={() => void saveStory('En Revision')}
                type="button"
              >
                Enviar a Revisión
              </button>
            </footer>
          </div>

          <aside className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl lg:col-span-5 lg:sticky lg:top-6 lg:self-start">
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-400">
                  Live Preview
                </span>
                <p className="mt-1 text-xs text-slate-500">Azure DevOps · Jira · Teams</p>
              </div>
              <button
                className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-bold text-cyan-400 transition-colors hover:bg-cyan-500/20"
                onClick={() => void copyPreview()}
                type="button"
              >
                📋 Copiar Historia
              </button>
            </div>

            <section>
              <span className="font-mono text-[11px] text-slate-500">
                {editingItem?.audit_id || 'NUEVA-HU'}
              </span>
              <h2 className="mt-2 text-xl font-bold leading-snug text-white">
                {titulo || 'Título de la Historia de Usuario'}
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-cyan-700/50 bg-cyan-500/10 px-2.5 py-1 text-xs text-cyan-300">
                  {modulo}
                </span>
                <span className={`rounded-full border px-2.5 py-1 text-xs ${PRIORITY_STYLES[prioridad]}`}>
                  {prioridad === 'Critica' ? 'Crítica' : prioridad}
                </span>
                <span className={`rounded-full border px-2.5 py-1 text-xs ${STATUS_STYLES[estado]}`}>
                  {estado}
                </span>
              </div>
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                Historia de Usuario
              </h3>
              <p className="whitespace-pre-wrap text-sm leading-7 text-slate-200">
                {story}
              </p>
            </section>

            <section>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                Criterios de Aceptación
              </h3>
              <ul className="space-y-2">
                {criterios.map((criterion) => (
                  <li
                    className="flex gap-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs leading-5 text-slate-300"
                    key={criterion.id}
                  >
                    <span className={criterion.verified ? 'text-emerald-400' : 'text-slate-500'}>
                      {criterion.verified ? '✓' : '○'}
                    </span>
                    <span>{formatCriterion(criterion)}</span>
                  </li>
                ))}
              </ul>
            </section>

            <div className="border-t border-slate-800 pt-4 text-xs text-slate-500">
              Propietario: <span className="text-slate-300">{currentUserName}</span>
            </div>
          </aside>
        </section>
      )}

      {deleteTarget && (
        <div
          aria-modal="true"
          className="fixed inset-0 z-[1000] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
        >
          <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/95 p-6 text-white shadow-2xl backdrop-blur-md">
            <h2 className="text-lg font-bold">¿Eliminar Historia de Usuario?</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              “{deleteTarget.titulo}” se eliminará permanentemente de Supabase.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-700"
                disabled={isDeleting}
                onClick={() => setDeleteTarget(undefined)}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
                disabled={isDeleting}
                onClick={() => void removeStory()}
                type="button"
              >
                {isDeleting ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
};

export default IniciativasMejorasView;
