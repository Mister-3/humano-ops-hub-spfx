import * as React from 'react';
import { Icon } from '@fluentui/react';
import { SurfaceCard } from '../Common/SurfaceCard';
import { StatusBadge } from '../Common/StatusBadge';
import { KpiCard } from '../Common/KpiCard';
import {
  RELEASES_DATA,
  type ReleaseChangeType
} from './ayudaData';

type FilterType = 'all' | ReleaseChangeType;

const CHANGE_TYPE_CONFIG: Record<
  ReleaseChangeType,
  { label: string; variant: 'success' | 'danger' | 'info' | 'warning' }
> = {
  feature: { label: 'Mejora / Feature', variant: 'success' },
  fix: { label: 'Corrección / Bugfix', variant: 'danger' },
  refactor: { label: 'Arquitectura', variant: 'info' },
  security: { label: 'Seguridad / RBAC', variant: 'warning' }
};

export const VersionesTab: React.FC = () => {
  const [selectedFilter, setSelectedFilter] = React.useState<FilterType>('all');

  const currentRelease = RELEASES_DATA.find((r) => r.isCurrent) || RELEASES_DATA[0];

  const totalChanges = React.useMemo(() => {
    return RELEASES_DATA.reduce((acc, r) => acc + r.changes.length, 0);
  }, []);

  const filteredReleases = React.useMemo(() => {
    if (selectedFilter === 'all') return RELEASES_DATA;

    return RELEASES_DATA.map((release) => ({
      ...release,
      changes: release.changes.filter((c) => c.type === selectedFilter)
    })).filter((release) => release.changes.length > 0);
  }, [selectedFilter]);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Barra superior de métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard
          label="Versión Activa"
          value={currentRelease.version}
          subtext="Producción y Cloud Sync"
          variant="cyan"
          icon={<Icon iconName="ReleaseGate" className="text-xl" />}
        />
        <KpiCard
          label="Total Despliegues"
          value={`${RELEASES_DATA.length} Releases`}
          subtext={`${totalChanges} mejoras y ajustes aplicados`}
          variant="emerald"
          icon={<Icon iconName="History" className="text-xl" />}
        />
        <KpiCard
          label="Última Actualización"
          value={currentRelease.date}
          subtext={currentRelease.codename}
          variant="purple"
          icon={<Icon iconName="DateTime" className="text-xl" />}
        />
      </div>

      {/* Barra de Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
        <div className="flex items-center gap-2">
          <Icon iconName="Filter" className="text-cyan-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Filtrar cambios por tipo:
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedFilter('all')}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
              selectedFilter === 'all'
                ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20'
                : 'border border-slate-800 bg-slate-900/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            Todos ({totalChanges})
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter('feature')}
            className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
              selectedFilter === 'feature'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'border border-slate-800 bg-slate-900/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <span>✨</span>
            <span>Mejoras</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter('fix')}
            className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
              selectedFilter === 'fix'
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'
                : 'border border-slate-800 bg-slate-900/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <span>🐛</span>
            <span>Correcciones</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter('refactor')}
            className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
              selectedFilter === 'refactor'
                ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20'
                : 'border border-slate-800 bg-slate-900/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <span>⚙️</span>
            <span>Arquitectura</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter('security')}
            className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
              selectedFilter === 'security'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'border border-slate-800 bg-slate-900/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <span>🛡️</span>
            <span>Seguridad & RBAC</span>
          </button>
        </div>
      </div>

      {/* Línea de Tiempo (Timeline Vertical) */}
      <div className="relative border-l-2 border-slate-800 ml-4 md:ml-6 pl-6 md:pl-8 space-y-8">
        {filteredReleases.map((release) => {
          return (
            <div key={release.version} className="relative group">
              {/* Punto indicador en la línea de tiempo */}
              <div
                className={`absolute -left-[31px] md:-left-[39px] top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all ${
                  release.isCurrent
                    ? 'border-cyan-400 bg-slate-950 shadow-lg shadow-cyan-500/40'
                    : 'border-slate-700 bg-slate-900'
                }`}
              >
                {release.isCurrent ? (
                  <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                )}
              </div>

              {/* Contenedor de la versión */}
              <SurfaceCard
                elevation="raised"
                className={`p-6 border-slate-800 transition-all ${
                  release.isCurrent
                    ? 'border-cyan-500/50 shadow-2xl shadow-cyan-500/5'
                    : 'hover:border-slate-700'
                }`}
              >
                {/* Cabecera del Release */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-black text-white tracking-tight">
                      {release.version}
                    </h3>
                    {release.isCurrent ? (
                      <span className="flex items-center gap-1 rounded-full border border-cyan-500/50 bg-cyan-500/10 px-2.5 py-0.5 text-[11px] font-extrabold uppercase text-cyan-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                        Versión Actual
                      </span>
                    ) : (
                      <span className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-0.5 text-[11px] font-semibold text-slate-400">
                        Histórica
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                    <Icon iconName="Calendar" className="text-cyan-400" />
                    <span>{release.date}</span>
                  </div>
                </div>

                {/* Codename y resumen */}
                <div className="mt-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                    {release.codename}
                  </span>
                  <p className="mt-1 text-xs md:text-sm text-slate-300 leading-relaxed">
                    {release.summary}
                  </p>
                </div>

                {/* Lista de cambios */}
                <div className="mt-5 space-y-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Detalle de Cambios ({release.changes.length}):
                  </span>
                  <ul className="space-y-2 text-xs text-slate-300">
                    {release.changes.map((change, cIdx) => {
                      const badgeConfig = CHANGE_TYPE_CONFIG[change.type];
                      return (
                        <li
                          key={cIdx}
                          className="flex items-start gap-2.5 rounded-xl border border-slate-800/60 bg-slate-950/40 p-2.5 transition-colors hover:bg-slate-900/60"
                        >
                          <StatusBadge
                            size="sm"
                            variant={badgeConfig.variant}
                          >
                            {badgeConfig.label}
                          </StatusBadge>
                          <span className="leading-relaxed text-slate-200">
                            {change.description}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </SurfaceCard>
            </div>
          );
        })}
      </div>

      {/* Pie de página con referencia */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-950/50 p-4 text-center text-xs text-slate-400">
        <span>
          Para consultar la bitácora técnica completa y el historial de commits, revisa el archivo{' '}
          <strong className="text-cyan-400">CHANGELOG.md</strong> en la raíz del repositorio.
        </span>
      </div>
    </div>
  );
};

export default VersionesTab;
