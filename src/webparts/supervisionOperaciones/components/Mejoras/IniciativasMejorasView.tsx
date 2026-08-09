import * as React from 'react';
import { Pivot, PivotItem } from '@fluentui/react';

import AprobacionMejorasQueue from './AprobacionMejorasQueue';
import MisSolicitudesMejora from './MisSolicitudesMejora';
import SolicitudMejoraForm from './SolicitudMejoraForm';
import styles from './MejorasView.module.scss';

export interface IIniciativasMejorasViewProps {
  currentUserEmail: string;
  currentUserName: string;
  userRole?: string;
}

export const IniciativasMejorasView: React.FC<IIniciativasMejorasViewProps> = ({
  currentUserEmail,
  currentUserName,
  userRole
}) => {
  const [selectedTab, setSelectedTab] = React.useState<string>('nueva');

  const isSupervisorOrAdmin =
    userRole === 'Supervisor' ||
    userRole === 'Gerente' ||
    userRole === 'Admin' ||
    userRole === 'Master_Admin';

  return (
    <div className="min-h-screen p-6 space-y-6 bg-slate-950 text-slate-100 transition-colors">
      {/* Module Header Card - Standard Dark Theme */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-950/50 text-blue-400 flex items-center justify-center text-2xl shadow-inner flex-shrink-0">
            💡
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Iniciativas & Mejoras
              </h1>
              <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-900/40 text-blue-300 border border-blue-800">
                Módulo Activo
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Proponga, evalúe y dé seguimiento a las historias de usuario para la optimización continua de la plataforma.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs Navigation Wrapper */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md">
        <Pivot
          className={styles.modulePivot}
          onLinkClick={(item) => setSelectedTab(item?.props.itemKey || 'nueva')}
          selectedKey={selectedTab}
        >
          <PivotItem headerText="➕ Nueva Historia de Usuario" itemKey="nueva">
            <div className="pt-4">
              <SolicitudMejoraForm
                currentUserEmail={currentUserEmail}
                currentUserName={currentUserName}
                onSaved={() => setSelectedTab('misSolicitudes')}
              />
            </div>
          </PivotItem>

          <PivotItem headerText="📋 Mis Solicitudes" itemKey="misSolicitudes">
            <div className="pt-4">
              <MisSolicitudesMejora currentUserEmail={currentUserEmail} />
            </div>
          </PivotItem>

          {isSupervisorOrAdmin && (
            <PivotItem headerText="⏳ Cola de Aprobaciones" itemKey="colaAprobacion">
              <div className="pt-4">
                <AprobacionMejorasQueue
                  currentUserEmail={currentUserEmail}
                  currentUserName={currentUserName}
                />
              </div>
            </PivotItem>
          )}
        </Pivot>
      </div>
    </div>
  );
};

export default IniciativasMejorasView;
