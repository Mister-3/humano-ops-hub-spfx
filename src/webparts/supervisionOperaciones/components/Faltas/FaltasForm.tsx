import * as React from 'react';
import {
  DatePicker,
  DefaultButton,
  Dropdown,
  type IDropdownOption,
  MaskedTextField,
  MessageBar,
  MessageBarType,
  Pivot,
  PivotItem,
  PrimaryButton,
  Spinner,
  SpinnerSize,
  Stack,
  Text,
  TextField
} from '@fluentui/react';

import type { IFalta, RoleType } from '../../models/AppModels';
import type GraphService from '../../services/GraphService';
import type { IDirectReport } from '../../services/GraphService';
import SharePointService, {
  type ICatalogoItem,
  type IRegistrarFaltaData
} from '../../services/SharePointService';
import AgentComboBox from '../AgentSelector/AgentComboBox';
import HistorialView from '../Historial/HistorialView';
import styles from './FaltasForm.module.scss';

export interface IFaltasFormProps {
  availableAgents?: ReadonlyArray<IDirectReport>;
  currentUserEmail: string;
  currentUserName: string;
  graphService: GraphService;
  isLoadingAgents?: boolean;
  userRole: RoleType;
}

const ERROR_CATEGORY = 'Error en proceso';
const TRAINING_CATEGORY = 'Capacitación';
const ASSISTANT_SUBCATEGORY = 'Error de Digitación';
const NO_PENALTY_IMPACT = 'Sin penalidad';

type ArrivalPeriod = 'AM' | 'PM';

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

const fallbackCategoryOptions: IDropdownOption[] = [
  { key: 'Tardanza', text: 'Tardanza' },
  { key: 'Ausencia Injustificada', text: 'Ausencia Injustificada' },
  { key: ERROR_CATEGORY, text: ERROR_CATEGORY },
  { key: 'Violación de Política', text: 'Violación de Política' },
  { key: TRAINING_CATEGORY, text: TRAINING_CATEGORY }
];

const impactOptions: IDropdownOption[] = [
  { key: 'Bajo', text: 'Bajo' },
  { key: 'Medio', text: 'Medio' },
  { key: 'Crítico', text: 'Crítico' }
];

const arrivalPeriodOptions: IDropdownOption[] = [
  { key: 'AM', text: 'AM' },
  { key: 'PM', text: 'PM' }
];

const errorOriginOptions: IDropdownOption[] = [
  { key: 'Caso Helpdesk', text: 'Caso Helpdesk' },
  { key: 'Monitoreo Calidad', text: 'Monitoreo Calidad' }
];

const fallbackSubcategoryOptions: IDropdownOption[] = [
  { key: ASSISTANT_SUBCATEGORY, text: ASSISTANT_SUBCATEGORY },
  { key: 'Incumplimiento SLA', text: 'Incumplimiento SLA' },
  { key: 'Procedimiento Incompleto', text: 'Procedimiento Incompleto' },
  { key: 'Omisión de Verificación', text: 'Omisión de Verificación' }
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
  graphService,
  isLoadingAgents = false,
  userRole
}) => {
  const isAssistant = userRole === 'Asistente';
  const canRegisterOfficial = userRole === 'Supervisor' ||
    userRole === 'Gerente' ||
    userRole === 'Admin';
  const canSubmit = isAssistant || canRegisterOfficial;

  const [selectedAgentKey, setSelectedAgentKey] = React.useState<string>('');
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
  const [horaLlegada, setHoraLlegada] = React.useState<string>('');
  const [arrivalPeriod, setArrivalPeriod] =
    React.useState<ArrivalPeriod>('AM');
  const [nivelImpacto, setNivelImpacto] = React.useState<string>('');
  const [evidenciaFile, setEvidenciaFile] = React.useState<File | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string>('');
  const [errorMessage, setErrorMessage] = React.useState<string>('');
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [isLoadingTeam, setIsLoadingTeam] = React.useState<boolean>(true);
  const [teamErrorMessage, setTeamErrorMessage] = React.useState<string>('');
  const [categoryOptions, setCategoryOptions] =
    React.useState<IDropdownOption[]>([]);
  const [subcategoryOptions, setSubcategoryOptions] =
    React.useState<IDropdownOption[]>([]);
  const [processOptions, setProcessOptions] =
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
    let isMounted = true;

    const loadTeam = async (): Promise<void> => {
      setIsLoadingTeam(availableAgents !== undefined
        ? isLoadingAgents
        : true);
      setTeamErrorMessage('');
      setSelectedAgentKey('');
      setTeamMembers([]);

      try {
        const loadedMembers = availableAgents !== undefined
          ? availableAgents
          : isAssistant
            ? await graphService.getSupervisorPeers()
            : await graphService.getDirectReports();

        if (isMounted) {
          const seenIdentities: { [identity: string]: boolean } = {};
          const uniqueMembers = loadedMembers
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

          setTeamMembers(uniqueMembers);
        }
      } catch (error: unknown) {
        if (isMounted) {
          const detail = error instanceof Error
            ? error.message
            : 'No fue posible cargar el equipo del supervisor.';
          setTeamErrorMessage(detail);
        }
      } finally {
        if (isMounted) {
          setIsLoadingTeam(
            availableAgents !== undefined && isLoadingAgents
          );
        }
      }
    };

    loadTeam().catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [
    availableAgents,
    getAgentKey,
    graphService,
    isAssistant,
    isLoadingAgents
  ]);

  React.useEffect(() => {
    let isMounted = true;

    const loadCatalogs = async (): Promise<void> => {
      setIsLoadingCatalogs(true);
      setCatalogErrorMessage('');

      try {
        const [categories, subcategories, processes] = await Promise.all([
          sharePointService.getCatalogos('Falta'),
          sharePointService.getCatalogos('ErrorProceso'),
          sharePointService.getCatalogos('ProcesoArea')
        ]);

        if (!isMounted) {
          return;
        }

        const loadedCategories = toCatalogOptions(categories);
        const loadedSubcategories = toCatalogOptions(subcategories);

        setCategoryOptions(
          isAssistant
            ? [{ key: ERROR_CATEGORY, text: ERROR_CATEGORY }]
            : loadedCategories
        );
        setSubcategoryOptions(
          isAssistant
            ? [{
              key: ASSISTANT_SUBCATEGORY,
              text: ASSISTANT_SUBCATEGORY
            }]
            : loadedSubcategories
        );
        setProcessOptions(toCatalogOptions(processes));

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
          setCategoryOptions(fallbackCategoryOptions);
          setSubcategoryOptions(fallbackSubcategoryOptions);
          setProcessOptions([]);
          setCatalogErrorMessage(
            `${detail} Se habilitaron temporalmente las opciones base.`
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

    if (isCatalogValue(nextCategory, TRAINING_CATEGORY)) {
      setNivelImpacto(NO_PENALTY_IMPACT);
      setSubcategoria('');
      setCasoRef('');
      setOrigenError('');
    } else if (nivelImpacto === NO_PENALTY_IMPACT) {
      setNivelImpacto('');
    }

    if (!isCatalogValue(nextCategory, ERROR_CATEGORY)) {
      setSubcategoria('');
      setCasoRef('');
      setOrigenError('');
    }

    if (!isCatalogValue(nextCategory, TRAINING_CATEGORY)) {
      setProcesoArea('');
    }

    if (!normalizeCatalogValue(nextCategory).includes('tardanza')) {
      setHoraLlegada('');
      setArrivalPeriod('AM');
    }
  };

  const submitFalta = async (): Promise<void> => {
    setErrorMessage('');
    setSuccessMessage('');

    if (
      !selectedAgent ||
      !fecha ||
      !categoria ||
      (!isTraining && !nivelImpacto)
    ) {
      setErrorMessage('Complete los campos obligatorios antes de continuar.');
      return;
    }

    if (isProcessError && !subcategoria) {
      setErrorMessage('Seleccione la subcategoría del error antes de continuar.');
      return;
    }

    if (isProcessError && !origenError) {
      setErrorMessage('Seleccione el origen del registro antes de continuar.');
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
      const estado: IFalta['estado'] = isTraining
        ? 'Aprobado'
        : isAssistant
          ? 'Borrador'
          : 'Aprobado';
      const faltaData: IRegistrarFaltaData = {
        agente: selectedAgent.name,
        agenteEmail: selectedAgent.email,
        agenteObjectId: selectedAgent.id,
        fecha,
        categoria,
        impacto: isTraining ? NO_PENALTY_IMPACT : nivelImpacto,
        estado,
        rolOriginador: userRole,
        subcategoria: isProcessError ? subcategoria : '',
        casoRef: isProcessError ? casoRef.trim() : '',
        origenError: isProcessError ? origenError : '',
        procesoArea: isTraining ? procesoArea : '',
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
      setHoraLlegada('');
      setArrivalPeriod('AM');
      setNivelImpacto('');
      setEvidenciaFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setSuccessMessage(isTraining
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
    <Pivot className={styles.modulePivot} aria-label="Vistas del módulo de faltas">
      <PivotItem headerText="➕ Nuevo Registro" itemKey="nuevo">
        <form className={styles.form} onSubmit={handleSubmit}>
          <Stack
            className={styles.formCard}
            tokens={{ childrenGap: 15 }}
          >
            <Text className={styles.title} variant="xLarge">
              Registro de faltas y capacitaciones
            </Text>

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

            {teamErrorMessage && (
              <MessageBar messageBarType={MessageBarType.warning}>
                {teamErrorMessage}
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
                    : 'Seleccione el proceso certificado'}
                  required
                  selectedKey={procesoArea || undefined}
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
                    : 'Seleccione una subcategoría'}
                  required
                  selectedKey={subcategoria || undefined}
                />
                <TextField
                  disabled={!canSubmit || isSubmitting}
                  label="ID Caso Helpdesk / Calidad"
                  onChange={(_, value) => setCasoRef(value || '')}
                  placeholder="Opcional"
                  value={casoRef}
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
                      className={styles.tardinessBadge}
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
                : impactOptions}
              required={!isTraining}
              selectedKey={isTraining ? NO_PENALTY_IMPACT : nivelImpacto}
            />

            <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 12 }}>
              <input
                accept="image/*,.pdf,.msg,.eml"
                aria-label="Seleccionar archivo de evidencia"
                disabled={!canSubmit || isSubmitting}
                onChange={(event) => {
                  setEvidenciaFile(event.currentTarget.files?.[0] || null);
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

            <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 12 }}>
              <PrimaryButton
                disabled={
                  !canSubmit ||
                  isSubmitting ||
                  isLoadingTeam ||
                  isLoadingCatalogs
                }
                text={isAssistant
                  ? 'Enviar para Revisión (Borrador)'
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
        </form>
      </PivotItem>

      <PivotItem headerText="📊 Historial y Consultas" itemKey="historial">
        <HistorialView
          currentUserEmail={currentUserEmail}
          currentUserName={currentUserName}
          availableAgents={availableAgents}
          graphService={graphService}
          isLoadingAgents={isLoadingAgents}
          moduleType="faltas"
          userRole={userRole}
        />
      </PivotItem>
    </Pivot>
  );
};

export default FaltasForm;
