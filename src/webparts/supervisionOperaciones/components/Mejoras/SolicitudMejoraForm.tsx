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

  // Form selections (Cascada: Aplicativo -> Módulo -> Pantalla)
  const [selectedAplicativoItem, setSelectedAplicativoItem] = React.useState<ICatalogoItem | null>(null);
  const [selectedModuloItem, setSelectedModuloItem] = React.useState<ICatalogoItem | null>(null);
  const [selectedPantallaItem, setSelectedPantallaItem] = React.useState<ICatalogoItem | null>(null);

  const [titulo, setTitulo] = React.useState<string>('');
  const [comoRol, setComoRol] = React.useState<string>('');
  const [quieroFuncionalidad, setQuieroFuncionalidad] = React.useState<string>('');
  const [paraBeneficio, setParaBeneficio] = React.useState<string>('');
  const [criteriosAceptacion, setCriteriosAceptacion] = React.useState<string>('');

  // Catalog items loaded dynamically from Database (ZERO MOCK DATA)
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
          const filtered = (allItems || []).filter((item) => {
            if (item.parent_id === null || item.parent_id === undefined || item.parent_id === '') {
              return false;
            }
            const pId = String(item.parent_id);
            return pId === parentKey;
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
          const filtered = (allItems || []).filter((item) => {
            if (item.parent_id === null || item.parent_id === undefined || item.parent_id === '') {
              return false;
            }
            const pId = String(item.parent_id);
            return pId === parentKey;
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

  // Reset casada al cambiar Aplicativo
  const handleAplicativoChange = (val: string) => {
    const found = aplicativos.find((a) => String(a.rawId ?? a.Id ?? a.Valor) === val || a.Valor === val);
    setSelectedAplicativoItem(found || null);
    setSelectedModuloItem(null);
    setSelectedPantallaItem(null);
  };

  // Reset cascada al cambiar Módulo
  const handleModuloChange = (val: string) => {
    const found = modulos.find((m) => String(m.rawId ?? m.Id ?? m.Valor) === val || m.Valor === val);
    setSelectedModuloItem(found || null);
    setSelectedPantallaItem(null);
  };

  // Cambiar Pantalla
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

  // Validación: Pantalla es OBLIGATORIA
  const isFormValid = React.useMemo(() => {
    return (
      Boolean(selectedAplicativoItem) &&
      Boolean(selectedModuloItem) &&
      Boolean(selectedPantallaItem) &&
      Boolean(titulo.trim()) &&
      Boolean(comoRol.trim()) &&
      Boolean(quieroFuncionalidad.trim()) &&
      Boolean(paraBeneficio.trim()) &&
      Boolean(criteriosAceptacion.trim())
    );
  }, [
    selectedAplicativoItem,
    selectedModuloItem,
    selectedPantallaItem,
    titulo,
    comoRol,
    quieroFuncionalidad,
    paraBeneficio,
    criteriosAceptacion
  ]);

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

    if (!selectedPantallaItem) {
      setErrorMessage('Seleccione la pantalla objetivo (Campo obligatorio).');
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
        aplicativo_id: String(selectedAplicativoItem.rawId),
        modulo_afectado: selectedModuloItem.Valor,
        modulo_id: String(selectedModuloItem.rawId),
        pantalla_afectada: selectedPantallaItem.Valor,
        pantalla_id: String(selectedPantallaItem.rawId),
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
      className="flex flex-col gap-6"
      onSubmit={(e) => void handleSubmit(e)}
    >
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

      {/* SECCIÓN 1: Ubicación y Alcance del Sistema */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md flex flex-col gap-5">
        <div className="flex items-center gap-2.5 pb-2 border-b border-slate-800/80 text-lg font-bold text-white">
          <Icon iconName="Layers" className="text-blue-400 text-xl" />
          <span>1. Ubicación de la Mejora</span>
        </div>

        <p className="text-xs text-slate-400 -mt-2">
          Seleccione en cascada el Aplicativo, Módulo y Pantalla específica donde se aplicará la iniciativa.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. Aplicativo */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-200">
              Aplicativo <span className="text-rose-500">*</span>
            </label>
            <select
              disabled={isSubmitting || isLoadingAplicativos}
              className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all font-medium cursor-pointer disabled:opacity-50"
              value={selectedAplicativoItem ? String(selectedAplicativoItem.rawId ?? selectedAplicativoItem.Id ?? selectedAplicativoItem.Valor) : ''}
              onChange={(e) => handleAplicativoChange(e.target.value)}
              required
            >
              <option value="" disabled className="bg-slate-900 text-white py-2">
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

          {/* 2. Módulo */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-200">
              Módulo <span className="text-rose-500">*</span>
            </label>
            <select
              disabled={isSubmitting || !selectedAplicativoItem || isLoadingModulos}
              className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all font-medium cursor-pointer disabled:opacity-50"
              value={selectedModuloItem ? String(selectedModuloItem.rawId ?? selectedModuloItem.Id ?? selectedModuloItem.Valor) : ''}
              onChange={(e) => handleModuloChange(e.target.value)}
              required
            >
              <option value="" disabled className="bg-slate-900 text-white py-2">
                {!selectedAplicativoItem
                  ? '👈 Seleccione aplicativo primero'
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

          {/* 3. Pantalla (OBLIGATORIA) */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-200">
              Pantalla / Sección <span className="text-rose-500">*</span>
            </label>
            <select
              disabled={isSubmitting || !selectedModuloItem || isLoadingPantallas}
              className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all font-medium cursor-pointer disabled:opacity-50"
              value={selectedPantallaItem ? String(selectedPantallaItem.rawId ?? selectedPantallaItem.Id ?? selectedPantallaItem.Valor) : ''}
              onChange={(e) => handlePantallaChange(e.target.value)}
              required
            >
              <option value="" disabled className="bg-slate-900 text-white py-2">
                {!selectedModuloItem
                  ? '👈 Seleccione módulo primero'
                  : isLoadingPantallas
                  ? 'Cargando pantallas...'
                  : pantallas.length === 0
                  ? 'Sin opciones disponibles (Configurar en Admin)'
                  : 'Seleccione la pantalla...'}
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
      </div>

      {/* SECCIÓN 2: Detalle de Historia de Usuario (Estilo Azure DevOps Work Item) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md flex flex-col gap-5">
        <div className="flex items-center gap-2.5 pb-2 border-b border-slate-800/80 text-lg font-bold text-white">
          <Icon iconName="GitGraph" className="text-indigo-400 text-xl" />
          <span>2. Historia de Usuario (Work Item)</span>
        </div>

        {/* Título de la Iniciativa (Estilo Work Item Title) */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-slate-200">
            Título de la Iniciativa <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            disabled={isSubmitting}
            className="w-full text-lg font-semibold bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
            placeholder="Ej: Exportación optimizada de reportes mensuales a Excel"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            required
          />
        </div>

        {/* Campos Guiados de Historia (Estilo Tarjeta DevOps con Badges) */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 font-semibold text-indigo-400 text-sm">
            <Icon iconName="BookOpen" className="text-indigo-400" />
            <span>Plantilla Estructurada de Historia de Usuario</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Como */}
            <div className="flex flex-col gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-blue-950/60 text-blue-400 border border-blue-800/50 uppercase tracking-wider w-fit">
                <span>👤</span> Como...
              </span>
              <input
                type="text"
                disabled={isSubmitting}
                className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all font-medium text-sm"
                placeholder="Rol (Ej: Supervisor de Llamadas)"
                value={comoRol}
                onChange={(e) => setComoRol(e.target.value)}
                required
              />
            </div>

            {/* Quiero */}
            <div className="flex flex-col gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-indigo-950/60 text-indigo-400 border border-indigo-800/50 uppercase tracking-wider w-fit">
                <span>✨</span> Quiero...
              </span>
              <input
                type="text"
                disabled={isSubmitting}
                className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all font-medium text-sm"
                placeholder="Acción (Ej: Filtrar datos por período)"
                value={quieroFuncionalidad}
                onChange={(e) => setQuieroFuncionalidad(e.target.value)}
                required
              />
            </div>

            {/* Para */}
            <div className="flex flex-col gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-purple-950/60 text-purple-400 border border-purple-800/50 uppercase tracking-wider w-fit">
                <span>🎯</span> Para...
              </span>
              <input
                type="text"
                disabled={isSubmitting}
                className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all font-medium text-sm"
                placeholder="Beneficio (Ej: Reducir tiempo de auditoría)"
                value={paraBeneficio}
                onChange={(e) => setParaBeneficio(e.target.value)}
                required
              />
            </div>
          </div>

          {userStoryDescription && (
            <div className="bg-slate-950/80 border-l-4 border-indigo-500 border-t border-r border-b border-slate-800 rounded-r-xl p-4 text-sm italic text-slate-200 shadow-sm">
              <span className="font-semibold not-italic text-indigo-400 block mb-1 text-xs">
                Vista Previa Generada (Work Item):
              </span>
              "{userStoryDescription}"
            </div>
          )}
        </div>

        {/* Criterios de Aceptación (Editor amplio) */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-slate-200">
            Criterios de Aceptación <span className="text-rose-500">*</span>
          </label>
          <textarea
            disabled={isSubmitting}
            rows={4}
            className="w-full bg-slate-900/90 border border-blue-900/40 rounded-xl px-4 py-3.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all font-medium text-sm resize-none"
            placeholder="Especifique los criterios de aceptación requeridos..."
            value={criteriosAceptacion}
            onChange={(e) => setCriteriosAceptacion(e.target.value)}
            required
          />
        </div>

        {/* Botón Principal Registrado Estándar del App */}
        <div className="flex flex-col gap-2 pt-2 items-end">
          <button
            type="submit"
            disabled={isSubmitting || !isFormValid}
            className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-semibold py-3 px-8 rounded-xl shadow-lg shadow-blue-600/20 transition-all cursor-pointer flex items-center justify-center gap-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-600 disabled:active:scale-100"
          >
            <Icon iconName="Send" />
            <span>{isSubmitting ? 'Registrando iniciativa...' : 'Enviar Solicitud de Mejora'}</span>
          </button>

          {!isFormValid && (
            <span className="text-xs text-amber-400 flex items-center gap-1 font-medium">
              <span>⚠️</span> Complete la ubicación (Aplicativo, Módulo y Pantalla) y los campos obligatorios para habilitar el envío.
            </span>
          )}

          {isSubmitting && (
            <div className="flex justify-center pt-2 w-full">
              <Spinner label="Guardando propuesta..." size={SpinnerSize.small} />
            </div>
          )}
        </div>
      </div>
    </form>
  );
};

export default SolicitudMejoraForm;
