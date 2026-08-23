import * as React from 'react';
import { Icon } from '@fluentui/react';
import { BookOpen, Check, Search, Sparkles } from 'lucide-react';
import { AppDialog } from '../Common/AppDialog';
import { SurfaceCard } from '../Common/SurfaceCard';
import { StatusBadge } from '../Common/StatusBadge';
import {
  type IKudoAttributeGroup,
  type IKudoConceptCriteria
} from './kudoCriteriaMatrix';

export interface IKudoMatrixModalProps {
  isOpen: boolean;
  matrixGroups: ReadonlyArray<IKudoAttributeGroup>;
  onClose: () => void;
  onSelectConcept?: (attribute: string, conceptText: string) => void;
  selectedAttribute?: string;
}

export const KudoMatrixModal: React.FC<IKudoMatrixModalProps> = ({
  isOpen,
  matrixGroups,
  onClose,
  onSelectConcept,
  selectedAttribute
}) => {
  const [search, setSearch] = React.useState<string>('');
  const [activeAttrFilter, setActiveAttrFilter] = React.useState<string>('todos');

  // Si se abre con un atributo preseleccionado, sugerir ese filtro inicialmente
  React.useEffect(() => {
    if (isOpen && selectedAttribute) {
      setActiveAttrFilter(selectedAttribute.toLowerCase());
    } else if (isOpen) {
      setActiveAttrFilter('todos');
      setSearch('');
    }
  }, [isOpen, selectedAttribute]);

  // Filtrado de grupos y criterios
  const filteredGroups = React.useMemo(() => {
    const q = search.trim().toLowerCase();

    return matrixGroups
      .map((group) => {
        // Filtrar por tab activo
        if (activeAttrFilter !== 'todos' && group.attribute.toLowerCase() !== activeAttrFilter) {
          return null;
        }

        // Filtrar por texto de búsqueda
        if (!q) {
          return group;
        }

        const matchGroupAttr = group.attribute.toLowerCase().includes(q);
        const matchGroupDesc = group.description.toLowerCase().includes(q);

        const matchingCriteria = group.criteria.filter((crit) =>
          crit.text.toLowerCase().includes(q)
        );

        if (matchGroupAttr || matchGroupDesc || matchingCriteria.length > 0) {
          return {
            ...group,
            criteria: matchGroupAttr || matchGroupDesc ? group.criteria : matchingCriteria
          };
        }

        return null;
      })
      .filter((g): g is IKudoAttributeGroup => g !== null);
  }, [activeAttrFilter, matrixGroups, search]);

  const totalCriteriaCount = React.useMemo(() => {
    return matrixGroups.reduce((acc, g) => acc + g.criteria.length, 0);
  }, [matrixGroups]);

  return (
    <AppDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Matriz de Criterios y Conceptos de Reconocimiento"
      maxWidth="lg"
    >
      <div className="space-y-5 animate-fadeIn">
        {/* Banner descriptivo */}
        <div className="flex items-start gap-3 rounded-2xl border border-cyan-500/20 bg-cyan-950/20 p-4 text-xs text-slate-300">
          <BookOpen className="mt-0.5 shrink-0 text-cyan-400" size={18} />
          <div>
            <p className="font-semibold text-cyan-200">
              Guía Operativa de Atributos Corporativos
            </p>
            <p className="mt-0.5 leading-relaxed text-slate-300">
              Consulta las conductas y comportamientos esperados para fundamentar tus reconocimientos. Puedes hacer clic en cualquiera de los conceptos para transferirlo directamente al formulario.
            </p>
          </div>
        </div>

        {/* Barra de búsqueda y selector de filtros */}
        <div className="space-y-3">
          <div className="relative">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
              size={16}
            />
            <input
              type="text"
              placeholder="Buscar criterios o conductas... (ej: contingencias, amabilidad, herramientas)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2.5 pl-10 pr-4 text-xs text-slate-100 placeholder-slate-500 outline-none transition-colors focus:border-cyan-500/50"
            />
          </div>

          {/* Filtro tipo píldora por atributo */}
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setActiveAttrFilter('todos')}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                activeAttrFilter === 'todos'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              Todos ({matrixGroups.length})
            </button>
            {matrixGroups.map((g) => {
              const isSelected = activeAttrFilter === g.attribute.toLowerCase();
              return (
                <button
                  key={g.attribute}
                  type="button"
                  onClick={() => setActiveAttrFilter(g.attribute.toLowerCase())}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-cyan-500 text-slate-950 font-semibold shadow-md shadow-cyan-500/20'
                      : 'border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon iconName={g.iconName} className="text-xs" />
                  <span>{g.attribute}</span>
                  <span className={`text-[10px] ${isSelected ? 'text-slate-900' : 'text-slate-400'}`}>
                    ({g.criteria.length})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Lista de grupos y criterios */}
        <div className="space-y-4 max-h-[52vh] overflow-y-auto pr-1">
          {filteredGroups.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 p-8 text-center text-slate-400">
              <p className="text-sm font-semibold">No se encontraron criterios</p>
              <p className="mt-1 text-xs text-slate-400">
                Prueba con otro término de búsqueda o selecciona otra categoría.
              </p>
            </div>
          ) : (
            filteredGroups.map((group) => (
              <SurfaceCard
                key={group.attribute}
                elevation="raised"
                className="overflow-hidden border-slate-800/80 p-4 transition-all hover:border-cyan-500/30"
              >
                {/* Cabecera del atributo */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/60 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                      <Icon iconName={group.iconName} className="text-base" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-100">
                        {group.attribute}
                      </h4>
                      <p className="text-xs text-slate-400">
                        {group.description}
                      </p>
                    </div>
                  </div>
                  <StatusBadge size="sm" variant="info">
                    {group.criteria.length} {group.criteria.length === 1 ? 'criterio' : 'criterios'}
                  </StatusBadge>
                </div>

                {/* Lista de conceptos / conductas */}
                <div className="mt-3 divide-y divide-slate-800/40">
                  {group.criteria.map((criterion) => (
                    <div
                      key={criterion.id}
                      className="group flex items-center justify-between gap-3 py-2.5 transition-colors hover:bg-slate-800/30 rounded-xl px-2"
                    >
                      <div className="flex items-start gap-2 text-xs text-slate-300">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
                        <span className="leading-relaxed">{criterion.text}</span>
                        {criterion.isCustom && (
                          <span className="shrink-0 rounded bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-purple-300">
                            Personalizado
                          </span>
                        )}
                      </div>

                      {onSelectConcept && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectConcept(group.attribute, criterion.text);
                            onClose();
                          }}
                          className="shrink-0 flex items-center gap-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-medium text-cyan-300 transition-all hover:bg-cyan-500 hover:text-slate-950"
                          title="Usar este criterio en el reconocimiento"
                        >
                          <Sparkles size={12} />
                          <span>Usar criterio</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </SurfaceCard>
            ))
          )}
        </div>

        {/* Barra de pie con resumen */}
        <div className="flex w-full items-center justify-between border-t border-slate-800/80 pt-4">
          <span className="text-xs text-slate-400">
            {totalCriteriaCount} conductas y criterios orientativos disponibles
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700"
          >
            Cerrar
          </button>
        </div>
      </div>
    </AppDialog>
  );
};
