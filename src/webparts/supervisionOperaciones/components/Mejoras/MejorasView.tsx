import * as React from 'react';
import { Pivot, PivotItem, Stack } from '@fluentui/react';

import AprobacionMejorasQueue from './AprobacionMejorasQueue';
import styles from './MejorasView.module.scss';
import MisSolicitudesMejora from './MisSolicitudesMejora';
import SolicitudMejoraForm from './SolicitudMejoraForm';

export interface IMejorasViewProps {
  currentUserEmail: string;
  currentUserName: string;
  userRole?: string;
}

export const MejorasView: React.FC<IMejorasViewProps> = ({
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
    <Stack className={styles.container}>
      <Pivot
        className={styles.modulePivot}
        onLinkClick={(item) => setSelectedTab(item?.props.itemKey || 'nueva')}
        selectedKey={selectedTab}
      >
        <PivotItem headerText="➕ Nueva Solicitud" itemKey="nueva">
          <SolicitudMejoraForm
            currentUserEmail={currentUserEmail}
            currentUserName={currentUserName}
            onSaved={() => setSelectedTab('misSolicitudes')}
          />
        </PivotItem>

        <PivotItem headerText="📋 Mis Solicitudes" itemKey="misSolicitudes">
          <MisSolicitudesMejora currentUserEmail={currentUserEmail} />
        </PivotItem>

        {isSupervisorOrAdmin && (
          <PivotItem headerText="⏳ Cola de Aprobación" itemKey="colaAprobacion">
            <AprobacionMejorasQueue
              currentUserEmail={currentUserEmail}
              currentUserName={currentUserName}
            />
          </PivotItem>
        )}
      </Pivot>
    </Stack>
  );
};

export default MejorasView;
