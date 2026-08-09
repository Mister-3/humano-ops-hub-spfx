import * as React from 'react';
import {
  DefaultButton,
  MessageBar,
  MessageBarType,
  PrimaryButton,
  Spinner,
  SpinnerSize,
  Stack,
  Text,
  TextField
} from '@fluentui/react';

import { cloudDbClient } from '../../../../services/CloudDbClient';
import type { ISolicitudMejora } from '../../services/SharePointService';
import styles from './MejorasView.module.scss';

export interface IAprobacionMejorasQueueProps {
  currentUserEmail: string;
  currentUserName: string;
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

export const AprobacionMejorasQueue: React.FC<IAprobacionMejorasQueueProps> = ({
  currentUserEmail,
  currentUserName
}) => {
  const [queueItems, setQueueItems] = React.useState<ISolicitudMejora[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [errorMessage, setErrorMessage] = React.useState<string>('');
  const [successMessage, setSuccessMessage] = React.useState<string>('');

  // Response Modal State
  const [targetItem, setTargetItem] = React.useState<ISolicitudMejora | null>(null);
  const [targetAction, setTargetAction] = React.useState<'Aprobada' | 'Declinada' | null>(null);
  const [comentarioRevision, setComentarioRevision] = React.useState<string>('');
  const [isSubmittingResponse, setIsSubmittingResponse] = React.useState<boolean>(false);

  const loadQueue = React.useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const data = await cloudDbClient.getSolicitudesMejora();
      const pending = data.filter((it) => it.estado === 'Pendiente_Aprobacion');
      setQueueItems(pending);
    } catch (err) {
      console.error('Error al cargar la cola de aprobación de mejoras:', err);
      setErrorMessage('No se pudo cargar la cola de aprobación.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadQueue().catch(() => undefined);
  }, [loadQueue]);

  const openResponseModal = (item: ISolicitudMejora, action: 'Aprobada' | 'Declinada') => {
    setTargetItem(item);
    setTargetAction(action);
    setComentarioRevision('');
  };

  const closeResponseModal = () => {
    setTargetItem(null);
    setTargetAction(null);
    setComentarioRevision('');
  };

  const handleSubmitResponse = async () => {
    if (!targetItem || !targetAction) return;
    if (comentarioRevision.trim().length < 10) {
      setErrorMessage('El comentario de revisión debe tener al menos 10 caracteres.');
      return;
    }

    setIsSubmittingResponse(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const id = targetItem.id || targetItem.audit_id || '';
      await cloudDbClient.responderSolicitudMejora(
        id,
        targetAction,
        comentarioRevision.trim(),
        currentUserEmail,
        currentUserName
      );

      setSuccessMessage(`Solicitud "${targetItem.titulo}" marcada como ${targetAction} correctamente.`);
      closeResponseModal();
      loadQueue().catch(() => undefined);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al procesar la respuesta.';
      setErrorMessage(msg);
    } finally {
      setIsSubmittingResponse(false);
    }
  };

  return (
    <Stack className={styles.container} tokens={{ childrenGap: 16 }}>
      <Stack tokens={{ childrenGap: 2 }}>
        <Text variant="xLarge" style={{ fontWeight: 600 }}>
          ⏳ Cola de Aprobación de Iniciativas & Mejoras
        </Text>
        <Text style={{ color: '#64748b' }}>
          Evalúe y emita retroalimentación obligatoria sobre las historias de usuario propuestas por el equipo.
        </Text>
      </Stack>

      {successMessage && (
        <MessageBar messageBarType={MessageBarType.success}>
          {successMessage}
        </MessageBar>
      )}

      {errorMessage && (
        <MessageBar messageBarType={MessageBarType.error}>
          {errorMessage}
        </MessageBar>
      )}

      {isLoading ? (
        <Spinner label="Cargando cola de aprobación..." size={SpinnerSize.large} />
      ) : queueItems.length > 0 ? (
        <Stack tokens={{ childrenGap: 16 }}>
          {queueItems.map((item) => (
            <div key={item.id || item.audit_id || item.created_at} className={styles.card}>
              <Stack tokens={{ childrenGap: 14 }}>
                <Stack horizontal horizontalAlign="space-between" verticalAlign="center" wrap tokens={{ childrenGap: 8 }}>
                  <Text variant="large" style={{ fontWeight: 600 }}>
                    {item.titulo}
                  </Text>
                  <span className={styles.badgePending}>🟡 Pendiente de Revisión</span>
                </Stack>

                <Stack horizontal wrap tokens={{ childrenGap: 16 }}>
                  <Text variant="small" style={{ color: '#64748b' }}>
                    <strong>Solicitante:</strong> {item.autor_nombre} ({item.autor_email})
                  </Text>
                  <Text variant="small" style={{ color: '#64748b' }}>
                    <strong>Módulo:</strong> {item.modulo_afectado}
                  </Text>
                  <Text variant="small" style={{ color: '#64748b' }}>
                    <strong>Fecha:</strong> {formatDateStr(item.created_at)}
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

                <Stack horizontal tokens={{ childrenGap: 12 }} style={{ marginTop: 8 }}>
                  <PrimaryButton
                    style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}
                    iconProps={{ iconName: 'CheckMark' }}
                    onClick={() => openResponseModal(item, 'Aprobada')}
                    text="Aprobar Solicitud"
                  />
                  <DefaultButton
                    style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                    iconProps={{ iconName: 'Cancel' }}
                    onClick={() => openResponseModal(item, 'Declinada')}
                    text="Declinar Solicitud"
                  />
                </Stack>
              </Stack>
            </div>
          ))}
        </Stack>
      ) : (
        <MessageBar messageBarType={MessageBarType.info}>
          No hay solicitudes pendientes en la cola de aprobación.
        </MessageBar>
      )}

      {/* Modal Integrado para Comentario Obligatorio */}
      {targetItem && targetAction && (
        <div className={styles.overlay} onClick={isSubmittingResponse ? undefined : closeResponseModal}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <Stack tokens={{ childrenGap: 12 }}>
              <Text variant="large" style={{ fontWeight: 600 }}>
                {targetAction === 'Aprobada' ? '🟢 Aprobar Solicitud de Mejora' : '🔴 Declinar Solicitud de Mejora'}
              </Text>
              <Text style={{ fontSize: '0.9rem', color: '#64748b' }}>
                Solicitud: <strong>{targetItem.titulo}</strong> ({targetItem.autor_nombre})
              </Text>

              <TextField
                disabled={isSubmittingResponse}
                label="Comentario / Retroalimentación de Revisión (Mínimo 10 caracteres)"
                multiline
                onChange={(_, val) => setComentarioRevision(val || '')}
                placeholder="Ingrese sus observaciones detalladas o justificante de la decisión..."
                required
                rows={4}
                value={comentarioRevision}
              />

              {comentarioRevision.trim().length > 0 && comentarioRevision.trim().length < 10 && (
                <Text variant="small" style={{ color: '#dc2626' }}>
                  El comentario debe contener al menos 10 caracteres (actual: {comentarioRevision.trim().length}).
                </Text>
              )}

              <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 12 }} style={{ marginTop: 8 }}>
                <DefaultButton
                  disabled={isSubmittingResponse}
                  onClick={closeResponseModal}
                  text="Cancelar"
                />
                <PrimaryButton
                  disabled={isSubmittingResponse || comentarioRevision.trim().length < 10}
                  style={
                    targetAction === 'Aprobada'
                      ? { backgroundColor: '#16a34a', borderColor: '#16a34a' }
                      : { backgroundColor: '#dc2626', borderColor: '#dc2626' }
                  }
                  onClick={() => void handleSubmitResponse()}
                  text={isSubmittingResponse ? 'Procesando...' : targetAction === 'Aprobada' ? 'Confirmar Aprobación' : 'Confirmar Declinación'}
                />
              </Stack>
            </Stack>
          </div>
        </div>
      )}
    </Stack>
  );
};

export default AprobacionMejorasQueue;
