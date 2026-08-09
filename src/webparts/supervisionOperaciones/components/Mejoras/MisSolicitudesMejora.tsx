import * as React from 'react';
import { Icon, MessageBar, MessageBarType, Spinner, SpinnerSize } from '@fluentui/react';

import { cloudDbClient } from '../../../../services/CloudDbClient';
import type { ISolicitudMejora } from '../../services/SharePointService';

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

  const renderStatusBadge = (estado: string) => {
    switch (estado) {
      case 'Aprobada':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/50">
            <Icon iconName="CheckMark" className="text-xs" />
            <span>Aprobada</span>
          </span>
        );
      case 'Declinada':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/60 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800/50">
            <Icon iconName="Cancel" className="text-xs" />
            <span>Declinada</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/60 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/50">
            <Icon iconName="Clock" className="text-xs" />
            <span>Pendiente de Aprobación</span>
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <span>📋</span> Mis Solicitudes Registradas
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Consulte la evolución de sus propuestas y la retroalimentación emitida por los supervisores.
        </p>
      </div>

      {errorMessage && (
        <MessageBar messageBarType={MessageBarType.error}>
          {errorMessage}
        </MessageBar>
      )}

      {isLoading ? (
        <div className="py-12 flex justify-center">
          <Spinner label="Cargando solicitudes..." size={SpinnerSize.large} />
        </div>
      ) : solicitudes.length > 0 ? (
        <div className="flex flex-col gap-4">
          {solicitudes.map((item) => (
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
                      {item.autor_nombre} • {formatDateRelative(item.created_at)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    📌 {item.modulo_afectado}
                  </span>
                  {renderStatusBadge(item.estado)}
                </div>
              </div>

              {/* User Story Quote */}
              <div className="bg-slate-50 dark:bg-slate-950/60 border-l-4 border-blue-500 p-4 rounded-r-xl text-sm italic text-slate-800 dark:text-slate-200">
                <span className="font-semibold not-italic text-blue-600 dark:text-blue-400 block mb-1 text-xs">
                  📖 Historia de Usuario:
                </span>
                "{item.descripcion}"
              </div>

              {/* Acceptance Criteria */}
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  ✅ Criterios de Aceptación:
                </span>
                <p className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed">
                  {item.criterios_aceptacion}
                </p>
              </div>

              {/* Supervisor Feedback */}
              {item.estado !== 'Pendiente_Aprobacion' && item.comentario_supervisor && (
                <div className="bg-blue-50/50 dark:bg-blue-950/20 border-l-4 border-blue-600 p-4 rounded-r-xl text-sm text-slate-800 dark:text-slate-200 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                      💬 Retroalimentación de Supervisión ({item.supervisor_nombre || item.supervisor_email || 'Supervisor'}):
                    </span>
                    <span className="text-xs text-slate-400">
                      Revisado: {formatDateRelative(item.fecha_revision)}
                    </span>
                  </div>
                  <p className="text-sm font-medium">
                    {item.comentario_supervisor}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <MessageBar messageBarType={MessageBarType.info}>
          No tiene iniciativas registradas. Vaya a la pestaña "➕ Nueva Solicitud" para enviar una propuesta.
        </MessageBar>
      )}
    </div>
  );
};

export default MisSolicitudesMejora;
