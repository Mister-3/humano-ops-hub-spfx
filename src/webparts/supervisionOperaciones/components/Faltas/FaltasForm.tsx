import * as React from 'react';
import {
  DatePicker,
  DefaultButton,
  Dropdown,
  type IDropdownOption,
  MaskedTextField,
  MessageBar,
  MessageBarType,
  PrimaryButton,
  Spinner,
  SpinnerSize,
  Stack,
  Text,
  TextField
} from '@fluentui/react';
import { ClipboardPlus, Clock3, FilePlus2, History } from 'lucide-react';

import type { IFalta, RoleType } from '../../models/AppModels';
import { useRBAC } from '../../../../auth/RBACContext';
import type { IDirectReport } from '../../services/GraphService';
import SharePointService, {
  type ICatalogoItem,
  type IRegistrarFaltaData
} from '../../services/SharePointService';
import AgentComboBox from '../AgentSelector/AgentComboBox';
import { PageHeader, SurfaceCard } from '../Common';
import HistorialView from '../Historial/HistorialView';
import AprobacionesView from './AprobacionesView';
import styles from './FaltasForm.module.scss';

export interface IFaltasFormProps {
  availableAgents: ReadonlyArray<IDirectReport>;
  currentUserEmail: string;
  currentUserName: string;
  isLoadingAgents?: boolean;
  userRole: RoleType;
}

const ERROR_CATEGORY = 'Error en proceso';
const TRAINING_CATEGORY = 'Capacitación';
const ETHICS_CATEGORY = 'Código de Ética';
const ASSISTANT_SUBCATEGORY = 'Error de Digitación';
const NO_PENALTY_IMPACT = 'Sin penalidad';

type ArrivalPeriod = 'AM' | 'PM';
type FaltasViewKey = 'nuevo' | 'historial' | 'aprobaciones';

interface ITardinessCalculation {
  formattedArrivalTime: string;
  hoursLost: number;
  isSunday: boolean;
  minutesLate: number;
  officialArrivalTime: string;
}

const normalizeCatalogValue = (value: string): string => value
  .trim()
  .replace(/\s+/g, ' ')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase();

const isCatalogValue = (value: string, expectedValue: string): boolean => (
  normalizeCatalogValue(value) === normalizeCatalogValue(expectedValue)
);

const impactOptions: IDropdownOption[] = [
  { key: 'Bajo', text: 'Bajo' },
  { key: 'Medio', text: 'Medio' },
  { key: 'Crítico', text: 'Crítico' }
];

const ethicsImpactOptions: IDropdownOption[] = [
  { key: 'Leve', text: 'Leve' },
  { key: 'Medio', text: 'Medio' },
  { key: 'Grave', text: 'Grave' }
];

const arrivalPeriodOptions: IDropdownOption[] = [
  { key: 'AM', text: 'AM' },
  { key: 'PM', text: 'PM' }
];

const errorOriginOptions: IDropdownOption[] = [
  { key: 'Caso Helpdesk', text: 'Caso Helpdesk' },
  { key: 'Monitoreo Calidad', text: 'Monitoreo Calidad' }
];

const toCatalogOptions = (
  items: ReadonlyArray<ICatalogoItem>
): IDropdownOption[] => {
  const seenValues: { [normalizedValue: string]: boolean } = {};

  return items
    .map((item) => item.Valor.trim())
    .filter((value) => {
      const normalizedValue = normalizeCatalogValue(value);

      if (!value || seenValues[normalizedValue]) {
        return false;
      }

      seenValues[normalizedValue] = true;
      return true;
    })
    .sort((left, right) => left.localeCompare(right, 'es'))
    .map((value) => ({ key: value, text: value }));
};

const parseArrivalTime = (
  value: string,
  period: ArrivalPeriod
): { formattedValue: string; minutesFromMidnight: number } | undefined => {
  const cleanValue = value.trim();
  const match = /^(\d{2}):(\d{2})$/.exec(cleanValue);

  if (!match) {
    return undefined;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 1 ||
    hours > 12 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return undefined;
  }

  const hours24 = period === 'AM'
    ? hours % 12
    : (hours % 12) + 12;
  const formattedHours = hours < 10 ? `0${hours}` : String(hours);
  const formattedMinutes = minutes < 10 ? `0${minutes}` : String(minutes);

  return {
    formattedValue: `${formattedHours}:${formattedMinutes} ${period}`,
    minutesFromMidnight: (hours24 * 60) + minutes
  };
};

const calculateTardiness = (
  date: Date | undefined,
  arrivalTime: string,
  period: ArrivalPeriod
): ITardinessCalculation | undefined => {
  if (!date) {
    return undefined;
  }

  const parsedArrival = parseArrivalTime(arrivalTime, period);

  if (!parsedArrival) {
    return undefined;
  }

  const dayOfWeek = date.getDay();

  if (dayOfWeek === 0) {
    return {
      formattedArrivalTime: parsedArrival.formattedValue,
      hoursLost: 0,
      isSunday: true,
      minutesLate: 0,
      officialArrivalTime: 'No aplica'
    };
  }

  const officialArrivalMinutes = dayOfWeek === 6
    ? 9 * 60
    : 8 * 60;
  const minutesLate = Math.max(
    0,
    parsedArrival.minutesFromMidnight - officialArrivalMinutes
  );

  return {
    formattedArrivalTime: parsedArrival.formattedValue,
    hoursLost: Math.round((minutesLate / 60) * 100) / 100,
    isSunday: false,
    minutesLate,
    officialArrivalTime: dayOfWeek === 6 ? '09:00 AM' : '08:00 AM'
  };
};

const FaltasForm: React.FC<IFaltasFormProps> = ({
  availableAgents,
  currentUserEmail,
  currentUserName,
  isLoadingAgents = false,
  userRole
}) => {
  const { hasPermission } = useRBAC();
  const canRegisterFaltas = hasPermission('modulo:faltas:registrar');
  const isAssistant = userRole === 'Asistente';
  const requiresApproval = isAssistant ||
    userRole === 'Agente';
  const canRegisterOfficial = userRole === 'Supervisor' ||
    userRole === 'Gerente' ||
    userRole === 'Admin';
  const canSubmit = requiresApproval || canRegisterOfficial;
  const canReviewApprovals = hasPermission('modulo:faltas:aprobar');
  const approvalAuthorEmails = React.useMemo<
    ReadonlyArray<string> | undefined
  >(
    () => userRole === 'Admin'
      ? undefined
      : availableAgents
          .map((agent) => agent.email.trim())
          .filter(Boolean),
    [availableAgents, userRole]
  );

  const [selectedAgentKey, setSelectedAgentKey] = React.useState<string>('');
  const [activeView, setActiveView] = React.useState<FaltasViewKey>('nuevo');
  const [teamMembers, setTeamMembers] = React.useState<IDirectReport[]>([]);
  const [fecha, setFecha] = React.useState<Date | null>(new Date());
  const [categoria, setCategoria] = React.useState<string>(
    isAssistant ? ERROR_CATEGORY : ''
  );
  const [subcategoria, setSubcategoria] = React.useState<string>(
    isAssistant ? ASSISTANT_SUBCATEGORY : ''
  );
  const [casoRef, setCasoRef] = React.useState<string>('');
  const [origenError, setOrigenError] = React.useState<string>('');
  const [procesoArea, setProcesoArea] = React.useState<string>('');
  const [comentarios, setComentarios] = React.useState<string>('');
  const [comentariosCapacitacion, setComentariosCapacitacion] =
    React.useState<string>('');
  const [horaLlegada, setHoraLlegada] = React.useState<string>('');
  const [arrivalPeriod, setArrivalPeriod] =
    React.useState<ArrivalPeriod>('AM');
  const [nivelImpacto, setNivelImpacto] = React.useState<string>('');
  const [evidenciaFile, setEvidenciaFile] = React.useState<File | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string>('');
  const [errorMessage, setErrorMessage] = React.useState<string>('');
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [isLoadingTeam, setIsLoadingTeam] = React.useState<boolean>(true);
  const [categoryOptions, setCategoryOptions] =
    React.useState<IDropdownOption[]>([]);
  const [subcategoryOptions, setSubcategoryOptions] =
    React.useState<IDropdownOption[]>([]);
  const [processOptions, setProcessOptions] =
    React.useState<IDropdownOption[]>([]);
  const [ethicsSubcategoryOptions, setEthicsSubcategoryOptions] =
    React.useState<IDropdownOption[]>([]);
  const [isLoadingCatalogs, setIsLoadingCatalogs] =
    React.useState<boolean>(true);
  const [catalogErrorMessage, setCatalogErrorMessage] =
    React.useState<string>('');
  const successTimerRef = React.useRef<number | undefined>(undefined);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const sharePointService = React.useMemo(() => new SharePointService(), []);

  const getAgentKey = React.useCallback((agent: IDirectReport): string => {
    const normalizedId = agent.id.trim();
    const normalizedEmail = agent.email.trim().toLocaleLowerCase();

    return normalizedId || normalizedEmail ||
      `name:${agent.name.trim().toLocaleLowerCase()}`;
  }, []);

  const selectedAgent = React.useMemo(
    (): IDirectReport | undefined => teamMembers.find(
      (member) => getAgentKey(member) === selectedAgentKey
    ),
    [getAgentKey, selectedAgentKey, teamMembers]
  );

  React.useEffect(() => {
    const seenIdentities: { [identity: string]: boolean } = {};
    const uniqueMembers = availableAgents
      .map((member): IDirectReport => ({
        ...member,
        email: member.email.trim(),
        id: member.id.trim(),
        name: member.name.trim()
      }))
      .filter((member) => {
        const identity = getAgentKey(member);

        if (!member.name || seenIdentities[identity]) {
          return false;
        }

        seenIdentities[identity] = true;
        return true;
      })
      .sort((left, right) => left.name.localeCompare(right.name, 'es'));

    setIsLoadingTeam(isLoadingAgents);
    setSelectedAgentKey('');
    setTeamMembers(uniqueMembers);
  }, [
    availableAgents,
    getAgentKey,
    isLoadingAgents
  ]);

  React.useEffect(() => {
    let isMounted = true;

    const loadCatalogs = async (): Promise<void> => {
      setIsLoadingCatalogs(true);
      setCatalogErrorMessage('');

      try {
        // Las lecturas son secuenciales porque las dos categorías de ética
        // pueden autoaprovisionar sus valores obligatorios en una lista ya
        // existente. Así se evita que dos solicitudes intenten insertarlos a
        // la vez durante la primera carga posterior a la actualización.
        const categories = await sharePointService.getCatalogos('Falta');
        const subcategories = await sharePointService.getCatalogos(
          'ErrorProceso'
        );
        const processes = await sharePointService.getCatalogos('ProcesoArea');
        const ethicsSubcategories = await sharePointService.getCatalogos(
          'CodigoEtica'
        );

        if (!isMounted) {
          return;
        }

        const loadedCategories = toCatalogOptions(categories);
        const loadedSubcategories = toCatalogOptions(subcategories);

        setCategoryOptions(
          isAssistant
            ? loadedCategories.filter((option) =>
              isCatalogValue(String(option.key), ERROR_CATEGORY)
            )
            : loadedCategories
        );
        setSubcategoryOptions(
          isAssistant
            ? loadedSubcategories.filter((option) =>
              isCatalogValue(String(option.key), ASSISTANT_SUBCATEGORY)
            )
            : loadedSubcategories
        );
        setProcessOptions(toCatalogOptions(processes));
        setEthicsSubcategoryOptions(toCatalogOptions(ethicsSubcategories));

        if (loadedCategories.length === 0) {
          setCatalogErrorMessage(
            'No hay categorías de faltas configuradas. Solicite su creación al Administrador.'
          );
        }
      } catch (error: unknown) {
        if (isMounted) {
          const detail = error instanceof Error
            ? error.message
            : 'No fue posible cargar los catálogos operativos.';
          setCategoryOptions([]);
          setSubcategoryOptions([]);
          setProcessOptions([]);
          setEthicsSubcategoryOptions([]);
          setCatalogErrorMessage(
            `${detail} Configure las opciones requeridas en el Panel Admin.`
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingCatalogs(false);
        }
      }
    };

    loadCatalogs().catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [isAssistant, sharePointService]);

  React.useEffect(() => {
    if (isAssistant) {
      setCategoria(ERROR_CATEGORY);
      setSubcategoria(ASSISTANT_SUBCATEGORY);
    }
  }, [isAssistant]);

  React.useEffect(() => () => {
    if (successTimerRef.current !== undefined) {
      window.clearTimeout(successTimerRef.current);
    }
  }, []);

  const isTraining = isCatalogValue(categoria, TRAINING_CATEGORY);
  const isProcessError = isCatalogValue(categoria, ERROR_CATEGORY);
  const isEthicsViolation = isCatalogValue(categoria, ETHICS_CATEGORY);
  const hasRequiredCatalogOptions = categoryOptions.length > 0 &&
    (!isProcessError || (
      subcategoryOptions.length > 0 && processOptions.length > 0
    )) &&
    (!isEthicsViolation || ethicsSubcategoryOptions.length > 0) &&
    (!isTraining || processOptions.length > 0);
  const isTardanza = categoria
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .includes('tardanza');
  const tardinessCalculation = React.useMemo(
    () => isTardanza
      ? calculateTardiness(fecha || undefined, horaLlegada, arrivalPeriod)
      : undefined,
    [arrivalPeriod, fecha, horaLlegada, isTardanza]
  );

  const handleCategoryChange = (nextCategory: string): void => {
    setCategoria(nextCategory);
    setProcesoArea('');

    if (isCatalogValue(nextCategory, TRAINING_CATEGORY)) {
      setNivelImpacto(NO_PENALTY_IMPACT);
      setSubcategoria('');
      setOrigenError('');
    } else {
      setNivelImpacto('');
    }

    if (!isCatalogValue(nextCategory, ERROR_CATEGORY)) {
      setSubcategoria('');
      setOrigenError('');
    }

    if (isCatalogValue(nextCategory, ETHICS_CATEGORY)) {
      setSubcategoria('');
      setOrigenError('');
      setProcesoArea('');
      setNivelImpacto('');
    } else if (!isCatalogValue(nextCategory, ERROR_CATEGORY)) {
      setSubcategoria('');
    }

    if (!isCatalogValue(nextCategory, TRAINING_CATEGORY)) {
      setComentariosCapacitacion('');
      if (!isCatalogValue(nextCategory, ERROR_CATEGORY)) {
        setProcesoArea('');
      }
    }

    if (!normalizeCatalogValue(nextCategory).includes('tardanza')) {
      setHoraLlegada('');
      setArrivalPeriod('AM');
    }
  };

  const submitFalta = async (): Promise<void> => {
    setErrorMessage('');
    setSuccessMessage('');

    if (!canRegisterFaltas) {
      setErrorMessage('No posee permiso para registrar faltas o errores.');
      return;
    }

    if (
      !selectedAgent ||
      !fecha ||
      !categoria ||
      (!isTraining && !nivelImpacto)
    ) {
      setErrorMessage('Complete los campos obligatorios antes de continuar.');
      return;
    }

    if (requiresApproval && !casoRef.trim()) {
      setErrorMessage(
        'El ID Relacionado es obligatorio para registros enviados a la cola de aprobación.'
      );
      return;
    }

    if (isProcessError && !subcategoria) {
      setErrorMessage('Seleccione la subcategoría del error antes de continuar.');
      return;
    }

    if (isEthicsViolation && !subcategoria) {
      setErrorMessage(
        'Seleccione la subcategoría de Código de Ética antes de continuar.'
      );
      return;
    }

    if (isProcessError && !origenError) {
      setErrorMessage('Seleccione el origen del registro antes de continuar.');
      return;
    }

    if (isProcessError && !procesoArea) {
      setErrorMessage('Seleccione el proceso del área donde se originó el error.');
      return;
    }

    if (isTraining && !procesoArea) {
      setErrorMessage('Seleccione el proceso del área asociado a la capacitación.');
      return;
    }

    if (isTardanza && !tardinessCalculation) {
      setErrorMessage(
        'Ingrese una hora de llegada válida en formato hh:mm y seleccione AM o PM.'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const finalEstadoAprobacion = requiresApproval
        ? 'Pendiente_Aprobacion'
        : 'Aprobado';
      const estado: IFalta['estado'] = requiresApproval
        ? 'Borrador'
        : 'Aprobado';
      const faltaData: IRegistrarFaltaData = {
        agente: selectedAgent.name,
        agenteEmail: selectedAgent.email,
        agenteObjectId: selectedAgent.id,
        emailSupervisor: currentUserEmail,
        fecha,
        categoria,
        impacto: isTraining ? NO_PENALTY_IMPACT : nivelImpacto,
        estado,
        estadoAprobacion: finalEstadoAprobacion,
        rolOriginador: userRole,
        subcategoria: isProcessError || isEthicsViolation ? subcategoria : '',
        casoRef: casoRef.trim(),
        origenError: isProcessError ? origenError : '',
        procesoArea: isTraining || isProcessError ? procesoArea : '',
        comentariosCapacitacion: isTraining
          ? comentariosCapacitacion.trim()
          : '',
        comentarios: comentarios.trim(),
        horaLlegada: isTardanza
          ? tardinessCalculation?.formattedArrivalTime || ''
          : '',
        minutosTardanza: isTardanza
          ? tardinessCalculation?.minutesLate || 0
          : 0,
        horasPerdidas: isTardanza
          ? tardinessCalculation?.hoursLost || 0
          : 0
      };

      await sharePointService.registrarFalta(faltaData, evidenciaFile);

      setSelectedAgentKey('');
      setFecha(new Date());
      setCategoria(isAssistant ? ERROR_CATEGORY : '');
      setSubcategoria(isAssistant ? ASSISTANT_SUBCATEGORY : '');
      setCasoRef('');
      setOrigenError('');
      setProcesoArea('');
      setComentarios('');
      setComentariosCapacitacion('');
      setHoraLlegada('');
      setArrivalPeriod('AM');
      setNivelImpacto('');
      setEvidenciaFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setSuccessMessage(requiresApproval
        ? 'Registro enviado correctamente a la cola de aprobación'
        : isTraining
          ? 'Capacitación registrada correctamente'
          : 'Falta registrada correctamente');

      if (successTimerRef.current !== undefined) {
        window.clearTimeout(successTimerRef.current);
      }

      successTimerRef.current = window.setTimeout(() => {
        setSuccessMessage('');
      }, 4000);
    } catch (error: unknown) {
      const detail = error instanceof Error
        ? error.message
        : 'Ocurrió un error inesperado al guardar la falta.';
      setErrorMessage(detail);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    submitFalta().catch((error: unknown) => {
      const detail = error instanceof Error
        ? error.message
        : 'Ocurrió un error inesperado al guardar la falta.';
      setErrorMessage(detail);
      setIsSubmitting(false);
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        action={(
          <button
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-600/20 transition-colors hover:bg-cyan-500"
            onClick={() => setActiveView('nuevo')}
            type="button"
          >
            <FilePlus2 aria-hidden="true" size={18} />
            Nuevo registro
          </button>
        )}
        icon={<ClipboardPlus aria-hidden="true" size={24} />}
        subtitle="Registra, consulta y revisa incidencias operativas con trazabilidad completa."
        title="Registro y Gestión de Oportunidades"
      />

      <nav
        aria-label="Vistas de oportunidades operativas"
        className="flex flex-wrap gap-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-2 shadow-lg"
      >
        {([
          { key: 'nuevo' as const, label: 'Nuevo registro', icon: FilePlus2 },
          { key: 'historial' as const, label: 'Historial y consultas', icon: History },
          ...(canReviewApprovals
            ? [{ key: 'aprobaciones' as const, label: 'Cola de aprobación', icon: Clock3 }]
            : [])
        ]).map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeView === tab.key;
          return (
            <button
              aria-current={isActive ? 'page' : undefined}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${isActive
                ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300'
                : 'border-transparent text-slate-400 hover:border-slate-700 hover:bg-slate-800 hover:text-slate-200'}`}
              key={tab.key}
              onClick={() => setActiveView(tab.key)}
              type="button"
            >
              <TabIcon aria-hidden="true" size={17} />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {activeView === 'nuevo' && (
        <form className={styles.form} onSubmit={handleSubmit}>
          <SurfaceCard className={styles.formCard}>
            <Stack tokens={{ childrenGap: 15 }}>
            {!canSubmit && (
              <MessageBar messageBarType={MessageBarType.warning}>
                El rol {userRole} posee acceso de consulta, pero no puede registrar faltas.
              </MessageBar>
            )}

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

            {catalogErrorMessage && (
              <MessageBar messageBarType={MessageBarType.warning}>
                {catalogErrorMessage}
              </MessageBar>
            )}

            {isLoadingTeam && (
              <Spinner label="Cargando equipo autorizado..." size={SpinnerSize.small} />
            )}

            {isLoadingCatalogs && (
              <Spinner
                label="Cargando catálogos operativos..."
                size={SpinnerSize.small}
              />
            )}

            <AgentComboBox
              agents={teamMembers}
              disabled={!canSubmit || isSubmitting || isLoadingTeam}
              label="Agente"
              onAgentChange={(agent) => {
                setSelectedAgentKey(agent ? getAgentKey(agent) : '');
              }}
              placeholder="Busque por nombre o correo"
              required
              selectedAgent={selectedAgent}
            />

            <DatePicker
              disabled={!canSubmit || isSubmitting}
              firstDayOfWeek={1}
              label="Fecha"
              onSelectDate={(selectedDate) => {
                setFecha(selectedDate || null);
              }}
              placeholder="Seleccione una fecha"
              value={fecha || undefined}
            />

            <Dropdown
              disabled={
                !canSubmit ||
                isAssistant ||
                isSubmitting ||
                isLoadingCatalogs
              }
              label="Categoría"
              onChange={(_, option) => {
                handleCategoryChange(String(option?.key || ''));
              }}
              options={isAssistant
                ? categoryOptions.filter(
                  (option) => isCatalogValue(String(option.key), ERROR_CATEGORY)
                )
                : categoryOptions}
              placeholder={isLoadingCatalogs
                ? 'Cargando categorías...'
                : categoryOptions.length === 0
                  ? 'Sin opciones registradas (Configurar en Panel Admin)'
                  : 'Seleccione una categoría'}
              required
              selectedKey={categoria}
            />

            {isTraining && (
              <Stack className={styles.conditionalSection} tokens={{ childrenGap: 15 }}>
                <MessageBar messageBarType={MessageBarType.info}>
                  Registro de certificación/entrenamiento de procesos. Penalidad: 0 puntos.
                </MessageBar>
                <Text className={styles.conditionalTitle}>
                  Detalle de la capacitación
                </Text>
                <Dropdown
                  disabled={!canSubmit || isSubmitting || isLoadingCatalogs}
                  label="Proceso del Área"
                  onChange={(_, option) => {
                    setProcesoArea(String(option?.key || ''));
                  }}
                  options={processOptions}
                  placeholder={isLoadingCatalogs
                    ? 'Cargando procesos...'
                    : processOptions.length === 0
                      ? 'Sin opciones registradas (Configurar en Panel Admin)'
                      : 'Seleccione el proceso certificado'}
                  required
                  selectedKey={procesoArea || undefined}
                />
                <TextField
                  disabled={!canSubmit || isSubmitting}
                  label="Comentarios de la Capacitación"
                  multiline
                  onChange={(_, value) => {
                    setComentariosCapacitacion(value || '');
                  }}
                  placeholder="Detalle de certificación, resultado o seguimiento (opcional)"
                  resizable={false}
                  rows={3}
                  value={comentariosCapacitacion}
                />
              </Stack>
            )}

            {isProcessError && (
              <Stack className={styles.conditionalSection} tokens={{ childrenGap: 15 }}>
                <Text className={styles.conditionalTitle}>
                  Detalle del error en proceso
                </Text>
                <Dropdown
                  disabled={
                    !canSubmit ||
                    isAssistant ||
                    isSubmitting ||
                    isLoadingCatalogs
                  }
                  label="Subcategoría de Error"
                  onChange={(_, option) => {
                    setSubcategoria(String(option?.key || ''));
                  }}
                  options={isAssistant
                    ? subcategoryOptions.filter(
                      (option) => isCatalogValue(
                        String(option.key),
                        ASSISTANT_SUBCATEGORY
                      )
                    )
                    : subcategoryOptions}
                  placeholder={isLoadingCatalogs
                    ? 'Cargando subcategorías...'
                    : subcategoryOptions.length === 0
                      ? 'Sin opciones registradas (Configurar en Panel Admin)'
                      : 'Seleccione una subcategoría'}
                  required
                  selectedKey={subcategoria || undefined}
                />
                <Dropdown
                  disabled={!canSubmit || isSubmitting}
                  label="Origen del Registro"
                  onChange={(_, option) => {
                    setOrigenError(String(option?.key || ''));
                  }}
                  options={errorOriginOptions}
                  placeholder="Seleccione el origen del error"
                  required
                  selectedKey={origenError || undefined}
                />
                <TextField
                  description={requiresApproval
                    ? 'Requerido para enviar el registro a la cola de aprobación.'
                    : 'Opcional para registros con aprobación directa.'}
                  disabled={!canSubmit || isSubmitting}
                  label="ID Relacionado"
                  onChange={(_, value) => setCasoRef(value || '')}
                  placeholder={requiresApproval
                    ? 'Ingrese el ID del caso o referencia'
                    : 'Opcional'}
                  required={requiresApproval}
                  value={casoRef}
                />
                <Dropdown
                  disabled={!canSubmit || isSubmitting || isLoadingCatalogs}
                  label="Proceso del Área"
                  onChange={(_, option) => {
                    setProcesoArea(String(option?.key || ''));
                  }}
                  options={processOptions}
                  placeholder={isLoadingCatalogs
                    ? 'Cargando procesos...'
                    : processOptions.length === 0
                      ? 'Sin opciones registradas (Configurar en Panel Admin)'
                      : 'Seleccione el proceso donde ocurrió el error'}
                  required
                  selectedKey={procesoArea || undefined}
                />
              </Stack>
            )}

            {isEthicsViolation && (
              <Stack className={styles.conditionalSection} tokens={{ childrenGap: 15 }}>
                <Text className={styles.conditionalTitle}>
                  Tipificación de Código de Ética
                </Text>
                <Dropdown
                  disabled={!canSubmit || isSubmitting || isLoadingCatalogs}
                  label="Subcategoría de Código de Ética"
                  onChange={(_, option) => {
                    setSubcategoria(String(option?.key || ''));
                  }}
                  options={ethicsSubcategoryOptions}
                  placeholder={isLoadingCatalogs
                    ? 'Cargando subcategorías...'
                    : ethicsSubcategoryOptions.length === 0
                      ? 'Sin opciones registradas (Configurar en Panel Admin)'
                      : 'Seleccione la conducta tipificada'}
                  required
                  selectedKey={subcategoria || undefined}
                />
                {ethicsSubcategoryOptions.length === 0 && !isLoadingCatalogs && (
                  <MessageBar messageBarType={MessageBarType.warning}>
                    No hay subcategorías de Código de Ética configuradas.
                    Solicite al Administrador actualizar el catálogo.
                  </MessageBar>
                )}
              </Stack>
            )}

            {isTardanza && (
              <Stack
                className={styles.conditionalSection}
                tokens={{ childrenGap: 12 }}
              >
                <Text className={styles.conditionalTitle}>
                  Cálculo automático de tardanza
                </Text>
                <Stack
                  className={styles.timeControls}
                  horizontal
                  tokens={{ childrenGap: 12 }}
                  verticalAlign="end"
                  wrap
                >
                  <Stack.Item className={styles.timeInput} grow>
                    <MaskedTextField
                      disabled={!canSubmit || isSubmitting}
                      label="Hora de Llegada"
                      mask="99:99"
                      maskChar="_"
                      onFocus={(e) => (e.target as HTMLInputElement).select()}
                      onChange={(_, value) => {
                        setHoraLlegada(value || '');
                      }}
                      placeholder="08:45"
                      required
                      value={horaLlegada}
                    />
                  </Stack.Item>
                  <Stack.Item className={styles.periodInput}>
                    <Dropdown
                      disabled={!canSubmit || isSubmitting}
                      label="Período"
                      onChange={(_, option) => {
                        const nextPeriod = String(option?.key || 'AM');
                        setArrivalPeriod(nextPeriod === 'PM' ? 'PM' : 'AM');
                      }}
                      options={arrivalPeriodOptions}
                      required
                      selectedKey={arrivalPeriod}
                    />
                  </Stack.Item>
                </Stack>

                {tardinessCalculation?.isSunday ? (
                  <MessageBar messageBarType={MessageBarType.warning}>
                    La fecha seleccionada es domingo y no tiene una hora oficial
                    de entrada configurada. La tardanza se registrará en 0 minutos.
                  </MessageBar>
                ) : tardinessCalculation ? (
                  <>
                    <Text className={styles.officialTime}>
                      Hora oficial de entrada para la fecha seleccionada:{' '}
                      {tardinessCalculation.officialArrivalTime}
                    </Text>
                    <div
                      aria-live="polite"
                      className={`${styles.tardinessBadge} tabular-nums font-mono`}
                      role="status"
                    >
                      ⏱️ Tardanza detectada:{' '}
                      {tardinessCalculation.minutesLate} minutos (
                      {tardinessCalculation.hoursLost.toFixed(2)} hrs laborables
                      perdidas).
                    </div>
                  </>
                ) : (
                  <Text className={styles.officialTime}>
                    Ingrese una hora válida en formato hh:mm y seleccione AM o PM.
                  </Text>
                )}
              </Stack>
            )}

            <TextField
              disabled={!canSubmit || isSubmitting}
              label="Comentarios / Observaciones"
              multiline
              onChange={(_, value) => setComentarios(value || '')}
              placeholder="Agregue cualquier detalle relevante (opcional)"
              resizable={false}
              rows={3}
              value={comentarios}
            />

            <Dropdown
              disabled={!canSubmit || isSubmitting || isTraining}
              label="Nivel de Impacto"
              onChange={(_, option) => setNivelImpacto(String(option?.key || ''))}
              options={isTraining
                ? [{ key: NO_PENALTY_IMPACT, text: 'Sin penalidad (0 puntos)' }]
                : isEthicsViolation
                  ? ethicsImpactOptions
                  : impactOptions}
              required={!isTraining}
              selectedKey={isTraining ? NO_PENALTY_IMPACT : nivelImpacto}
            />

            <Stack verticalAlign="start" tokens={{ childrenGap: 6 }}>
              <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 12 }}>
                <input
                  accept="image/*,.pdf,.msg,.eml"
                  aria-label="Seleccionar archivo de evidencia"
                  disabled={!canSubmit || isSubmitting}
                  onChange={(event) => {
                    const selectedFile = event.currentTarget.files?.[0] || null;
                    if (selectedFile) {
                      const MAX_FILE_SIZE_MB = 50;
                      if (selectedFile.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
                        setErrorMessage(`El archivo excede el límite permitido de ${MAX_FILE_SIZE_MB} MB.`);
                        event.currentTarget.value = '';
                        setEvidenciaFile(null);
                        return;
                      }
                    }
                    setEvidenciaFile(selectedFile);
                  }}
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  type="file"
                />
                <DefaultButton
                  disabled={!canSubmit || isSubmitting}
                  onClick={() => fileInputRef.current?.click()}
                  text="Adjuntar Evidencia (Foto/Correo)"
                  type="button"
                />
                {evidenciaFile && (
                  <Text className={styles.fileName}>
                    Archivo seleccionado: {evidenciaFile.name}
                  </Text>
                )}
              </Stack>
              <p className="mt-1 text-xs text-slate-400">
                Límite máximo por archivo: 50 MB (Imágenes y PDFs)
              </p>
            </Stack>

            <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 12 }}>
              <PrimaryButton
                disabled={
                  !canRegisterFaltas ||
                  !canSubmit ||
                  isSubmitting ||
                  isLoadingTeam ||
                  isLoadingCatalogs ||
                  !hasRequiredCatalogOptions
                }
                text={requiresApproval
                  ? isAssistant
                    ? 'Enviar para Revisión (Borrador)'
                    : 'Enviar para Revisión'
                  : isTraining
                    ? 'Registrar Capacitación'
                    : 'Registrar Falta Oficial'}
                type="submit"
              />
              {isSubmitting && (
                <Spinner
                  label="Guardando..."
                  size={SpinnerSize.small}
                />
              )}
            </Stack>
            </Stack>
          </SurfaceCard>
        </form>
      )}

      {activeView === 'historial' && (
        <HistorialView
          currentUserEmail={currentUserEmail}
          currentUserName={currentUserName}
          availableAgents={availableAgents}
          isLoadingAgents={isLoadingAgents}
          moduleType="faltas"
          userRole={userRole}
        />
      )}

      {canReviewApprovals && activeView === 'aprobaciones' && (
        <AprobacionesView allowedAuthorEmails={approvalAuthorEmails} />
      )}
    </div>
  );
};

export default FaltasForm;
