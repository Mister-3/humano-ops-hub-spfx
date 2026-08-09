import * as React from 'react';
import {
  MessageBar,
  MessageBarType,
  Spinner,
  SpinnerSize,
  Stack,
  Text
} from '@fluentui/react';

import { cloudDbClient } from '../../../../services/CloudDbClient';
import type { ISolicitudMejora } from '../../services/SharePointService';
import styles from './MejorasView.module.scss';

export interface IMisSolicitudesMejoraProps {
  currentUserEmail: string;
}

const formatDateStr = (isoStr?: string): string => {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleDateString('es-DO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return isoStr;
  }
};

export const MisSolicitudesMejora: React.FC<IMisSolicitudesMejoraProps> = ({
  currentUserEmail
}) => {
  const [solicitudes, setSolicitudes] = React.useState<ISolicitudMejora[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [errorMessage, setErrorMessage] = React.useState<string>('');

  const loadSolicitudes = React.useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const data = await cloudDbClient.getSolicitudesMejora(currentUserEmail);
      setSolicitudes(data);
    } catch (err) {
      console.error('Error al cargar mis solicitudes de mejora:', err);
      setErrorMessage('No se pudieron obtener sus solicitudes de mejora.');
    } finally {
      setIsLoading(false);
    }
  }, [currentUserEmail]);

  React.useEffect(() => {
    loadSolicitudes().catch(() => undefined);
  }, [loadSolicitudes]);

  const renderBadge = (estado: string) => {
    switch (estado) {
      case 'Aprobada':
        return <span className={styles.badgeApproved}>🟢 Aprobada</span>;
      case 'Declinada':
        return <span className={styles.badgeDeclined}>🔴 Declinada</span>;
      default:
        return <span className={styles.badgePending}>🟡 Pendiente de Aprobación</span>;
    }
  };

  return (
    <Stack className={styles.container} tokens={{ childrenGap: 16 }}>
      <Stack tokens={{ childrenGap: 2 }}>
        <Text variant="xLarge" style={{ fontWeight: 600 }}>
          📋 Mis Solicitudes de Iniciativas & Mejoras
        </Text>
        <Text style={{ color: '#64748b' }}>
          Consulte el estado de revisión y la retroalimentación emitida por los supervisores.
        </Text>
      </Stack>

      {errorMessage && (
        <MessageBar messageBarType={MessageBarType.error}>
          {errorMessage}
        </MessageBar>
      )}

      {isLoading ? (
        <Spinner label="Cargando solicitudes..." size={SpinnerSize.large} />
      ) : solicitudes.length > 0 ? (
        <Stack tokens={{ childrenGap: 16 }}>
          {solicitudes.map((item) => (
            <div key={item.id || item.audit_id || item.created_at} className={styles.card}>
              <Stack tokens={{ childrenGap: 12 }}>
                <Stack horizontal horizontalAlign="space-between" verticalAlign="center" wrap tokens={{ childrenGap: 8 }}>
                  <Text variant="large" style={{ fontWeight: 600 }}>
                    {item.titulo}
                  </Text>
                  {renderBadge(item.estado)}
                </Stack>

                <Stack horizontal wrap tokens={{ childrenGap: 16 }}>
                  <Text variant="small" style={{ color: '#64748b' }}>
                    <strong>Módulo:</strong> {item.modulo_afectado}
                  </Text>
                  <Text variant="small" style={{ color: '#64748b' }}>
                    <strong>Fecha envío:</strong> {formatDateStr(item.created_at)}
                  </Text>
                </Stack>

                <div className={styles.userStoryBox}>
                  <Text style={{ fontWeight: 600 }}>📖 Historia de Usuario:</Text>
                  <Text style={{ fontStyle: 'italic' }}>"{item.descripcion}"</Text>
                </div>

                <Stack tokens={{ childrenGap: 4 }}>
                  <Text style={{ fontWeight: 600 }}>✅ Criterios de Aceptación:</Text>
                  <Text style={{ whiteSpace: 'pre-wrap', color: '#475569' }}>
                    {item.criterios_aceptacion}
                  </Text>
                </Stack>

                {item.estado !== 'Pendiente_Aprobacion' && item.comentario_supervisor && (
                  <div className={styles.feedbackBox}>
                    <Text style={{ fontWeight: 600 }}>
                      💬 Retroalimentación del Supervisor ({item.supervisor_nombre || item.supervisor_email || 'Supervisor'}):
                    </Text>
                    <Text style={{ marginTop: 4, display: 'block' }}>
                      {item.comentario_supervisor}
                    </Text>
                    <Text variant="small" style={{ color: '#64748b', marginTop: 4, display: 'block' }}>
                      Revisado el: {formatDateStr(item.fecha_revision)}
                    </Text>
                  </div>
                )}
              </Stack>
            </div>
          ))}
        </Stack>
      ) : (
        <MessageBar messageBarType={MessageBarType.info}>
          Aún no ha enviado solicitudes de mejora. Utilice la pestaña "➕ Nueva Solicitud" para proponer una iniciativa.
        </MessageBar>
      )}
    </Stack>
  );
};

export default MisSolicitudesMejora;
