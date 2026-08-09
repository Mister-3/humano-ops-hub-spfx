import * as React from 'react';
import { Icon, MessageBar, MessageBarType, Spinner, SpinnerSize } from '@fluentui/react';

import { cloudDbClient } from '../../../../services/CloudDbClient';
import SharePointService from '../../services/SharePointService';
import styles from './MejorasView.module.scss';

export interface ISolicitudMejoraFormProps {
  currentUserEmail: string;
  currentUserName: string;
  onSaved?: () => void;
}

const STATIC_FALLBACK_MODULES = [
  'Productividad',
  'Faltas y Errores Operativos',
  'Ocupación y Registro de Llamadas',
  'Reconocimientos y Empleado del Mes',
  'Planificación Semanal',
  'Catálogos y Admin'
];

export const SolicitudMejoraForm: React.FC<ISolicitudMejoraFormProps> = ({
  currentUserEmail,
  currentUserName,
  onSaved
}) => {
  const sharePointService = React.useMemo(() => new SharePointService(), []);
  const [titulo, setTitulo] = React.useState<string>('');
  const [moduloAfectado, setModuloAfectado] = React.useState<string>('');
  const [comoRol, setComoRol] = React.useState<string>('');
  const [quieroFuncionalidad, setQuieroFuncionalidad] = React.useState<string>('');
  const [paraBeneficio, setParaBeneficio] = React.useState<string>('');
  const [criteriosAceptacion, setCriteriosAceptacion] = React.useState<string>('');
  const [moduleOptions, setModuleOptions] = React.useState<string[]>(STATIC_FALLBACK_MODULES);
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [successMessage, setSuccessMessage] = React.useState<string>('');
  const [errorMessage, setErrorMessage] = React.useState<string>('');

  React.useEffect(() => {
    let isMounted = true;
    sharePointService
      .getCatalogos('modulos_pantallas')
      .then((items: any[]) => {
        if (isMounted && items && items.length > 0) {
          const loaded = items.map((it: any) => String(it.Valor || it.title || '')).filter(Boolean);
          if (loaded.length > 0) {
            setModuleOptions(loaded);
          }
        }
      })
      .catch(() => undefined);
    return () => {
      isMounted = false;
    };
  }, [sharePointService]);

  const userStoryDescription = React.useMemo(() => {
    if (!comoRol.trim() && !quieroFuncionalidad.trim() && !paraBeneficio.trim()) {
      return '';
    }
    return `Como ${comoRol.trim() || '[Rol]'}, quiero ${quieroFuncionalidad.trim() || '[Funcionalidad]'}, para ${paraBeneficio.trim() || '[Beneficio]'}.`;
  }, [comoRol, quieroFuncionalidad, paraBeneficio]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');

    if (!titulo.trim()) {
      setErrorMessage('Ingrese un título descriptivo para la solicitud de mejora.');
      return;
    }

    if (!moduloAfectado) {
      setErrorMessage('Seleccione el módulo o pantalla objetivo.');
      return;
    }

    if (!comoRol.trim() || !quieroFuncionalidad.trim() || !paraBeneficio.trim()) {
      setErrorMessage('Complete todos los campos de la plantilla de Historia de Usuario (¿Cómo?, ¿Qué?, ¿Para qué?).');
      return;
    }

    if (!criteriosAceptacion.trim()) {
      setErrorMessage('Especifique los criterios de aceptación indispensables.');
      return;
    }

    setIsSubmitting(true);

    try {
      await cloudDbClient.createSolicitudMejora({
        autor_nombre: currentUserName || 'Colaborador',
        autor_email: currentUserEmail,
        modulo_afectado: moduloAfectado,
        titulo: titulo.trim(),
        descripcion: userStoryDescription,
        criterios_aceptacion: criteriosAceptacion.trim()
      });

      setTitulo('');
      setModuloAfectado('');
      setComoRol('');
      setQuieroFuncionalidad('');
      setParaBeneficio('');
      setCriteriosAceptacion('');
      setSuccessMessage('¡Iniciativa enviada exitosamente! Su propuesta ya está registrada en la cola de revisión.');
      onSaved?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al enviar la solicitud.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className={styles.card} onSubmit={(e) => void handleSubmit(e)}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>💡</span> Proponer Nueva Iniciativa o Mejora
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Estructure su propuesta en formato guiado de Historia de Usuario para facilitar la evaluación y respuesta de la supervisión.
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Título */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Título de la Mejora <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              disabled={isSubmitting}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-sm outline-none"
              placeholder="Ej: Exportación acelerada de métricas semanales a Excel"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
            />
          </div>

          {/* Módulo Select */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Módulo / Pantalla Afectada <span className="text-rose-500">*</span>
            </label>
            <select
              disabled={isSubmitting}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-sm outline-none"
              value={moduloAfectado}
              onChange={(e) => setModuloAfectado(e.target.value)}
              required
            >
              <option value="" disabled>Seleccione el módulo objetivo...</option>
              {moduleOptions.map((mod) => (
                <option key={mod} value={mod}>
                  {mod}
                </option>
              ))}
            </select>
          </div>

          {/* Tarjeta Guiada Historia de Usuario */}
          <div className="md:col-span-2 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-xl p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2 font-semibold text-blue-900 dark:text-blue-300 text-sm">
              <Icon iconName="BookOpen" className="text-blue-600 dark:text-blue-400" />
              <span>Plantilla Guiada de Historia de Usuario</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                  <span>👤</span> 1. ¿Cómo? (Rol de usuario)
                </label>
                <input
                  type="text"
                  disabled={isSubmitting}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm outline-none"
                  placeholder="Ej: Supervisor de llamadas"
                  value={comoRol}
                  onChange={(e) => setComoRol(e.target.value)}
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                  <span>✨</span> 2. ¿Qué? (Funcionalidad deseada)
                </label>
                <input
                  type="text"
                  disabled={isSubmitting}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm outline-none"
                  placeholder="Ej: Filtrar los registros por estado activo en tiempo real"
                  value={quieroFuncionalidad}
                  onChange={(e) => setQuieroFuncionalidad(e.target.value)}
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                  <span>🎯</span> 3. ¿Para qué? (Impacto / Beneficio)
                </label>
                <input
                  type="text"
                  disabled={isSubmitting}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm outline-none"
                  placeholder="Ej: Optimizar el tiempo de auditoría semanal de la dirección"
                  value={paraBeneficio}
                  onChange={(e) => setParaBeneficio(e.target.value)}
                  required
                />
              </div>
            </div>

            {userStoryDescription && (
              <div className="bg-white dark:bg-slate-900 border-l-4 border-blue-500 border-t border-r border-b border-slate-200 dark:border-slate-800 rounded-r-xl p-3.5 text-sm italic text-slate-800 dark:text-slate-200 shadow-sm">
                <span className="font-semibold not-italic text-blue-600 dark:text-blue-400 block mb-0.5 text-xs">
                  Vista Previa Generada:
                </span>
                "{userStoryDescription}"
              </div>
            )}
          </div>

          {/* Criterios de Aceptación */}
          <div className="md:col-span-2 flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Criterios de Aceptación <span className="text-rose-500">*</span>
            </label>
            <textarea
              disabled={isSubmitting}
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-sm outline-none resize-none"
              placeholder="Ej: 1. El botón de exportación debe incluir columnas A, B y C. 2. La descarga debe realizarse en menos de 3 segundos."
              value={criteriosAceptacion}
              onChange={(e) => setCriteriosAceptacion(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm hover:shadow transition-all font-medium py-3 px-6 text-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <Icon iconName="Send" />
            <span>{isSubmitting ? 'Enviando iniciativa...' : 'Enviar Solicitud de Mejora'}</span>
          </button>
          {isSubmitting && <Spinner label="Guardando propuesta..." size={SpinnerSize.small} />}
        </div>
      </div>
    </form>
  );
};

export default SolicitudMejoraForm;
