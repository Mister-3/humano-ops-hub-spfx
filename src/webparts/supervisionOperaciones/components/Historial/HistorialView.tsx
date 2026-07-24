import * as React from 'react';
import {
  DatePicker,
  DefaultButton,
  DetailsList,
  DetailsListLayoutMode,
  Dropdown,
  type IColumn,
  type IDropdownOption,
  MessageBar,
  MessageBarType,
  PrimaryButton,
  SelectionMode,
  Stack,
  Text
} from '@fluentui/react';

import type { RoleType } from '../../models/AppModels';
import type GraphService from '../../services/GraphService';
import type { IDirectReport } from '../../services/GraphService';
import SharePointService, {
  type ICatalogoItem,
  type IFaltaHistorialItem,
  type IKudoHistorialItem,
  type IProductividadHistorialItem
} from '../../services/SharePointService';
import { SkeletonLoader } from '../Common/SkeletonLoader';
import styles from './HistorialView.module.scss';

export type HistorialModuleType = 'faltas' | 'kudos' | 'productividad';

export interface IHistorialViewProps {
  availableAgents?: ReadonlyArray<IDirectReport>;
  currentUserEmail: string;
  currentUserName: string;
  graphService: GraphService;
  isLoadingAgents?: boolean;
  moduleType: HistorialModuleType;
  userRole: RoleType;
}

type HistorialItem =
  | IFaltaHistorialItem
  | IKudoHistorialItem
  | IProductividadHistorialItem;

interface ISummaryMetric {
  label: string;
  value: string;
}

const ALL_AGENTS_KEY = '__all_agents__';
const TEAM_AGENTS_KEY = '__team_agents__';
const ALL_CATEGORIES_KEY = '__all_categories__';
const ALL_CATEGORY_DETAILS_KEY = '__all_category_details__';

const fallbackErrorProcessOptions: ReadonlyArray<string> = [
  'Error de Digitación',
  'Incumplimiento SLA',
  'Procedimiento Incompleto',
  'Omisión de Verificación'
];

const fallbackAreaProcessOptions: ReadonlyArray<string> = [
  'Emisiones',
  'Movimientos',
  'Reclamaciones',
  'Servicio al Cliente'
];

const fallbackFaltaCategoryOptions: IDropdownOption[] = [
  { key: ALL_CATEGORIES_KEY, text: 'Todas' },
  { key: 'Tardanza', text: 'Tardanza' },
  { key: 'Ausencia Injustificada', text: 'Ausencia Injustificada' },
  { key: 'Error en proceso', text: 'Error en proceso' },
  { key: 'Violación de Política', text: 'Violación de Política' },
  { key: 'Capacitación', text: 'Capacitación' }
];

const getAgentKey = (agent: IDirectReport): string => {
  const identity = agent.email.trim().toLocaleLowerCase() ||
    agent.id.trim() ||
    agent.name.trim().toLocaleLowerCase();

  return `agent:${identity}`;
};

const matchesAgentIdentity = (
  item: HistorialItem,
  agent: IDirectReport
): boolean => {
  const itemEmail = item.AgenteEmail?.trim().toLocaleLowerCase() || '';
  const agentEmail = agent.email.trim().toLocaleLowerCase();

  if (itemEmail && agentEmail && itemEmail === agentEmail) {
    return true;
  }

  const itemObjectId =
    item.AgenteObjectID?.trim().toLocaleLowerCase() || '';
  const agentObjectId = agent.id.trim().toLocaleLowerCase();

  if (
    itemObjectId &&
    agentObjectId &&
    itemObjectId === agentObjectId
  ) {
    return true;
  }

  if (itemEmail || itemObjectId) {
    return false;
  }

  return Boolean(
    item.Title?.trim() &&
    item.Title.trim().toLocaleLowerCase() ===
      agent.name.trim().toLocaleLowerCase()
  );
};

const toAgentOptions = (
  agents: ReadonlyArray<IDirectReport>
): IDropdownOption[] => agents.map((agent) => ({
  key: getAgentKey(agent),
  text: agent.email
    ? `${agent.name} · ${agent.email}`
    : agent.name
}));

const toCategoryOptions = (
  items: ReadonlyArray<ICatalogoItem>
): IDropdownOption[] => {
  const seenValues: { [normalizedValue: string]: boolean } = {};
  const options = items
    .map((item) => item.Valor.trim())
    .filter((value) => {
      const normalizedValue = value.toLocaleLowerCase();

      if (!value || seenValues[normalizedValue]) {
        return false;
      }

      seenValues[normalizedValue] = true;
      return true;
    })
    .sort((left, right) => left.localeCompare(right, 'es'))
    .map((value): IDropdownOption => ({ key: value, text: value }));

  return [{ key: ALL_CATEGORIES_KEY, text: 'Todas' }, ...options];
};

const normalizeCatalogValue = (value?: string): string => (
  value
    ?.trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase() || ''
);

const getDetailCatalog = (
  category: string
): 'ErrorProceso' | 'ProcesoArea' | undefined => {
  switch (normalizeCatalogValue(category)) {
    case 'error en proceso':
      return 'ErrorProceso';
    case 'capacitacion':
      return 'ProcesoArea';
    default:
      return undefined;
  }
};

const toCategoryDetailOptions = (
  values: ReadonlyArray<string>,
  catalog: 'ErrorProceso' | 'ProcesoArea'
): IDropdownOption[] => {
  const seenValues: { [normalizedValue: string]: boolean } = {};
  const options = values
    .map((value) => value.trim())
    .filter((value) => {
      const normalizedValue = normalizeCatalogValue(value);

      if (!normalizedValue || seenValues[normalizedValue]) {
        return false;
      }

      seenValues[normalizedValue] = true;
      return true;
    })
    .sort((left, right) => left.localeCompare(right, 'es'))
    .map((value): IDropdownOption => ({ key: value, text: value }));
  const allLabel = catalog === 'ErrorProceso'
    ? 'Todas las subcategorías'
    : 'Todos los procesos';

  return [
    { key: ALL_CATEGORY_DETAILS_KEY, text: allLabel },
    ...options
  ];
};

const getInitialStartDate = (): Date => {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), 1);
};

const normalizeStartDate = (date: Date): Date => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

const normalizeEndDate = (date: Date): Date => {
  const normalized = new Date(date);
  normalized.setHours(23, 59, 59, 999);
  return normalized;
};

const padDatePart = (value: number): string => value < 10 ? `0${value}` : String(value);

const formatDateValue = (value: string): string => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return `${padDatePart(date.getDate())}/${padDatePart(date.getMonth() + 1)}/${date.getFullYear()}`;
};

const formatPickerDate = (date?: Date): string => {
  if (!date) {
    return '';
  }

  return `${padDatePart(date.getDate())}/${padDatePart(date.getMonth() + 1)}/${date.getFullYear()}`;
};

const formatNumber = (value: number): string => value.toLocaleString('es-DO', {
  maximumFractionDigits: 2
});

const isFaltaItem = (item: HistorialItem): item is IFaltaHistorialItem => (
  'FechaFalta' in item
);

const isKudoItem = (item: HistorialItem): item is IKudoHistorialItem => (
  'FechaKudo' in item
);

const isProductividadItem = (
  item: HistorialItem
): item is IProductividadHistorialItem => 'FechaRegistro' in item;

const getItemDate = (item: HistorialItem): string => {
  if (isFaltaItem(item)) {
    return item.FechaFalta;
  }

  if (isKudoItem(item)) {
    return item.FechaKudo;
  }

  return item.FechaInicio || item.FechaRegistro;
};

const getImpactBadgeClass = (impacto: string): string => {
  switch (impacto.trim().toLocaleLowerCase()) {
    case 'bajo':
      return styles.badgeLow;
    case 'medio':
      return styles.badgeMedium;
    case 'crítico':
    case 'critico':
      return styles.badgeCritical;
    default:
      return styles.badgeNeutral;
  }
};

const getStatusBadgeClass = (estado: string): string => {
  switch (estado.trim().toLocaleLowerCase()) {
    case 'aprobado':
      return styles.badgeApproved;
    case 'borrador':
      return styles.badgeDraft;
    case 'rechazado':
      return styles.badgeRejected;
    default:
      return styles.badgeNeutral;
  }
};

const createFaltasColumns = (): IColumn[] => [
  {
    key: 'fecha',
    name: 'Fecha',
    minWidth: 90,
    maxWidth: 105,
    onRender: (item?: IFaltaHistorialItem) => (
      <Text>{item ? formatDateValue(item.FechaFalta) : '—'}</Text>
    )
  },
  {
    fieldName: 'Title',
    isResizable: true,
    key: 'agente',
    minWidth: 145,
    name: 'Agente'
  },
  {
    key: 'agenteEmail',
    minWidth: 210,
    name: 'Correo del agente',
    onRender: (item?: IFaltaHistorialItem) => (
      <Text className={styles.identityCell}>
        {item?.AgenteEmail || '—'}
      </Text>
    )
  },
  {
    key: 'agenteObjectId',
    minWidth: 180,
    name: 'Object ID Entra ID',
    onRender: (item?: IFaltaHistorialItem) => (
      <Text className={styles.identityCell} title={item?.AgenteObjectID}>
        {item?.AgenteObjectID || '—'}
      </Text>
    )
  },
  {
    fieldName: 'Categoria',
    isResizable: true,
    key: 'categoria',
    minWidth: 135,
    name: 'Categoría'
  },
  {
    fieldName: 'Subcategoria',
    isResizable: true,
    key: 'subcategoria',
    minWidth: 150,
    name: 'Subcategoría',
    onRender: (item?: IFaltaHistorialItem) => (
      <Text>{item?.Subcategoria || '—'}</Text>
    )
  },
  {
    fieldName: 'CasoRef',
    isResizable: true,
    key: 'casoRef',
    minWidth: 145,
    name: 'Caso Helpdesk / Calidad',
    onRender: (item?: IFaltaHistorialItem) => (
      <Text>{item?.CasoRef || '—'}</Text>
    )
  },
  {
    fieldName: 'ProcesoArea',
    isResizable: true,
    key: 'procesoArea',
    minWidth: 160,
    name: 'Proceso del Área',
    onRender: (item?: IFaltaHistorialItem) => (
      <Text>{item?.ProcesoArea || '—'}</Text>
    )
  },
  {
    key: 'comentarios',
    minWidth: 220,
    name: 'Comentarios / Observaciones',
    onRender: (item?: IFaltaHistorialItem) => (
      <span
        className={styles.messageCell}
        title={item?.Comentarios || item?.ComentariosCapacitacion}
      >
        {item?.Comentarios || item?.ComentariosCapacitacion || '—'}
      </span>
    )
  },
  {
    key: 'impacto',
    name: 'Impacto',
    minWidth: 90,
    onRender: (item?: IFaltaHistorialItem) => item && (
      <span className={`${styles.badge} ${getImpactBadgeClass(item.Impacto)}`}>
        {item.Impacto}
      </span>
    )
  },
  {
    key: 'estado',
    name: 'Estado',
    minWidth: 95,
    onRender: (item?: IFaltaHistorialItem) => item && (
      <span className={`${styles.badge} ${getStatusBadgeClass(item.Estado)}`}>
        {item.Estado}
      </span>
    )
  },
  {
    fieldName: 'RolOriginador',
    isResizable: true,
    key: 'rolOriginador',
    minWidth: 105,
    name: 'Rol originador'
  }
];

const createKudosColumns = (): IColumn[] => [
  {
    key: 'fecha',
    name: 'Fecha',
    minWidth: 90,
    maxWidth: 105,
    onRender: (item?: IKudoHistorialItem) => (
      <Text>{item ? formatDateValue(item.FechaKudo) : '—'}</Text>
    )
  },
  {
    fieldName: 'Title',
    isResizable: true,
    key: 'agente',
    minWidth: 140,
    name: 'Agente receptor'
  },
  {
    key: 'agenteEmail',
    minWidth: 210,
    name: 'Correo del agente',
    onRender: (item?: IKudoHistorialItem) => (
      <Text className={styles.identityCell}>
        {item?.AgenteEmail || '—'}
      </Text>
    )
  },
  {
    key: 'agenteObjectId',
    minWidth: 180,
    name: 'Object ID Entra ID',
    onRender: (item?: IKudoHistorialItem) => (
      <Text className={styles.identityCell} title={item?.AgenteObjectID}>
        {item?.AgenteObjectID || '—'}
      </Text>
    )
  },
  {
    fieldName: 'Atributo',
    isResizable: true,
    key: 'atributo',
    minWidth: 140,
    name: 'Atributo'
  },
  {
    key: 'mensaje',
    name: 'Mensaje',
    minWidth: 210,
    isResizable: true,
    onRender: (item?: IKudoHistorialItem) => (
      <span className={styles.messageCell} title={item?.Mensaje}>
        {item?.Mensaje || '—'}
      </span>
    )
  },
  {
    key: 'puntos',
    name: 'Puntos',
    minWidth: 70,
    maxWidth: 85,
    onRender: (item?: IKudoHistorialItem) => (
      <span className={`${styles.badge} ${styles.badgePoints}`}>
        +{formatNumber(item?.Puntos || 0)}
      </span>
    )
  },
  {
    fieldName: 'Remitente',
    isResizable: true,
    key: 'remitente',
    minWidth: 130,
    name: 'Enviado por'
  }
];

const createProductividadColumns = (): IColumn[] => [
  {
    key: 'fechaInicio',
    name: 'Fecha Inicio',
    minWidth: 90,
    maxWidth: 105,
    onRender: (item?: IProductividadHistorialItem) => (
      <Text>
        {item
          ? formatDateValue(item.FechaInicio || item.FechaRegistro)
          : '—'}
      </Text>
    )
  },
  {
    key: 'fechaFin',
    name: 'Fecha Fin',
    minWidth: 90,
    maxWidth: 105,
    onRender: (item?: IProductividadHistorialItem) => (
      <Text>
        {item
          ? formatDateValue(
              item.FechaFin || item.FechaInicio || item.FechaRegistro
            )
          : '—'}
      </Text>
    )
  },
  {
    fieldName: 'Title',
    isResizable: true,
    key: 'agente',
    minWidth: 160,
    name: 'Agente'
  },
  {
    key: 'agenteEmail',
    minWidth: 210,
    name: 'Correo del agente',
    onRender: (item?: IProductividadHistorialItem) => (
      <Text className={styles.identityCell}>
        {item?.AgenteEmail || '—'}
      </Text>
    )
  },
  {
    key: 'agenteObjectId',
    minWidth: 180,
    name: 'Object ID Entra ID',
    onRender: (item?: IProductividadHistorialItem) => (
      <Text className={styles.identityCell} title={item?.AgenteObjectID}>
        {item?.AgenteObjectID || '—'}
      </Text>
    )
  },
  {
    key: 'casos',
    name: 'Casos',
    minWidth: 85,
    onRender: (item?: IProductividadHistorialItem) => (
      <Text>{formatNumber(item?.Casos || 0)}</Text>
    )
  },
  {
    key: 'emisiones',
    name: 'Emisiones',
    minWidth: 90,
    onRender: (item?: IProductividadHistorialItem) => (
      <Text>{formatNumber(item?.Emisiones || 0)}</Text>
    )
  },
  {
    key: 'movimientos',
    name: 'Movimientos',
    minWidth: 105,
    onRender: (item?: IProductividadHistorialItem) => (
      <Text>{formatNumber(item?.Movimientos || 0)}</Text>
    )
  },
  {
    key: 'total',
    name: 'Total operaciones',
    minWidth: 115,
    onRender: (item?: IProductividadHistorialItem) => (
      <strong className={styles.totalValue}>
        {formatNumber(
          (item?.Casos || 0) +
          (item?.Emisiones || 0) +
          (item?.Movimientos || 0)
        )}
      </strong>
    )
  }
];

const escapeCsvValue = (value: string | number): string => (
  `"${String(value).replace(/"/g, '""')}"`
);

const HistorialView: React.FC<IHistorialViewProps> = ({
  availableAgents,
  currentUserEmail,
  currentUserName,
  graphService,
  isLoadingAgents = false,
  moduleType,
  userRole
}) => {
  const [startDate, setStartDate] = React.useState<Date | undefined>(
    getInitialStartDate()
  );
  const [endDate, setEndDate] = React.useState<Date | undefined>(new Date());
  const [selectedAgent, setSelectedAgent] = React.useState<string>('');
  const [selectedCategory, setSelectedCategory] = React.useState<string>(
    ALL_CATEGORIES_KEY
  );
  const [selectedCategoryDetail, setSelectedCategoryDetail] =
    React.useState<string>(ALL_CATEGORY_DETAILS_KEY);
  const [allowedAgents, setAllowedAgents] =
    React.useState<IDirectReport[]>([]);
  const [agentOptions, setAgentOptions] = React.useState<IDropdownOption[]>([]);
  const [categoryOptions, setCategoryOptions] =
    React.useState<IDropdownOption[]>(fallbackFaltaCategoryOptions);
  const [categoryDetailOptions, setCategoryDetailOptions] =
    React.useState<IDropdownOption[]>([]);
  const [items, setItems] = React.useState<HistorialItem[]>([]);
  const [isLoadingTeam, setIsLoadingTeam] = React.useState<boolean>(true);
  const [isLoadingCategories, setIsLoadingCategories] =
    React.useState<boolean>(moduleType === 'faltas');
  const [isLoadingCategoryDetails, setIsLoadingCategoryDetails] =
    React.useState<boolean>(false);
  const [isLoadingQuery, setIsLoadingQuery] = React.useState<boolean>(false);
  const [hasSearched, setHasSearched] = React.useState<boolean>(false);
  const [errorMessage, setErrorMessage] = React.useState<string>('');
  const [catalogWarning, setCatalogWarning] = React.useState<string>('');
  const [categoryDetailWarning, setCategoryDetailWarning] =
    React.useState<string>('');
  const sharePointService = React.useMemo(() => new SharePointService(), []);

  const isAdministrator = userRole === 'Admin';
  const isTeamManager = userRole === 'Supervisor' || userRole === 'Gerente';
  const isRestrictedToSelf = userRole === 'Asistente' || userRole === 'Oficial';

  React.useEffect(() => {
    let isMounted = true;

    const loadAgentScope = async (): Promise<void> => {
      setIsLoadingTeam(availableAgents !== undefined
        ? isLoadingAgents
        : true);
      setErrorMessage('');
      setItems([]);
      setHasSearched(false);
      setAllowedAgents([]);
      setAgentOptions([]);
      setSelectedAgent('');

      try {
        if (isRestrictedToSelf) {
          const ownName = currentUserName.trim();
          const ownEmail = currentUserEmail.trim();
          const ownIdentity: IDirectReport = {
            email: ownEmail,
            id: '',
            name: ownName
          };

          if (isMounted) {
            const hasIdentity = Boolean(ownName || ownEmail);
            setAllowedAgents(hasIdentity ? [ownIdentity] : []);
            setAgentOptions(hasIdentity ? toAgentOptions([ownIdentity]) : []);
            setSelectedAgent(hasIdentity ? getAgentKey(ownIdentity) : '');
          }

          return;
        }

        const users = availableAgents !== undefined
          ? availableAgents
          : isAdministrator
            ? await graphService.getAllUsers()
            : await graphService.getDirectReports();
        const seenIdentities: { [identity: string]: boolean } = {};
        const uniqueUsers = users
          .map((user): IDirectReport => ({
            ...user,
            email: user.email.trim(),
            id: user.id.trim(),
            name: user.name.trim()
          }))
          .filter((user) => {
            const identity = getAgentKey(user);

            if (!user.name || seenIdentities[identity]) {
              return false;
            }

            seenIdentities[identity] = true;
            return true;
          })
          .sort((left, right) => left.name.localeCompare(right.name, 'es'));
        const scopeOption: IDropdownOption = isAdministrator
          ? { key: ALL_AGENTS_KEY, text: 'Todos los Agentes' }
          : { key: TEAM_AGENTS_KEY, text: 'Todo mi equipo' };

        if (isMounted) {
          setAllowedAgents(uniqueUsers);
          setAgentOptions([
            scopeOption,
            ...toAgentOptions(uniqueUsers)
          ]);
          setSelectedAgent(String(scopeOption.key));
        }
      } catch (error: unknown) {
        if (isMounted) {
          const detail = error instanceof Error
            ? error.message
            : 'No fue posible cargar los agentes disponibles.';
          setAllowedAgents([]);
          setAgentOptions([]);
          setSelectedAgent('');
          setErrorMessage(detail);
        }
      } finally {
        if (isMounted) {
          setIsLoadingTeam(
            availableAgents !== undefined && isLoadingAgents
          );
        }
      }
    };

    loadAgentScope().catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [
    availableAgents,
    currentUserEmail,
    currentUserName,
    graphService,
    isAdministrator,
    isLoadingAgents,
    isRestrictedToSelf
  ]);

  React.useEffect(() => {
    let isMounted = true;

    if (moduleType !== 'faltas') {
      setIsLoadingCategories(false);
      return () => {
        isMounted = false;
      };
    }

    const loadCategories = async (): Promise<void> => {
      setIsLoadingCategories(true);
      setCatalogWarning('');

      try {
        const categories = await sharePointService.getCatalogos('Falta');

        if (isMounted) {
          const loadedOptions = toCategoryOptions(categories);
          setCategoryOptions(loadedOptions);

          if (loadedOptions.length === 1) {
            setCatalogWarning(
              'No hay categorías configuradas; el filtro mostrará todos los registros.'
            );
          }
        }
      } catch (error: unknown) {
        if (isMounted) {
          const detail = error instanceof Error
            ? error.message
            : 'No fue posible cargar las categorías.';
          setCategoryOptions(fallbackFaltaCategoryOptions);
          setCatalogWarning(
            `${detail} Se utilizarán temporalmente las opciones base.`
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingCategories(false);
        }
      }
    };

    loadCategories().catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [moduleType, sharePointService]);

  React.useEffect(() => {
    let isMounted = true;
    const detailCatalog = moduleType === 'faltas'
      ? getDetailCatalog(selectedCategory)
      : undefined;

    setSelectedCategoryDetail(ALL_CATEGORY_DETAILS_KEY);
    setCategoryDetailOptions([]);
    setCategoryDetailWarning('');

    if (!detailCatalog) {
      setIsLoadingCategoryDetails(false);

      return () => {
        isMounted = false;
      };
    }

    const loadCategoryDetails = async (): Promise<void> => {
      setIsLoadingCategoryDetails(true);

      try {
        const catalogItems = await sharePointService.getCatalogos(
          detailCatalog
        );

        if (!isMounted) {
          return;
        }

        const loadedOptions = toCategoryDetailOptions(
          catalogItems.map((item) => item.Valor),
          detailCatalog
        );
        setCategoryDetailOptions(loadedOptions);

        if (loadedOptions.length === 1) {
          setCategoryDetailWarning(
            detailCatalog === 'ErrorProceso'
              ? 'No hay subcategorías de error configuradas.'
              : 'No hay procesos del área configurados.'
          );
        }
      } catch (error: unknown) {
        if (!isMounted) {
          return;
        }

        const detail = error instanceof Error
          ? error.message
          : 'No fue posible cargar el filtro dependiente.';
        const fallbackValues = detailCatalog === 'ErrorProceso'
          ? fallbackErrorProcessOptions
          : fallbackAreaProcessOptions;

        setCategoryDetailOptions(
          toCategoryDetailOptions(fallbackValues, detailCatalog)
        );
        setCategoryDetailWarning(
          `${detail} Se utilizarán temporalmente las opciones base.`
        );
      } finally {
        if (isMounted) {
          setIsLoadingCategoryDetails(false);
        }
      }
    };

    loadCategoryDetails().catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [moduleType, selectedCategory, sharePointService]);

  const columns = React.useMemo((): IColumn[] => {
    switch (moduleType) {
      case 'faltas':
        return createFaltasColumns();
      case 'kudos':
        return createKudosColumns();
      case 'productividad':
        return createProductividadColumns();
    }
  }, [moduleType]);

  const getRecords = async (
    normalizedStart: Date,
    normalizedEnd: Date,
    agent?: IDirectReport
  ): Promise<HistorialItem[]> => {
    switch (moduleType) {
      case 'faltas':
        return sharePointService.getFaltasHistorial(
          normalizedStart,
          normalizedEnd,
          agent?.name,
          selectedCategory === ALL_CATEGORIES_KEY
            ? undefined
            : selectedCategory,
          agent?.email,
          agent?.id
        );
      case 'kudos':
        return sharePointService.getKudosHistorial(
          normalizedStart,
          normalizedEnd,
          agent?.name,
          agent?.email,
          agent?.id
        );
      case 'productividad':
        return sharePointService.getProductividadHistorial(
          normalizedStart,
          normalizedEnd,
          agent?.name,
          agent?.email,
          agent?.id
        );
    }
  };

  const queryRecords = async (): Promise<void> => {
    setErrorMessage('');

    if (!startDate || !endDate) {
      setErrorMessage('Seleccione una fecha de inicio y una fecha de fin.');
      return;
    }

    const normalizedStart = normalizeStartDate(startDate);
    const normalizedEnd = normalizeEndDate(endDate);

    if (normalizedStart.getTime() > normalizedEnd.getTime()) {
      setErrorMessage('La fecha de inicio no puede ser posterior a la fecha de fin.');
      return;
    }

    if (!selectedAgent) {
      setErrorMessage('Seleccione el alcance de agentes que desea consultar.');
      return;
    }

    setIsLoadingQuery(true);
    setHasSearched(true);

    try {
      let records: HistorialItem[];

      if (isAdministrator && selectedAgent === ALL_AGENTS_KEY) {
        records = await getRecords(normalizedStart, normalizedEnd);
      } else if (isTeamManager && selectedAgent === TEAM_AGENTS_KEY) {
        const rangeRecords = await getRecords(
          normalizedStart,
          normalizedEnd
        );
        records = rangeRecords.filter((item) =>
          allowedAgents.some((agent) => matchesAgentIdentity(item, agent))
        );
      } else {
        const enforcedAgent = isRestrictedToSelf
          ? allowedAgents[0]
          : allowedAgents.find(
            (agent) => getAgentKey(agent) === selectedAgent
          );

        if (!enforcedAgent) {
          throw new Error('No se pudo determinar el usuario autorizado para la consulta.');
        }

        if (
          !isAdministrator &&
          !isRestrictedToSelf &&
          allowedAgents.every(
            (agent) => getAgentKey(agent) !== getAgentKey(enforcedAgent)
          )
        ) {
          throw new Error('El agente seleccionado no pertenece a su ámbito autorizado.');
        }

        records = await getRecords(normalizedStart, normalizedEnd, enforcedAgent);
      }

      if (
        moduleType === 'faltas' &&
        selectedCategoryDetail !== ALL_CATEGORY_DETAILS_KEY
      ) {
        const detailCatalog = getDetailCatalog(selectedCategory);
        const normalizedDetail = normalizeCatalogValue(
          selectedCategoryDetail
        );

        records = records.filter((item) => {
          if (!isFaltaItem(item)) {
            return false;
          }

          const itemValue = detailCatalog === 'ErrorProceso'
            ? item.Subcategoria
            : detailCatalog === 'ProcesoArea'
              ? item.ProcesoArea
              : undefined;

          return normalizeCatalogValue(itemValue) === normalizedDetail;
        });
      }

      records.sort((left, right) => (
        new Date(getItemDate(right)).getTime() - new Date(getItemDate(left)).getTime()
      ));
      setItems(records);
    } catch (error: unknown) {
      const detail = error instanceof Error
        ? error.message
        : 'Ocurrió un error inesperado al consultar el historial.';
      setItems([]);
      setErrorMessage(detail);
    } finally {
      setIsLoadingQuery(false);
    }
  };

  const getCsvRows = (): Array<Array<string | number>> => {
    switch (moduleType) {
      case 'faltas':
        return [
          [
            'Fecha',
            'Agente',
            'Correo del agente',
            'Object ID Entra ID',
            'Categoría',
            'Subcategoría',
            'Caso Helpdesk / Calidad',
            'Proceso del Área',
            'Comentarios / Observaciones',
            'Impacto',
            'Estado',
            'Rol originador'
          ],
          ...items.filter(isFaltaItem).map((item) => [
            formatDateValue(item.FechaFalta),
            item.Title,
            item.AgenteEmail || '',
            item.AgenteObjectID || '',
            item.Categoria,
            item.Subcategoria || '',
            item.CasoRef || '',
            item.ProcesoArea || '',
            item.Comentarios || item.ComentariosCapacitacion || '',
            item.Impacto,
            item.Estado,
            item.RolOriginador
          ])
        ];
      case 'kudos':
        return [
          [
            'Fecha',
            'Agente receptor',
            'Correo del agente',
            'Object ID Entra ID',
            'Atributo',
            'Mensaje',
            'Puntos',
            'Enviado por'
          ],
          ...items.filter(isKudoItem).map((item) => [
            formatDateValue(item.FechaKudo),
            item.Title,
            item.AgenteEmail || '',
            item.AgenteObjectID || '',
            item.Atributo,
            item.Mensaje,
            item.Puntos,
            item.Remitente
          ])
        ];
      case 'productividad':
        return [
          [
            'Fecha Inicio',
            'Fecha Fin',
            'Agente',
            'Correo del agente',
            'Object ID Entra ID',
            'Casos',
            'Emisiones',
            'Movimientos',
            'Total operaciones'
          ],
          ...items.filter(isProductividadItem).map((item) => [
            formatDateValue(item.FechaInicio || item.FechaRegistro),
            formatDateValue(
              item.FechaFin || item.FechaInicio || item.FechaRegistro
            ),
            item.Title,
            item.AgenteEmail || '',
            item.AgenteObjectID || '',
            item.Casos,
            item.Emisiones,
            item.Movimientos,
            item.Casos + item.Emisiones + item.Movimientos
          ])
        ];
    }
  };

  const exportToCsv = (): void => {
    if (items.length === 0) {
      return;
    }

    const csvContent = getCsvRows()
      .map((row) => row.map(escapeCsvValue).join(','))
      .join('\r\n');
    const blob = new Blob([`\uFEFF${csvContent}`], {
      type: 'text/csv;charset=utf-8'
    });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const exportDate = new Date().toISOString().slice(0, 10);

    link.href = objectUrl;
    link.download = `historial_${moduleType}_${exportDate}.csv`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  };

  const summaryMetrics = React.useMemo((): ISummaryMetric[] => {
    if (moduleType === 'faltas') {
      const faltas = items.filter(isFaltaItem);

      return [
        { label: 'Registros', value: formatNumber(faltas.length) },
        {
          label: 'Aprobadas',
          value: formatNumber(faltas.filter((item) => item.Estado === 'Aprobado').length)
        },
        {
          label: 'Impacto crítico',
          value: formatNumber(faltas.filter((item) => (
            item.Impacto.toLocaleLowerCase() === 'crítico' ||
            item.Impacto.toLocaleLowerCase() === 'critico'
          )).length)
        }
      ];
    }

    if (moduleType === 'kudos') {
      const kudos = items.filter(isKudoItem);
      const totalPoints = kudos.reduce((total, item) => total + item.Puntos, 0);
      const uniqueAgents = new Set(kudos.map(
        (item) => item.AgenteEmail?.trim().toLocaleLowerCase() || item.Title
      )).size;

      return [
        { label: 'Reconocimientos', value: formatNumber(kudos.length) },
        { label: 'Puntos otorgados', value: formatNumber(totalPoints) },
        { label: 'Agentes reconocidos', value: formatNumber(uniqueAgents) }
      ];
    }

    const productividad = items.filter(isProductividadItem);

    return [
      {
        label: 'Casos',
        value: formatNumber(productividad.reduce((total, item) => total + item.Casos, 0))
      },
      {
        label: 'Emisiones',
        value: formatNumber(productividad.reduce(
          (total, item) => total + item.Emisiones,
          0
        ))
      },
      {
        label: 'Movimientos',
        value: formatNumber(productividad.reduce(
          (total, item) => total + item.Movimientos,
          0
        ))
      }
    ];
  }, [items, moduleType]);

  const moduleTitle = moduleType === 'faltas'
    ? 'Historial de faltas'
    : moduleType === 'kudos'
      ? 'Historial de reconocimientos'
      : 'Historial de productividad';
  const isQueryDisabled = isLoadingTeam || isLoadingQuery ||
    isLoadingCategories || isLoadingCategoryDetails || !selectedAgent ||
    (isRestrictedToSelf && !currentUserName.trim() && !currentUserEmail.trim());
  const isLoadingHistoryData = isLoadingTeam ||
    isLoadingCategories ||
    isLoadingCategoryDetails ||
    isLoadingQuery;
  const loadingLabel = isLoadingQuery
    ? 'Consultando registros en SharePoint...'
    : isLoadingTeam
      ? 'Cargando alcance de agentes...'
      : isLoadingCategories
        ? 'Cargando categorías...'
        : 'Cargando subcategorías y procesos...';

  return (
    <Stack className={styles.historyCard} tokens={{ childrenGap: 20 }}>
      <Stack tokens={{ childrenGap: 4 }}>
        <Text className={styles.title} variant="xLarge">
          {moduleTitle}
        </Text>
        <Text className={styles.description}>
          Consulte registros por fecha y dentro del alcance permitido para su rol.
        </Text>
      </Stack>

      {errorMessage && (
        <MessageBar messageBarType={MessageBarType.error}>
          {errorMessage}
        </MessageBar>
      )}

      {catalogWarning && (
        <MessageBar messageBarType={MessageBarType.warning}>
          {catalogWarning}
        </MessageBar>
      )}

      {categoryDetailWarning && (
        <MessageBar messageBarType={MessageBarType.warning}>
          {categoryDetailWarning}
        </MessageBar>
      )}

      <Stack className={styles.filterBar} tokens={{ childrenGap: 16 }}>
        <Stack
          horizontal
          wrap
          tokens={{ childrenGap: 16 }}
          verticalAlign="end"
        >
          <DatePicker
            className={styles.dateField}
            disabled={isLoadingQuery}
            formatDate={formatPickerDate}
            label="Fecha Inicio"
            onSelectDate={(date) => setStartDate(date || undefined)}
            placeholder="dd/mm/aaaa"
            value={startDate}
          />
          <DatePicker
            className={styles.dateField}
            disabled={isLoadingQuery}
            formatDate={formatPickerDate}
            label="Fecha Fin"
            onSelectDate={(date) => setEndDate(date || undefined)}
            placeholder="dd/mm/aaaa"
            value={endDate}
          />
          <Dropdown
            className={styles.agentField}
            disabled={isLoadingTeam || isLoadingQuery || isRestrictedToSelf}
            label="Seleccionar Agente"
            onChange={(_, option) => setSelectedAgent(String(option?.key || ''))}
            options={agentOptions}
            placeholder={isLoadingTeam ? 'Cargando agentes...' : 'Seleccione un agente'}
            selectedKey={selectedAgent || undefined}
          />
          {moduleType === 'faltas' && (
            <Dropdown
              className={styles.categoryField}
              disabled={isLoadingCategories || isLoadingQuery}
              label="Filtrar por Categoría"
              onChange={(_, option) => {
                setSelectedCategory(String(option?.key || ALL_CATEGORIES_KEY));
                setSelectedCategoryDetail(ALL_CATEGORY_DETAILS_KEY);
              }}
              options={categoryOptions}
              placeholder={isLoadingCategories
                ? 'Cargando categorías...'
                : 'Seleccione una categoría'}
              selectedKey={selectedCategory}
            />
          )}
          {moduleType === 'faltas' && (
            <Dropdown
              className={styles.categoryDetailField}
              disabled={
                !getDetailCatalog(selectedCategory) ||
                isLoadingCategoryDetails ||
                isLoadingQuery
              }
              label="Subcategoría / Proceso"
              onChange={(_, option) => {
                setSelectedCategoryDetail(
                  String(option?.key || ALL_CATEGORY_DETAILS_KEY)
                );
              }}
              options={categoryDetailOptions}
              placeholder={
                isLoadingCategoryDetails
                  ? 'Cargando opciones...'
                  : getDetailCatalog(selectedCategory)
                    ? 'Seleccione una opción'
                    : 'Seleccione primero una categoría'
              }
              selectedKey={
                getDetailCatalog(selectedCategory)
                  ? selectedCategoryDetail
                  : undefined
              }
            />
          )}
        </Stack>

        <Stack horizontal wrap tokens={{ childrenGap: 12 }} verticalAlign="center">
          <PrimaryButton
            disabled={isQueryDisabled}
            iconProps={{ iconName: 'Search' }}
            onClick={() => queryRecords().catch(() => undefined)}
            text="Consultar Registros"
          />
          <DefaultButton
            disabled={isLoadingQuery || items.length === 0}
            iconProps={{ iconName: 'Download' }}
            onClick={exportToCsv}
            text="Exportar a CSV"
          />
        </Stack>
      </Stack>

      {isLoadingHistoryData ? (
        <SkeletonLoader
          cardCount={2}
          label={loadingLabel}
          rowCount={5}
        />
      ) : items.length > 0 ? (
        <React.Fragment>
          <div className={styles.tableContainer}>
            <DetailsList
              columns={columns}
              compact
              getKey={(item: HistorialItem) => `${moduleType}-${item.Id}`}
              items={items}
              layoutMode={DetailsListLayoutMode.justified}
              selectionMode={SelectionMode.none}
            />
          </div>

          <Stack
            className={styles.summaryBar}
            horizontal
            wrap
            tokens={{ childrenGap: 12 }}
          >
            {summaryMetrics.map((metric) => (
              <Stack className={styles.summaryMetric} key={metric.label}>
                <Text className={styles.summaryLabel}>{metric.label}</Text>
                <Text className={styles.summaryValue}>{metric.value}</Text>
              </Stack>
            ))}
          </Stack>
        </React.Fragment>
      ) : hasSearched ? (
        <MessageBar messageBarType={MessageBarType.info}>
          No se encontraron registros para los filtros seleccionados.
        </MessageBar>
      ) : (
        <Stack className={styles.emptyState} horizontalAlign="center">
          <Text variant="large">Defina los filtros y seleccione “Consultar Registros”.</Text>
        </Stack>
      )}
    </Stack>
  );
};

export default HistorialView;
