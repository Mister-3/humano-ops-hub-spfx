import * as React from 'react';
import { Icon, MessageBar, MessageBarType, Spinner, SpinnerSize } from '@fluentui/react';

import { cloudDbClient } from '../../../../services/CloudDbClient';
import SharePointService, { ICatalogoItem } from '../../services/SharePointService';

export interface ISolicitudMejoraFormProps {
  currentUserEmail: string;
  currentUserName: string;
  onSaved?: () => void;
}

export const SolicitudMejoraForm: React.FC<ISolicitudMejoraFormProps> = ({
  currentUserEmail,
  currentUserName,
  onSaved
}) => {
  const sharePointService = React.useMemo(() => new SharePointService(), []);

  // Form selections
  const [selectedAplicativoItem, setSelectedAplicativoItem] = React.useState<ICatalogoItem | null>(null);
  const [selectedModuloItem, setSelectedModuloItem] = React.useState<ICatalogoItem | null>(null);
  const [selectedPantallaItem, setSelectedPantallaItem] = React.useState<ICatalogoItem | null>(null);

  const [titulo, setTitulo] = React.useState<string>('');
  const [comoRol, setComoRol] = React.useState<string>('');
  const [quieroFuncionalidad, setQuieroFuncionalidad] = React.useState<string>('');
  const [paraBeneficio, setParaBeneficio] = React.useState<string>('');
  const [criteriosAceptacion, setCriteriosAceptacion] = React.useState<string>('');

  // Catalog items loaded from Database (STRICT ZERO MOCK DATA)
  const [aplicativos, setAplicativos] = React.useState<ICatalogoItem[]>([]);
  const [modulos, setModulos] = React.useState<ICatalogoItem[]>([]);
  const [pantallas, setPantallas] = React.useState<ICatalogoItem[]>([]);

  const [isLoadingAplicativos, setIsLoadingAplicativos] = React.useState<boolean>(true);
  const [isLoadingModulos, setIsLoadingModulos] = React.useState<boolean>(false);
  const [isLoadingPantallas, setIsLoadingPantallas] = React.useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [successMessage, setSuccessMessage] = React.useState<string>('');
  const [errorMessage, setErrorMessage] = React.useState<string>('');

  // 1. Cargar Aplicativos al montar
  React.useEffect(() => {
    let isMounted = true;
    setIsLoadingAplicativos(true);

    sharePointService
      .getCatalogos('aplicativos')
      .then((items: ICatalogoItem[]) => {
        if (isMounted) {
          setAplicativos(items || []);
        }
      })
      .catch((err) => {
        console.warn('Error cargando catálogo de aplicativos:', err);
        if (isMounted) setAplicativos([]);
      })
      .finally(() => {
        if (isMounted) setIsLoadingAplicativos(false);
      });

    return () => {
      isMounted = false;
    };
  }, [sharePointService]);

  // 2. Cargar Módulos filtrados al seleccionar un Aplicativo
  React.useEffect(() => {
    if (!selectedAplicativoItem) {
      setModulos([]);
      setSelectedModuloItem(null);
      return;
    }

    let isMounted = true;
    setIsLoadingModulos(true);
    const parentKey = String(selectedAplicativoItem.rawId ?? selectedAplicativoItem.Id ?? selectedAplicativoItem.Valor);

    sharePointService
      .getCatalogos('modulos')
      .then((allItems: ICatalogoItem[]) => {
        if (isMounted) {
          // Filtrar por parent_id
          const filtered = (allItems || []).filter((item) => {
            if (!item.parent_id) return true; // Si no tiene parent_id asignado, incluirlo
            const pId = String(item.parent_id);
            return (
              pId === parentKey ||
              pId === String(selectedAplicativoItem.Id) ||
              pId === String(selectedAplicativoItem.rawId) ||
              pId.toLowerCase() === selectedAplicativoItem.Valor.toLowerCase()
            );
          });
          setModulos(filtered);
        }
      })
      .catch((err) => {
        console.warn('Error cargando módulos:', err);
        if (isMounted) setModulos([]);
      })
      .finally(() => {
        if (isMounted) setIsLoadingModulos(false);
      });

    return () => {
      isMounted = false;
    };
  }, [sharePointService, selectedAplicativoItem]);

  // 3. Cargar Pantallas filtradas al seleccionar un Módulo
  React.useEffect(() => {
    if (!selectedModuloItem) {
      setPantallas([]);
      setSelectedPantallaItem(null);
      return;
    }

    let isMounted = true;
    setIsLoadingPantallas(true);
    const parentKey = String(selectedModuloItem.rawId ?? selectedModuloItem.Id ?? selectedModuloItem.Valor);

    sharePointService
      .getCatalogos('pantallas')
      .then((allItems: ICatalogoItem[]) => {
        if (isMounted) {
          // Filtrar por parent_id
          const filtered = (allItems || []).filter((item) => {
            if (!item.parent_id) return true; // Si no tiene parent_id asignado, incluirlo
            const pId = String(item.parent_id);
            return (
              pId === parentKey ||
              pId === String(selectedModuloItem.Id) ||
              pId === String(selectedModuloItem.rawId) ||
              pId.toLowerCase() === selectedModuloItem.Valor.toLowerCase()
            );
          });
          setPantallas(filtered);
        }
      })
      .catch((err) => {
        console.warn('Error cargando pantallas:', err);
        if (isMounted) setPantallas([]);
      })
      .finally(() => {
        if (isMounted) setIsLoadingPantallas(false);
      });

    return () => {
      isMounted = false;
    };
  }, [sharePointService, selectedModuloItem]);

  // Manejar cambio en Aplicativo (Resetea Módulo y Pantalla)
  const handleAplicativoChange = (val: string) => {
    const found = aplicativos.find((a) => String(a.rawId ?? a.Id ?? a.Valor) === val || a.Valor === val);
    setSelectedAplicativoItem(found || null);
    setSelectedModuloItem(null);
    setSelectedPantallaItem(null);
  };

  // Manejar cambio en Módulo (Resetea Pantalla)
  const handleModuloChange = (val: string) => {
    const found = modulos.find((m) => String(m.rawId ?? m.Id ?? m.Valor) === val || m.Valor === val);
    setSelectedModuloItem(found || null);
    setSelectedPantallaItem(null);
  };

  // Manejar cambio en Pantalla
  const handlePantallaChange = (val: string) => {
    const found = pantallas.find((p) => String(p.rawId ?? p.Id ?? p.Valor) === val || p.Valor === val);
    setSelectedPantallaItem(found || null);
  };

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

    if (!selectedAplicativoItem) {
      setErrorMessage('Seleccione el aplicativo objetivo.');
      return;
    }

    if (!selectedModuloItem) {
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
        aplicativo: selectedAplicativoItem.Valor,
        modulo_afectado: selectedModuloItem.Valor,
        pantalla_afectada: selectedPantallaItem ? selectedPantallaItem.Valor : '',
        titulo: titulo.trim(),
        descripcion: userStoryDescription,
        criterios_aceptacion: criteriosAceptacion.trim()
      });

      setTitulo('');
      setSelectedAplicativoItem(null);
      setSelectedModuloItem(null);
      setSelectedPantallaItem(null);
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
          Seleccione en cascada el Aplicativo, Módulo y Pantalla origen, e ingrese los bloques estructurados de su solicitud.
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

      {/* Grid de 3 Columnas para Selección de Origen en Cascada */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Aplicativo */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-slate-200">
            1. Aplicativo <span className="text-rose-500">*</span>
          </label>
          <select
            disabled={isSubmitting || isLoadingAplicativos}
            className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all font-medium cursor-pointer disabled:opacity-50"
            value={selectedAplicativoItem ? String(selectedAplicativoItem.rawId ?? selectedAplicativoItem.Id ?? selectedAplicativoItem.Valor) : ''}
            onChange={(e) => handleAplicativoChange(e.target.value)}
            required
          >
            <option value="" disabled className="bg-slate-900 text-slate-400 py-2">
              {isLoadingAplicativos ? 'Cargando aplicativos...' : aplicativos.length === 0 ? 'Sin opciones disponibles (Configurar en Admin)' : 'Seleccione el aplicativo...'}
            </option>
            {aplicativos.map((app) => {
              const key = String(app.rawId ?? app.Id ?? app.Valor);
              return (
                <option key={key} value={key} className="bg-slate-900 text-white py-2">
                  {app.Valor}
                </option>
              );
            })}
          </select>
        </div>

        {/* 2. Módulo (Solo si hay Aplicativo seleccionado) */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-slate-200">
            2. Módulo <span className="text-rose-500">*</span>
          </label>
          <select
            disabled={isSubmitting || !selectedAplicativoItem || isLoadingModulos}
            className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all font-medium cursor-pointer disabled:opacity-50"
            value={selectedModuloItem ? String(selectedModuloItem.rawId ?? selectedModuloItem.Id ?? selectedModuloItem.Valor) : ''}
            onChange={(e) => handleModuloChange(e.target.value)}
            required
          >
            <option value="" disabled className="bg-slate-900 text-slate-400 py-2">
              {!selectedAplicativoItem
                ? '👈 Seleccione un aplicativo primero'
                : isLoadingModulos
                ? 'Cargando módulos...'
                : modulos.length === 0
                ? 'Sin opciones disponibles (Configurar en Admin)'
                : 'Seleccione el módulo...'}
            </option>
            {modulos.map((mod) => {
              const key = String(mod.rawId ?? mod.Id ?? mod.Valor);
              return (
                <option key={key} value={key} className="bg-slate-900 text-white py-2">
                  {mod.Valor}
                </option>
              );
            })}
          </select>
        </div>

        {/* 3. Pantalla (Solo si hay Módulo seleccionado) */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-slate-200">
            3. Pantalla / Sección
          </label>
          <select
            disabled={isSubmitting || !selectedModuloItem || isLoadingPantallas}
            className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all font-medium cursor-pointer disabled:opacity-50"
            value={selectedPantallaItem ? String(selectedPantallaItem.rawId ?? selectedPantallaItem.Id ?? selectedPantallaItem.Valor) : ''}
            onChange={(e) => handlePantallaChange(e.target.value)}
          >
            <option value="" className="bg-slate-900 text-slate-400 py-2">
              {!selectedModuloItem
                ? '👈 Seleccione un módulo primero'
                : isLoadingPantallas
                ? 'Cargando pantallas...'
                : pantallas.length === 0
                ? 'Sin opciones disponibles (Configurar en Admin)'
                : '(Opcional) Seleccione pantalla...'}
            </option>
            {pantallas.map((pan) => {
              const key = String(pan.rawId ?? pan.Id ?? pan.Valor);
              return (
                <option key={key} value={key} className="bg-slate-900 text-white py-2">
                  {pan.Valor}
                </option>
              );
            })}
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
