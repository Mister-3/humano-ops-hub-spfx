import * as React from 'react';
import { Icon, MessageBar, MessageBarType, Spinner, SpinnerSize } from '@fluentui/react';

import { cloudDbClient } from '../../../../services/CloudDbClient';
import type { ISolicitudMejora } from '../../services/SharePointService';

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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <span>⏳</span> Cola de Aprobación de Iniciativas & Mejoras
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Revise las propuestas enviadas por el equipo, valide los criterios de aceptación y emita su decisión con comentarios.
        </p>
      </div>

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
        <div className="py-12 flex justify-center">
          <Spinner label="Cargando cola de aprobación..." size={SpinnerSize.large} />
        </div>
      ) : queueItems.length > 0 ? (
        <div className="flex flex-col gap-4">
          {queueItems.map((item) => (
            <div
              key={item.id || item.audit_id || item.created_at}
              className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col gap-4"
            >
              {/* Header card */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm flex-shrink-0">
                    {getInitials(item.autor_nombre)}
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white">
                      {item.titulo}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Solicitante: <strong>{item.autor_nombre}</strong> ({item.autor_email}) • {formatDateRelative(item.created_at)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    📌 {item.modulo_afectado}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/60 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/50">
                    <Icon iconName="Clock" className="text-xs" />
                    <span>Pendiente de Revisión</span>
                  </span>
                </div>
              </div>

              {/* User Story Quote */}
              <div className="bg-slate-50 dark:bg-slate-950/60 border-l-4 border-blue-500 p-4 rounded-r-xl text-sm italic text-slate-800 dark:text-slate-200">
                <span className="font-semibold not-italic text-blue-600 dark:text-blue-400 block mb-1 text-xs">
                  📖 Historia de Usuario propuesta:
                </span>
                "{item.descripcion}"
              </div>

              {/* Acceptance Criteria */}
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  ✅ Criterios de Aceptación Requeridos:
                </span>
                <p className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed">
                  {item.criterios_aceptacion}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => openResponseModal(item, 'Aprobada')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl px-5 py-2.5 shadow-sm hover:shadow transition-all inline-flex items-center gap-2 text-sm cursor-pointer"
                >
                  <Icon iconName="CheckMark" />
                  <span>Aprobar Iniciativa</span>
                </button>
                <button
                  type="button"
                  onClick={() => openResponseModal(item, 'Declinada')}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-xl px-5 py-2.5 shadow-sm hover:shadow transition-all inline-flex items-center gap-2 text-sm cursor-pointer"
                >
                  <Icon iconName="Cancel" />
                  <span>Declinar Iniciativa</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <MessageBar messageBarType={MessageBarType.info}>
          No hay propuestas pendientes en la cola de aprobación.
        </MessageBar>
      )}

      {/* Modal Estilizado Patrón DeleteConfirmModal */}
      {targetItem && targetAction && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
          onClick={isSubmittingResponse ? undefined : closeResponseModal}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl max-w-lg w-full flex flex-col gap-5 animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl flex-shrink-0 ${
                  targetAction === 'Aprobada'
                    ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'
                    : 'bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400'
                }`}
              >
                <Icon iconName={targetAction === 'Aprobada' ? 'CheckMark' : 'Cancel'} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {targetAction === 'Aprobada' ? 'Aprobar Iniciativa de Mejora' : 'Declinar Iniciativa de Mejora'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Propuesta: "{targetItem.titulo}" por {targetItem.autor_nombre}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Comentario / Retroalimentación de Revisión <span className="text-rose-500">*</span>
              </label>
              <textarea
                disabled={isSubmittingResponse}
                rows={4}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-sm outline-none resize-none"
                placeholder="Ingrese sus observaciones o justificante para el solicitante..."
                value={comentarioRevision}
                onChange={(e) => setComentarioRevision(e.target.value)}
                required
              />

              <div className="flex justify-between items-center text-xs">
                <span className={comentarioRevision.trim().length >= 10 ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-rose-500'}>
                  {comentarioRevision.trim().length < 10
                    ? `Faltan ${10 - comentarioRevision.trim().length} caracteres`
                    : '✓ Longitud mínima completada'}
                </span>
                <span className="text-slate-400">
                  {comentarioRevision.trim().length} / 10
                </span>
              </div>
            </div>

            <div className="flex justify-end items-center gap-3 pt-2">
              <button
                type="button"
                disabled={isSubmittingResponse}
                onClick={closeResponseModal}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-sm transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSubmittingResponse || comentarioRevision.trim().length < 10}
                onClick={() => void handleSubmitResponse()}
                className={`px-5 py-2.5 rounded-xl text-white font-medium text-sm shadow-sm transition-all disabled:opacity-50 cursor-pointer ${
                  targetAction === 'Aprobada'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {isSubmittingResponse
                  ? 'Procesando...'
                  : targetAction === 'Aprobada'
                  ? 'Confirmar Aprobación'
                  : 'Confirmar Declinación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AprobacionMejorasQueue;
