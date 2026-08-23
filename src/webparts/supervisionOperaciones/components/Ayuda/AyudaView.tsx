import * as React from 'react';
import { Icon, initializeIcons } from '@fluentui/react';
import { PageHeader } from '../Common/PageHeader';
import { StatusBadge } from '../Common/StatusBadge';
import { AcercaDeTab } from './AcercaDeTab';
import { VersionesTab } from './VersionesTab';
import { APP_INFO } from './ayudaData';

initializeIcons(undefined, { disableWarnings: true });

export type AyudaTabType = 'acerca' | 'versiones';

export const AyudaView: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<AyudaTabType>('acerca');

  return (
    <div className="space-y-6 pb-12">
      {/* Encabezado del Módulo */}
      <PageHeader
        title="Centro de Ayuda & Versiones"
        subtitle="Documentación general del ecosistema Manager Hub, arquitectura tecnológica, catálogo descriptivo de módulos y bitácora histórica de versiones."
        icon={<Icon iconName="Help" className="text-xl" />}
        badge={
          <StatusBadge
            size="md"
            variant="info"
          >
            {APP_INFO.version}
          </StatusBadge>
        }
      />

      {/* Selector de Pestañas Estilo Píldora */}
      <div className="flex items-center justify-start border-b border-slate-800 pb-4">
        <div
          role="tablist"
          aria-label="Pestañas de Ayuda y Versiones"
          className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-800 bg-slate-950/80 p-1.5 shadow-lg backdrop-blur-md"
        >
          <button
            id="tab-acerca"
            role="tab"
            type="button"
            aria-selected={activeTab === 'acerca'}
            aria-controls="panel-acerca"
            onClick={() => setActiveTab('acerca')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs md:text-sm font-bold transition-all ${
              activeTab === 'acerca'
                ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20'
                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
            }`}
          >
            <Icon iconName="Info" className={activeTab === 'acerca' ? 'text-slate-950' : 'text-cyan-400'} />
            <span>Acerca de la Plataforma</span>
          </button>

          <button
            id="tab-versiones"
            role="tab"
            type="button"
            aria-selected={activeTab === 'versiones'}
            aria-controls="panel-versiones"
            onClick={() => setActiveTab('versiones')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs md:text-sm font-bold transition-all ${
              activeTab === 'versiones'
                ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20'
                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
            }`}
          >
            <Icon iconName="History" className={activeTab === 'versiones' ? 'text-slate-950' : 'text-cyan-400'} />
            <span>Versiones y Correcciones</span>
          </button>
        </div>
      </div>

      {/* Contenido de la pestaña activa */}
      <div
        id={`panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        tabIndex={0}
        className="focus:outline-none"
      >
        {activeTab === 'acerca' ? <AcercaDeTab /> : <VersionesTab />}
      </div>
    </div>
  );
};

export default AyudaView;
