import * as React from 'react';
import { Icon, MessageBar, MessageBarType, Spinner, SpinnerSize } from '@fluentui/react';

import { cloudDbClient } from '../../../../services/CloudDbClient';
import SharePointService from '../../services/SharePointService';

export interface ISolicitudMejoraFormProps {
  currentUserEmail: string;
  currentUserName: string;
  onSaved?: () => void;
}

const DEFAULT_APLICATIVOS = [
  'Humano Ops Hub',
  'Portal de Operaciones',
  'Módulo de Gestión SharePoint',
  'Sistema de Métricas'
];

const DEFAULT_MODULOS = [
  'Productividad',
  'Faltas y Errores Operativos',
  'Ocupación y Registro de Llamadas',
  'Reconocimientos y Empleado del Mes',
  'Planificación Semanal',
  'Catálogos y Admin'
];

const DEFAULT_PANTALLAS = [
  'Formulario de Registro',
  'Dashboard de Indicadores',
  'Cola de Aprobación',
  'Historial de Transacciones',
  'Panel de Administración',
  'Vista General / Resumen'
];

export const SolicitudMejoraForm: React.FC<ISolicitudMejoraFormProps> = ({
  currentUserEmail,
  currentUserName,
  onSaved
}) => {
  const sharePointService = React.useMemo(() => new SharePointService(), []);
  const [aplicativo, setAplicativo] = React.useState<string>('Humano Ops Hub');
  const [moduloAfectado, setModuloAfectado] = React.useState<string>('');
  const [pantallaAfectada, setPantallaAfectada] = React.useState<string>('');
  const [titulo, setTitulo] = React.useState<string>('');
  const [comoRol, setComoRol] = React.useState<string>('');
  const [quieroFuncionalidad, setQuieroFuncionalidad] = React.useState<string>('');
  const [paraBeneficio, setParaBeneficio] = React.useState<string>('');
  const [criteriosAceptacion, setCriteriosAceptacion] = React.useState<string>('');

  const [aplicativoOptions, setAplicativoOptions] = React.useState<string[]>(DEFAULT_APLICATIVOS);
  const [moduloOptions, setModuloOptions] = React.useState<string[]>(DEFAULT_MODULOS);
  const [pantallaOptions, setPantallaOptions] = React.useState<string[]>(DEFAULT_PANTALLAS);

  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [successMessage, setSuccessMessage] = React.useState<string>('');
  const [errorMessage, setErrorMessage] = React.useState<string>('');

  React.useEffect(() => {
    let isMounted = true;
    
    // Cargar Catálogo de Aplicativos
    sharePointService
      .getCatalogos('aplicativos')
      .then((items: any[]) => {
        if (isMounted && items && items.length > 0) {
          const loaded = items.map((it: any) => String(it.Valor || it.title || '')).filter(Boolean);
          if (loaded.length > 0) setAplicativoOptions(loaded);
        }
      })
      .catch(() => undefined);

    // Cargar Catálogo de Módulos
    sharePointService
      .getCatalogos('modulos')
      .then((items: any[]) => {
        if (isMounted && items && items.length > 0) {
          const loaded = items.map((it: any) => String(it.Valor || it.title || '')).filter(Boolean);
          if (loaded.length > 0) setModuloOptions(loaded);
        }
      })
      .catch(() => undefined);

    // Cargar Catálogo de Pantallas
    sharePointService
      .getCatalogos('pantallas')
      .then((items: any[]) => {
        if (isMounted && items && items.length > 0) {
          const loaded = items.map((it: any) => String(it.Valor || it.title || '')).filter(Boolean);
          if (loaded.length > 0) setPantallaOptions(loaded);
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

    if (!aplicativo) {
      setErrorMessage('Seleccione el aplicativo objetivo.');
      return;
    }

    if (!moduloAfectado) {
      setErrorMessage('Seleccione el módulo objetivo.');
      return;
    }

    if (!titulo.trim()) {
      setErrorMessage('Ingrese un título descriptivo para la iniciativa.');
      return;
    }

    if (!comoRol.trim() || !quieroFuncionalidad.trim() || !paraBeneficio.trim()) {
      setErrorMessage('Complete todos los bloques de la plantilla de Historia de Usuario (¿Como?, ¿Quiero?, ¿Para?).');
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
        aplicativo: aplicativo,
        modulo_afectado: moduloAfectado,
        pantalla_afectada: pantallaAfectada,
        titulo: titulo.trim(),
        descripcion: userStoryDescription,
        criterios_aceptacion: criteriosAceptacion.trim()
      });

      setTitulo('');
      setModuloAfectado('');
      setPantallaAfectada('');
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
    <form
      className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md flex flex-col gap-6"
      onSubmit={(e) => void handleSubmit(e)}
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <span>💡</span> Proponer Nueva Iniciativa o Historia de Usuario
        </h3>
        <p className="text-sm text-slate-400">
          Seleccione el aplicativo, módulo y pantalla origen, e ingrese los bloques estructurados de su solicitud.
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

      {/* Grid de 3 Columnas para Selección de Origen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Aplicativo */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-slate-200">
            1. Aplicativo <span className="text-rose-500">*</span>
          </label>
          <select
            disabled={isSubmitting}
            className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all font-medium cursor-pointer"
            value={aplicativo}
            onChange={(e) => setAplicativo(e.target.value)}
            required
          >
            <option value="" disabled className="bg-slate-900 text-slate-400 py-2">
              Seleccione el aplicativo...
            </option>
            {aplicativoOptions.map((app) => (
              <option key={app} value={app} className="bg-slate-900 text-white py-2">
                {app}
              </option>
            ))}
          </select>
        </div>

        {/* 2. Módulo */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-slate-200">
            2. Módulo <span className="text-rose-500">*</span>
          </label>
          <select
            disabled={isSubmitting}
            className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all font-medium cursor-pointer"
            value={moduloAfectado}
            onChange={(e) => setModuloAfectado(e.target.value)}
            required
          >
            <option value="" disabled className="bg-slate-900 text-slate-400 py-2">
              Seleccione el módulo...
            </option>
            {moduloOptions.map((mod) => (
              <option key={mod} value={mod} className="bg-slate-900 text-white py-2">
                {mod}
              </option>
            ))}
          </select>
        </div>

        {/* 3. Pantalla */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-slate-200">
            3. Pantalla / Sección
          </label>
          <select
            disabled={isSubmitting}
            className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all font-medium cursor-pointer"
            value={pantallaAfectada}
            onChange={(e) => setPantallaAfectada(e.target.value)}
          >
            <option value="" className="bg-slate-900 text-slate-400 py-2">
              (Opcional) Seleccione pantalla...
            </option>
            {pantallaOptions.map((pan) => (
              <option key={pan} value={pan} className="bg-slate-900 text-white py-2">
                {pan}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Título Full Width */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold text-slate-200">
          Título de la Iniciativa <span className="text-rose-500">*</span>
        </label>
        <input
          type="text"
          disabled={isSubmitting}
          className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all font-medium"
          placeholder="Ej: Exportación optimizada de reportes mensuales a Excel"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          required
        />
      </div>

      {/* Historia de Usuario (Estructura Guiada) */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
        <div className="flex items-center gap-2 font-semibold text-blue-400 text-sm">
          <Icon iconName="BookOpen" className="text-blue-400" />
          <span>Plantilla Guiada de Historia de Usuario</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold tracking-wider uppercase text-blue-400 flex items-center gap-1">
              <span>👤</span> 1. ¿Como...? (Rol de usuario)
            </label>
            <input
              type="text"
              disabled={isSubmitting}
              className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all font-medium text-sm"
              placeholder="Ej: Supervisor de Llamadas"
              value={comoRol}
              onChange={(e) => setComoRol(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold tracking-wider uppercase text-blue-400 flex items-center gap-1">
              <span>✨</span> 2. ¿Quiero...? (Acción / Funcionalidad)
            </label>
            <input
              type="text"
              disabled={isSubmitting}
              className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all font-medium text-sm"
              placeholder="Ej: Filtrar los datos en tiempo real por período"
              value={quieroFuncionalidad}
              onChange={(e) => setQuieroFuncionalidad(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold tracking-wider uppercase text-blue-400 flex items-center gap-1">
              <span>🎯</span> 3. ¿Para...? (Beneficio de negocio)
            </label>
            <input
              type="text"
              disabled={isSubmitting}
              className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all font-medium text-sm"
              placeholder="Ej: Reducir el tiempo de preparación de la auditoría"
              value={paraBeneficio}
              onChange={(e) => setParaBeneficio(e.target.value)}
              required
            />
          </div>
        </div>

        {userStoryDescription && (
          <div className="bg-slate-950/80 border-l-4 border-blue-500 border-t border-r border-b border-slate-800 rounded-r-xl p-3.5 text-sm italic text-slate-200 shadow-sm">
            <span className="font-semibold not-italic text-blue-400 block mb-0.5 text-xs">
              Vista Previa Generada:
            </span>
            "{userStoryDescription}"
          </div>
        )}
      </div>

      {/* Criterios de Aceptación Full Width */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold text-slate-200">
          Criterios de Aceptación <span className="text-rose-500">*</span>
        </label>
        <textarea
          disabled={isSubmitting}
          rows={3}
          className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all font-medium text-sm resize-none"
          placeholder="Ej: 1. El botón de exportación debe incluir columnas A, B y C. 2. La descarga debe realizarse en menos de 3 segundos."
          value={criteriosAceptacion}
          onChange={(e) => setCriteriosAceptacion(e.target.value)}
          required
        />
      </div>

      {/* Botón Principal Full Width */}
      <div className="flex flex-col gap-2 pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl shadow-lg shadow-blue-600/20 transition-all cursor-pointer flex items-center justify-center gap-2 text-sm disabled:opacity-50"
        >
          <Icon iconName="Send" />
          <span>{isSubmitting ? 'Enviando iniciativa...' : 'Enviar Solicitud de Mejora'}</span>
        </button>
        {isSubmitting && (
          <div className="flex justify-center pt-2">
            <Spinner label="Guardando propuesta..." size={SpinnerSize.small} />
          </div>
        )}
      </div>
    </form>
  );
};

export default SolicitudMejoraForm;
