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
      setErrorMessage('No se pudo obtener la cola de aprobación.');
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
      setErrorMessage('El comentario de revisión exige un mínimo de 10 caracteres.');
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

      setSuccessMessage(`Iniciativa "${targetItem.titulo}" marcada como ${targetAction} exitosamente.`);
      closeResponseModal();
      loadQueue().catch(() => undefined);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar la respuesta.';
      setErrorMessage(msg);
    } finally {
      setIsSubmittingResponse(false);
    }
  };

  return (
    <Stack className={styles.container} tokens={{ childrenGap: 20 }}>
      <Stack tokens={{ childrenGap: 2 }}>
        <Text className={styles.headerTitle}>
          ⏳ Cola de Aprobación de Iniciativas & Mejoras
        </Text>
        <Text className={styles.headerSubtitle}>
          Revise las propuestas enviadas por el equipo, valide los criterios de aceptación y emita su decisión con comentarios.
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
                        Solicitante: <strong>{item.autor_nombre}</strong> ({item.autor_email}) • {formatDateRelative(item.created_at)}
                      </Text>
                    </div>
                  </Stack>

                  <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
                    <span className={styles.moduleTag}>📌 {item.modulo_afectado}</span>
                    <span className={styles.badgePending}>🟡 Pendiente</span>
                  </Stack>
                </Stack>

                <div className={styles.previewQuote}>
                  <Text style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>📖 Historia de Usuario propuesta:</Text>
                  "{item.descripcion}"
                </div>

                <Stack tokens={{ childrenGap: 4 }}>
                  <Text style={{ fontWeight: 600, fontSize: '0.875rem' }}>✅ Criterios de Aceptación Requeridos:</Text>
                  <Text style={{ whiteSpace: 'pre-wrap', color: '#475569', fontSize: '0.875rem' }}>
                    {item.criterios_aceptacion}
                  </Text>
                </Stack>

                <Stack horizontal tokens={{ childrenGap: 12 }} style={{ marginTop: 8 }}>
                  <PrimaryButton
                    style={{ backgroundColor: '#059669', borderColor: '#059669', borderRadius: '10px' }}
                    iconProps={{ iconName: 'CheckMark' }}
                    onClick={() => openResponseModal(item, 'Aprobada')}
                    text="Aprobar Iniciativa"
                  />
                  <DefaultButton
                    style={{ color: '#e11d48', borderColor: '#fecdd3', borderRadius: '10px' }}
                    iconProps={{ iconName: 'Cancel' }}
                    onClick={() => openResponseModal(item, 'Declinada')}
                    text="Declinar Iniciativa"
                  />
                </Stack>
              </Stack>
            </div>
          ))}
        </Stack>
      ) : (
        <MessageBar messageBarType={MessageBarType.info}>
          No hay propuestas pendientes en la cola de aprobación.
        </MessageBar>
      )}

      {/* Modal Estilizado Patrón DeleteConfirmModal */}
      {targetItem && targetAction && (
        <div className={styles.overlay} onClick={isSubmittingResponse ? undefined : closeResponseModal}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <Stack tokens={{ childrenGap: 14 }}>
              <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 12 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                    backgroundColor: targetAction === 'Aprobada' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                    color: targetAction === 'Aprobada' ? '#059669' : '#e11d48'
                  }}
                >
                  {targetAction === 'Aprobada' ? '🟢' : '🔴'}
                </div>
                <div>
                  <Text variant="large" style={{ fontWeight: 700, display: 'block' }}>
                    {targetAction === 'Aprobada' ? 'Aprobar Iniciativa de Mejora' : 'Declinar Iniciativa de Mejora'}
                  </Text>
                  <Text variant="small" style={{ color: '#64748b' }}>
                    Propuesta: "{targetItem.titulo}" por {targetItem.autor_nombre}
                  </Text>
                </div>
              </Stack>

              <TextField
                disabled={isSubmittingResponse}
                label="Comentario / Retroalimentación de Revisión (Mínimo 10 caracteres)"
                multiline
                onChange={(_, val) => setComentarioRevision(val || '')}
                placeholder="Ingrese sus observaciones o justificante para el solicitante..."
                required
                rows={4}
                value={comentarioRevision}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text variant="small" style={{ color: comentarioRevision.trim().length >= 10 ? '#059669' : '#e11d48' }}>
                  {comentarioRevision.trim().length < 10
                    ? `Faltan ${10 - comentarioRevision.trim().length} caracteres`
                    : '✓ Longitud mínima completada'}
                </Text>
                <Text variant="small" style={{ color: '#64748b' }}>
                  {comentarioRevision.trim().length} / 10
                </Text>
              </div>

              <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 12 }} style={{ marginTop: 8 }}>
                <DefaultButton
                  disabled={isSubmittingResponse}
                  onClick={closeResponseModal}
                  text="Cancelar"
                />
                <PrimaryButton
                  disabled={isSubmittingResponse || comentarioRevision.trim().length < 10}
                  style={{
                    backgroundColor: targetAction === 'Aprobada' ? '#059669' : '#e11d48',
                    borderColor: targetAction === 'Aprobada' ? '#059669' : '#e11d48',
                    borderRadius: '10px'
                  }}
                  onClick={() => void handleSubmitResponse()}
                  text={
                    isSubmittingResponse
                      ? 'Procesando...'
                      : targetAction === 'Aprobada'
                      ? 'Confirmar Aprobación'
                      : 'Confirmar Declinación'
                  }
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
