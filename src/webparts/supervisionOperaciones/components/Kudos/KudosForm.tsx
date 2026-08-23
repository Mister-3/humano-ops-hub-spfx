import * as React from 'react';
import {
  DatePicker,
  DayOfWeek,
  DefaultButton,
  Dropdown,
  type IDropdownOption,
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
import { Award, FilePlus2 } from 'lucide-react';

import { cloudDbClient } from '../../../../services/CloudDbClient';
import { useRBAC } from '../../../../auth/RBACContext';
import SharePointService, {
  deduplicateKudos,
  isFaltaApprovedForScoring,
  type IConfiguracionMetricas,
  type IEvaluacionKudoItem,
  type IEvaluacionProductividadItem,
  type IFaltaHistorialItem,
  type IPublicarEmpleadoMesData,
  type IRegistrarKudoData
} from '../../services/SharePointService';
import type { IDirectReport } from '../../services/GraphService';
import type { RoleType } from '../../models/AppModels';
import useCurrentDate from '../../hooks/useCurrentDate';
import {
  calculateAgentProductivity,
  calculateProductivityOverlapFactor,
  calculateTeamMetricAverages,
  getWorkingDaysCount,
  PRODUCTIVITY_METRIC_KEYS,
  resolveCaseSlaValues,
  resolveProductivityMetricValues,
  type IProductivityAgentRecord
} from '../../utils';
import { EmployeeMonthCard } from '../Dashboard/EmployeeMonthCard';
import {
  buildKudoMedals,
  getKudoMedalDefinition,
  normalizeKudoAttribute,
  type IKudoMedal
} from '../Dashboard/KudoMedals';
import AgentComboBox from '../AgentSelector/AgentComboBox';
import { KpiCard, PageHeader, SurfaceCard } from '../Common';
import HistorialView from '../Historial/HistorialView';
import EmpleadoMesHistorialView from './EmpleadoMesHistorialView';
import styles from './KudosForm.module.scss';

export interface IKudosFormProps {
  availableAgents: ReadonlyArray<IDirectReport>;
  currentUserEmail: string;
  isLoadingAgents?: boolean;
  remitente: string;
  userRole: RoleType;
}

const MONTH_NAMES: ReadonlyArray<string> = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre'
];

const NEW_VIEW_KEY = 'nuevo';
const PUBLICATION_VIEW_KEY = 'publicar';
const EVIDENCE_INPUT_ACCEPT = '.pdf,.jpg,.jpeg,.png';
const ALLOWED_EVIDENCE_EXTENSIONS = new Set<string>([
  'pdf',
  'jpg',
  'jpeg',
  'png'
]);
const ALLOWED_EVIDENCE_MIME_TYPES = new Set<string>([
  'application/pdf',
  'image/jpeg',
  'image/png'
]);

interface IAgentIdentityItem {
  Title?: string;
  AgenteEmail?: string;
  AgenteObjectID?: string;
}

interface IResolvedAgent {
  key: string;
  name: string;
  email: string;
  objectId: string;
}

interface IEmployeeMonthAccumulator extends IResolvedAgent {
  hasProductividad: boolean;
  metricasProductividad: IProductivityAgentRecord;
  puntosProductividad: number;
  puntosKudos: number;
  puntosRestados: number;
  kudos: IEvaluacionKudoItem[];
}

interface IEmployeeMonthCandidate {
  agenteNombre: string;
  agenteEmail: string;
  puntosTotales: number;
  puntosKudos: number;
  reconocimientosMes: number;
  conceptoKudo: string;
  medals: ReadonlyArray<IKudoMedal>;
}

interface IPreviousMonthPeriod {
  startDate: Date;
  endDate: Date;
  mesAno: string;
}

const normalizeIdentity = (value?: string): string =>
  value?.trim().toLocaleLowerCase() || '';

const normalizeAttribute = (value?: string): string => (
  value
    ?.trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase() || ''
);

const toFiniteNumber = (value: unknown): number => (
  typeof value === 'number' && Number.isFinite(value) ? value : 0
);

const formatMonthYear = (date: Date): string =>
  `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;

const formatRecognitionDate = (date?: Date): string => {
  if (!date) {
    return '';
  }

  return new Intl.DateTimeFormat('es-DO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
};

const getFileExtension = (fileName: string): string => {
  const extensionIndex = fileName.lastIndexOf('.');

  return extensionIndex >= 0
    ? fileName.slice(extensionIndex + 1).toLocaleLowerCase()
    : '';
};

const isAllowedEvidenceFile = (file: File): boolean => {
  const extensionIsAllowed = ALLOWED_EVIDENCE_EXTENSIONS.has(
    getFileExtension(file.name)
  );
  const normalizedMimeType = file.type.trim().toLocaleLowerCase();
  const mimeTypeIsAllowed =
    !normalizedMimeType ||
    ALLOWED_EVIDENCE_MIME_TYPES.has(normalizedMimeType);

  return extensionIsAllowed && mimeTypeIsAllowed;
};

const formatFileSize = (sizeInBytes: number): string => {
  if (sizeInBytes < 1024) {
    return `${sizeInBytes} B`;
  }

  if (sizeInBytes < 1024 * 1024) {
    return `${(sizeInBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getPreviousMonthPeriod = (today: Date): IPreviousMonthPeriod => {
  const startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const endDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    0,
    23,
    59,
    59,
    999
  );

  return {
    startDate,
    endDate,
    mesAno: formatMonthYear(startDate)
  };
};

const itemMatchesAgent = (
  item: IAgentIdentityItem,
  agent: IDirectReport
): boolean => {
  const itemEmail = normalizeIdentity(item.AgenteEmail);
  const agentEmail = normalizeIdentity(agent.email);

  if (itemEmail && agentEmail && itemEmail === agentEmail) {
    return true;
  }

  const itemObjectId = normalizeIdentity(item.AgenteObjectID);
  const agentObjectId = normalizeIdentity(agent.id);

  if (itemObjectId && agentObjectId && itemObjectId === agentObjectId) {
    return true;
  }

  if (itemEmail || itemObjectId) {
    return false;
  }

  return Boolean(
    normalizeIdentity(item.Title) &&
    normalizeIdentity(item.Title) === normalizeIdentity(agent.name)
  );
};

const resolveAgent = (
  item: IAgentIdentityItem,
  allowedAgents: ReadonlyArray<IDirectReport>,
  hasGlobalScope: boolean
): IResolvedAgent | undefined => {
  const scopedAgent = allowedAgents.find((agent) =>
    itemMatchesAgent(item, agent)
  );

  if (!hasGlobalScope && !scopedAgent) {
    return undefined;
  }

  const name = scopedAgent?.name.trim() || item.Title?.trim() || '';
  const email =
    scopedAgent?.email.trim() || item.AgenteEmail?.trim() || '';
  const objectId =
    scopedAgent?.id.trim() || item.AgenteObjectID?.trim() || '';
  const key = email
    ? `email:${normalizeIdentity(email)}`
    : objectId
      ? `object:${normalizeIdentity(objectId)}`
      : name
        ? `legacy:${normalizeIdentity(name)}`
        : '';

  return key
    ? {
        key,
        name: name || email || objectId,
        email,
        objectId
      }
    : undefined;
};

const getPenalty = (
  item: IFaltaHistorialItem,
  config: IConfiguracionMetricas
): number => {
  if (
    !isFaltaApprovedForScoring(item.EstadoAprobacion) ||
    normalizeAttribute(item.Categoria) === 'capacitacion'
  ) {
    return 0;
  }

  switch (normalizeAttribute(item.Impacto)) {
    case 'bajo':
    case 'leve':
      return toFiniteNumber(config.PenalidadBaja);
    case 'medio':
      return toFiniteNumber(config.PenalidadMedia);
    case 'critico':
    case 'grave':
      return toFiniteNumber(config.PenalidadCritica);
    default:
      return 0;
  }
};

const getPredominantKudoAttribute = (
  kudos: ReadonlyArray<IEvaluacionKudoItem>
): string => {
  const pointsByAttribute = kudos.reduce<Record<string, {
    label: string;
    points: number;
  }>>((accumulator, kudo) => {
    const label = kudo.Atributo?.trim() || '';
    const key = normalizeKudoAttribute(label);

    if (!key) {
      return accumulator;
    }

    if (!accumulator[key]) {
      accumulator[key] = { label, points: 0 };
    }

    accumulator[key].points += toFiniteNumber(kudo.Puntos);
    return accumulator;
  }, {});

  return Object.keys(pointsByAttribute)
    .map((key) => pointsByAttribute[key])
    .sort((first, second) => (
      second.points - first.points ||
      first.label.localeCompare(second.label, 'es')
    ))[0]?.label || '';
};

const getKudoConcept = (attribute: string): string => {
  switch (normalizeKudoAttribute(attribute)) {
    case 'orientado al negocio':
      return 'Colaborador con mayor orientación al negocio';
    case 'empatia':
      return 'Colaborador que más destacó por su empatía';
    case 'agilidad':
      return 'Colaborador que más destacó por su agilidad';
    case 'pensamiento digital':
      return 'Colaborador con mayor orientación al pensamiento digital';
    case 'resolucion de problemas':
      return 'Colaborador destacado en resolución de problemas';
    case 'trabajo en equipo':
      return 'Colaborador que más destacó por su trabajo en equipo';
    default:
      return attribute
        ? `Colaborador destacado en ${attribute.toLocaleLowerCase()}`
        : 'Colaborador con desempeño integral sobresaliente';
  }
};

const createEmptyProductivityRecord = (): IProductivityAgentRecord => ({
  CasosAtendidos: 0,
  CasosATiempo: 0,
  EmisionesTx: 0,
  EmisionesPg: 0,
  MovimientosTx: 0,
  MovimientosPg: 0,
  EscaneoTx: 0,
  EscaneoPg: 0,
  hasCaseSlaData: false
});

const addProductivityRecord = (
  accumulator: IProductivityAgentRecord,
  item: IEvaluacionProductividadItem,
  overlapFactor: number
): void => {
  const values = resolveProductivityMetricValues(item);
  const caseSla = resolveCaseSlaValues(item);

  if (caseSla.hasSlaData) {
    accumulator.CasosAtendidos =
      toFiniteNumber(accumulator.CasosAtendidos) +
      (caseSla.casosAtendidos * overlapFactor);
    accumulator.CasosATiempo =
      toFiniteNumber(accumulator.CasosATiempo) +
      (caseSla.casosATiempo * overlapFactor);
    accumulator.hasCaseSlaData = true;
  }

  PRODUCTIVITY_METRIC_KEYS.forEach((metric) => {
    if (metric === 'Casos') {
      return;
    }

    accumulator[metric] = toFiniteNumber(accumulator[metric]) +
      (values[metric] * overlapFactor);
  });
};

const buildEmployeeMonthCandidate = (
  productividad: ReadonlyArray<IEvaluacionProductividadItem>,
  kudos: ReadonlyArray<IEvaluacionKudoItem>,
  faltas: ReadonlyArray<IFaltaHistorialItem>,
  config: IConfiguracionMetricas,
  allowedAgents: ReadonlyArray<IDirectReport>,
  hasGlobalScope: boolean,
  periodStart: Date,
  periodEnd: Date,
  workingDays: number
): IEmployeeMonthCandidate | undefined => {
  const agents = new Map<string, IEmployeeMonthAccumulator>();
  const getAccumulator = (
    item: IAgentIdentityItem
  ): IEmployeeMonthAccumulator | undefined => {
    const identity = resolveAgent(item, allowedAgents, hasGlobalScope);

    if (!identity) {
      return undefined;
    }

    let accumulator = agents.get(identity.key);

    if (!accumulator) {
      accumulator = {
        ...identity,
        hasProductividad: false,
        metricasProductividad: createEmptyProductivityRecord(),
        puntosProductividad: 0,
        puntosKudos: 0,
        puntosRestados: 0,
        kudos: []
      };
      agents.set(identity.key, accumulator);
    }

    return accumulator;
  };

  productividad.forEach((item) => {
    const agent = getAccumulator(item);
    const overlapFactor = calculateProductivityOverlapFactor(
      item,
      periodStart,
      periodEnd
    );

    if (!agent || overlapFactor <= 0) {
      return;
    }

    agent.hasProductividad = true;
    addProductivityRecord(
      agent.metricasProductividad,
      item,
      overlapFactor
    );
  });

  deduplicateKudos(kudos).forEach((item: IEvaluacionKudoItem) => {
    const agent = getAccumulator(item);

    if (!agent) {
      return;
    }

    agent.puntosKudos += toFiniteNumber(item.Puntos);
    agent.kudos.push(item);
  });

  faltas.forEach((item) => {
    const agent = getAccumulator(item);

    if (!agent) {
      return;
    }

    agent.puntosRestados += getPenalty(item, config);
  });

  const accumulatedAgents = Array.from(agents.values());
  const teamAverages = calculateTeamMetricAverages(
    accumulatedAgents
      .filter((agent) => agent.hasProductividad)
      .map((agent) => agent.metricasProductividad)
  );

  accumulatedAgents.forEach((agent) => {
    agent.puntosProductividad = agent.hasProductividad
      ? calculateAgentProductivity(
        agent.metricasProductividad,
        config,
        teamAverages,
        workingDays
      ).productivityPercentage
      : 0;
  });

  const winner = accumulatedAgents
    .map((agent) => ({
      ...agent,
      puntosTotales:
        agent.puntosProductividad +
        agent.puntosKudos -
        agent.puntosRestados
    }))
    .sort((first, second) => (
      second.puntosTotales - first.puntosTotales ||
      second.puntosKudos - first.puntosKudos ||
      first.name.localeCompare(second.name, 'es')
    ))[0];

  if (!winner) {
    return undefined;
  }

  const predominantAttribute = getPredominantKudoAttribute(winner.kudos);

  return {
    agenteNombre: winner.name,
    agenteEmail: winner.email,
    puntosTotales: winner.puntosTotales,
    puntosKudos: winner.puntosKudos,
    reconocimientosMes: winner.kudos.length,
    conceptoKudo: getKudoConcept(predominantAttribute),
    medals: buildKudoMedals(winner.kudos)
  };
};

const KudosForm: React.FC<IKudosFormProps> = ({
  availableAgents,
  currentUserEmail,
  isLoadingAgents = false,
  remitente,
  userRole
}) => {
  const { hasPermission, hasRole } = useRBAC();
  const canCreateKudo = hasPermission('modulo:kudos:crear');
  const [selectedAgent, setSelectedAgent] = React.useState<
    IDirectReport | undefined
  >();
  const [atributo, setAtributo] = React.useState<string>('');
  const [mensaje, setMensaje] = React.useState<string>('');
  const [fechaReconocimiento, setFechaReconocimiento] =
    React.useState<Date | undefined>(() => new Date());
  const [evidenciaFiles, setEvidenciaFiles] = React.useState<File[]>([]);
  const [evidenciaError, setEvidenciaError] = React.useState<string>('');
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [successMessage, setSuccessMessage] = React.useState<string>('');
  const [errorMessage, setErrorMessage] = React.useState<string>('');
  const [atributoOptions, setAtributoOptions] = React.useState<
    IDropdownOption[]
  >([]);
  const [isLoadingCatalog, setIsLoadingCatalog] =
    React.useState<boolean>(true);
  const [catalogErrorMessage, setCatalogErrorMessage] =
    React.useState<string>('');
  const [activeView, setActiveView] =
    React.useState<string>(NEW_VIEW_KEY);
  const [employeeMonthCandidate, setEmployeeMonthCandidate] =
    React.useState<IEmployeeMonthCandidate | undefined>();
  const [dedicatoria, setDedicatoria] = React.useState<string>('');
  const [dedicatoriaError, setDedicatoriaError] =
    React.useState<string>('');
  const [isLoadingPublication, setIsLoadingPublication] =
    React.useState<boolean>(false);
  const [isPublishing, setIsPublishing] =
    React.useState<boolean>(false);
  const [publicationSuccessMessage, setPublicationSuccessMessage] =
    React.useState<string>('');
  const [publicationErrorMessage, setPublicationErrorMessage] =
    React.useState<string>('');
  const evidenciaInputRef = React.useRef<HTMLInputElement>(null);
  const sharePointService = React.useMemo(() => new SharePointService(), []);
  const currentDate = useCurrentDate();
  const previousMonthPeriod = React.useMemo(
    () => getPreviousMonthPeriod(currentDate),
    [currentDate]
  );
  const canAccessPublication = hasPermission('modulo:kudos:publicar_empleado_mes');
  const [limiteDiaPublicacion, setLimiteDiaPublicacion] = React.useState<number>(5);
  const currentDay = currentDate.getDate();
  const isPublicationWindowOpen =
    hasRole('admin') || (currentDay >= 1 && currentDay <= limiteDiaPublicacion);
  const scopedAgents = availableAgents;
  const isLoadingTeam = isLoadingAgents;

  React.useEffect(() => {
    setSelectedAgent(undefined);
  }, [availableAgents]);

  React.useEffect(() => {
    let isMounted = true;

    const loadKudoCatalog = async (): Promise<void> => {
      try {
        const configuration = await sharePointService.getConfiguracion();
        const sysConfig = await cloudDbClient.getConfiguracionSistema();
        if (isMounted) {
          const limite = sysConfig.limite_dia_publicacion
            ? Number(sysConfig.limite_dia_publicacion)
            : (configuration.LimiteDiaPublicacion ?? 5);
          setLimiteDiaPublicacion(limite);
        }

        const catalogItems: ReadonlyArray<{ Valor: string }> =
          await sharePointService.getCatalogos('Kudo');

        if (!isMounted) {
          return;
        }

        const optionsByAttribute = new Map<string, IDropdownOption>();

        catalogItems.forEach((item) => {
          const value = item.Valor.trim();
          const normalizedValue = normalizeKudoAttribute(value);

          if (value && !optionsByAttribute.has(normalizedValue)) {
            const definition = getKudoMedalDefinition(value);
            optionsByAttribute.set(normalizedValue, {
              key: definition.attribute,
              text: definition.attribute
            });
          }
        });

        const options = Array.from(optionsByAttribute.values());

        setAtributoOptions(options);

        if (options.length === 0) {
          setCatalogErrorMessage(
            'No hay atributos de Kudo configurados. Solicite al Administrador agregar opciones al catálogo.'
          );
        }
      } catch (error: unknown) {
        if (!isMounted) {
          return;
        }

        const detail = error instanceof Error
          ? error.message
          : 'No fue posible consultar el catálogo de Kudos.';

        setAtributoOptions([]);
        setCatalogErrorMessage(
          `${detail} Configure los atributos en el Panel Admin.`
        );
      } finally {
        if (isMounted) {
          setIsLoadingCatalog(false);
        }
      }
    };

    loadKudoCatalog().catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [sharePointService]);

  React.useEffect(() => {
    if (
      activeView !== PUBLICATION_VIEW_KEY ||
      !canAccessPublication
    ) {
      return undefined;
    }

    const isScopeLoading = availableAgents !== undefined
      ? isLoadingAgents
      : isLoadingTeam;

    if (userRole !== 'Admin' && isScopeLoading) {
      setIsLoadingPublication(true);
      return undefined;
    }

    let isMounted = true;

    const loadPublicationPreview = async (): Promise<void> => {
      setIsLoadingPublication(true);
      setPublicationErrorMessage('');
      setPublicationSuccessMessage('');
      setEmployeeMonthCandidate(undefined);

      try {
        const [evaluationData, faltas] = await Promise.all([
          sharePointService.getDatosEvaluacion(
            previousMonthPeriod.startDate,
            previousMonthPeriod.endDate
          ),
          sharePointService.getFaltasHistorial(
            previousMonthPeriod.startDate,
            previousMonthPeriod.endDate
          )
        ]);
        const candidate = buildEmployeeMonthCandidate(
          evaluationData.productividad,
          evaluationData.kudos,
          faltas,
          evaluationData.config,
          scopedAgents,
          userRole === 'Admin',
          previousMonthPeriod.startDate,
          previousMonthPeriod.endDate,
          getWorkingDaysCount(
            previousMonthPeriod.startDate,
            previousMonthPeriod.endDate
          )
        );

        if (isMounted) {
          setEmployeeMonthCandidate(candidate);
        }
      } catch (error: unknown) {
        if (isMounted) {
          const detail = error instanceof Error
            ? error.message
            : 'No fue posible calcular el Empleado del Mes.';
          setPublicationErrorMessage(detail);
        }
      } finally {
        if (isMounted) {
          setIsLoadingPublication(false);
        }
      }
    };

    loadPublicationPreview().catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [
    activeView,
    availableAgents,
    canAccessPublication,
    isLoadingAgents,
    isLoadingTeam,
    previousMonthPeriod,
    scopedAgents,
    sharePointService,
    userRole
  ]);

  const submitKudo = async (): Promise<void> => {
    if (!canCreateKudo) {
      setErrorMessage('No posee permiso para registrar Kudos.');
      return;
    }
    setSuccessMessage('');
    setErrorMessage('');

    if (
      !selectedAgent ||
      !atributo ||
      !mensaje.trim() ||
      !fechaReconocimiento
    ) {
      setErrorMessage('Complete todos los campos obligatorios.');
      return;
    }

    if (evidenciaError) {
      setErrorMessage(
        'Corrija la selección de evidencias antes de enviar el reconocimiento.'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      let puntosPorKudo = 10;

      try {
        const configuration = await sharePointService.getConfiguracion();
        puntosPorKudo = configuration?.PuntosPorKudo || 10;
      } catch {
        // Fallback temporal si la configuración global no está disponible.
        puntosPorKudo = 10;
      }

      const kudoData: IRegistrarKudoData = {
        agente: selectedAgent.name.trim(),
        agenteEmail: selectedAgent.email.trim(),
        agenteObjectId: selectedAgent.id,
        atributo,
        mensaje: mensaje.trim(),
        puntos: puntosPorKudo,
        fecha: fechaReconocimiento,
        remitente,
        remitenteEmail: currentUserEmail
      };

      await sharePointService.registrarKudo(kudoData, evidenciaFiles);

      setSelectedAgent(undefined);
      setAtributo('');
      setMensaje('');
      setFechaReconocimiento(new Date());
      setEvidenciaFiles([]);
      setEvidenciaError('');

      if (evidenciaInputRef.current) {
        evidenciaInputRef.current.value = '';
      }

      setSuccessMessage('Reconocimiento enviado correctamente.');
    } catch (error: unknown) {
      const detail = error instanceof Error
        ? error.message
        : 'Ocurrió un error inesperado al enviar el reconocimiento.';
      setErrorMessage(detail);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    submitKudo().catch((error: unknown) => {
      const detail = error instanceof Error
        ? error.message
        : 'Ocurrió un error inesperado al enviar el reconocimiento.';
      setErrorMessage(detail);
      setIsSubmitting(false);
    });
  };

  const handleEvidenceChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ): void => {
    const selectedFiles = Array.from(event.currentTarget.files || []);
    const MAX_FILE_SIZE_MB = 50;
    const oversizedFiles = selectedFiles.filter(
      (file) => file.size > MAX_FILE_SIZE_MB * 1024 * 1024
    );

    setSuccessMessage('');
    setErrorMessage('');

    if (oversizedFiles.length > 0) {
      setErrorMessage(`El archivo excede el límite permitido de ${MAX_FILE_SIZE_MB} MB.`);
      setEvidenciaFiles([]);
      setEvidenciaError(`El archivo excede el límite permitido de ${MAX_FILE_SIZE_MB} MB.`);
      event.currentTarget.value = '';
      return;
    }

    const rejectedFiles = selectedFiles.filter(
      (file) => !isAllowedEvidenceFile(file)
    );

    if (rejectedFiles.length > 0) {
      setEvidenciaFiles([]);
      setEvidenciaError(
        `Formato no permitido: ${rejectedFiles
          .map((file) => file.name)
          .join(', ')}. Use únicamente PDF, JPG, JPEG o PNG.`
      );
      event.currentTarget.value = '';
      return;
    }

    setEvidenciaFiles(selectedFiles);
    setEvidenciaError('');
  };

  const clearEvidenceFiles = (): void => {
    setEvidenciaFiles([]);
    setEvidenciaError('');

    if (evidenciaInputRef.current) {
      evidenciaInputRef.current.value = '';
    }
  };

  const handleDedicatoriaChange = (
    _event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>,
    value?: string
  ): void => {
    const nextValue = value || '';
    const lineCount = nextValue.replace(/\r/g, '').split('\n').length;

    setDedicatoria(nextValue);
    setDedicatoriaError(
      lineCount > 2
        ? 'La dedicatoria admite un máximo de 2 líneas.'
        : ''
    );
    setPublicationSuccessMessage('');
  };

  const publishEmployeeMonth = async (): Promise<void> => {
    setPublicationErrorMessage('');
    setPublicationSuccessMessage('');

    if (!canAccessPublication) {
      setPublicationErrorMessage(
        'No tiene permisos para publicar el Empleado del Mes.'
      );
      return;
    }

    if (!isPublicationWindowOpen) {
      setPublicationErrorMessage(
        'La publicación para Supervisores está disponible únicamente del día 1 al 5.'
      );
      return;
    }

    if (!employeeMonthCandidate) {
      setPublicationErrorMessage(
        'No existen datos suficientes para determinar un ganador.'
      );
      return;
    }

    if (!employeeMonthCandidate.agenteEmail) {
      setPublicationErrorMessage(
        'El colaborador ganador no tiene un correo de Entra ID asociado.'
      );
      return;
    }

    const normalizedDedication = dedicatoria.trim();
    const dedicationLineCount =
      normalizedDedication.replace(/\r/g, '').split('\n').length;

    if (!normalizedDedication) {
      setPublicationErrorMessage(
        'Escriba unas palabras de reconocimiento antes de publicar.'
      );
      return;
    }

    if (dedicationLineCount > 2 || normalizedDedication.length > 150) {
      setPublicationErrorMessage(
        'La dedicatoria debe tener un máximo de 2 líneas y 150 caracteres.'
      );
      return;
    }

    setIsPublishing(true);

    try {
      const publicationData: IPublicarEmpleadoMesData = {
        mesAno: previousMonthPeriod.mesAno,
        agenteEmail: employeeMonthCandidate.agenteEmail,
        agenteNombre: employeeMonthCandidate.agenteNombre,
        puntosTotales: employeeMonthCandidate.puntosTotales,
        conceptoKudo: employeeMonthCandidate.conceptoKudo,
        dedicatoria: normalizedDedication,
        estado: 'Publicado',
        fechaPublicacion: new Date()
      };

      await sharePointService.publicarEmpleadoMes(publicationData);
      setPublicationSuccessMessage(
        `Empleado del Mes de ${previousMonthPeriod.mesAno} publicado correctamente.`
      );
    } catch (error: unknown) {
      const detail = error instanceof Error
        ? error.message
        : 'Ocurrió un error inesperado durante la publicación.';
      setPublicationErrorMessage(detail);
    } finally {
      setIsPublishing(false);
    }
  };

  const isPublishButtonDisabled =
    !canAccessPublication ||
    isLoadingPublication ||
    isPublishing ||
    !employeeMonthCandidate ||
    !employeeMonthCandidate.agenteEmail ||
    !dedicatoria.trim() ||
    Boolean(dedicatoriaError) ||
    !isPublicationWindowOpen;

  return (
    <div className="space-y-6">
    <PageHeader
      action={(
        <button
          className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-600/20 transition-colors hover:bg-cyan-500"
          onClick={() => setActiveView(NEW_VIEW_KEY)}
          type="button"
        >
          <FilePlus2 aria-hidden="true" size={18} />
          Nuevo reconocimiento
        </button>
      )}
      icon={<Award aria-hidden="true" size={24} />}
      subtitle="Celebra comportamientos destacados y gestiona el reconocimiento mensual del equipo."
      title="Reconocimientos & Cultura Ops"
    />
    <Pivot
      aria-label="Vistas del módulo de reconocimientos"
      className={styles.modulePivot}
      onLinkClick={(item) => {
        const itemKey = item?.props.itemKey;

        if (itemKey) {
          setActiveView(itemKey);
        }
      }}
      selectedKey={activeView}
    >
      <PivotItem headerText="Nuevo reconocimiento" itemKey="nuevo">
        <form className={styles.form} onSubmit={handleSubmit}>
          <SurfaceCard className={styles.formCard}>
            <Stack tokens={{ childrenGap: 15 }}>
            <Text className={styles.title} variant="xLarge">
              Enviar un reconocimiento
            </Text>
            <Text className={styles.description}>
              Destaca una conducta que represente los atributos de Humano Seguros.
            </Text>

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

            {(isLoadingTeam || isLoadingCatalog) && (
              <Stack
                className={styles.loadingRow}
                horizontal
                wrap
                tokens={{ childrenGap: 16 }}
              >
                {isLoadingTeam && (
                  <Spinner
                    label="Cargando colaboradores autorizados..."
                    size={SpinnerSize.small}
                  />
                )}
                {isLoadingCatalog && (
                  <Spinner
                    label="Cargando catálogo de reconocimientos..."
                    size={SpinnerSize.small}
                  />
                )}
              </Stack>
            )}

            <AgentComboBox
              agents={scopedAgents}
              disabled={isSubmitting || isLoadingTeam}
              label="Agente receptor"
              onAgentChange={setSelectedAgent}
              placeholder="Busque por nombre o correo"
              required
              selectedAgent={selectedAgent}
            />

            <Dropdown
              disabled={
                isSubmitting ||
                isLoadingCatalog ||
                atributoOptions.length === 0
              }
              label="Atributo corporativo"
              onChange={(_, option) => setAtributo(String(option?.key || ''))}
              options={atributoOptions}
              placeholder={
                isLoadingCatalog
                  ? 'Cargando opciones...'
                  : atributoOptions.length === 0
                    ? 'Sin opciones registradas (Configurar en Panel Admin)'
                    : 'Seleccione un atributo'
              }
              required
              selectedKey={atributo || undefined}
            />

            <TextField
              disabled={isSubmitting}
              label="Mensaje de reconocimiento"
              multiline
              onChange={(_, value) => setMensaje(value || '')}
              required
              rows={5}
              value={mensaje}
            />

            <DatePicker
              disabled={isSubmitting}
              firstDayOfWeek={DayOfWeek.Monday}
              formatDate={formatRecognitionDate}
              isRequired
              label="Fecha del Reconocimiento"
              onSelectDate={(date) =>
                setFechaReconocimiento(date || undefined)
              }
              placeholder="Seleccione la fecha"
              value={fechaReconocimiento}
            />

            <Stack
              className={styles.evidencePanel}
              tokens={{ childrenGap: 10 }}
            >
              <Stack tokens={{ childrenGap: 3 }}>
                <Text className={styles.evidenceLabel}>
                  Evidencia Adjunta
                </Text>
                <Text className={styles.evidenceHint}>
                  Formatos permitidos: PDF, JPG, JPEG y PNG. Puede seleccionar
                  varios archivos.
                </Text>
              </Stack>

              <input
                accept={EVIDENCE_INPUT_ACCEPT}
                aria-label="Seleccionar evidencias del reconocimiento"
                className={styles.fileInput}
                disabled={isSubmitting}
                multiple
                onChange={handleEvidenceChange}
                ref={evidenciaInputRef}
                type="file"
              />

              <Stack
                horizontal
                verticalAlign="center"
                wrap
                tokens={{ childrenGap: 10 }}
              >
                <DefaultButton
                  disabled={isSubmitting}
                  iconProps={{ iconName: 'Attach' }}
                  onClick={() => evidenciaInputRef.current?.click()}
                  text={
                    evidenciaFiles.length > 0
                      ? 'Cambiar evidencias'
                      : 'Adjuntar evidencias'
                  }
                  type="button"
                />
                {(evidenciaFiles.length > 0 || evidenciaError) && (
                  <DefaultButton
                    disabled={isSubmitting}
                    iconProps={{ iconName: 'Clear' }}
                    onClick={clearEvidenceFiles}
                    text="Limpiar selección"
                    type="button"
                  />
                )}
              </Stack>

              <p className="mt-1 text-xs text-slate-400">
                Límite máximo por archivo: 50 MB (Imágenes y PDFs)
              </p>

              {evidenciaError && (
                <MessageBar messageBarType={MessageBarType.error}>
                  {evidenciaError}
                </MessageBar>
              )}

              {evidenciaFiles.length > 0 && (
                <Stack
                  aria-label={`${evidenciaFiles.length} evidencias seleccionadas`}
                  className={styles.fileList}
                  tokens={{ childrenGap: 6 }}
                >
                  <Text className={styles.fileListTitle}>
                    {evidenciaFiles.length}{' '}
                    {evidenciaFiles.length === 1
                      ? 'archivo seleccionado'
                      : 'archivos seleccionados'}
                  </Text>
                  {evidenciaFiles.map((file) => (
                    <Stack
                      className={styles.fileItem}
                      horizontal
                      key={`${file.name}-${file.size}-${file.lastModified}`}
                      verticalAlign="center"
                    >
                      <Text className={styles.fileName}>{file.name}</Text>
                      <Text className={styles.fileSize}>
                        {formatFileSize(file.size)}
                      </Text>
                    </Stack>
                  ))}
                </Stack>
              )}
            </Stack>

            <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 12 }}>
              <PrimaryButton
                disabled={
                  !canCreateKudo ||
                  isSubmitting ||
                  isLoadingTeam ||
                  isLoadingCatalog ||
                  atributoOptions.length === 0 ||
                  !fechaReconocimiento ||
                  Boolean(evidenciaError)
                }
                text="Enviar reconocimiento"
                type="submit"
              />
              {isSubmitting && (
                <Spinner label="Enviando..." size={SpinnerSize.small} />
              )}
            </Stack>
            </Stack>
          </SurfaceCard>
        </form>
      </PivotItem>

      <PivotItem headerText="Historial y consultas" itemKey="historial">
        <HistorialView
          currentUserEmail={currentUserEmail}
          currentUserName={remitente}
          availableAgents={availableAgents}
          isLoadingAgents={isLoadingAgents}
          moduleType="kudos"
          userRole={userRole}
        />
      </PivotItem>

      {canAccessPublication && (
        <PivotItem
          headerText="Publicar Empleado del Mes"
          itemKey={PUBLICATION_VIEW_KEY}
        >
          <Stack
            className={styles.publicationView}
            tokens={{ childrenGap: 20 }}
          >
            <SurfaceCard className={styles.publicationHeader}>
              <Stack tokens={{ childrenGap: 6 }}>
                <Text className={styles.title} variant="xLarge">
                  Publicar Empleado del Mes
                </Text>
                <Text className={styles.description}>
                  Candidato calculado automáticamente para{' '}
                  <strong>{previousMonthPeriod.mesAno}</strong> con el puntaje
                  integral de productividad, Kudos y penalidades aprobadas.
                </Text>
              </Stack>
            </SurfaceCard>

            {!isPublicationWindowOpen && (
              <MessageBar messageBarType={MessageBarType.info}>
                Los Supervisores pueden publicar únicamente durante los días
                1 al 5 del mes. El Administrador mantiene acceso de validación
                fuera de esa ventana.
              </MessageBar>
            )}

            {publicationSuccessMessage && (
              <MessageBar messageBarType={MessageBarType.success}>
                {publicationSuccessMessage}
              </MessageBar>
            )}

            {publicationErrorMessage && (
              <MessageBar messageBarType={MessageBarType.error}>
                {publicationErrorMessage}
              </MessageBar>
            )}

            {isLoadingPublication ? (
              <Stack
                className={styles.publicationLoading}
                horizontalAlign="center"
                verticalAlign="center"
              >
                <Spinner
                  label={`Calculando candidato de ${previousMonthPeriod.mesAno}...`}
                  size={SpinnerSize.large}
                />
              </Stack>
            ) : employeeMonthCandidate ? (
              <>
                <section
                  aria-label="Métricas del reconocimiento mensual"
                  className="grid grid-cols-1 gap-4 md:grid-cols-3"
                >
                  <KpiCard
                    label="Puntos de atributos"
                    subtext={previousMonthPeriod.mesAno}
                    value={employeeMonthCandidate.puntosKudos.toLocaleString('es-DO', { maximumFractionDigits: 1 })}
                    variant="cyan"
                  />
                  <KpiCard
                    label="Reconocimientos del mes"
                    subtext="Registros reales evaluados"
                    value={employeeMonthCandidate.reconocimientosMes}
                    variant="purple"
                  />
                  <KpiCard
                    label="Puntaje integral"
                    subtext="Productividad + Kudos − penalidades"
                    value={employeeMonthCandidate.puntosTotales.toLocaleString('es-DO', { maximumFractionDigits: 1 })}
                    variant="emerald"
                  />
                </section>
                <Stack tokens={{ childrenGap: 8 }}>
                  <Text className={styles.previewEyebrow}>
                    Vista previa en vivo
                  </Text>
                  <EmployeeMonthCard
                    agenteNombre={employeeMonthCandidate.agenteNombre}
                    conceptoKudo={employeeMonthCandidate.conceptoKudo}
                    dedicatoria={
                      dedicatoria.trim() ||
                      'La dedicatoria del supervisor aparecerá aquí.'
                    }
                    medals={employeeMonthCandidate.medals}
                    mesAno={previousMonthPeriod.mesAno}
                    puntosTotales={employeeMonthCandidate.puntosTotales}
                    previewLabel="Vista previa antes de publicar"
                  />
                </Stack>

                <SurfaceCard className={styles.publicationControls}>
                  <Stack tokens={{ childrenGap: 14 }}>
                  <TextField
                    disabled={isPublishing}
                    errorMessage={dedicatoriaError}
                    label="Palabras de Reconocimiento"
                    maxLength={150}
                    multiline
                    onChange={handleDedicatoriaChange}
                    placeholder="Escriba una dedicatoria breve para el colaborador..."
                    rows={2}
                    value={dedicatoria}
                  />
                  <Text className={styles.characterCounter}>
                    {dedicatoria.length}/150 caracteres · máximo 2 líneas
                  </Text>

                  {!employeeMonthCandidate.agenteEmail && (
                    <MessageBar messageBarType={MessageBarType.warning}>
                      El candidato no tiene un correo de Entra ID asociado.
                      Actualice su identidad antes de publicar.
                    </MessageBar>
                  )}

                  <Stack
                    horizontal
                    verticalAlign="center"
                    tokens={{ childrenGap: 12 }}
                  >
                    <PrimaryButton
                      disabled={isPublishButtonDisabled}
                      iconProps={{ iconName: 'Rocket' }}
                      onClick={() => {
                        publishEmployeeMonth().catch(() => undefined);
                      }}
                      text="Publicar Empleado del Mes"
                    />
                    {isPublishing && (
                      <Spinner
                        label="Publicando..."
                        size={SpinnerSize.small}
                      />
                    )}
                  </Stack>
                  </Stack>
                </SurfaceCard>
              </>
            ) : (
              <MessageBar messageBarType={MessageBarType.info}>
                No hay datos suficientes dentro de{' '}
                {previousMonthPeriod.mesAno} para determinar un ganador.
              </MessageBar>
            )}
          </Stack>
        </PivotItem>
      )}

      <PivotItem headerText="Histórico Empleado del Mes" itemKey="historicoEmpleadoMes">
        <EmpleadoMesHistorialView />
      </PivotItem>
    </Pivot>
    </div>
  );
};

export default KudosForm;
