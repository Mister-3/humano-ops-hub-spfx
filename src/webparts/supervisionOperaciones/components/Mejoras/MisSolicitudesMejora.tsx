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

const getInitials = (name?: string): string => {
  if (!name) return 'US';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

const formatDateRelative = (isoStr?: string): string => {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 5) return 'Hace un momento';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours} h`;
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;

    return d.toLocaleDateString('es-DO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
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
      setErrorMessage('No se pudieron recuperar sus solicitudes.');
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
    <Stack className={styles.container} tokens={{ childrenGap: 20 }}>
      <Stack tokens={{ childrenGap: 2 }}>
        <Text className={styles.headerTitle}>
          📋 Mis Solicitudes Registradas
        </Text>
        <Text className={styles.headerSubtitle}>
          Consulte la evolución de sus propuestas y la retroalimentación emitida por los supervisores.
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
              <Stack tokens={{ childrenGap: 14 }}>
                <Stack horizontal horizontalAlign="space-between" verticalAlign="center" wrap tokens={{ childrenGap: 10 }}>
                  <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 10 }}>
                    <div className={styles.authorAvatar} title={item.autor_nombre}>
                      {getInitials(item.autor_nombre)}
                    </div>
                    <div>
                      <Text variant="large" style={{ fontWeight: 600, display: 'block' }}>
                        {item.titulo}
                      </Text>
                      <Text variant="small" style={{ color: '#64748b' }}>
                        {item.autor_nombre} • {formatDateRelative(item.created_at)}
                      </Text>
                    </div>
                  </Stack>

                  <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
                    <span className={styles.moduleTag}>📌 {item.modulo_afectado}</span>
                    {renderBadge(item.estado)}
                  </Stack>
                </Stack>

                <div className={styles.previewQuote}>
                  <Text style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>📖 Historia de Usuario:</Text>
                  "{item.descripcion}"
                </div>

                <Stack tokens={{ childrenGap: 4 }}>
                  <Text style={{ fontWeight: 600, fontSize: '0.875rem' }}>✅ Criterios de Aceptación:</Text>
                  <Text style={{ whiteSpace: 'pre-wrap', color: '#475569', fontSize: '0.875rem' }}>
                    {item.criterios_aceptacion}
                  </Text>
                </Stack>

                {item.estado !== 'Pendiente_Aprobacion' && item.comentario_supervisor && (
                  <div className={styles.feedbackBox}>
                    <Text style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                      💬 Retroalimentación de Supervisión ({item.supervisor_nombre || item.supervisor_email || 'Supervisor'}):
                    </Text>
                    <Text style={{ fontSize: '0.875rem', marginTop: 2 }}>
                      {item.comentario_supervisor}
                    </Text>
                    <Text variant="small" style={{ color: '#64748b', marginTop: 2 }}>
                      Revisado: {formatDateRelative(item.fecha_revision)}
                    </Text>
                  </div>
                )}
              </Stack>
            </div>
          ))}
        </Stack>
      ) : (
        <MessageBar messageBarType={MessageBarType.info}>
          No tiene iniciativas registradas. Vaya a la pestaña "➕ Nueva Solicitud" para enviar una propuesta.
        </MessageBar>
      )}
    </Stack>
  );
};

export default MisSolicitudesMejora;
