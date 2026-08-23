import * as React from 'react';
import { Icon } from '@fluentui/react';
import { SurfaceCard } from '../Common/SurfaceCard';
import { StatusBadge } from '../Common/StatusBadge';
import { APP_INFO, MODULES_INFO } from './ayudaData';

export const AcercaDeTab: React.FC = () => {
  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-6 md:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-cyan-300">
              <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
              Versión Activa {APP_INFO.version}
            </span>
            <span className="rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1 text-xs font-medium text-slate-300">
              {APP_INFO.environment}
            </span>
          </div>

          <h2 className="mt-4 text-2xl md:text-3xl font-black text-white tracking-tight">
            {APP_INFO.name}
          </h2>
          <p className="mt-1 text-sm md:text-base font-medium text-cyan-400">
            {APP_INFO.tagline}
          </p>

          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-300">
            {APP_INFO.description}
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-1.5 text-xs text-slate-300">
              <Icon iconName="CloudUpload" className="text-cyan-400" />
              Local-First & Supabase Cloud
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-1.5 text-xs text-slate-300">
              <Icon iconName="ShieldAlert" className="text-emerald-400" />
              Seguridad RBAC Granular
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-1.5 text-xs text-slate-300">
              <Icon iconName="Color" className="text-purple-400" />
              Dark Modern UI (Slate/Cyan)
            </span>
          </div>
        </div>
      </div>

      {/* Pilares Arquitectónicos */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <Icon iconName="EngineeringGroup" className="text-cyan-400 text-lg" />
          <h3 className="text-lg font-bold text-white tracking-wide">
            Pilares Técnicos y Arquitectura
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {APP_INFO.keyPillars.map((pillar, idx) => (
            <SurfaceCard
              key={idx}
              elevation="raised"
              className="p-4 border-slate-800/80 hover:border-cyan-500/30 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                  <Icon iconName={pillar.icon} />
                </div>
                <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                  {pillar.title}
                </h4>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-400">
                {pillar.description}
              </p>
            </SurfaceCard>
          ))}
        </div>
      </div>

      {/* Catálogo de Módulos */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon iconName="AppIconDefaultList" className="text-cyan-400 text-lg" />
            <h3 className="text-lg font-bold text-white tracking-wide">
              Catálogo de Módulos Operativos
            </h3>
          </div>
          <span className="text-xs font-semibold text-slate-400">
            {MODULES_INFO.length} módulos disponibles
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {MODULES_INFO.map((mod) => (
            <SurfaceCard
              key={mod.id}
              elevation="raised"
              className="flex flex-col justify-between p-5 border-slate-800/90 hover:border-cyan-500/40 hover:shadow-cyan-500/5 transition-all"
            >
              <div>
                {/* Header de la tarjeta */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 shadow-sm">
                      <Icon iconName={mod.iconName} className="text-lg" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">
                        {mod.title}
                      </h4>
                      <span className="text-[11px] font-semibold text-cyan-400">
                        {mod.badge}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="mt-3.5 text-xs leading-relaxed text-slate-300">
                  {mod.description}
                </p>

                {/* Casos de uso clave */}
                <div className="mt-4 pt-3 border-t border-slate-800/80">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Casos de Uso Clave:
                  </span>
                  <ul className="mt-2 space-y-1.5 text-xs text-slate-300">
                    {mod.keyUseCases.map((useCase, uIdx) => (
                      <li key={uIdx} className="flex items-start gap-2">
                        <span className="text-cyan-400 font-bold leading-none mt-1">▸</span>
                        <span className="leading-snug">{useCase}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Roles con acceso */}
              <div className="mt-5 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase text-slate-500 mr-1">
                  Roles:
                </span>
                {mod.allowedRoles.map((role) => (
                  <StatusBadge
                    key={role}
                    size="sm"
                    variant={role === 'Admin' ? 'warning' : 'neutral'}
                  >
                    {role}
                  </StatusBadge>
                ))}
              </div>
            </SurfaceCard>
          ))}
        </div>
      </div>

      {/* Soporte y Contacto */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        <SurfaceCard elevation="flat" className="p-4 border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <Icon iconName="Help" className="text-cyan-400 text-lg" />
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Soporte Técnico Operativo
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                ¿Inconvenientes con el cálculo de SLA o permisos de usuario?
              </p>
              <a
                href={`mailto:${APP_INFO.supportContact}`}
                className="mt-2 inline-block text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                {APP_INFO.supportContact} →
              </a>
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard elevation="flat" className="p-4 border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <Icon iconName="Admin" className="text-amber-400 text-lg" />
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Administración de Plataforma
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Solicitudes de nuevos catálogos jerárquicos o roles especiales.
              </p>
              <a
                href={`mailto:${APP_INFO.adminContact}`}
                className="mt-2 inline-block text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors"
              >
                {APP_INFO.adminContact} →
              </a>
            </div>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
};

export default AcercaDeTab;
