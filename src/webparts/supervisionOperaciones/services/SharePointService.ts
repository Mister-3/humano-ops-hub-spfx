import type { SPFI } from '@pnp/sp';
import '@pnp/sp/attachments';
import '@pnp/sp/fields';
import '@pnp/sp/items';
import '@pnp/sp/items/get-all';
import '@pnp/sp/lists';
import '@pnp/sp/views';
import '@pnp/sp/webs';

import type {
  FaltaApprovalStatus,
  IFalta,
  IFaltaAprobacionItem,
  RoleType
} from '../models/AppModels';
export type {
  FaltaApprovalStatus,
  IFaltaAprobacionItem
} from '../models/AppModels';
import { generateAuditID } from '../utils/auditUtils';
import { getSP } from './pnpjsConfig';

const LIST_TITLE = 'Registro_Faltas';
const LIST_DESCRIPTION = 'Lista para el registro oficial de faltas operativas';
const KUDOS_LIST_TITLE = 'Registro_Kudos';
const KUDOS_LIST_DESCRIPTION = 'Lista para reconocimientos corporativos';
const CONFIG_LIST_TITLE = 'Configuracion_Metricas';
const CONFIG_LIST_DESCRIPTION = 'Configuración global de métricas operativas';
const GLOBAL_CONFIG_TITLE = 'Config_Global';
const PRODUCTIVITY_LIST_TITLE = 'Registro_Productividad';
const PRODUCTIVITY_LIST_DESCRIPTION = 'Registro de productividad operativa';
const ROLES_CONFIG_LIST_TITLE = 'Configuracion_Roles';
const ROLES_CONFIG_LIST_DESCRIPTION =
  'Asignaciones manuales de roles para Humano Ops Hub';
const CATALOGS_CONFIG_LIST_TITLE = 'Configuracion_Catalogos';
const CATALOGS_CONFIG_LIST_DESCRIPTION =
  'Catálogos operativos dinámicos para Humano Ops Hub';
const ABSENCES_LIST_TITLE = 'Registro_Ausencias';
const ABSENCES_LIST_DESCRIPTION =
  'Registro de ausencias y vacaciones del equipo operativo';
const FLEET_CALLS_LIST_TITLE = 'Registro_OcupacionLlamadas';
const FLEET_CALLS_LIST_DESCRIPTION =
  'Registro manual de llamadas para la ocupación del supervisor';
const EMAIL_OCCUPANCY_LIST_TITLE = 'Registro_OcupacionCorreos';
const EMAIL_OCCUPANCY_LIST_DESCRIPTION =
  'Conteos de correos sincronizados por Power Automate para la ocupación del supervisor';
const EMPLOYEE_MONTH_PUBLICATIONS_LIST_TITLE = 'Publicacion_EmpleadoMes';
const EMPLOYEE_MONTH_PUBLICATIONS_LIST_DESCRIPTION =
  'Publicaciones oficiales del Empleado del Mes';
const ALLOWED_KUDO_ATTACHMENT_EXTENSIONS: ReadonlyArray<string> = [
  'pdf',
  'jpg',
  'jpeg',
  'png'
];
export const PRODUCTIVITY_OVERLAP_ERROR_MESSAGE =
  '⚠️ Conflicto de Fechas: Ya existe un registro de productividad guardado para este colaborador que se traslapa con el rango ingresado.';
const ROLE_VALUES: ReadonlyArray<string> = [
  'Admin',
  'Gerente',
  'Supervisor',
  'Analista',
  'Asistente',
  'Oficial'
];

type HistorialDateField = 'FechaFalta' | 'FechaKudo' | 'FechaRegistro';

export type CatalogCategory =
  | 'Falta'
  | 'ErrorProceso'
  | 'CodigoEtica'
  | 'Kudo'
  | 'ProcesoArea';

const CATALOG_CATEGORIES: ReadonlyArray<CatalogCategory> = [
  'Falta',
  'ErrorProceso',
  'CodigoEtica',
  'Kudo',
  'ProcesoArea'
];

export type AusenciaType =
  | 'Vacaciones'
  | 'Día Libre Cumpleaños'
  | 'Día Libre Empleado del Mes'
  | 'Licencia / Incapacidad';

const ABSENCE_TYPES: ReadonlyArray<AusenciaType> = [
  'Vacaciones',
  'Día Libre Cumpleaños',
  'Día Libre Empleado del Mes',
  'Licencia / Incapacidad'
];

const DEFAULT_CATALOG_ITEMS: ReadonlyArray<{
  categoria: CatalogCategory;
  valor: string;
}> = [
  { categoria: 'Falta', valor: 'Tardanza' },
  { categoria: 'Falta', valor: 'Ausencia Injustificada' },
  { categoria: 'Falta', valor: 'Error en proceso' },
  { categoria: 'Falta', valor: 'Violación de Política' },
  { categoria: 'Falta', valor: 'Capacitación' },
  { categoria: 'Falta', valor: 'Código de Ética' },
  { categoria: 'ErrorProceso', valor: 'Error de Digitación' },
  { categoria: 'ErrorProceso', valor: 'Incumplimiento SLA' },
  { categoria: 'ErrorProceso', valor: 'Procedimiento Incompleto' },
  { categoria: 'ErrorProceso', valor: 'Omisión de Verificación' },
  { categoria: 'CodigoEtica', valor: 'Uso inadecuado de recursos' },
  {
    categoria: 'CodigoEtica',
    valor: 'Trato irrespetuoso o conducta inapropiada'
  },
  {
    categoria: 'CodigoEtica',
    valor: 'Conflicto de interés no declarado'
  },
  {
    categoria: 'CodigoEtica',
    valor: 'Fraude, soborno o divulgación indebida'
  },
  { categoria: 'Kudo', valor: 'Orientado al negocio' },
  { categoria: 'Kudo', valor: 'Empatía' },
  { categoria: 'Kudo', valor: 'Agilidad' },
  { categoria: 'Kudo', valor: 'Pensamiento digital' },
  { categoria: 'Kudo', valor: 'Resolución de problemas' },
  { categoria: 'Kudo', valor: 'Trabajo en equipo' },
  { categoria: 'ProcesoArea', valor: 'Emisiones' },
  { categoria: 'ProcesoArea', valor: 'Movimientos' },
  { categoria: 'ProcesoArea', valor: 'Reclamaciones' },
  { categoria: 'ProcesoArea', valor: 'Servicio al Cliente' }
];

const MANDATORY_ETHICS_CATEGORY_ITEM: ReadonlyArray<{
  categoria: CatalogCategory;
  valor: string;
}> = DEFAULT_CATALOG_ITEMS.filter(
  (item) =>
    item.categoria === 'Falta' && item.valor === 'Código de Ética'
);

const DEFAULT_ETHICS_SUBCATEGORY_ITEMS: ReadonlyArray<{
  categoria: CatalogCategory;
  valor: string;
}> = DEFAULT_CATALOG_ITEMS.filter(
  (item) => item.categoria === 'CodigoEtica'
);

const escapeODataString = (value: string): string => value.replace(/'/g, "''");

const isRoleType = (value: string): value is RoleType =>
  ROLE_VALUES.indexOf(value) >= 0;

const isCatalogCategory = (value: string): value is CatalogCategory =>
  CATALOG_CATEGORIES.indexOf(value as CatalogCategory) >= 0;

const isAusenciaType = (value: string): value is AusenciaType =>
  ABSENCE_TYPES.indexOf(value as AusenciaType) >= 0;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getNestedRecord = (
  record: Record<string, unknown>,
  propertyName: string
): Record<string, unknown> | undefined => {
  const value = record[propertyName];
  return isRecord(value) ? value : undefined;
};

const getSharePointStatusCode = (error: unknown): number | undefined => {
  if (!isRecord(error)) {
    return undefined;
  }

  const directStatus = error.status ?? error.statusCode;

  if (typeof directStatus === 'number') {
    return directStatus;
  }

  const response = getNestedRecord(error, 'response');
  const responseStatus = response?.status;

  if (typeof responseStatus === 'number') {
    return responseStatus;
  }

  const data = getNestedRecord(error, 'data');
  const dataResponse = data ? getNestedRecord(data, 'response') : undefined;
  const dataResponseStatus = dataResponse?.status;

  return typeof dataResponseStatus === 'number'
    ? dataResponseStatus
    : undefined;
};

const isSharePointNotFoundError = (error: unknown): boolean => {
  if (getSharePointStatusCode(error) === 404) {
    return true;
  }

  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();

  return (
    /\b404\b/.test(message) ||
    message.indexOf('does not exist') >= 0 ||
    message.indexOf('no existe') >= 0 ||
    message.indexOf('list not found') >= 0 ||
    message.indexOf('lista no encontrada') >= 0
  );
};

const normalizeEmail = (email?: string): string =>
  email?.trim().toLowerCase() || '';

const getApprovalStatusForRole = (
  role: RoleType
): FaltaApprovalStatus =>
  role === 'Analista' || role === 'Asistente' || role === 'Oficial'
    ? 'Pendiente'
    : 'Aprobado';

/**
 * Los registros anteriores a v4.5 no contienen EstadoAprobacion. Por diseño,
 * esa ausencia equivale a una aprobación ya consolidada.
 */
export const isFaltaApprovedForScoring = (
  approvalStatus?: string
): boolean => {
  const normalizedStatus = approvalStatus?.trim().toLocaleLowerCase() || '';
  return normalizedStatus === '' || normalizedStatus === 'aprobado';
};

const validateKudoAttachments = (
  files: ReadonlyArray<File>
): void => {
  files.forEach((file) => {
    const fileName = file.name.trim();
    const extensionSeparatorIndex = fileName.lastIndexOf('.');
    const extension =
      extensionSeparatorIndex >= 0
        ? fileName.slice(extensionSeparatorIndex + 1).toLowerCase()
        : '';

    if (
      !fileName ||
      !extension ||
      ALLOWED_KUDO_ATTACHMENT_EXTENSIONS.indexOf(extension) < 0
    ) {
      throw new Error(
        `El archivo "${file.name || 'sin nombre'}" no es válido. ` +
          'Solo se permiten evidencias PDF, JPG, JPEG o PNG.'
      );
    }
  });
};

const getDayBoundary = (
  date: Date,
  boundary: 'start' | 'end',
  parameterName: string
): Date => {
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${parameterName} no contiene una fecha válida.`);
  }

  const result = new Date(date.getTime());

  if (boundary === 'start') {
    result.setHours(0, 0, 0, 0);
  } else {
    result.setHours(23, 59, 59, 999);
  }

  return result;
};

const buildHistorialFilter = (
  dateField: HistorialDateField,
  startDate?: Date,
  endDate?: Date
): string => {
  const clauses: string[] = [];
  const startBoundary = startDate
    ? getDayBoundary(startDate, 'start', 'La fecha de inicio')
    : undefined;
  const endBoundary = endDate
    ? getDayBoundary(endDate, 'end', 'La fecha de fin')
    : undefined;

  if (
    startBoundary &&
    endBoundary &&
    startBoundary.getTime() > endBoundary.getTime()
  ) {
    throw new Error('La fecha de inicio no puede ser posterior a la fecha de fin.');
  }

  if (startBoundary) {
    clauses.push(
      `${dateField} ge datetime'${startBoundary.toISOString()}'`
    );
  }

  if (endBoundary) {
    clauses.push(`${dateField} le datetime'${endBoundary.toISOString()}'`);
  }

  return clauses.join(' and ');
};

const isItemInAgentScope = (
  item: {
    Title?: string;
    AgenteEmail?: string;
    AgenteObjectID?: string;
  },
  agenteNombre?: string,
  agenteEmail?: string,
  agenteObjectId?: string
): boolean => {
  const expectedEmail = normalizeEmail(agenteEmail);
  const expectedObjectId =
    agenteObjectId?.trim().toLocaleLowerCase() || '';
  const expectedName =
    agenteNombre?.trim().toLocaleLowerCase() || '';

  if (!expectedEmail && !expectedObjectId && !expectedName) {
    return true;
  }

  const itemEmail = normalizeEmail(item.AgenteEmail);

  if (itemEmail && expectedEmail && itemEmail === expectedEmail) {
    return true;
  }

  const itemObjectId =
    item.AgenteObjectID?.trim().toLocaleLowerCase() || '';

  if (
    itemObjectId &&
    expectedObjectId &&
    itemObjectId === expectedObjectId
  ) {
    return true;
  }

  if (itemEmail || itemObjectId) {
    return false;
  }

  const itemName = item.Title?.trim().toLocaleLowerCase() || '';
  return Boolean(expectedName && itemName === expectedName);
};

export interface IRegistrarFaltaData {
  agente: string;
  agenteEmail?: string;
  agenteObjectId?: string;
  fecha: Date;
  categoria: string;
  subcategoria?: string;
  casoRef?: string;
  procesoArea?: string;
  comentariosCapacitacion?: string;
  comentarios?: string;
  horaLlegada?: string;
  minutosTardanza?: number;
  horasPerdidas?: number;
  origenError?: string;
  impacto: string;
  estado: IFalta['estado'];
  rolOriginador: RoleType;
}

export interface IRegistrarKudoData {
  agente: string;
  agenteEmail?: string;
  agenteObjectId?: string;
  atributo: string;
  mensaje: string;
  puntos: number;
  fecha: Date;
  remitente: string;
}

export interface IKudoListItem {
  Title?: string;
  AgenteEmail?: string;
  AgenteObjectID?: string;
  Puntos?: number;
}

export interface IRegistrarProductividadData {
  agente: string;
  agenteEmail: string;
  agenteObjectId?: string;
  fechaInicio: Date;
  fechaFin: Date;
  casosAtendidos: number;
  casosATiempo: number;
  emisionesTx: number;
  emisionesPg: number;
  movimientosTx: number;
  movimientosPg: number;
  escaneoTx: number;
  escaneoPg: number;
  /**
   * Alias v3 conservados para integraciones que todavía consumen el esquema
   * agregado. Los registros v4 siempre persisten también estos valores.
   */
  emisiones?: number;
  movimientos?: number;
}

interface IExistingProductividadRange {
  Id: number;
  FechaRegistro?: string;
  FechaInicio?: string;
  FechaFin?: string;
}

export interface IRegistrarAusenciaData {
  agente: string;
  agenteEmail?: string;
  agenteObjectId?: string;
  tipoAusencia: AusenciaType;
  fechaInicio: Date;
  fechaFin: Date;
  comentarios?: string;
}

export interface IAusenciaItem {
  Id: number;
  Title: string;
  AgenteEmail?: string;
  AgenteObjectID?: string;
  TipoAusencia: AusenciaType;
  FechaInicio: string;
  FechaFin: string;
  Comentarios: string;
  AuditID?: string;
}

export interface IRegistrarLlamadaFlotaData {
  casoContacto: string;
  supervisorEmail: string;
  fechaHora: Date;
  duracionMinutos: number;
  comentarios?: string;
}

export interface ILlamadaFlotaItem {
  Id: number;
  Title: string;
  SupervisorEmail: string;
  FechaHora: string;
  DuracionMinutos: number;
  Comentarios: string;
  AuditID?: string;
}

export interface IRegistrarConteoCorreosData {
  supervisorEmail: string;
  fecha: Date;
  cantidadCorreos: number;
  comentarios?: string;
}

export interface IOcupacionCorreoItem {
  Id: number;
  Title: string;
  Fecha: string;
  CantidadCorreos: number;
  Comentarios: string;
}

export interface IFaltaHistorialItem {
  Id: number;
  Title: string;
  AgenteEmail?: string;
  AgenteObjectID?: string;
  FechaFalta: string;
  Categoria: string;
  Subcategoria?: string;
  CasoRef?: string;
  ProcesoArea?: string;
  ComentariosCapacitacion?: string;
  Comentarios?: string;
  HoraLlegada?: string;
  MinutosTardanza?: number;
  HorasPerdidas?: number;
  OrigenError?: string;
  Impacto: string;
  Estado: IFalta['estado'];
  EstadoAprobacion?: FaltaApprovalStatus;
  RolOriginador: RoleType;
  AuditID?: string;
  Author?: {
    EMail?: string;
    Title?: string;
  };
}

export interface IRoleOverrideItem {
  Id: number;
  Title: string;
  RolAsignado: RoleType;
}

export interface IKudoHistorialItem {
  Id: number;
  Title: string;
  AgenteEmail?: string;
  AgenteObjectID?: string;
  Atributo: string;
  Mensaje: string;
  Puntos: number;
  FechaKudo: string;
  Remitente: string;
  AuditID?: string;
}

export interface IProductividadHistorialItem {
  Id: number;
  Title: string;
  AgenteEmail?: string;
  AgenteObjectID?: string;
  FechaRegistro: string;
  FechaInicio?: string;
  FechaFin?: string;
  Casos: number;
  CasosAtendidos: number;
  CasosATiempo?: number;
  TieneDatosSLA?: boolean;
  Emisiones: number;
  Movimientos: number;
  EmisionesTx: number;
  EmisionesPg: number;
  MovimientosTx: number;
  MovimientosPg: number;
  EscaneoTx: number;
  EscaneoPg: number;
  AuditID?: string;
}

export interface IDashboardProductividadItem {
  Title?: string;
  AgenteEmail?: string;
  AgenteObjectID?: string;
  FechaRegistro?: string;
  FechaInicio?: string;
  FechaFin?: string;
  Casos?: number;
  CasosAtendidos?: number;
  CasosATiempo?: number;
  TieneDatosSLA?: boolean;
  Emisiones?: number;
  Movimientos?: number;
  EmisionesTx?: number;
  EmisionesPg?: number;
  MovimientosTx?: number;
  MovimientosPg?: number;
  EscaneoTx?: number;
  EscaneoPg?: number;
}

export interface IDashboardFaltaItem {
  Title?: string;
  AgenteEmail?: string;
  AgenteObjectID?: string;
  Categoria?: string;
  Impacto?: string;
  Estado?: string;
  EstadoAprobacion?: FaltaApprovalStatus;
}

export interface IDatosDashboard {
  config: IConfiguracionMetricas;
  productividad: IDashboardProductividadItem[];
  faltas: IDashboardFaltaItem[];
  kudos: IKudoListItem[];
}

export interface IEvaluacionProductividadItem {
  Id: number;
  Title?: string;
  AgenteEmail?: string;
  AgenteObjectID?: string;
  FechaRegistro?: string;
  FechaInicio?: string;
  FechaFin?: string;
  Casos?: number;
  CasosAtendidos?: number;
  CasosATiempo?: number;
  TieneDatosSLA?: boolean;
  Emisiones?: number;
  Movimientos?: number;
  EmisionesTx?: number;
  EmisionesPg?: number;
  MovimientosTx?: number;
  MovimientosPg?: number;
  EscaneoTx?: number;
  EscaneoPg?: number;
}

export interface IEvaluacionKudoItem {
  Title?: string;
  AgenteEmail?: string;
  AgenteObjectID?: string;
  FechaKudo?: string;
  Atributo?: string;
  Puntos?: number;
}

export interface IEvaluacionFaltaItem {
  Id: number;
  Title?: string;
  AgenteEmail?: string;
  AgenteObjectID?: string;
  FechaFalta?: string;
  Categoria?: string;
  Impacto?: string;
  Estado?: string;
  EstadoAprobacion?: FaltaApprovalStatus;
}

export interface IDatosEvaluacion {
  productividad: IEvaluacionProductividadItem[];
  kudos: IEvaluacionKudoItem[];
  faltas: IEvaluacionFaltaItem[];
  config: IConfiguracionMetricas;
}

export interface IAgenteIdentityFilter {
  name: string;
  email?: string;
  objectId?: string;
}

export interface ICatalogoItem {
  Id: number;
  Title: CatalogCategory;
  Valor: string;
}

export interface IConfiguracionMetricas {
  Id: number;
  Title: string;
  PesoCasos: number;
  PesoEmisionesTx: number;
  PesoEmisionesPg: number;
  PesoMovimientosTx: number;
  PesoMovimientosPg: number;
  PesoEscaneoTx: number;
  PesoEscaneoPg: number;
  MetaSlaCasos: number;
  MetaEmisionesTx: number;
  MetaMovimientosPg: number;
  MetaEscaneoPg: number;
  /** Campos v3 conservados mientras Dashboard/Evaluación migran a v4. */
  PesoEmisiones: number;
  PesoMovimientos: number;
  MetaDiaria: number;
  PuntosPorKudo: number;
  PenalidadBaja: number;
  PenalidadMedia: number;
  PenalidadCritica: number;
}

const PRODUCTIVITY_V4_DEFAULTS = {
  MetaSlaCasos: 90,
  MetaEmisionesTx: 10,
  MetaMovimientosPg: 350,
  MetaEscaneoPg: 350,
  PesoCasos: 20,
  PesoEmisionesTx: 15,
  PesoEmisionesPg: 10,
  PesoMovimientosTx: 15,
  PesoMovimientosPg: 15,
  PesoEscaneoTx: 10,
  PesoEscaneoPg: 15
} as const;

export type PublicacionEmpleadoMesEstado = 'Borrador' | 'Publicado';

export interface IPublicacionEmpleadoMes {
  Id: number;
  Title: string;
  AgenteEmail: string;
  AgenteNombre: string;
  PuntosTotales: number;
  ConceptoKudo: string;
  Dedicatoria: string;
  Estado: PublicacionEmpleadoMesEstado;
  FechaPublicacion: string;
}

export interface IPublicarEmpleadoMesData {
  mesAno: string;
  agenteEmail: string;
  agenteNombre: string;
  puntosTotales: number;
  conceptoKudo: string;
  dedicatoria: string;
  estado?: PublicacionEmpleadoMesEstado;
  fechaPublicacion?: Date;
}

export type IConfiguracionMetricasUpdate = Pick<
  IConfiguracionMetricas,
  | 'PesoCasos'
  | 'PesoEmisionesTx'
  | 'PesoEmisionesPg'
  | 'PesoMovimientosTx'
  | 'PesoMovimientosPg'
  | 'PesoEscaneoTx'
  | 'PesoEscaneoPg'
  | 'MetaSlaCasos'
  | 'MetaEmisionesTx'
  | 'MetaMovimientosPg'
  | 'MetaEscaneoPg'
  | 'PuntosPorKudo'
  | 'PenalidadBaja'
  | 'PenalidadMedia'
  | 'PenalidadCritica'
> &
  Partial<
    Pick<
      IConfiguracionMetricas,
      'PesoEmisiones' | 'PesoMovimientos' | 'MetaDiaria'
    >
  >;

interface IProductividadMetricFields {
  Casos?: number;
  CasosAtendidos?: number;
  CasosATiempo?: number;
  TieneDatosSLA?: boolean;
  Emisiones?: number;
  Movimientos?: number;
  EmisionesTx?: number;
  EmisionesPg?: number;
  MovimientosTx?: number;
  MovimientosPg?: number;
  EscaneoTx?: number;
  EscaneoPg?: number;
}

type NormalizedProductividadMetrics = Required<
  Omit<IProductividadMetricFields, 'CasosATiempo' | 'TieneDatosSLA'>
> &
  Pick<IProductividadMetricFields, 'CasosATiempo'> & {
    TieneDatosSLA: boolean;
  };

const getMetricValue = (
  value: number | undefined,
  fallback = 0
): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : fallback;

/**
 * Los ítems anteriores a v4 no contienen las siete métricas. Emisiones y
 * Movimientos se proyectan sobre las métricas equivalentes usadas en v3 y el
 * resto se inicializa en cero para que los consumidores no reciban null.
 */
const normalizeProductividadMetrics = <
  T extends IProductividadMetricFields
>(
  item: T
): T & NormalizedProductividadMetrics => {
  const emisionesTx = getMetricValue(
    item.EmisionesTx,
    getMetricValue(item.Emisiones)
  );
  const movimientosPg = getMetricValue(
    item.MovimientosPg,
    getMetricValue(item.Movimientos)
  );
  const casosAtendidos = getMetricValue(
    item.CasosAtendidos,
    getMetricValue(item.Casos)
  );
  const tieneDatosSLA =
    typeof item.CasosATiempo === 'number' &&
    Number.isFinite(item.CasosATiempo) &&
    item.CasosATiempo >= 0;

  return {
    ...item,
    Casos: getMetricValue(item.Casos, casosAtendidos),
    CasosAtendidos: casosAtendidos,
    CasosATiempo:
      tieneDatosSLA
        ? item.CasosATiempo
        : undefined,
    TieneDatosSLA: tieneDatosSLA,
    Emisiones: getMetricValue(item.Emisiones, emisionesTx),
    Movimientos: getMetricValue(item.Movimientos, movimientosPg),
    EmisionesTx: emisionesTx,
    EmisionesPg: getMetricValue(item.EmisionesPg),
    MovimientosTx: getMetricValue(item.MovimientosTx),
    MovimientosPg: movimientosPg,
    EscaneoTx: getMetricValue(item.EscaneoTx),
    EscaneoPg: getMetricValue(item.EscaneoPg)
  };
};

export class SharePointService {
  public constructor(private readonly sp: SPFI = getSP()) {}

  public async ensureRegistroFaltasList(): Promise<void> {
    let provisioningStep = 'crear o verificar la lista';

    try {
      const listEnsure = await this.sp.web.lists.ensure(
        LIST_TITLE,
        LIST_DESCRIPTION,
        100,
        false
      );

      let existingInternalNames: string[];

      if (listEnsure.created) {
        existingInternalNames = [];
      } else {
        provisioningStep = 'consultar las columnas existentes';
        const existingFields = await listEnsure.list.fields
          .select('InternalName')();
        existingInternalNames = existingFields.map((field) => field.InternalName);
      }

      if (existingInternalNames.indexOf('FechaFalta') < 0) {
        provisioningStep = 'crear la columna FechaFalta';
        const result = await listEnsure.list.fields.addDateTime(
          'FechaFalta',
          { Required: true }
        );
        provisioningStep = 'asignar el nombre visible de FechaFalta';
        await result.field.update({ Title: 'Fecha de la Falta' });
      }

      if (existingInternalNames.indexOf('Categoria') < 0) {
        provisioningStep = 'crear la columna Categoria';
        const result = await listEnsure.list.fields.addText(
          'Categoria',
          { Required: true }
        );
        provisioningStep = 'asignar el nombre visible de Categoria';
        await result.field.update({ Title: 'Categoría' });
      }

      if (existingInternalNames.indexOf('Impacto') < 0) {
        provisioningStep = 'crear la columna Impacto';
        const result = await listEnsure.list.fields.addText(
          'Impacto',
          { Required: true }
        );
        provisioningStep = 'asignar el nombre visible de Impacto';
        await result.field.update({ Title: 'Nivel de Impacto' });
      }

      if (existingInternalNames.indexOf('Estado') < 0) {
        provisioningStep = 'crear la columna Estado';
        const result = await listEnsure.list.fields.addText(
          'Estado',
          { Required: true }
        );
        provisioningStep = 'asignar el nombre visible de Estado';
        await result.field.update({ Title: 'Estado de Registro' });
      }

      if (existingInternalNames.indexOf('RolOriginador') < 0) {
        provisioningStep = 'crear la columna RolOriginador';
        const result = await listEnsure.list.fields.addText(
          'RolOriginador',
          { Required: true }
        );
        provisioningStep = 'asignar el nombre visible de RolOriginador';
        await result.field.update({ Title: 'Rol del Creador' });
      }

      if (existingInternalNames.indexOf('Subcategoria') < 0) {
        provisioningStep = 'crear la columna Subcategoria';
        const result = await listEnsure.list.fields.addText('Subcategoria');
        provisioningStep = 'asignar el nombre visible de Subcategoria';
        await result.field.update({ Title: 'Subcategoría de Error' });
      }

      if (existingInternalNames.indexOf('CasoRef') < 0) {
        provisioningStep = 'crear la columna CasoRef';
        const result = await listEnsure.list.fields.addText('CasoRef');
        provisioningStep = 'asignar el nombre visible de CasoRef';
        await result.field.update({
          Title: 'ID Caso Helpdesk / Calidad'
        });
      }

      if (existingInternalNames.indexOf('ProcesoArea') < 0) {
        provisioningStep = 'crear la columna ProcesoArea';
        const result = await listEnsure.list.fields.addText('ProcesoArea');
        provisioningStep = 'asignar el nombre visible de ProcesoArea';
        await result.field.update({ Title: 'Proceso del Área' });
      }

      if (existingInternalNames.indexOf('ComentariosCapacitacion') < 0) {
        provisioningStep = 'crear la columna ComentariosCapacitacion';
        const result = await listEnsure.list.fields.addMultilineText(
          'ComentariosCapacitacion',
          {
            NumberOfLines: 6,
            RichText: false
          }
        );
        provisioningStep =
          'asignar el nombre visible de ComentariosCapacitacion';
        await result.field.update({
          Title: 'Comentarios de la Capacitación'
        });
      }

      if (existingInternalNames.indexOf('Comentarios') < 0) {
        provisioningStep = 'crear la columna Comentarios';
        const result = await listEnsure.list.fields.addMultilineText(
          'Comentarios',
          {
            NumberOfLines: 6,
            RichText: false
          }
        );
        provisioningStep = 'asignar el nombre visible de Comentarios';
        await result.field.update({
          Title: 'Comentarios / Observaciones'
        });
      }

      if (existingInternalNames.indexOf('HoraLlegada') < 0) {
        provisioningStep = 'crear la columna HoraLlegada';
        const result = await listEnsure.list.fields.addText('HoraLlegada');
        provisioningStep = 'asignar el nombre visible de HoraLlegada';
        await result.field.update({ Title: 'Hora de Llegada' });
      }

      if (existingInternalNames.indexOf('MinutosTardanza') < 0) {
        provisioningStep = 'crear la columna MinutosTardanza';
        const result = await listEnsure.list.fields.addNumber(
          'MinutosTardanza',
          { MinimumValue: 0 }
        );
        provisioningStep = 'asignar el nombre visible de MinutosTardanza';
        await result.field.update({ Title: 'Minutos de Tardanza' });
      }

      if (existingInternalNames.indexOf('HorasPerdidas') < 0) {
        provisioningStep = 'crear la columna HorasPerdidas';
        const result = await listEnsure.list.fields.addNumber(
          'HorasPerdidas',
          { MinimumValue: 0 }
        );
        provisioningStep = 'asignar el nombre visible de HorasPerdidas';
        await result.field.update({
          Title: 'Horas Laborables Perdidas'
        });
      }

      if (existingInternalNames.indexOf('OrigenError') < 0) {
        provisioningStep = 'crear la columna OrigenError';
        const result = await listEnsure.list.fields.addText('OrigenError');
        provisioningStep = 'asignar el nombre visible de OrigenError';
        await result.field.update({ Title: 'Origen del Error' });
      }

      if (existingInternalNames.indexOf('AgenteEmail') < 0) {
        provisioningStep = 'crear la columna AgenteEmail';
        const result = await listEnsure.list.fields.addText('AgenteEmail');
        provisioningStep = 'asignar el nombre visible de AgenteEmail';
        await result.field.update({ Title: 'Correo del Agente' });
      }

      if (existingInternalNames.indexOf('AgenteObjectID') < 0) {
        provisioningStep = 'crear la columna AgenteObjectID';
        const result = await listEnsure.list.fields.addText('AgenteObjectID');
        provisioningStep = 'asignar el nombre visible de AgenteObjectID';
        await result.field.update({ Title: 'Object ID Entra ID' });
      }

      if (existingInternalNames.indexOf('AuditID') < 0) {
        provisioningStep = 'crear la columna AuditID';
        const result = await listEnsure.list.fields.addText('AuditID');
        provisioningStep = 'asignar el nombre visible de AuditID';
        await result.field.update({ Title: 'ID de Auditoría' });
      }

      if (existingInternalNames.indexOf('EstadoAprobacion') < 0) {
        provisioningStep = 'crear la columna EstadoAprobacion';
        const result = await listEnsure.list.fields.addText(
          'EstadoAprobacion'
        );
        provisioningStep = 'asignar el nombre visible de EstadoAprobacion';
        await result.field.update({ Title: 'Estado de Aprobación' });
      }

      provisioningStep = 'obtener la vista predeterminada';
      const defaultView = await listEnsure.list.defaultView;
      const defaultViewFields = await defaultView.fields();
      const visibleFields = defaultViewFields.Items;

      if (visibleFields.indexOf('FechaFalta') < 0) {
        provisioningStep = 'agregar FechaFalta a la vista predeterminada';
        await defaultView.fields.add('FechaFalta');
      }

      if (visibleFields.indexOf('Categoria') < 0) {
        provisioningStep = 'agregar Categoria a la vista predeterminada';
        await defaultView.fields.add('Categoria');
      }

      if (visibleFields.indexOf('Impacto') < 0) {
        provisioningStep = 'agregar Impacto a la vista predeterminada';
        await defaultView.fields.add('Impacto');
      }

      if (visibleFields.indexOf('Estado') < 0) {
        provisioningStep = 'agregar Estado a la vista predeterminada';
        await defaultView.fields.add('Estado');
      }

      if (visibleFields.indexOf('RolOriginador') < 0) {
        provisioningStep = 'agregar RolOriginador a la vista predeterminada';
        await defaultView.fields.add('RolOriginador');
      }

      if (visibleFields.indexOf('Subcategoria') < 0) {
        provisioningStep = 'agregar Subcategoria a la vista predeterminada';
        await defaultView.fields.add('Subcategoria');
      }

      if (visibleFields.indexOf('CasoRef') < 0) {
        provisioningStep = 'agregar CasoRef a la vista predeterminada';
        await defaultView.fields.add('CasoRef');
      }

      if (visibleFields.indexOf('ProcesoArea') < 0) {
        provisioningStep = 'agregar ProcesoArea a la vista predeterminada';
        await defaultView.fields.add('ProcesoArea');
      }

      if (visibleFields.indexOf('ComentariosCapacitacion') < 0) {
        provisioningStep =
          'agregar ComentariosCapacitacion a la vista predeterminada';
        await defaultView.fields.add('ComentariosCapacitacion');
      }

      if (visibleFields.indexOf('Comentarios') < 0) {
        provisioningStep = 'agregar Comentarios a la vista predeterminada';
        await defaultView.fields.add('Comentarios');
      }

      if (visibleFields.indexOf('HoraLlegada') < 0) {
        provisioningStep = 'agregar HoraLlegada a la vista predeterminada';
        await defaultView.fields.add('HoraLlegada');
      }

      if (visibleFields.indexOf('MinutosTardanza') < 0) {
        provisioningStep =
          'agregar MinutosTardanza a la vista predeterminada';
        await defaultView.fields.add('MinutosTardanza');
      }

      if (visibleFields.indexOf('HorasPerdidas') < 0) {
        provisioningStep = 'agregar HorasPerdidas a la vista predeterminada';
        await defaultView.fields.add('HorasPerdidas');
      }

      if (visibleFields.indexOf('OrigenError') < 0) {
        provisioningStep = 'agregar OrigenError a la vista predeterminada';
        await defaultView.fields.add('OrigenError');
      }

      if (visibleFields.indexOf('AgenteEmail') < 0) {
        provisioningStep = 'agregar AgenteEmail a la vista predeterminada';
        await defaultView.fields.add('AgenteEmail');
      }

      if (visibleFields.indexOf('AgenteObjectID') < 0) {
        provisioningStep = 'agregar AgenteObjectID a la vista predeterminada';
        await defaultView.fields.add('AgenteObjectID');
      }

      if (visibleFields.indexOf('AuditID') < 0) {
        provisioningStep = 'agregar AuditID a la vista predeterminada';
        await defaultView.fields.add('AuditID');
      }

      if (visibleFields.indexOf('EstadoAprobacion') < 0) {
        provisioningStep =
          'agregar EstadoAprobacion a la vista predeterminada';
        await defaultView.fields.add('EstadoAprobacion');
      }
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Error al ${provisioningStep} en ${LIST_TITLE}: ${detail}`
      );
    }
  }

  public async registrarFalta(
    faltaData: IRegistrarFaltaData,
    // El contrato refleja directamente el estado de un input File.
    // eslint-disable-next-line @rushstack/no-new-null
    file: File | null
  ): Promise<void> {
    let itemCreated = false;

    try {
      await this.ensureRegistroFaltasList();

      const iar = await this.sp.web.lists
        .getByTitle(LIST_TITLE)
        .items.add({
          AuditID: generateAuditID(),
          Title: faltaData.agente,
          AgenteEmail: normalizeEmail(faltaData.agenteEmail),
          AgenteObjectID: faltaData.agenteObjectId?.trim() || '',
          FechaFalta: faltaData.fecha.toISOString(),
          Categoria: faltaData.categoria,
          Subcategoria: faltaData.subcategoria?.trim() || '',
          CasoRef: faltaData.casoRef?.trim() || '',
          ProcesoArea: faltaData.procesoArea?.trim() || '',
          ComentariosCapacitacion:
            faltaData.comentariosCapacitacion?.trim() || '',
          Comentarios: faltaData.comentarios?.trim() || '',
          HoraLlegada: faltaData.horaLlegada?.trim() || '',
          MinutosTardanza: faltaData.minutosTardanza ?? 0,
          HorasPerdidas: faltaData.horasPerdidas ?? 0,
          OrigenError: faltaData.origenError?.trim() || '',
          Impacto: faltaData.impacto,
          Estado: faltaData.estado,
          EstadoAprobacion: getApprovalStatusForRole(
            faltaData.rolOriginador
          ),
          RolOriginador: faltaData.rolOriginador
        });

      itemCreated = true;

      if (file) {
        await iar.item.attachmentFiles.add(file.name, file);
      }
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);

      if (itemCreated && file) {
        throw new Error(
          `La falta fue creada, pero no se pudo adjuntar ${file.name}: ${detail}`
        );
      }

      throw new Error(`No fue posible registrar la falta: ${detail}`);
    }
  }

  public async getFaltasHistorial(
    startDate?: Date,
    endDate?: Date,
    agenteNombre?: string,
    categoriaFilter?: string,
    agenteEmail?: string,
    agenteObjectId?: string
  ): Promise<IFaltaHistorialItem[]> {
    try {
      await this.ensureRegistroFaltasList();

      const dateFilter = buildHistorialFilter(
        'FechaFalta',
        startDate,
        endDate
      );
      const normalizedCategory = categoriaFilter?.trim();
      const query = this.sp.web.lists
        .getByTitle(LIST_TITLE)
        .items
        .select(
          'Id',
          'Title',
          'AgenteEmail',
          'AgenteObjectID',
          'FechaFalta',
          'Categoria',
          'Subcategoria',
          'CasoRef',
          'ProcesoArea',
          'ComentariosCapacitacion',
          'Comentarios',
          'HoraLlegada',
          'MinutosTardanza',
          'HorasPerdidas',
          'OrigenError',
          'Impacto',
          'Estado',
          'EstadoAprobacion',
          'RolOriginador',
          'AuditID'
        )
        .orderBy('FechaFalta', false);
      const items = dateFilter
        ? await query.filter(dateFilter).getAll<IFaltaHistorialItem>()
        : await query.getAll<IFaltaHistorialItem>();

      return items.filter((item) => {
        const matchesAgent = isItemInAgentScope(
          item,
          agenteNombre,
          agenteEmail,
          agenteObjectId
        );
        const matchesCategory =
          !normalizedCategory ||
          normalizedCategory.toLocaleLowerCase() === 'todas' ||
          item.Categoria?.trim().toLocaleLowerCase() ===
            normalizedCategory.toLocaleLowerCase();

        return matchesAgent &&
          matchesCategory &&
          isFaltaApprovedForScoring(item.EstadoAprobacion);
      });
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `No fue posible consultar el historial de faltas en ${LIST_TITLE}: ${detail}`
      );
    }
  }

  public async getFaltasPendientes(
    allowedAuthorEmails?: ReadonlyArray<string>
  ): Promise<IFaltaAprobacionItem[]> {
    try {
      await this.ensureRegistroFaltasList();

      const hasAuthorScope = allowedAuthorEmails !== undefined;
      const normalizedAuthorEmails = new Set(
        (allowedAuthorEmails || [])
          .map((email) => normalizeEmail(email))
          .filter(Boolean)
      );

      if (hasAuthorScope && normalizedAuthorEmails.size === 0) {
        return [];
      }

      const items = await this.sp.web.lists
        .getByTitle(LIST_TITLE)
        .items
        .select(
          'Id',
          'Title',
          'AgenteEmail',
          'AgenteObjectID',
          'AuditID',
          'FechaFalta',
          'Categoria',
          'Subcategoria',
          'CasoRef',
          'Comentarios',
          'Impacto',
          'Estado',
          'EstadoAprobacion',
          'RolOriginador',
          'AttachmentFiles/FileName',
          'AttachmentFiles/ServerRelativeUrl',
          'Author/Title',
          'Author/EMail'
        )
        .expand('AttachmentFiles', 'Author')
        .filter("EstadoAprobacion eq 'Pendiente'")
        .orderBy('FechaFalta', false)
        .getAll<IFaltaAprobacionItem>();

      return items
        .filter((item) => (
          !hasAuthorScope ||
          normalizedAuthorEmails.has(normalizeEmail(item.Author?.EMail))
        ))
        .map((item) => ({
          ...item,
          EstadoAprobacion: 'Pendiente',
          AttachmentFiles: item.AttachmentFiles || []
        }));
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `No fue posible consultar la cola de aprobación: ${detail}`
      );
    }
  }

  public async actualizarEstadoAprobacion(
    id: number,
    estado: Extract<FaltaApprovalStatus, 'Aprobado' | 'Rechazado'>
  ): Promise<void> {
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error('El identificador de la falta no es válido.');
    }

    if (estado !== 'Aprobado' && estado !== 'Rechazado') {
      throw new Error('El estado de aprobación no es válido.');
    }

    try {
      await this.ensureRegistroFaltasList();
      await this.sp.web.lists
        .getByTitle(LIST_TITLE)
        .items
        .getById(id)
        .update({
          EstadoAprobacion: estado,
          Estado: estado
        });
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `No fue posible marcar la falta como ${estado.toLowerCase()}: ` +
        detail
      );
    }
  }

  public async getCapacitacionesPeriodo(
    startDate: Date,
    endDate: Date,
    supervisorEmail?: string
  ): Promise<IFaltaHistorialItem[]> {
    try {
      await this.ensureRegistroFaltasList();

      const dateFilter = buildHistorialFilter(
        'FechaFalta',
        startDate,
        endDate
      );
      const normalizedSupervisorEmail = normalizeEmail(supervisorEmail);
      const clauses = [
        dateFilter,
        "Categoria eq 'Capacitación'"
      ].filter(Boolean);

      if (normalizedSupervisorEmail) {
        clauses.push(
          `Author/EMail eq '${escapeODataString(
            normalizedSupervisorEmail
          )}'`
        );
      }

      const items = await this.sp.web.lists
        .getByTitle(LIST_TITLE)
        .items
        .select(
          'Id',
          'Title',
          'AgenteEmail',
          'AgenteObjectID',
          'FechaFalta',
          'Categoria',
          'Subcategoria',
          'CasoRef',
          'ProcesoArea',
          'Comentarios',
          'Impacto',
          'Estado',
          'EstadoAprobacion',
          'RolOriginador',
          'AuditID',
          'Author/EMail',
          'Author/Title'
        )
        .expand('Author')
        .filter(clauses.join(' and '))
        .orderBy('FechaFalta', false)
        .getAll<IFaltaHistorialItem>();

      return items.filter((item) =>
        isFaltaApprovedForScoring(item.EstadoAprobacion)
      );
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `No fue posible consultar las capacitaciones en ${LIST_TITLE}: ${detail}`
      );
    }
  }

  public async ensureRegistroKudosList(): Promise<void> {
    let provisioningStep = 'crear o verificar la lista';

    try {
      const listEnsure = await this.sp.web.lists.ensure(
        KUDOS_LIST_TITLE,
        KUDOS_LIST_DESCRIPTION,
        100,
        false
      );

      let existingInternalNames: string[];

      if (listEnsure.created) {
        existingInternalNames = [];
      } else {
        provisioningStep = 'consultar las columnas existentes';
        const existingFields = await listEnsure.list.fields
          .select('InternalName')();
        existingInternalNames = existingFields.map((field) => field.InternalName);
      }

      if (existingInternalNames.indexOf('Atributo') < 0) {
        provisioningStep = 'crear la columna Atributo';
        const result = await listEnsure.list.fields.addText(
          'Atributo',
          { Required: true }
        );
        provisioningStep = 'asignar el nombre visible de Atributo';
        await result.field.update({ Title: 'Atributo Corporativo' });
      }

      if (existingInternalNames.indexOf('Mensaje') < 0) {
        provisioningStep = 'crear la columna Mensaje';
        const result = await listEnsure.list.fields.addMultilineText(
          'Mensaje',
          {
            NumberOfLines: 6,
            Required: true,
            RichText: false
          }
        );
        provisioningStep = 'asignar el nombre visible de Mensaje';
        await result.field.update({ Title: 'Mensaje de Reconocimiento' });
      }

      if (existingInternalNames.indexOf('Puntos') < 0) {
        provisioningStep = 'crear la columna Puntos';
        const result = await listEnsure.list.fields.addNumber(
          'Puntos',
          {
            MinimumValue: 0,
            Required: true
          }
        );
        provisioningStep = 'asignar el nombre visible de Puntos';
        await result.field.update({ Title: 'Puntos Asignados' });
      }

      if (existingInternalNames.indexOf('FechaKudo') < 0) {
        provisioningStep = 'crear la columna FechaKudo';
        const result = await listEnsure.list.fields.addDateTime(
          'FechaKudo',
          { Required: true }
        );
        provisioningStep = 'asignar el nombre visible de FechaKudo';
        await result.field.update({ Title: 'Fecha' });
      }

      if (existingInternalNames.indexOf('Remitente') < 0) {
        provisioningStep = 'crear la columna Remitente';
        const result = await listEnsure.list.fields.addText(
          'Remitente',
          { Required: true }
        );
        provisioningStep = 'asignar el nombre visible de Remitente';
        await result.field.update({ Title: 'Enviado por' });
      }

      if (existingInternalNames.indexOf('AgenteEmail') < 0) {
        provisioningStep = 'crear la columna AgenteEmail';
        const result = await listEnsure.list.fields.addText('AgenteEmail');
        provisioningStep = 'asignar el nombre visible de AgenteEmail';
        await result.field.update({ Title: 'Correo del Agente' });
      }

      if (existingInternalNames.indexOf('AgenteObjectID') < 0) {
        provisioningStep = 'crear la columna AgenteObjectID';
        const result = await listEnsure.list.fields.addText('AgenteObjectID');
        provisioningStep = 'asignar el nombre visible de AgenteObjectID';
        await result.field.update({ Title: 'Object ID Entra ID' });
      }

      if (existingInternalNames.indexOf('AuditID') < 0) {
        provisioningStep = 'crear la columna AuditID';
        const result = await listEnsure.list.fields.addText('AuditID');
        provisioningStep = 'asignar el nombre visible de AuditID';
        await result.field.update({ Title: 'ID de Auditoría' });
      }

      provisioningStep = 'obtener la vista predeterminada';
      const defaultView = await listEnsure.list.defaultView;
      const defaultViewFields = await defaultView.fields();
      const visibleFields = defaultViewFields.Items;

      if (visibleFields.indexOf('Atributo') < 0) {
        provisioningStep = 'agregar Atributo a la vista predeterminada';
        await defaultView.fields.add('Atributo');
      }

      if (visibleFields.indexOf('Mensaje') < 0) {
        provisioningStep = 'agregar Mensaje a la vista predeterminada';
        await defaultView.fields.add('Mensaje');
      }

      if (visibleFields.indexOf('Puntos') < 0) {
        provisioningStep = 'agregar Puntos a la vista predeterminada';
        await defaultView.fields.add('Puntos');
      }

      if (visibleFields.indexOf('FechaKudo') < 0) {
        provisioningStep = 'agregar FechaKudo a la vista predeterminada';
        await defaultView.fields.add('FechaKudo');
      }

      if (visibleFields.indexOf('Remitente') < 0) {
        provisioningStep = 'agregar Remitente a la vista predeterminada';
        await defaultView.fields.add('Remitente');
      }

      if (visibleFields.indexOf('AgenteEmail') < 0) {
        provisioningStep = 'agregar AgenteEmail a la vista predeterminada';
        await defaultView.fields.add('AgenteEmail');
      }

      if (visibleFields.indexOf('AgenteObjectID') < 0) {
        provisioningStep = 'agregar AgenteObjectID a la vista predeterminada';
        await defaultView.fields.add('AgenteObjectID');
      }

      if (visibleFields.indexOf('AuditID') < 0) {
        provisioningStep = 'agregar AuditID a la vista predeterminada';
        await defaultView.fields.add('AuditID');
      }
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Error al ${provisioningStep} en ${KUDOS_LIST_TITLE}: ${detail}`
      );
    }
  }

  public async registrarKudo(
    kudoData: IRegistrarKudoData,
    files?: ReadonlyArray<File>
  ): Promise<void> {
    let itemCreated = false;
    let currentAttachmentName = '';
    const attachmentFiles = files || [];

    try {
      validateKudoAttachments(attachmentFiles);
      await this.ensureRegistroKudosList();

      const iar = await this.sp.web.lists
        .getByTitle(KUDOS_LIST_TITLE)
        .items.add({
          AuditID: generateAuditID(),
          Title: kudoData.agente,
          AgenteEmail: normalizeEmail(kudoData.agenteEmail),
          AgenteObjectID: kudoData.agenteObjectId?.trim() || '',
          Atributo: kudoData.atributo,
          Mensaje: kudoData.mensaje,
          Puntos: kudoData.puntos,
          FechaKudo: kudoData.fecha.toISOString(),
          Remitente: kudoData.remitente
        });

      itemCreated = true;

      for (let index = 0; index < attachmentFiles.length; index += 1) {
        const file = attachmentFiles[index];
        currentAttachmentName = file.name;
        await iar.item.attachmentFiles.add(file.name, file);
      }
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);

      if (itemCreated && currentAttachmentName) {
        throw new Error(
          'El reconocimiento fue creado, pero no se pudo adjuntar ' +
            `"${currentAttachmentName}": ${detail}`
        );
      }

      throw new Error(`No fue posible registrar el reconocimiento: ${detail}`);
    }
  }

  public async getKudosHistorial(
    startDate?: Date,
    endDate?: Date,
    agenteNombre?: string,
    agenteEmail?: string,
    agenteObjectId?: string
  ): Promise<IKudoHistorialItem[]> {
    try {
      await this.ensureRegistroKudosList();

      const filter = buildHistorialFilter(
        'FechaKudo',
        startDate,
        endDate
      );
      const query = this.sp.web.lists
        .getByTitle(KUDOS_LIST_TITLE)
        .items
        .select(
          'Id',
          'Title',
          'AgenteEmail',
          'AgenteObjectID',
          'Atributo',
          'Mensaje',
          'Puntos',
          'FechaKudo',
          'Remitente',
          'AuditID'
        )
        .orderBy('FechaKudo', false);

      const items = filter
        ? await query.filter(filter).getAll<IKudoHistorialItem>()
        : await query.getAll<IKudoHistorialItem>();

      return items.filter((item) => isItemInAgentScope(
        item,
        agenteNombre,
        agenteEmail,
        agenteObjectId
      ));
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `No fue posible consultar el historial de reconocimientos en ${KUDOS_LIST_TITLE}: ${detail}`
      );
    }
  }

  public async getKudosMensuales(): Promise<IKudoListItem[]> {
    try {
      await this.ensureRegistroKudosList();

      const items: IKudoListItem[] = await this.sp.web.lists
        .getByTitle(KUDOS_LIST_TITLE)
        .items
        .select('Title', 'AgenteEmail', 'AgenteObjectID', 'Puntos')();

      return items;
    } catch {
      // El Dashboard se presenta vacío si la lista todavía no está disponible.
      return [];
    }
  }

  public async ensureRegistroProductividadList(): Promise<void> {
    let provisioningStep = 'crear o verificar la lista';

    try {
      const listEnsure = await this.sp.web.lists.ensure(
        PRODUCTIVITY_LIST_TITLE,
        PRODUCTIVITY_LIST_DESCRIPTION,
        100,
        false
      );

      let existingInternalNames: string[];

      if (listEnsure.created) {
        existingInternalNames = [];
      } else {
        provisioningStep = 'consultar las columnas existentes';
        const existingFields = await listEnsure.list.fields
          .select('InternalName')();
        existingInternalNames = existingFields.map((field) => field.InternalName);
      }

      if (existingInternalNames.indexOf('FechaRegistro') < 0) {
        provisioningStep = 'crear la columna FechaRegistro';
        const result = await listEnsure.list.fields.addDateTime(
          'FechaRegistro'
        );
        provisioningStep = 'asignar el nombre visible de FechaRegistro';
        await result.field.update({ Title: 'Fecha de Registro' });
      }

      if (existingInternalNames.indexOf('FechaInicio') < 0) {
        provisioningStep = 'crear la columna FechaInicio';
        const result = await listEnsure.list.fields.addDateTime(
          'FechaInicio'
        );
        provisioningStep = 'asignar el nombre visible de FechaInicio';
        await result.field.update({ Title: 'Fecha Inicio' });
      }

      if (existingInternalNames.indexOf('FechaFin') < 0) {
        provisioningStep = 'crear la columna FechaFin';
        const result = await listEnsure.list.fields.addDateTime(
          'FechaFin'
        );
        provisioningStep = 'asignar el nombre visible de FechaFin';
        await result.field.update({ Title: 'Fecha Fin' });
      }

      if (existingInternalNames.indexOf('Casos') < 0) {
        provisioningStep = 'crear la columna Casos';
        const result = await listEnsure.list.fields.addNumber(
          'Casos',
          { MinimumValue: 0 }
        );
        provisioningStep = 'asignar el nombre visible de Casos';
        await result.field.update({ Title: 'Cantidad de Casos' });
      }

      if (existingInternalNames.indexOf('CasosAtendidos') < 0) {
        provisioningStep = 'crear la columna CasosAtendidos';
        const result = await listEnsure.list.fields.addNumber(
          'CasosAtendidos',
          { MinimumValue: 0 }
        );
        provisioningStep = 'asignar el nombre visible de CasosAtendidos';
        await result.field.update({ Title: 'Casos Atendidos (Totales)' });
      }

      if (existingInternalNames.indexOf('CasosATiempo') < 0) {
        provisioningStep = 'crear la columna CasosATiempo';
        const result = await listEnsure.list.fields.addNumber(
          'CasosATiempo',
          { MinimumValue: 0 }
        );
        provisioningStep = 'asignar el nombre visible de CasosATiempo';
        await result.field.update({
          Title: 'Casos Resueltos a Tiempo (Dentro de SLA)'
        });
      }

      if (existingInternalNames.indexOf('EmisionesTx') < 0) {
        provisioningStep = 'crear la columna EmisionesTx';
        const result = await listEnsure.list.fields.addNumber(
          'EmisionesTx',
          { MinimumValue: 0 }
        );
        provisioningStep = 'asignar el nombre visible de EmisionesTx';
        await result.field.update({ Title: 'Emisiones - Transacciones' });
      }

      if (existingInternalNames.indexOf('EmisionesPg') < 0) {
        provisioningStep = 'crear la columna EmisionesPg';
        const result = await listEnsure.list.fields.addNumber(
          'EmisionesPg',
          { MinimumValue: 0 }
        );
        provisioningStep = 'asignar el nombre visible de EmisionesPg';
        await result.field.update({ Title: 'Emisiones - Páginas Digitadas' });
      }

      if (existingInternalNames.indexOf('MovimientosTx') < 0) {
        provisioningStep = 'crear la columna MovimientosTx';
        const result = await listEnsure.list.fields.addNumber(
          'MovimientosTx',
          { MinimumValue: 0 }
        );
        provisioningStep = 'asignar el nombre visible de MovimientosTx';
        await result.field.update({ Title: 'Movimientos - Transacciones' });
      }

      if (existingInternalNames.indexOf('MovimientosPg') < 0) {
        provisioningStep = 'crear la columna MovimientosPg';
        const result = await listEnsure.list.fields.addNumber(
          'MovimientosPg',
          { MinimumValue: 0 }
        );
        provisioningStep = 'asignar el nombre visible de MovimientosPg';
        await result.field.update({ Title: 'Movimientos - Páginas Digitadas' });
      }

      if (existingInternalNames.indexOf('EscaneoTx') < 0) {
        provisioningStep = 'crear la columna EscaneoTx';
        const result = await listEnsure.list.fields.addNumber(
          'EscaneoTx',
          { MinimumValue: 0 }
        );
        provisioningStep = 'asignar el nombre visible de EscaneoTx';
        await result.field.update({ Title: 'Escaneo - Transacciones' });
      }

      if (existingInternalNames.indexOf('EscaneoPg') < 0) {
        provisioningStep = 'crear la columna EscaneoPg';
        const result = await listEnsure.list.fields.addNumber(
          'EscaneoPg',
          { MinimumValue: 0 }
        );
        provisioningStep = 'asignar el nombre visible de EscaneoPg';
        await result.field.update({ Title: 'Escaneo - Páginas Escaneadas' });
      }

      // Campos agregados v3: se conservan para lecturas históricas y para
      // consumidores que todavía no migran al detalle de siete métricas.
      if (existingInternalNames.indexOf('Emisiones') < 0) {
        provisioningStep = 'crear la columna Emisiones';
        const result = await listEnsure.list.fields.addNumber(
          'Emisiones',
          { MinimumValue: 0 }
        );
        provisioningStep = 'asignar el nombre visible de Emisiones';
        await result.field.update({ Title: 'Emisiones' });
      }

      if (existingInternalNames.indexOf('Movimientos') < 0) {
        provisioningStep = 'crear la columna Movimientos';
        const result = await listEnsure.list.fields.addNumber(
          'Movimientos',
          { MinimumValue: 0 }
        );
        provisioningStep = 'asignar el nombre visible de Movimientos';
        await result.field.update({ Title: 'Movimientos' });
      }

      if (existingInternalNames.indexOf('AgenteEmail') < 0) {
        provisioningStep = 'crear la columna AgenteEmail';
        const result = await listEnsure.list.fields.addText('AgenteEmail');
        provisioningStep = 'asignar el nombre visible de AgenteEmail';
        await result.field.update({ Title: 'Correo del Agente' });
      }

      if (existingInternalNames.indexOf('AgenteObjectID') < 0) {
        provisioningStep = 'crear la columna AgenteObjectID';
        const result = await listEnsure.list.fields.addText('AgenteObjectID');
        provisioningStep = 'asignar el nombre visible de AgenteObjectID';
        await result.field.update({ Title: 'Object ID Entra ID' });
      }

      if (existingInternalNames.indexOf('AuditID') < 0) {
        provisioningStep = 'crear la columna AuditID';
        const result = await listEnsure.list.fields.addText('AuditID');
        provisioningStep = 'asignar el nombre visible de AuditID';
        await result.field.update({ Title: 'ID de Auditoría' });
      }

      provisioningStep = 'obtener la vista predeterminada';
      const defaultView = await listEnsure.list.defaultView;
      const defaultViewFields = await defaultView.fields();

      if (defaultViewFields.Items.indexOf('FechaRegistro') < 0) {
        provisioningStep = 'agregar FechaRegistro a la vista predeterminada';
        await defaultView.fields.add('FechaRegistro');
      }

      if (defaultViewFields.Items.indexOf('FechaInicio') < 0) {
        provisioningStep = 'agregar FechaInicio a la vista predeterminada';
        await defaultView.fields.add('FechaInicio');
      }

      if (defaultViewFields.Items.indexOf('FechaFin') < 0) {
        provisioningStep = 'agregar FechaFin a la vista predeterminada';
        await defaultView.fields.add('FechaFin');
      }

      if (defaultViewFields.Items.indexOf('Casos') < 0) {
        provisioningStep = 'agregar Casos a la vista predeterminada';
        await defaultView.fields.add('Casos');
      }

      if (defaultViewFields.Items.indexOf('CasosAtendidos') < 0) {
        provisioningStep = 'agregar CasosAtendidos a la vista predeterminada';
        await defaultView.fields.add('CasosAtendidos');
      }

      if (defaultViewFields.Items.indexOf('CasosATiempo') < 0) {
        provisioningStep = 'agregar CasosATiempo a la vista predeterminada';
        await defaultView.fields.add('CasosATiempo');
      }

      if (defaultViewFields.Items.indexOf('EmisionesTx') < 0) {
        provisioningStep = 'agregar EmisionesTx a la vista predeterminada';
        await defaultView.fields.add('EmisionesTx');
      }

      if (defaultViewFields.Items.indexOf('EmisionesPg') < 0) {
        provisioningStep = 'agregar EmisionesPg a la vista predeterminada';
        await defaultView.fields.add('EmisionesPg');
      }

      if (defaultViewFields.Items.indexOf('MovimientosTx') < 0) {
        provisioningStep = 'agregar MovimientosTx a la vista predeterminada';
        await defaultView.fields.add('MovimientosTx');
      }

      if (defaultViewFields.Items.indexOf('MovimientosPg') < 0) {
        provisioningStep = 'agregar MovimientosPg a la vista predeterminada';
        await defaultView.fields.add('MovimientosPg');
      }

      if (defaultViewFields.Items.indexOf('EscaneoTx') < 0) {
        provisioningStep = 'agregar EscaneoTx a la vista predeterminada';
        await defaultView.fields.add('EscaneoTx');
      }

      if (defaultViewFields.Items.indexOf('EscaneoPg') < 0) {
        provisioningStep = 'agregar EscaneoPg a la vista predeterminada';
        await defaultView.fields.add('EscaneoPg');
      }

      if (defaultViewFields.Items.indexOf('Emisiones') < 0) {
        provisioningStep = 'agregar Emisiones a la vista predeterminada';
        await defaultView.fields.add('Emisiones');
      }

      if (defaultViewFields.Items.indexOf('Movimientos') < 0) {
        provisioningStep = 'agregar Movimientos a la vista predeterminada';
        await defaultView.fields.add('Movimientos');
      }

      if (defaultViewFields.Items.indexOf('AgenteEmail') < 0) {
        provisioningStep = 'agregar AgenteEmail a la vista predeterminada';
        await defaultView.fields.add('AgenteEmail');
      }

      if (defaultViewFields.Items.indexOf('AgenteObjectID') < 0) {
        provisioningStep = 'agregar AgenteObjectID a la vista predeterminada';
        await defaultView.fields.add('AgenteObjectID');
      }

      if (defaultViewFields.Items.indexOf('AuditID') < 0) {
        provisioningStep = 'agregar AuditID a la vista predeterminada';
        await defaultView.fields.add('AuditID');
      }
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Error al ${provisioningStep} en ${PRODUCTIVITY_LIST_TITLE}: ${detail}`
      );
    }
  }

  /**
   * Alias conservado para consumidores de la versión 2.0.
   */
  public async ensureProductividadList(): Promise<void> {
    await this.ensureRegistroProductividadList();
  }

  public async registrarProductividad(
    data: IRegistrarProductividadData
  ): Promise<void> {
    try {
      await this.ensureRegistroProductividadList();

      const agente = data.agente.trim();
      const agenteEmail = normalizeEmail(data.agenteEmail);
      const startBoundary = getDayBoundary(
        data.fechaInicio,
        'start',
        'La fecha de inicio'
      );
      const endBoundary = getDayBoundary(
        data.fechaFin,
        'end',
        'La fecha de fin'
      );

      if (!agente) {
        throw new Error('El nombre del colaborador es obligatorio.');
      }

      if (!agenteEmail) {
        throw new Error(
          'El correo del colaborador es obligatorio para validar el rango.'
        );
      }

      if (startBoundary.getTime() > endBoundary.getTime()) {
        throw new Error(
          'La fecha de inicio no puede ser posterior a la fecha de fin.'
        );
      }

      const numericValues = [
        data.casosAtendidos,
        data.casosATiempo,
        data.emisionesTx,
        data.emisionesPg,
        data.movimientosTx,
        data.movimientosPg,
        data.escaneoTx,
        data.escaneoPg
      ];

      if (numericValues.some(
        (value) => !Number.isFinite(value) || value < 0
      )) {
        throw new Error(
          'Los valores de productividad deben ser números mayores o iguales a cero.'
        );
      }

      if (data.casosATiempo > data.casosAtendidos) {
        throw new Error(
          'Los casos resueltos a tiempo no pueden exceder los casos atendidos.'
        );
      }

      const list = this.sp.web.lists.getByTitle(PRODUCTIVITY_LIST_TITLE);
      const existingRanges = await list.items
        .filter(`AgenteEmail eq '${escapeODataString(agenteEmail)}'`)
        .select('Id', 'FechaRegistro', 'FechaInicio', 'FechaFin')
        .getAll<IExistingProductividadRange>();
      const hasOverlap = existingRanges.some((existingRange) => {
        const existingStartValue =
          existingRange.FechaInicio || existingRange.FechaRegistro;
        const existingEndValue =
          existingRange.FechaFin ||
          existingRange.FechaInicio ||
          existingRange.FechaRegistro;

        if (!existingStartValue || !existingEndValue) {
          return false;
        }

        const existingStart = new Date(existingStartValue);
        const existingEnd = new Date(existingEndValue);

        if (
          Number.isNaN(existingStart.getTime()) ||
          Number.isNaN(existingEnd.getTime())
        ) {
          return false;
        }

        const effectiveExistingStart = existingRange.FechaInicio
          ? existingStart
          : getDayBoundary(
              existingStart,
              'start',
              'La fecha de un registro existente'
            );
        const effectiveExistingEnd = existingRange.FechaFin
          ? existingEnd
          : getDayBoundary(
              existingEnd,
              'end',
              'La fecha de un registro existente'
            );

        return (
          startBoundary.getTime() <= effectiveExistingEnd.getTime() &&
          endBoundary.getTime() >= effectiveExistingStart.getTime()
        );
      });

      if (hasOverlap) {
        throw new Error(PRODUCTIVITY_OVERLAP_ERROR_MESSAGE);
      }

      await list.items.add({
        AuditID: generateAuditID(),
        Title: agente,
        AgenteEmail: agenteEmail,
        AgenteObjectID: data.agenteObjectId?.trim() || '',
        FechaRegistro: new Date().toISOString(),
        FechaInicio: startBoundary.toISOString(),
        FechaFin: endBoundary.toISOString(),
        CasosAtendidos: data.casosAtendidos,
        CasosATiempo: data.casosATiempo,
        EmisionesTx: data.emisionesTx,
        EmisionesPg: data.emisionesPg,
        MovimientosTx: data.movimientosTx,
        MovimientosPg: data.movimientosPg,
        EscaneoTx: data.escaneoTx,
        EscaneoPg: data.escaneoPg,
        // Alias v3: mantienen funcionales los reportes existentes durante la
        // transición y permiten comparar registros históricos con v4.
        Emisiones: data.emisiones ?? data.emisionesTx,
        Movimientos: data.movimientos ?? data.movimientosPg
      });
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message === PRODUCTIVITY_OVERLAP_ERROR_MESSAGE
      ) {
        throw error;
      }

      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`No fue posible registrar la productividad: ${detail}`);
    }
  }

  public async getProductividadHistorial(
    startDate?: Date,
    endDate?: Date,
    agenteNombre?: string,
    agenteEmail?: string,
    agenteObjectId?: string
  ): Promise<IProductividadHistorialItem[]> {
    try {
      await this.ensureRegistroProductividadList();

      const legacyFilter = buildHistorialFilter(
        'FechaRegistro',
        startDate,
        endDate
      );
      const periodStart = startDate
        ? getDayBoundary(startDate, 'start', 'La fecha de inicio')
        : undefined;
      const periodEnd = endDate
        ? getDayBoundary(endDate, 'end', 'La fecha de fin')
        : undefined;

      if (
        periodStart &&
        periodEnd &&
        periodStart.getTime() > periodEnd.getTime()
      ) {
        throw new Error(
          'La fecha de inicio no puede ser posterior a la fecha de fin.'
        );
      }

      const overlapClauses: string[] = [];

      if (periodEnd) {
        overlapClauses.push(
          `FechaInicio le datetime'${periodEnd.toISOString()}'`
        );
      }

      if (periodStart) {
        overlapClauses.push(
          `FechaFin ge datetime'${periodStart.toISOString()}'`
        );
      }

      const overlapFilter = overlapClauses.join(' and ');
      const selectedFields = [
        'Id',
        'Title',
        'AgenteEmail',
        'AgenteObjectID',
        'FechaRegistro',
        'FechaInicio',
        'FechaFin',
        'Casos',
        'CasosAtendidos',
        'CasosATiempo',
        'Emisiones',
        'Movimientos',
        'EmisionesTx',
        'EmisionesPg',
        'MovimientosTx',
        'MovimientosPg',
        'EscaneoTx',
        'EscaneoPg',
        'AuditID'
      ];
      const list = this.sp.web.lists.getByTitle(PRODUCTIVITY_LIST_TITLE);
      let items: IProductividadHistorialItem[];

      if (!overlapFilter) {
        items = await list.items
          .select(...selectedFields)
          .orderBy('FechaRegistro', false)
          .getAll<IProductividadHistorialItem>();
      } else {
        const [rangeItems, legacyItems] = await Promise.all([
          list.items
            .select(...selectedFields)
            .filter(overlapFilter)
            .getAll<IProductividadHistorialItem>(),
          list.items
            .select(...selectedFields)
            .filter(legacyFilter)
            .getAll<IProductividadHistorialItem>()
        ]);
        const itemsById = new Map<number, IProductividadHistorialItem>();

        [...rangeItems, ...legacyItems].forEach((item) => {
          itemsById.set(item.Id, item);
        });
        items = Array.from(itemsById.values());
      }

      return items.map(normalizeProductividadMetrics).filter((item) => {
        if (!isItemInAgentScope(
          item,
          agenteNombre,
          agenteEmail,
          agenteObjectId
        )) {
          return false;
        }

        const itemStartValue = item.FechaInicio || item.FechaRegistro;
        const itemEndValue =
          item.FechaFin || item.FechaInicio || item.FechaRegistro;
        const rawItemStart = new Date(itemStartValue);
        const rawItemEnd = new Date(itemEndValue);

        if (
          Number.isNaN(rawItemStart.getTime()) ||
          Number.isNaN(rawItemEnd.getTime())
        ) {
          return false;
        }

        const itemStart = item.FechaInicio
          ? rawItemStart
          : getDayBoundary(
              rawItemStart,
              'start',
              'La fecha de un registro existente'
            );
        const itemEnd = item.FechaFin
          ? rawItemEnd
          : getDayBoundary(
              rawItemEnd,
              'end',
              'La fecha de un registro existente'
            );

        return (
          (!periodEnd || itemStart.getTime() <= periodEnd.getTime()) &&
          (!periodStart || itemEnd.getTime() >= periodStart.getTime())
        );
      });
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `No fue posible consultar el historial de productividad en ${PRODUCTIVITY_LIST_TITLE}: ${detail}`
      );
    }
  }

  public async ensureRegistroAusenciasList(): Promise<void> {
    let provisioningStep = 'verificar si la lista existe';

    try {
      let listCreated = false;

      try {
        await this.sp.web.lists
          .getByTitle(ABSENCES_LIST_TITLE)
          .select('Id')();
      } catch (lookupError: unknown) {
        if (!isSharePointNotFoundError(lookupError)) {
          throw lookupError;
        }

        provisioningStep = 'crear la lista inexistente';
        const listEnsure = await this.sp.web.lists.ensure(
          ABSENCES_LIST_TITLE,
          ABSENCES_LIST_DESCRIPTION,
          100,
          false
        );

        listCreated = listEnsure.created;
      }

      const list = this.sp.web.lists.getByTitle(ABSENCES_LIST_TITLE);

      provisioningStep = 'consultar las columnas existentes';
      const existingFields = await list.fields.select('InternalName')();
      const existingInternalNames = existingFields.map(
        (field) => field.InternalName
      );

      if (listCreated) {
        provisioningStep = 'configurar la columna Title para el agente';
        await list.fields
          .getByInternalNameOrTitle('Title')
          .update({ Title: 'Nombre del Agente' });
      }

      if (existingInternalNames.indexOf('AgenteEmail') < 0) {
        provisioningStep = 'crear la columna AgenteEmail';
        const result = await list.fields.addText('AgenteEmail');
        provisioningStep = 'asignar el nombre visible de AgenteEmail';
        await result.field.update({ Title: 'Correo del Agente' });
      }

      if (existingInternalNames.indexOf('AgenteObjectID') < 0) {
        provisioningStep = 'crear la columna AgenteObjectID';
        const result = await list.fields.addText('AgenteObjectID');
        provisioningStep = 'asignar el nombre visible de AgenteObjectID';
        await result.field.update({ Title: 'Object ID Entra ID' });
      }

      if (existingInternalNames.indexOf('TipoAusencia') < 0) {
        provisioningStep = 'crear la columna TipoAusencia';
        const result = await list.fields.addText('TipoAusencia', {
          Required: true
        });
        provisioningStep = 'asignar el nombre visible de TipoAusencia';
        await result.field.update({ Title: 'Tipo de Ausencia' });
      }

      if (existingInternalNames.indexOf('FechaInicio') < 0) {
        provisioningStep = 'crear la columna FechaInicio';
        const result = await list.fields.addDateTime('FechaInicio', {
          Required: true
        });
        provisioningStep = 'asignar el nombre visible de FechaInicio';
        await result.field.update({ Title: 'Fecha Inicio' });
      }

      if (existingInternalNames.indexOf('FechaFin') < 0) {
        provisioningStep = 'crear la columna FechaFin';
        const result = await list.fields.addDateTime('FechaFin', {
          Required: true
        });
        provisioningStep = 'asignar el nombre visible de FechaFin';
        await result.field.update({ Title: 'Fecha Fin' });
      }

      if (existingInternalNames.indexOf('Comentarios') < 0) {
        provisioningStep = 'crear la columna Comentarios';
        const result = await list.fields.addMultilineText('Comentarios', {
          NumberOfLines: 6,
          RichText: false
        });
        provisioningStep = 'asignar el nombre visible de Comentarios';
        await result.field.update({ Title: 'Comentarios' });
      }

      if (existingInternalNames.indexOf('AuditID') < 0) {
        provisioningStep = 'crear la columna AuditID';
        const result = await list.fields.addText('AuditID');
        provisioningStep = 'asignar el nombre visible de AuditID';
        await result.field.update({ Title: 'ID de Auditoría' });
      }

      provisioningStep = 'obtener la vista predeterminada';
      const defaultView = await list.defaultView;
      const defaultViewFields = await defaultView.fields();
      const visibleFields = defaultViewFields.Items;

      if (visibleFields.indexOf('AgenteEmail') < 0) {
        provisioningStep = 'agregar AgenteEmail a la vista predeterminada';
        await defaultView.fields.add('AgenteEmail');
      }

      if (visibleFields.indexOf('AgenteObjectID') < 0) {
        provisioningStep = 'agregar AgenteObjectID a la vista predeterminada';
        await defaultView.fields.add('AgenteObjectID');
      }

      if (visibleFields.indexOf('TipoAusencia') < 0) {
        provisioningStep = 'agregar TipoAusencia a la vista predeterminada';
        await defaultView.fields.add('TipoAusencia');
      }

      if (visibleFields.indexOf('FechaInicio') < 0) {
        provisioningStep = 'agregar FechaInicio a la vista predeterminada';
        await defaultView.fields.add('FechaInicio');
      }

      if (visibleFields.indexOf('FechaFin') < 0) {
        provisioningStep = 'agregar FechaFin a la vista predeterminada';
        await defaultView.fields.add('FechaFin');
      }

      if (visibleFields.indexOf('Comentarios') < 0) {
        provisioningStep = 'agregar Comentarios a la vista predeterminada';
        await defaultView.fields.add('Comentarios');
      }

      if (visibleFields.indexOf('AuditID') < 0) {
        provisioningStep = 'agregar AuditID a la vista predeterminada';
        await defaultView.fields.add('AuditID');
      }
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Error al ${provisioningStep} en ${ABSENCES_LIST_TITLE}: ${detail}`
      );
    }
  }

  public async registrarAusencia(
    data: IRegistrarAusenciaData
  ): Promise<void> {
    const normalizedAgent = data.agente.trim();

    if (!normalizedAgent) {
      throw new Error('Debes seleccionar el agente de la ausencia.');
    }

    if (!isAusenciaType(data.tipoAusencia)) {
      throw new Error(
        `El tipo de ausencia "${String(data.tipoAusencia)}" no es válido.`
      );
    }

    const startBoundary = getDayBoundary(
      data.fechaInicio,
      'start',
      'La fecha de inicio'
    );
    const endBoundary = getDayBoundary(
      data.fechaFin,
      'end',
      'La fecha de fin'
    );

    if (startBoundary.getTime() > endBoundary.getTime()) {
      throw new Error(
        'La fecha de inicio no puede ser posterior a la fecha de fin.'
      );
    }

    try {
      await this.ensureRegistroAusenciasList();

      await this.sp.web.lists
        .getByTitle(ABSENCES_LIST_TITLE)
        .items
        .add({
          AuditID: generateAuditID(),
          Title: normalizedAgent,
          AgenteEmail: normalizeEmail(data.agenteEmail),
          AgenteObjectID: data.agenteObjectId?.trim() || '',
          TipoAusencia: data.tipoAusencia,
          FechaInicio: startBoundary.toISOString(),
          FechaFin: endBoundary.toISOString(),
          Comentarios: data.comentarios?.trim() || ''
        });
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`No fue posible registrar la ausencia: ${detail}`);
    }
  }

  public async getAusencias(
    startDate: Date,
    endDate: Date
  ): Promise<IAusenciaItem[]> {
    const startBoundary = getDayBoundary(
      startDate,
      'start',
      'La fecha de inicio'
    );
    const endBoundary = getDayBoundary(
      endDate,
      'end',
      'La fecha de fin'
    );

    if (startBoundary.getTime() > endBoundary.getTime()) {
      throw new Error(
        'La fecha de inicio no puede ser posterior a la fecha de fin.'
      );
    }

    try {
      await this.ensureRegistroAusenciasList();

      const overlapFilter =
        `FechaInicio le datetime'${endBoundary.toISOString()}' and ` +
        `FechaFin ge datetime'${startBoundary.toISOString()}'`;

      return await this.sp.web.lists
        .getByTitle(ABSENCES_LIST_TITLE)
        .items
        .select(
          'Id',
          'Title',
          'AgenteEmail',
          'AgenteObjectID',
          'TipoAusencia',
          'FechaInicio',
          'FechaFin',
          'Comentarios',
          'AuditID'
        )
        .filter(overlapFilter)
        .orderBy('FechaInicio', true)
        .getAll<IAusenciaItem>();
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `No fue posible consultar las ausencias en ${ABSENCES_LIST_TITLE}: ${detail}`
      );
    }
  }

  public async ensureRegistroOcupacionLlamadasList(): Promise<void> {
    let provisioningStep = 'crear o verificar la lista';

    try {
      const listEnsure = await this.sp.web.lists.ensure(
        FLEET_CALLS_LIST_TITLE,
        FLEET_CALLS_LIST_DESCRIPTION,
        100,
        false
      );
      const list = listEnsure.list;

      provisioningStep = 'consultar las columnas existentes';
      const existingFields = await list.fields.select('InternalName')();
      const existingInternalNames = existingFields.map(
        (field) => field.InternalName
      );

      if (listEnsure.created) {
        provisioningStep = 'configurar la columna Title para Caso / Contacto';
        await list.fields
          .getByInternalNameOrTitle('Title')
          .update({ Title: 'Caso / Contacto' });
      }

      if (existingInternalNames.indexOf('SupervisorEmail') < 0) {
        provisioningStep = 'crear la columna SupervisorEmail';
        const result = await list.fields.addText('SupervisorEmail', {
          Required: true
        });
        provisioningStep = 'asignar el nombre visible de SupervisorEmail';
        await result.field.update({ Title: 'Correo del Supervisor' });
      }

      if (existingInternalNames.indexOf('FechaHora') < 0) {
        provisioningStep = 'crear la columna FechaHora';
        const result = await list.fields.addDateTime('FechaHora', {
          Required: true
        });
        provisioningStep = 'asignar el nombre visible de FechaHora';
        await result.field.update({ Title: 'Fecha / Hora' });
      }

      if (existingInternalNames.indexOf('DuracionMinutos') < 0) {
        provisioningStep = 'crear la columna DuracionMinutos';
        const result = await list.fields.addNumber('DuracionMinutos', {
          MinimumValue: 0,
          Required: true
        });
        provisioningStep = 'asignar el nombre visible de DuracionMinutos';
        await result.field.update({ Title: 'Duración en Minutos' });
      }

      if (existingInternalNames.indexOf('Comentarios') < 0) {
        provisioningStep = 'crear la columna Comentarios';
        const result = await list.fields.addMultilineText('Comentarios', {
          NumberOfLines: 6,
          RichText: false
        });
        provisioningStep = 'asignar el nombre visible de Comentarios';
        await result.field.update({ Title: 'Comentarios' });
      }

      if (existingInternalNames.indexOf('AuditID') < 0) {
        provisioningStep = 'crear la columna AuditID';
        const result = await list.fields.addText('AuditID');
        provisioningStep = 'asignar el nombre visible de AuditID';
        await result.field.update({ Title: 'ID de Auditoría' });
      }

      provisioningStep = 'obtener la vista predeterminada';
      const defaultView = await list.defaultView;
      const defaultViewFields = await defaultView.fields();
      const visibleFields = defaultViewFields.Items;

      if (visibleFields.indexOf('SupervisorEmail') < 0) {
        provisioningStep =
          'agregar SupervisorEmail a la vista predeterminada';
        await defaultView.fields.add('SupervisorEmail');
      }

      if (visibleFields.indexOf('FechaHora') < 0) {
        provisioningStep = 'agregar FechaHora a la vista predeterminada';
        await defaultView.fields.add('FechaHora');
      }

      if (visibleFields.indexOf('DuracionMinutos') < 0) {
        provisioningStep =
          'agregar DuracionMinutos a la vista predeterminada';
        await defaultView.fields.add('DuracionMinutos');
      }

      if (visibleFields.indexOf('Comentarios') < 0) {
        provisioningStep = 'agregar Comentarios a la vista predeterminada';
        await defaultView.fields.add('Comentarios');
      }

      if (visibleFields.indexOf('AuditID') < 0) {
        provisioningStep = 'agregar AuditID a la vista predeterminada';
        await defaultView.fields.add('AuditID');
      }
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Error al ${provisioningStep} en ${FLEET_CALLS_LIST_TITLE}: ${detail}`
      );
    }
  }

  public async registrarLlamadaFlota(
    data: IRegistrarLlamadaFlotaData
  ): Promise<void> {
    const casoContacto = data.casoContacto.trim();
    const supervisorEmail = normalizeEmail(data.supervisorEmail);

    if (!casoContacto) {
      throw new Error('Debes indicar el caso o contacto de la llamada.');
    }

    if (!supervisorEmail) {
      throw new Error('No se pudo identificar el correo del supervisor.');
    }

    if (Number.isNaN(data.fechaHora.getTime())) {
      throw new Error('La fecha y hora de la llamada no es válida.');
    }

    if (
      !Number.isFinite(data.duracionMinutos) ||
      data.duracionMinutos <= 0
    ) {
      throw new Error('La duración debe ser mayor que cero minutos.');
    }

    try {
      await this.ensureRegistroOcupacionLlamadasList();

      await this.sp.web.lists
        .getByTitle(FLEET_CALLS_LIST_TITLE)
        .items
        .add({
          AuditID: generateAuditID(),
          Title: casoContacto,
          SupervisorEmail: supervisorEmail,
          FechaHora: data.fechaHora.toISOString(),
          DuracionMinutos: Math.round(data.duracionMinutos * 100) / 100,
          Comentarios: data.comentarios?.trim() || ''
        });
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`No fue posible registrar la llamada: ${detail}`);
    }
  }

  public async getLlamadasFlota(
    startDate: Date,
    endDate: Date,
    supervisorEmail?: string
  ): Promise<ILlamadaFlotaItem[]> {
    const startBoundary = getDayBoundary(
      startDate,
      'start',
      'La fecha de inicio'
    );
    const endBoundary = getDayBoundary(
      endDate,
      'end',
      'La fecha de fin'
    );

    if (startBoundary.getTime() > endBoundary.getTime()) {
      throw new Error(
        'La fecha de inicio no puede ser posterior a la fecha de fin.'
      );
    }

    try {
      await this.ensureRegistroOcupacionLlamadasList();

      const filterClauses = [
        `FechaHora ge datetime'${startBoundary.toISOString()}' and ` +
        `FechaHora le datetime'${endBoundary.toISOString()}'`
      ];
      const normalizedSupervisorEmail = normalizeEmail(supervisorEmail);

      if (normalizedSupervisorEmail) {
        filterClauses.push(
          `SupervisorEmail eq '${escapeODataString(
            normalizedSupervisorEmail
          )}'`
        );
      }

      return await this.sp.web.lists
        .getByTitle(FLEET_CALLS_LIST_TITLE)
        .items
        .select(
          'Id',
          'Title',
          'SupervisorEmail',
          'FechaHora',
          'DuracionMinutos',
          'Comentarios',
          'AuditID'
        )
        .filter(filterClauses.join(' and '))
        .orderBy('FechaHora', false)
        .getAll<ILlamadaFlotaItem>();
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `No fue posible consultar las llamadas en ${FLEET_CALLS_LIST_TITLE}: ${detail}`
      );
    }
  }

  public async ensureRegistroOcupacionCorreosList(): Promise<void> {
    let provisioningStep = 'crear o verificar la lista';

    try {
      const listEnsure = await this.sp.web.lists.ensure(
        EMAIL_OCCUPANCY_LIST_TITLE,
        EMAIL_OCCUPANCY_LIST_DESCRIPTION,
        100,
        false
      );
      const list = listEnsure.list;

      provisioningStep = 'consultar las columnas existentes';
      const existingFields = await list.fields.select(
        'InternalName',
        'Title'
      )();
      const existingInternalNames = existingFields.map(
        (field) => field.InternalName
      );
      const titleField = existingFields.find(
        (field) => field.InternalName === 'Title'
      );

      if (titleField?.Title !== 'SupervisorEmail') {
        provisioningStep = 'configurar Title como SupervisorEmail';
        await list.fields
          .getByInternalNameOrTitle('Title')
          .update({ Title: 'SupervisorEmail' });
      }

      if (existingInternalNames.indexOf('Fecha') < 0) {
        provisioningStep = 'crear la columna Fecha';
        const result = await list.fields.addDateTime('Fecha', {
          Required: true
        });
        provisioningStep = 'asignar el nombre visible de Fecha';
        await result.field.update({ Title: 'Fecha de Registro' });
      }

      if (existingInternalNames.indexOf('CantidadCorreos') < 0) {
        provisioningStep = 'crear la columna CantidadCorreos';
        const result = await list.fields.addNumber('CantidadCorreos', {
          MinimumValue: 0,
          Required: true
        });
        provisioningStep = 'asignar el nombre visible de CantidadCorreos';
        await result.field.update({
          Title: 'Cantidad de Correos Enviados'
        });
      }

      if (existingInternalNames.indexOf('Comentarios') < 0) {
        provisioningStep = 'crear la columna Comentarios';
        const result = await list.fields.addMultilineText('Comentarios', {
          NumberOfLines: 6,
          RichText: false
        });
        provisioningStep = 'asignar el nombre visible de Comentarios';
        await result.field.update({
          Title: 'Comentarios u Observaciones'
        });
      }

      provisioningStep = 'obtener la vista predeterminada';
      const defaultView = await list.defaultView;
      const defaultViewFields = await defaultView.fields();
      const visibleFields = defaultViewFields.Items;

      if (visibleFields.indexOf('Fecha') < 0) {
        provisioningStep = 'agregar Fecha a la vista predeterminada';
        await defaultView.fields.add('Fecha');
      }

      if (visibleFields.indexOf('CantidadCorreos') < 0) {
        provisioningStep =
          'agregar CantidadCorreos a la vista predeterminada';
        await defaultView.fields.add('CantidadCorreos');
      }

      if (visibleFields.indexOf('Comentarios') < 0) {
        provisioningStep = 'agregar Comentarios a la vista predeterminada';
        await defaultView.fields.add('Comentarios');
      }
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Error al ${provisioningStep} en ${EMAIL_OCCUPANCY_LIST_TITLE}: ${detail}`
      );
    }
  }

  public async registrarConteoCorreos(
    data: IRegistrarConteoCorreosData
  ): Promise<void> {
    const supervisorEmail = normalizeEmail(data.supervisorEmail);

    if (!supervisorEmail || !/^[^\s@]+@[^\s@]+$/.test(supervisorEmail)) {
      throw new Error('Debes indicar un correo válido para el supervisor.');
    }

    if (Number.isNaN(data.fecha.getTime())) {
      throw new Error('La fecha del conteo de correos no es válida.');
    }

    if (
      !Number.isSafeInteger(data.cantidadCorreos) ||
      data.cantidadCorreos < 0
    ) {
      throw new Error(
        'La cantidad de correos debe ser un número entero mayor o igual a cero.'
      );
    }

    try {
      await this.ensureRegistroOcupacionCorreosList();

      await this.sp.web.lists
        .getByTitle(EMAIL_OCCUPANCY_LIST_TITLE)
        .items
        .add({
          Title: supervisorEmail,
          Fecha: data.fecha.toISOString(),
          CantidadCorreos: data.cantidadCorreos,
          Comentarios: data.comentarios?.trim() || ''
        });
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `No fue posible registrar el conteo de correos: ${detail}`
      );
    }
  }

  public async getOcupacionCorreos(
    startDate: Date,
    endDate: Date,
    supervisorEmail: string
  ): Promise<IOcupacionCorreoItem[]> {
    const startBoundary = getDayBoundary(
      startDate,
      'start',
      'La fecha de inicio'
    );
    const endBoundary = getDayBoundary(
      endDate,
      'end',
      'La fecha de fin'
    );
    const normalizedSupervisorEmail = normalizeEmail(supervisorEmail);

    if (startBoundary.getTime() > endBoundary.getTime()) {
      throw new Error(
        'La fecha de inicio no puede ser posterior a la fecha de fin.'
      );
    }

    if (
      !normalizedSupervisorEmail ||
      !/^[^\s@]+@[^\s@]+$/.test(normalizedSupervisorEmail)
    ) {
      throw new Error('Debes indicar un correo válido para el supervisor.');
    }

    try {
      await this.ensureRegistroOcupacionCorreosList();

      const dateFilter =
        `Fecha ge datetime'${startBoundary.toISOString()}' and ` +
        `Fecha le datetime'${endBoundary.toISOString()}'`;
      const supervisorFilter =
        `Title eq '${escapeODataString(normalizedSupervisorEmail)}'`;

      return await this.sp.web.lists
        .getByTitle(EMAIL_OCCUPANCY_LIST_TITLE)
        .items
        .select(
          'Id',
          'Title',
          'Fecha',
          'CantidadCorreos',
          'Comentarios'
        )
        .filter(`${dateFilter} and ${supervisorFilter}`)
        .orderBy('Fecha', false)
        .getAll<IOcupacionCorreoItem>();
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `No fue posible consultar la ocupación de correos en ` +
        `${EMAIL_OCCUPANCY_LIST_TITLE}: ${detail}`
      );
    }
  }

  public async ensureConfiguracionRolesList(): Promise<void> {
    let provisioningStep = 'crear o verificar la lista';

    try {
      const listEnsure = await this.sp.web.lists.ensure(
        ROLES_CONFIG_LIST_TITLE,
        ROLES_CONFIG_LIST_DESCRIPTION,
        100,
        false
      );

      let existingInternalNames: string[];

      if (listEnsure.created) {
        existingInternalNames = [];

        provisioningStep = 'configurar la columna Title para el correo';
        await listEnsure.list.fields
          .getByInternalNameOrTitle('Title')
          .update({ Title: 'Correo del usuario' });
      } else {
        provisioningStep = 'consultar las columnas existentes';
        const existingFields = await listEnsure.list.fields
          .select('InternalName')();
        existingInternalNames = existingFields.map(
          (field) => field.InternalName
        );
      }

      if (existingInternalNames.indexOf('RolAsignado') < 0) {
        provisioningStep = 'crear la columna RolAsignado';
        const result = await listEnsure.list.fields.addText('RolAsignado');
        provisioningStep = 'asignar el nombre visible de RolAsignado';
        await result.field.update({ Title: 'Rol Asignado' });
      }

      provisioningStep = 'obtener la vista predeterminada';
      const defaultView = await listEnsure.list.defaultView;
      const defaultViewFields = await defaultView.fields();

      if (defaultViewFields.Items.indexOf('RolAsignado') < 0) {
        provisioningStep = 'agregar RolAsignado a la vista predeterminada';
        await defaultView.fields.add('RolAsignado');
      }
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Error al ${provisioningStep} en ${ROLES_CONFIG_LIST_TITLE}: ${detail}`
      );
    }
  }

  public async getRoleOverrides(): Promise<IRoleOverrideItem[]> {
    try {
      await this.ensureConfiguracionRolesList();

      const items: Array<{
        Id: number;
        Title?: string;
        RolAsignado?: string;
      }> = await this.sp.web.lists
        .getByTitle(ROLES_CONFIG_LIST_TITLE)
        .items
        .select('Id', 'Title', 'RolAsignado')
        .getAll<{
          Id: number;
          Title?: string;
          RolAsignado?: string;
        }>();

      return items.reduce<IRoleOverrideItem[]>((overrides, item) => {
        const email = item.Title?.trim();
        const role = item.RolAsignado?.trim();

        if (email && role && isRoleType(role)) {
          overrides.push({
            Id: item.Id,
            Title: email,
            RolAsignado: role
          });
        }

        return overrides;
      }, []);
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `No fue posible consultar las asignaciones de roles: ${detail}`
      );
    }
  }

  public async setRoleOverride(
    email: string,
    role: RoleType
  ): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || normalizedEmail.indexOf('@') <= 0) {
      throw new Error('Debes indicar un correo electrónico válido.');
    }

    if (!isRoleType(role)) {
      throw new Error(`El rol "${String(role)}" no es válido.`);
    }

    try {
      await this.ensureConfiguracionRolesList();

      const existingItems: Array<{ Id: number }> = await this.sp.web.lists
        .getByTitle(ROLES_CONFIG_LIST_TITLE)
        .items
        .select('Id')
        .filter(`Title eq '${escapeODataString(normalizedEmail)}'`)
        .top(1)();

      const payload = {
        Title: normalizedEmail,
        RolAsignado: role
      };

      if (existingItems.length > 0) {
        await this.sp.web.lists
          .getByTitle(ROLES_CONFIG_LIST_TITLE)
          .items
          .getById(existingItems[0].Id)
          .update(payload);
      } else {
        await this.sp.web.lists
          .getByTitle(ROLES_CONFIG_LIST_TITLE)
          .items
          .add(payload);
      }
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `No fue posible guardar la asignación de rol para ${normalizedEmail}: ${detail}`
      );
    }
  }

  public async ensureConfiguracionCatalogosList(): Promise<void> {
    let provisioningStep = 'verificar si la lista existe';

    try {
      let listCreated = false;

      try {
        await this.sp.web.lists
          .getByTitle(CATALOGS_CONFIG_LIST_TITLE)
          .select('Id')();
      } catch (lookupError: unknown) {
        if (!isSharePointNotFoundError(lookupError)) {
          throw lookupError;
        }

        provisioningStep = 'crear la lista inexistente';
        const listEnsure = await this.sp.web.lists.ensure(
          CATALOGS_CONFIG_LIST_TITLE,
          CATALOGS_CONFIG_LIST_DESCRIPTION,
          100,
          false
        );

        listCreated = listEnsure.created;
      }

      const list = this.sp.web.lists.getByTitle(CATALOGS_CONFIG_LIST_TITLE);

      provisioningStep = 'consultar las columnas existentes';
      const existingFields = await list.fields.select('InternalName')();
      const existingInternalNames = existingFields.map(
        (field) => field.InternalName
      );

      if (listCreated) {
        provisioningStep = 'configurar la columna Title para la categoría';
        await list.fields
          .getByInternalNameOrTitle('Title')
          .update({ Title: 'Categoría' });
      }

      if (existingInternalNames.indexOf('Valor') < 0) {
        provisioningStep = 'crear la columna Valor';
        const result = await list.fields.addText('Valor', {
          Required: true
        });
        provisioningStep = 'asignar el nombre visible de Valor';
        await result.field.update({ Title: 'Valor' });
      }

      provisioningStep = 'obtener la vista predeterminada';
      const defaultView = await list.defaultView;
      const defaultViewFields = await defaultView.fields();

      if (defaultViewFields.Items.indexOf('Valor') < 0) {
        provisioningStep = 'agregar Valor a la vista predeterminada';
        await defaultView.fields.add('Valor');
      }

      provisioningStep = listCreated
        ? 'insertar los valores predeterminados'
        : 'garantizar el catálogo obligatorio de Código de Ética';
      await this.ensureCatalogItems(
        listCreated
          ? DEFAULT_CATALOG_ITEMS
          : MANDATORY_ETHICS_CATEGORY_ITEM
      );
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Error al ${provisioningStep} en ` +
        `${CATALOGS_CONFIG_LIST_TITLE}: ${detail}`
      );
    }
  }

  private async ensureCatalogItems(
    requiredItems: ReadonlyArray<{
      categoria: CatalogCategory;
      valor: string;
    }>
  ): Promise<boolean> {
    const list = this.sp.web.lists.getByTitle(CATALOGS_CONFIG_LIST_TITLE);
    const existingItems = await list.items
      .select('Title', 'Valor')
      .getAll<{ Title?: string; Valor?: string }>();
    const existingKeys = new Set(
      existingItems.map((item) =>
        `${item.Title?.trim().toLocaleLowerCase() || ''}|` +
        `${item.Valor?.trim().toLocaleLowerCase() || ''}`
      )
    );
    let itemAdded = false;

    for (
      let itemIndex = 0;
      itemIndex < requiredItems.length;
      itemIndex += 1
    ) {
      const requiredItem = requiredItems[itemIndex];
      const key =
        `${requiredItem.categoria.toLocaleLowerCase()}|` +
        requiredItem.valor.toLocaleLowerCase();

      if (existingKeys.has(key)) {
        continue;
      }

      await list.items.add({
        Title: requiredItem.categoria,
        Valor: requiredItem.valor
      });
      existingKeys.add(key);
      itemAdded = true;
    }

    return itemAdded;
  }

  private async readCatalogos(
    categoria?: CatalogCategory
  ): Promise<ICatalogoItem[]> {
    const query = this.sp.web.lists
      .getByTitle(CATALOGS_CONFIG_LIST_TITLE)
      .items
      .select('Id', 'Title', 'Valor')
      .orderBy('Valor', true);
    const items: Array<{
      Id: number;
      Title?: string;
      Valor?: string;
    }> = categoria
      ? await query
          .filter(`Title eq '${escapeODataString(categoria)}'`)
          .getAll<{
            Id: number;
            Title?: string;
            Valor?: string;
          }>()
      : await query.getAll<{
          Id: number;
          Title?: string;
          Valor?: string;
        }>();

    return items.reduce<ICatalogoItem[]>((catalogItems, item) => {
      const itemCategory = item.Title?.trim();
      const itemValue = item.Valor?.trim();

      if (itemCategory && itemValue && isCatalogCategory(itemCategory)) {
        catalogItems.push({
          Id: item.Id,
          Title: itemCategory,
          Valor: itemValue
        });
      }

      return catalogItems;
    }, []);
  }

  public async getCatalogos(
    categoria?: CatalogCategory
  ): Promise<ICatalogoItem[]> {
    if (categoria && !isCatalogCategory(categoria)) {
      throw new Error(`La categoría de catálogo "${categoria}" no es válida.`);
    }

    try {
      const items = await this.readCatalogos(categoria);
      const requiresEthicsCatalog =
        categoria === undefined ||
        categoria === 'Falta' ||
        categoria === 'CodigoEtica';

      if (!requiresEthicsCatalog) {
        return items;
      }

      const hasEthicsSubcategories = items.some(
        (item) => item.Title === 'CodigoEtica'
      );
      const requiredItems = [
        ...MANDATORY_ETHICS_CATEGORY_ITEM,
        ...(
          (categoria === 'CodigoEtica' || categoria === undefined) &&
          !hasEthicsSubcategories
            ? DEFAULT_ETHICS_SUBCATEGORY_ITEMS
            : []
        )
      ];
      const catalogUpdated = await this.ensureCatalogItems(requiredItems);

      return catalogUpdated
        ? await this.readCatalogos(categoria)
        : items;
    } catch (readError: unknown) {
      if (!isSharePointNotFoundError(readError)) {
        const detail =
          readError instanceof Error ? readError.message : String(readError);
        throw new Error(`No fue posible consultar los catálogos: ${detail}`);
      }

      try {
        await this.ensureConfiguracionCatalogosList();
        return await this.readCatalogos(categoria);
      } catch (provisioningError: unknown) {
        const detail =
          provisioningError instanceof Error
            ? provisioningError.message
            : String(provisioningError);
        throw new Error(`No fue posible consultar los catálogos: ${detail}`);
      }
    }
  }

  public async addCatalogo(
    categoria: CatalogCategory,
    valor: string
  ): Promise<void> {
    const normalizedValue = valor.trim();

    if (!isCatalogCategory(categoria)) {
      throw new Error(`La categoría de catálogo "${categoria}" no es válida.`);
    }

    if (!normalizedValue) {
      throw new Error('Debes indicar un valor para el catálogo.');
    }

    if (normalizedValue.length > 255) {
      throw new Error('El valor del catálogo no puede exceder 255 caracteres.');
    }

    try {
      await this.ensureConfiguracionCatalogosList();

      const existingItems: Array<{ Valor?: string }> =
        await this.sp.web.lists
          .getByTitle(CATALOGS_CONFIG_LIST_TITLE)
          .items
          .select('Valor')
          .filter(`Title eq '${escapeODataString(categoria)}'`)
          .getAll<{ Valor?: string }>();
      const normalizedComparison = normalizedValue.toLocaleLowerCase();
      const alreadyExists = existingItems.some(
        (item) =>
          item.Valor?.trim().toLocaleLowerCase() === normalizedComparison
      );

      if (alreadyExists) {
        throw new Error(
          `"${normalizedValue}" ya existe en el catálogo ${categoria}.`
        );
      }

      await this.sp.web.lists
        .getByTitle(CATALOGS_CONFIG_LIST_TITLE)
        .items
        .add({
          Title: categoria,
          Valor: normalizedValue
        });
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`No fue posible agregar el valor al catálogo: ${detail}`);
    }
  }

  public async deleteCatalogo(id: number): Promise<void> {
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error('El identificador del catálogo no es válido.');
    }

    try {
      await this.ensureConfiguracionCatalogosList();

      await this.sp.web.lists
        .getByTitle(CATALOGS_CONFIG_LIST_TITLE)
        .items
        .getById(id)
        .delete();
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`No fue posible eliminar el valor del catálogo: ${detail}`);
    }
  }

  public async ensureConfiguracionList(): Promise<void> {
    let provisioningStep = 'crear o verificar la lista';

    try {
      const listEnsure = await this.sp.web.lists.ensure(
        CONFIG_LIST_TITLE,
        CONFIG_LIST_DESCRIPTION,
        100,
        false
      );

      let existingInternalNames: string[];

      if (listEnsure.created) {
        existingInternalNames = [];
      } else {
        provisioningStep = 'consultar las columnas existentes';
        const existingFields = await listEnsure.list.fields
          .select('InternalName')();
        existingInternalNames = existingFields.map((field) => field.InternalName);
      }

      const v4WeightFields = [
        'PesoCasos',
        'PesoEmisionesTx',
        'PesoEmisionesPg',
        'PesoMovimientosTx',
        'PesoMovimientosPg',
        'PesoEscaneoTx',
        'PesoEscaneoPg'
      ];
      const hadCompleteV4WeightSchema = v4WeightFields.every(
        (internalName) => existingInternalNames.indexOf(internalName) >= 0
      );

      if (existingInternalNames.indexOf('PesoCasos') < 0) {
        provisioningStep = 'crear la columna PesoCasos';
        const result = await listEnsure.list.fields.addNumber(
          'PesoCasos',
          { MinimumValue: 0 }
        );
        provisioningStep = 'asignar el nombre visible de PesoCasos';
        await result.field.update({ Title: 'Peso Casos (%)' });
      }

      if (existingInternalNames.indexOf('PesoEmisionesTx') < 0) {
        provisioningStep = 'crear la columna PesoEmisionesTx';
        const result = await listEnsure.list.fields.addNumber(
          'PesoEmisionesTx',
          { MinimumValue: 0 }
        );
        provisioningStep = 'asignar el nombre visible de PesoEmisionesTx';
        await result.field.update({ Title: 'Peso Emisiones Tx (%)' });
      }

      if (existingInternalNames.indexOf('PesoEmisionesPg') < 0) {
        provisioningStep = 'crear la columna PesoEmisionesPg';
        const result = await listEnsure.list.fields.addNumber(
          'PesoEmisionesPg',
          { MinimumValue: 0 }
        );
        provisioningStep = 'asignar el nombre visible de PesoEmisionesPg';
        await result.field.update({ Title: 'Peso Emisiones Pg (%)' });
      }

      if (existingInternalNames.indexOf('PesoMovimientosTx') < 0) {
        provisioningStep = 'crear la columna PesoMovimientosTx';
        const result = await listEnsure.list.fields.addNumber(
          'PesoMovimientosTx',
          { MinimumValue: 0 }
        );
        provisioningStep = 'asignar el nombre visible de PesoMovimientosTx';
        await result.field.update({ Title: 'Peso Movimientos Tx (%)' });
      }

      if (existingInternalNames.indexOf('PesoMovimientosPg') < 0) {
        provisioningStep = 'crear la columna PesoMovimientosPg';
        const result = await listEnsure.list.fields.addNumber(
          'PesoMovimientosPg',
          { MinimumValue: 0 }
        );
        provisioningStep = 'asignar el nombre visible de PesoMovimientosPg';
        await result.field.update({ Title: 'Peso Movimientos Pg (%)' });
      }

      if (existingInternalNames.indexOf('PesoEscaneoTx') < 0) {
        provisioningStep = 'crear la columna PesoEscaneoTx';
        const result = await listEnsure.list.fields.addNumber(
          'PesoEscaneoTx',
          { MinimumValue: 0 }
        );
        provisioningStep = 'asignar el nombre visible de PesoEscaneoTx';
        await result.field.update({ Title: 'Peso Escaneo Tx (%)' });
      }

      if (existingInternalNames.indexOf('PesoEscaneoPg') < 0) {
        provisioningStep = 'crear la columna PesoEscaneoPg';
        const result = await listEnsure.list.fields.addNumber(
          'PesoEscaneoPg',
          { MinimumValue: 0 }
        );
        provisioningStep = 'asignar el nombre visible de PesoEscaneoPg';
        await result.field.update({ Title: 'Peso Escaneo Pg (%)' });
      }

      if (existingInternalNames.indexOf('MetaSlaCasos') < 0) {
        provisioningStep = 'crear la columna MetaSlaCasos';
        const result = await listEnsure.list.fields.addNumber(
          'MetaSlaCasos',
          { MinimumValue: 1, MaximumValue: 100 }
        );
        provisioningStep = 'asignar el nombre visible de MetaSlaCasos';
        await result.field.update({ Title: 'Meta de SLA de Casos (%)' });
      }

      if (existingInternalNames.indexOf('MetaEmisionesTx') < 0) {
        provisioningStep = 'crear la columna MetaEmisionesTx';
        const result = await listEnsure.list.fields.addNumber(
          'MetaEmisionesTx',
          { MinimumValue: 0 }
        );
        provisioningStep = 'asignar el nombre visible de MetaEmisionesTx';
        await result.field.update({ Title: 'Meta Diaria Emisiones Tx' });
      }

      if (existingInternalNames.indexOf('MetaMovimientosPg') < 0) {
        provisioningStep = 'crear la columna MetaMovimientosPg';
        const result = await listEnsure.list.fields.addNumber(
          'MetaMovimientosPg',
          { MinimumValue: 0 }
        );
        provisioningStep = 'asignar el nombre visible de MetaMovimientosPg';
        await result.field.update({ Title: 'Meta Diaria Movimientos Pg' });
      }

      if (existingInternalNames.indexOf('MetaEscaneoPg') < 0) {
        provisioningStep = 'crear la columna MetaEscaneoPg';
        const result = await listEnsure.list.fields.addNumber(
          'MetaEscaneoPg',
          { MinimumValue: 0 }
        );
        provisioningStep = 'asignar el nombre visible de MetaEscaneoPg';
        await result.field.update({ Title: 'Meta Diaria Escaneo Pg' });
      }

      // Esquema v3 conservado para compatibilidad con reportes existentes.
      if (existingInternalNames.indexOf('PesoEmisiones') < 0) {
        provisioningStep = 'crear la columna PesoEmisiones';
        await listEnsure.list.fields.addNumber('PesoEmisiones', {
          MinimumValue: 0
        });
      }

      if (existingInternalNames.indexOf('PesoMovimientos') < 0) {
        provisioningStep = 'crear la columna PesoMovimientos';
        await listEnsure.list.fields.addNumber('PesoMovimientos', {
          MinimumValue: 0
        });
      }

      if (existingInternalNames.indexOf('MetaDiaria') < 0) {
        provisioningStep = 'crear la columna MetaDiaria';
        await listEnsure.list.fields.addNumber('MetaDiaria', {
          MinimumValue: 0
        });
      }

      if (existingInternalNames.indexOf('PuntosPorKudo') < 0) {
        provisioningStep = 'crear la columna PuntosPorKudo';
        const result = await listEnsure.list.fields.addNumber(
          'PuntosPorKudo',
          { MinimumValue: 0 }
        );
        provisioningStep = 'asignar el nombre visible de PuntosPorKudo';
        await result.field.update({ Title: 'Puntos por Kudo' });
      }

      if (existingInternalNames.indexOf('PenalidadBaja') < 0) {
        provisioningStep = 'crear la columna PenalidadBaja';
        const result = await listEnsure.list.fields.addNumber(
          'PenalidadBaja',
          { MinimumValue: 0 }
        );
        provisioningStep = 'asignar el nombre visible de PenalidadBaja';
        await result.field.update({ Title: 'Penalidad Impacto Bajo' });
      }

      if (existingInternalNames.indexOf('PenalidadMedia') < 0) {
        provisioningStep = 'crear la columna PenalidadMedia';
        const result = await listEnsure.list.fields.addNumber(
          'PenalidadMedia',
          { MinimumValue: 0 }
        );
        provisioningStep = 'asignar el nombre visible de PenalidadMedia';
        await result.field.update({ Title: 'Penalidad Impacto Medio' });
      }

      if (existingInternalNames.indexOf('PenalidadCritica') < 0) {
        provisioningStep = 'crear la columna PenalidadCritica';
        const result = await listEnsure.list.fields.addNumber(
          'PenalidadCritica',
          { MinimumValue: 0 }
        );
        provisioningStep = 'asignar el nombre visible de PenalidadCritica';
        await result.field.update({ Title: 'Penalidad Impacto Crítico' });
      }

      const defaultConfiguration: Omit<IConfiguracionMetricas, 'Id'> = {
        Title: GLOBAL_CONFIG_TITLE,
        ...PRODUCTIVITY_V4_DEFAULTS,
        // Valores v3 conservados para que Dashboard y Evaluación puedan
        // convivir con la migración del motor de cálculo.
        PesoEmisiones: 1.5,
        PesoMovimientos: 1.2,
        MetaDiaria: 100,
        PuntosPorKudo: 10,
        PenalidadBaja: 5,
        PenalidadMedia: 15,
        PenalidadCritica: 50
      };

      if (listEnsure.created) {
        provisioningStep = 'insertar la configuración predeterminada';
        await listEnsure.list.items.add(defaultConfiguration);
      } else {
        provisioningStep = 'verificar la fila de configuración';
        const existingConfiguration: Array<{
          Id: number;
          PesoCasos?: number;
          PesoEmisionesTx?: number;
          PesoEmisionesPg?: number;
          PesoMovimientosTx?: number;
          PesoMovimientosPg?: number;
          PesoEscaneoTx?: number;
          PesoEscaneoPg?: number;
          MetaSlaCasos?: number;
          MetaEmisionesTx?: number;
          MetaMovimientosPg?: number;
          MetaEscaneoPg?: number;
          PesoEmisiones?: number;
          PesoMovimientos?: number;
          MetaDiaria?: number;
          PuntosPorKudo?: number;
          PenalidadBaja?: number;
          PenalidadMedia?: number;
          PenalidadCritica?: number;
        }> = await listEnsure.list.items
          .select(
            'Id',
            'PesoCasos',
            'PesoEmisionesTx',
            'PesoEmisionesPg',
            'PesoMovimientosTx',
            'PesoMovimientosPg',
            'PesoEscaneoTx',
            'PesoEscaneoPg',
            'MetaSlaCasos',
            'MetaEmisionesTx',
            'MetaMovimientosPg',
            'MetaEscaneoPg',
            'PesoEmisiones',
            'PesoMovimientos',
            'MetaDiaria',
            'PuntosPorKudo',
            'PenalidadBaja',
            'PenalidadMedia',
            'PenalidadCritica'
          )
          .filter(
            `Title eq '${escapeODataString(GLOBAL_CONFIG_TITLE)}'`
          )
          .orderBy('Id', true)
          .top(1)();

        if (existingConfiguration.length === 0) {
          provisioningStep = 'recrear la configuración predeterminada';
          await listEnsure.list.items.add(defaultConfiguration);
        } else {
          const currentConfiguration = existingConfiguration[0];
          const missingDefaults: Partial<IConfiguracionMetricasUpdate> = {};
          const currentWeightValues = [
            currentConfiguration.PesoCasos,
            currentConfiguration.PesoEmisionesTx,
            currentConfiguration.PesoEmisionesPg,
            currentConfiguration.PesoMovimientosTx,
            currentConfiguration.PesoMovimientosPg,
            currentConfiguration.PesoEscaneoTx,
            currentConfiguration.PesoEscaneoPg
          ];
          const hasValidV4WeightConfiguration =
            hadCompleteV4WeightSchema &&
            currentWeightValues.every(
              (value) =>
                typeof value === 'number' &&
                Number.isFinite(value) &&
                value >= 0
            ) &&
            Math.abs(
              currentWeightValues.reduce<number>(
                (total, value) => total + (value ?? 0),
                0
              ) - 100
            ) <= 0.001;

          if (!hasValidV4WeightConfiguration) {
            // PesoCasos ya existía en v3 con otra escala. Al incorporar las
            // seis columnas restantes se inicializa el conjunto indivisible
            // para garantizar una distribución porcentual total de 100%.
            // La misma recuperación cubre aprovisionamientos interrumpidos
            // después de crear campos pero antes de actualizar Config_Global.
            missingDefaults.PesoCasos = PRODUCTIVITY_V4_DEFAULTS.PesoCasos;
            missingDefaults.PesoEmisionesTx =
              PRODUCTIVITY_V4_DEFAULTS.PesoEmisionesTx;
            missingDefaults.PesoEmisionesPg =
              PRODUCTIVITY_V4_DEFAULTS.PesoEmisionesPg;
            missingDefaults.PesoMovimientosTx =
              PRODUCTIVITY_V4_DEFAULTS.PesoMovimientosTx;
            missingDefaults.PesoMovimientosPg =
              PRODUCTIVITY_V4_DEFAULTS.PesoMovimientosPg;
            missingDefaults.PesoEscaneoTx =
              PRODUCTIVITY_V4_DEFAULTS.PesoEscaneoTx;
            missingDefaults.PesoEscaneoPg =
              PRODUCTIVITY_V4_DEFAULTS.PesoEscaneoPg;
          }

          if (
            typeof currentConfiguration.MetaSlaCasos !== 'number' ||
            !Number.isFinite(currentConfiguration.MetaSlaCasos) ||
            currentConfiguration.MetaSlaCasos <= 0 ||
            currentConfiguration.MetaSlaCasos > 100
          ) {
            missingDefaults.MetaSlaCasos =
              PRODUCTIVITY_V4_DEFAULTS.MetaSlaCasos;
          }

          if (
            typeof currentConfiguration.MetaEmisionesTx !== 'number' ||
            !Number.isFinite(currentConfiguration.MetaEmisionesTx) ||
            currentConfiguration.MetaEmisionesTx <= 0
          ) {
            missingDefaults.MetaEmisionesTx =
              PRODUCTIVITY_V4_DEFAULTS.MetaEmisionesTx;
          }
          if (
            typeof currentConfiguration.MetaMovimientosPg !== 'number' ||
            !Number.isFinite(currentConfiguration.MetaMovimientosPg) ||
            currentConfiguration.MetaMovimientosPg <= 0
          ) {
            missingDefaults.MetaMovimientosPg =
              PRODUCTIVITY_V4_DEFAULTS.MetaMovimientosPg;
          }
          if (
            typeof currentConfiguration.MetaEscaneoPg !== 'number' ||
            !Number.isFinite(currentConfiguration.MetaEscaneoPg) ||
            currentConfiguration.MetaEscaneoPg <= 0
          ) {
            missingDefaults.MetaEscaneoPg =
              PRODUCTIVITY_V4_DEFAULTS.MetaEscaneoPg;
          }
          if (typeof currentConfiguration.PesoEmisiones !== 'number') {
            missingDefaults.PesoEmisiones = 1.5;
          }
          if (typeof currentConfiguration.PesoMovimientos !== 'number') {
            missingDefaults.PesoMovimientos = 1.2;
          }
          if (typeof currentConfiguration.MetaDiaria !== 'number') {
            missingDefaults.MetaDiaria = 100;
          }
          if (typeof currentConfiguration.PuntosPorKudo !== 'number') {
            missingDefaults.PuntosPorKudo = 10;
          }
          if (typeof currentConfiguration.PenalidadBaja !== 'number') {
            missingDefaults.PenalidadBaja = 5;
          }
          if (typeof currentConfiguration.PenalidadMedia !== 'number') {
            missingDefaults.PenalidadMedia = 15;
          }
          if (typeof currentConfiguration.PenalidadCritica !== 'number') {
            missingDefaults.PenalidadCritica = 50;
          }

          if (Object.keys(missingDefaults).length > 0) {
            provisioningStep = 'inicializar valores nuevos en Config_Global';
            await listEnsure.list.items
              .getById(currentConfiguration.Id)
              .update(missingDefaults);
          }
        }
      }

      provisioningStep = 'consolidar la fila Config_Global';
      const globalConfigurationItems: Array<{ Id: number }> =
        await listEnsure.list.items
          .select('Id')
          .filter(
            `Title eq '${escapeODataString(GLOBAL_CONFIG_TITLE)}'`
          )
          .orderBy('Id', true)
          .getAll<{ Id: number }>();

      // SharePoint REST no ofrece un upsert atómico por Title. En una carrera
      // de aprovisionamiento se conserva siempre el Id más antiguo y se
      // eliminan los duplicados. Un 404 es esperable si otra sesión ganó la
      // misma limpieza concurrente.
      for (
        let duplicateIndex = 1;
        duplicateIndex < globalConfigurationItems.length;
        duplicateIndex += 1
      ) {
        try {
          await listEnsure.list.items
            .getById(globalConfigurationItems[duplicateIndex].Id)
            .delete();
        } catch (duplicateCleanupError: unknown) {
          if (!isSharePointNotFoundError(duplicateCleanupError)) {
            throw duplicateCleanupError;
          }
        }
      }

      provisioningStep = 'obtener la vista predeterminada';
      const defaultView = await listEnsure.list.defaultView;
      const defaultViewFields = await defaultView.fields();

      if (defaultViewFields.Items.indexOf('MetaSlaCasos') < 0) {
        provisioningStep = 'agregar MetaSlaCasos a la vista predeterminada';
        await defaultView.fields.add('MetaSlaCasos');
      }

      if (defaultViewFields.Items.indexOf('MetaEmisionesTx') < 0) {
        provisioningStep = 'agregar MetaEmisionesTx a la vista predeterminada';
        await defaultView.fields.add('MetaEmisionesTx');
      }

      if (defaultViewFields.Items.indexOf('MetaMovimientosPg') < 0) {
        provisioningStep =
          'agregar MetaMovimientosPg a la vista predeterminada';
        await defaultView.fields.add('MetaMovimientosPg');
      }

      if (defaultViewFields.Items.indexOf('MetaEscaneoPg') < 0) {
        provisioningStep = 'agregar MetaEscaneoPg a la vista predeterminada';
        await defaultView.fields.add('MetaEscaneoPg');
      }

      if (defaultViewFields.Items.indexOf('PesoCasos') < 0) {
        provisioningStep = 'agregar PesoCasos a la vista predeterminada';
        await defaultView.fields.add('PesoCasos');
      }

      if (defaultViewFields.Items.indexOf('PesoEmisionesTx') < 0) {
        provisioningStep = 'agregar PesoEmisionesTx a la vista predeterminada';
        await defaultView.fields.add('PesoEmisionesTx');
      }

      if (defaultViewFields.Items.indexOf('PesoEmisionesPg') < 0) {
        provisioningStep = 'agregar PesoEmisionesPg a la vista predeterminada';
        await defaultView.fields.add('PesoEmisionesPg');
      }

      if (defaultViewFields.Items.indexOf('PesoMovimientosTx') < 0) {
        provisioningStep =
          'agregar PesoMovimientosTx a la vista predeterminada';
        await defaultView.fields.add('PesoMovimientosTx');
      }

      if (defaultViewFields.Items.indexOf('PesoMovimientosPg') < 0) {
        provisioningStep =
          'agregar PesoMovimientosPg a la vista predeterminada';
        await defaultView.fields.add('PesoMovimientosPg');
      }

      if (defaultViewFields.Items.indexOf('PesoEscaneoTx') < 0) {
        provisioningStep = 'agregar PesoEscaneoTx a la vista predeterminada';
        await defaultView.fields.add('PesoEscaneoTx');
      }

      if (defaultViewFields.Items.indexOf('PesoEscaneoPg') < 0) {
        provisioningStep = 'agregar PesoEscaneoPg a la vista predeterminada';
        await defaultView.fields.add('PesoEscaneoPg');
      }

      if (defaultViewFields.Items.indexOf('PuntosPorKudo') < 0) {
        provisioningStep = 'agregar PuntosPorKudo a la vista predeterminada';
        await defaultView.fields.add('PuntosPorKudo');
      }

      if (defaultViewFields.Items.indexOf('PenalidadBaja') < 0) {
        provisioningStep = 'agregar PenalidadBaja a la vista predeterminada';
        await defaultView.fields.add('PenalidadBaja');
      }

      if (defaultViewFields.Items.indexOf('PenalidadMedia') < 0) {
        provisioningStep = 'agregar PenalidadMedia a la vista predeterminada';
        await defaultView.fields.add('PenalidadMedia');
      }

      if (defaultViewFields.Items.indexOf('PenalidadCritica') < 0) {
        provisioningStep = 'agregar PenalidadCritica a la vista predeterminada';
        await defaultView.fields.add('PenalidadCritica');
      }
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Error al ${provisioningStep} en ${CONFIG_LIST_TITLE}: ${detail}`
      );
    }
  }

  public async getConfiguracion(): Promise<IConfiguracionMetricas> {
    try {
      await this.ensureConfiguracionList();

      const items: IConfiguracionMetricas[] = await this.sp.web.lists
        .getByTitle(CONFIG_LIST_TITLE)
        .items
        .select(
          'Id',
          'Title',
          'PesoCasos',
          'PesoEmisionesTx',
          'PesoEmisionesPg',
          'PesoMovimientosTx',
          'PesoMovimientosPg',
          'PesoEscaneoTx',
          'PesoEscaneoPg',
          'MetaSlaCasos',
          'MetaEmisionesTx',
          'MetaMovimientosPg',
          'MetaEscaneoPg',
          'PesoEmisiones',
          'PesoMovimientos',
          'MetaDiaria',
          'PuntosPorKudo',
          'PenalidadBaja',
          'PenalidadMedia',
          'PenalidadCritica'
        )
        .filter(
          `Title eq '${escapeODataString(GLOBAL_CONFIG_TITLE)}'`
        )
        .orderBy('Id', true)
        .top(1)();

      if (items.length === 0) {
        throw new Error('No existe la fila Config_Global.');
      }

      return items[0];
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`No fue posible obtener la configuración: ${detail}`);
    }
  }

  public async actualizarConfiguracion(
    id: number,
    data: IConfiguracionMetricasUpdate
  ): Promise<void> {
    try {
      await this.ensureConfiguracionList();

      const weightValues = [
        data.PesoCasos,
        data.PesoEmisionesTx,
        data.PesoEmisionesPg,
        data.PesoMovimientosTx,
        data.PesoMovimientosPg,
        data.PesoEscaneoTx,
        data.PesoEscaneoPg
      ];
      const dailyGoalValues = [
        data.MetaEmisionesTx,
        data.MetaMovimientosPg,
        data.MetaEscaneoPg
      ];
      const configurationValues = [
        ...weightValues,
        ...dailyGoalValues,
        data.MetaSlaCasos,
        data.PuntosPorKudo,
        data.PenalidadBaja,
        data.PenalidadMedia,
        data.PenalidadCritica
      ];

      if (
        configurationValues.some(
          (value) => !Number.isFinite(value) || value < 0
        )
      ) {
        throw new Error(
          'Las metas, pesos y reglas de puntuación deben ser números mayores o iguales a cero.'
        );
      }

      if (dailyGoalValues.some((value) => value <= 0)) {
        throw new Error(
          'Las tres metas diarias fijas deben ser mayores que cero.'
        );
      }

      if (data.MetaSlaCasos <= 0 || data.MetaSlaCasos > 100) {
        throw new Error(
          'La Meta de SLA de Casos debe ser mayor que cero y menor o igual a 100%.'
        );
      }

      const totalWeight = weightValues.reduce(
        (total, currentValue) => total + currentValue,
        0
      );

      if (Math.abs(totalWeight - 100) > 0.001) {
        throw new Error(
          `La suma de los siete pesos debe ser exactamente 100% (actual: ${totalWeight}%).`
        );
      }

      const updatePayload: Record<string, number> = {
        PesoCasos: data.PesoCasos,
        PesoEmisionesTx: data.PesoEmisionesTx,
        PesoEmisionesPg: data.PesoEmisionesPg,
        PesoMovimientosTx: data.PesoMovimientosTx,
        PesoMovimientosPg: data.PesoMovimientosPg,
        PesoEscaneoTx: data.PesoEscaneoTx,
        PesoEscaneoPg: data.PesoEscaneoPg,
        MetaSlaCasos: data.MetaSlaCasos,
        MetaEmisionesTx: data.MetaEmisionesTx,
        MetaMovimientosPg: data.MetaMovimientosPg,
        MetaEscaneoPg: data.MetaEscaneoPg,
        PuntosPorKudo: data.PuntosPorKudo,
        PenalidadBaja: data.PenalidadBaja,
        PenalidadMedia: data.PenalidadMedia,
        PenalidadCritica: data.PenalidadCritica
      };

      if (
        typeof data.PesoEmisiones === 'number' &&
        Number.isFinite(data.PesoEmisiones)
      ) {
        updatePayload.PesoEmisiones = data.PesoEmisiones;
      }
      if (
        typeof data.PesoMovimientos === 'number' &&
        Number.isFinite(data.PesoMovimientos)
      ) {
        updatePayload.PesoMovimientos = data.PesoMovimientos;
      }
      if (
        typeof data.MetaDiaria === 'number' &&
        Number.isFinite(data.MetaDiaria)
      ) {
        updatePayload.MetaDiaria = data.MetaDiaria;
      }

      await this.sp.web.lists
        .getByTitle(CONFIG_LIST_TITLE)
        .items
        .getById(id)
        .update(updatePayload);
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`No fue posible actualizar la configuración: ${detail}`);
    }
  }

  public async ensurePublicacionEmpleadoMesList(): Promise<void> {
    let provisioningStep = 'crear o verificar la lista';

    try {
      const listEnsure = await this.sp.web.lists.ensure(
        EMPLOYEE_MONTH_PUBLICATIONS_LIST_TITLE,
        EMPLOYEE_MONTH_PUBLICATIONS_LIST_DESCRIPTION,
        100,
        false
      );

      let existingInternalNames: string[];

      if (listEnsure.created) {
        existingInternalNames = [];
      } else {
        provisioningStep = 'consultar las columnas existentes';
        const existingFields = await listEnsure.list.fields
          .select('InternalName')();
        existingInternalNames = existingFields.map((field) => field.InternalName);
      }

      if (listEnsure.created) {
        provisioningStep = 'configurar el campo Title';
        const titleField =
          listEnsure.list.fields.getByInternalNameOrTitle('Title');
        await titleField.update({
          Title: 'Mes / Año',
          Required: true
        });
      }

      if (existingInternalNames.indexOf('AgenteEmail') < 0) {
        provisioningStep = 'crear la columna AgenteEmail';
        const result = await listEnsure.list.fields.addText('AgenteEmail');
        provisioningStep = 'asignar el nombre visible de AgenteEmail';
        await result.field.update({ Title: 'Correo del Agente' });
      }

      if (existingInternalNames.indexOf('AgenteNombre') < 0) {
        provisioningStep = 'crear la columna AgenteNombre';
        const result = await listEnsure.list.fields.addText('AgenteNombre');
        provisioningStep = 'asignar el nombre visible de AgenteNombre';
        await result.field.update({ Title: 'Nombre del Agente' });
      }

      if (existingInternalNames.indexOf('PuntosTotales') < 0) {
        provisioningStep = 'crear la columna PuntosTotales';
        const result = await listEnsure.list.fields.addNumber(
          'PuntosTotales'
        );
        provisioningStep = 'asignar el nombre visible de PuntosTotales';
        await result.field.update({ Title: 'Puntos Totales' });
      }

      if (existingInternalNames.indexOf('ConceptoKudo') < 0) {
        provisioningStep = 'crear la columna ConceptoKudo';
        const result = await listEnsure.list.fields.addText('ConceptoKudo');
        provisioningStep = 'asignar el nombre visible de ConceptoKudo';
        await result.field.update({
          Title: 'Concepto Predominante del Kudo'
        });
      }

      if (existingInternalNames.indexOf('Dedicatoria') < 0) {
        provisioningStep = 'crear la columna Dedicatoria';
        const result = await listEnsure.list.fields.addMultilineText(
          'Dedicatoria',
          {
            NumberOfLines: 2,
            RichText: false
          }
        );
        provisioningStep = 'asignar el nombre visible de Dedicatoria';
        await result.field.update({
          Title: 'Dedicatoria del Supervisor'
        });
      }

      if (existingInternalNames.indexOf('Estado') < 0) {
        provisioningStep = 'crear la columna Estado';
        const result = await listEnsure.list.fields.addText('Estado');
        provisioningStep = 'asignar el nombre visible de Estado';
        await result.field.update({ Title: 'Estado de Publicación' });
      }

      if (existingInternalNames.indexOf('FechaPublicacion') < 0) {
        provisioningStep = 'crear la columna FechaPublicacion';
        const result = await listEnsure.list.fields.addDateTime(
          'FechaPublicacion'
        );
        provisioningStep = 'asignar el nombre visible de FechaPublicacion';
        await result.field.update({ Title: 'Fecha de Publicación' });
      }

      provisioningStep = 'obtener la vista predeterminada';
      const defaultView = await listEnsure.list.defaultView;
      const defaultViewFields = await defaultView.fields();
      const visibleFields = defaultViewFields.Items;

      if (visibleFields.indexOf('AgenteEmail') < 0) {
        provisioningStep = 'agregar AgenteEmail a la vista predeterminada';
        await defaultView.fields.add('AgenteEmail');
      }

      if (visibleFields.indexOf('AgenteNombre') < 0) {
        provisioningStep = 'agregar AgenteNombre a la vista predeterminada';
        await defaultView.fields.add('AgenteNombre');
      }

      if (visibleFields.indexOf('PuntosTotales') < 0) {
        provisioningStep = 'agregar PuntosTotales a la vista predeterminada';
        await defaultView.fields.add('PuntosTotales');
      }

      if (visibleFields.indexOf('ConceptoKudo') < 0) {
        provisioningStep = 'agregar ConceptoKudo a la vista predeterminada';
        await defaultView.fields.add('ConceptoKudo');
      }

      if (visibleFields.indexOf('Dedicatoria') < 0) {
        provisioningStep = 'agregar Dedicatoria a la vista predeterminada';
        await defaultView.fields.add('Dedicatoria');
      }

      if (visibleFields.indexOf('Estado') < 0) {
        provisioningStep = 'agregar Estado a la vista predeterminada';
        await defaultView.fields.add('Estado');
      }

      if (visibleFields.indexOf('FechaPublicacion') < 0) {
        provisioningStep = 'agregar FechaPublicacion a la vista predeterminada';
        await defaultView.fields.add('FechaPublicacion');
      }
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Error al ${provisioningStep} en ` +
          `${EMPLOYEE_MONTH_PUBLICATIONS_LIST_TITLE}: ${detail}`
      );
    }
  }

  public async getPublicacionMes(
    mesAno: string
  ): Promise<IPublicacionEmpleadoMes | undefined> {
    const normalizedMonth = mesAno.trim();

    if (!normalizedMonth) {
      throw new Error('El mes y año de la publicación son obligatorios.');
    }

    try {
      await this.ensurePublicacionEmpleadoMesList();

      const items: IPublicacionEmpleadoMes[] = await this.sp.web.lists
        .getByTitle(EMPLOYEE_MONTH_PUBLICATIONS_LIST_TITLE)
        .items
        .filter(
          `Title eq '${escapeODataString(normalizedMonth)}' and ` +
            "Estado eq 'Publicado'"
        )
        .select(
          'Id',
          'Title',
          'AgenteEmail',
          'AgenteNombre',
          'PuntosTotales',
          'ConceptoKudo',
          'Dedicatoria',
          'Estado',
          'FechaPublicacion'
        )
        .orderBy('FechaPublicacion', false)
        .top(1)();

      if (items[0]) {
        return items[0];
      }

      // Si el mes solicitado todavía no fue publicado, conserva visible la
      // publicación activa más reciente durante la ventana de días 1 al 25.
      const latestPublishedItems: IPublicacionEmpleadoMes[] =
        await this.sp.web.lists
          .getByTitle(EMPLOYEE_MONTH_PUBLICATIONS_LIST_TITLE)
          .items
          .filter("Estado eq 'Publicado'")
          .select(
            'Id',
            'Title',
            'AgenteEmail',
            'AgenteNombre',
            'PuntosTotales',
            'ConceptoKudo',
            'Dedicatoria',
            'Estado',
            'FechaPublicacion'
          )
          .orderBy('FechaPublicacion', false)
          .top(1)();

      return latestPublishedItems[0];
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `No fue posible obtener la publicación de ${normalizedMonth}: ${detail}`
      );
    }
  }

  public async publicarEmpleadoMes(
    data: IPublicarEmpleadoMesData
  ): Promise<void> {
    const mesAno = data.mesAno.trim();
    const agenteEmail = data.agenteEmail.trim().toLowerCase();
    const agenteNombre = data.agenteNombre.trim();
    const conceptoKudo = data.conceptoKudo.trim();
    const dedicatoria = data.dedicatoria.trim();
    const estado = data.estado ?? 'Publicado';
    const fechaPublicacion = data.fechaPublicacion ?? new Date();

    if (!mesAno || !agenteEmail || !agenteNombre || !conceptoKudo) {
      throw new Error(
        'Mes, correo, nombre del agente y concepto de Kudo son obligatorios.'
      );
    }

    if (!Number.isFinite(data.puntosTotales)) {
      throw new Error('Los puntos totales deben ser un número válido.');
    }

    if (!dedicatoria) {
      throw new Error('La dedicatoria es obligatoria.');
    }

    if (dedicatoria.length > 150) {
      throw new Error('La dedicatoria no puede exceder los 150 caracteres.');
    }

    if (dedicatoria.split(/\r?\n/).length > 2) {
      throw new Error('La dedicatoria no puede exceder dos líneas.');
    }

    if (Number.isNaN(fechaPublicacion.getTime())) {
      throw new Error('La fecha de publicación no es válida.');
    }

    if (estado !== 'Borrador' && estado !== 'Publicado') {
      throw new Error('El estado de la publicación no es válido.');
    }

    try {
      await this.ensurePublicacionEmpleadoMesList();

      const list = this.sp.web.lists.getByTitle(
        EMPLOYEE_MONTH_PUBLICATIONS_LIST_TITLE
      );
      const existingItems: Array<{ Id: number }> = await list.items
        .filter(`Title eq '${escapeODataString(mesAno)}'`)
        .select('Id')
        .orderBy('Id', false)
        .top(1)();
      const payload = {
        Title: mesAno,
        AgenteEmail: agenteEmail,
        AgenteNombre: agenteNombre,
        PuntosTotales: data.puntosTotales,
        ConceptoKudo: conceptoKudo,
        Dedicatoria: dedicatoria,
        Estado: estado,
        FechaPublicacion: fechaPublicacion.toISOString()
      };

      if (existingItems.length > 0) {
        await list.items.getById(existingItems[0].Id).update(payload);
      } else {
        await list.items.add(payload);
      }
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `No fue posible publicar el Empleado del Mes: ${detail}`
      );
    }
  }

  public async getDatosEvaluacion(
    startDate: Date,
    endDate: Date,
    agentes?: ReadonlyArray<IAgenteIdentityFilter | string>
  ): Promise<IDatosEvaluacion> {
    try {
      const startBoundary = getDayBoundary(
        startDate,
        'start',
        'La fecha de inicio'
      );
      const endBoundary = getDayBoundary(
        endDate,
        'end',
        'La fecha de fin'
      );

      if (startBoundary.getTime() > endBoundary.getTime()) {
        throw new Error(
          'La fecha de inicio no puede ser posterior a la fecha de fin.'
        );
      }

      const startIso = startBoundary.toISOString();
      const endIso = endBoundary.toISOString();
      const productividadFilter =
        `FechaRegistro ge datetime'${startIso}' and ` +
        `FechaRegistro le datetime'${endIso}'`;
      const productividadRangeFilter =
        `FechaInicio le datetime'${endIso}' and ` +
        `FechaFin ge datetime'${startIso}'`;
      const kudosFilter =
        `FechaKudo ge datetime'${startIso}' and ` +
        `FechaKudo le datetime'${endIso}'`;
      const faltasFilter =
        `FechaFalta ge datetime'${startIso}' and ` +
        `FechaFalta le datetime'${endIso}'`;

      const hasAgentScope = agentes !== undefined;
      const normalizedAgents = (agentes ?? [])
        .reduce<IAgenteIdentityFilter[]>((identities, agent) => {
          const identity: IAgenteIdentityFilter =
            typeof agent === 'string'
              ? { name: agent.trim() }
              : {
                  name: agent.name.trim(),
                  email: normalizeEmail(agent.email) || undefined,
                  objectId: agent.objectId?.trim() || undefined
                };
          const identityKey =
            (identity.email && `email:${identity.email}`) ||
            (identity.objectId &&
              `object:${identity.objectId.toLowerCase()}`) ||
            (identity.name && `name:${identity.name.toLowerCase()}`);
          const alreadyIncluded = identities.some((currentIdentity) => {
            const currentKey =
              (currentIdentity.email &&
                `email:${currentIdentity.email}`) ||
              (currentIdentity.objectId &&
                `object:${currentIdentity.objectId.toLowerCase()}`) ||
              (currentIdentity.name &&
                `name:${currentIdentity.name.toLowerCase()}`);

            return currentKey === identityKey;
          });

          if (identityKey && !alreadyIncluded) {
            identities.push(identity);
          }

          return identities;
        }, []);
      const emptyAgentScope = hasAgentScope && normalizedAgents.length === 0;
      const isItemWithinEvaluationScope = (
        item: {
          Title?: string;
          AgenteEmail?: string;
          AgenteObjectID?: string;
        }
      ): boolean => normalizedAgents.some((identity) =>
        isItemInAgentScope(
          item,
          identity.name,
          identity.email,
          identity.objectId
        )
      );

      await Promise.all([
        this.ensureRegistroProductividadList(),
        this.ensureRegistroKudosList(),
        this.ensureRegistroFaltasList()
      ]);

      const productivityFields = [
        'Id',
        'Title',
        'AgenteEmail',
        'AgenteObjectID',
        'FechaRegistro',
        'FechaInicio',
        'FechaFin',
        'Casos',
        'CasosAtendidos',
        'CasosATiempo',
        'Emisiones',
        'Movimientos',
        'EmisionesTx',
        'EmisionesPg',
        'MovimientosTx',
        'MovimientosPg',
        'EscaneoTx',
        'EscaneoPg'
      ];
      const productividadPromise: Promise<
        IEvaluacionProductividadItem[]
      > = emptyAgentScope
        ? Promise.resolve([])
        : (async (): Promise<IEvaluacionProductividadItem[]> => {
            const list = this.sp.web.lists
              .getByTitle(PRODUCTIVITY_LIST_TITLE);
            const [rangeItems, legacyItems] = await Promise.all([
              list.items
                .filter(productividadRangeFilter)
                .select(...productivityFields)
                .getAll<IEvaluacionProductividadItem>(),
              list.items
                .filter(productividadFilter)
                .select(...productivityFields)
                .getAll<IEvaluacionProductividadItem>()
            ]);
            const itemsById = new Map<
              number,
              IEvaluacionProductividadItem
            >();

            [...rangeItems, ...legacyItems].forEach((item) => {
              itemsById.set(item.Id, item);
            });

            return Array.from(itemsById.values());
          })();

      const kudosPromise: Promise<IEvaluacionKudoItem[]> = emptyAgentScope
        ? Promise.resolve([])
        : this.sp.web.lists
            .getByTitle(KUDOS_LIST_TITLE)
            .items
            .filter(kudosFilter)
            .select(
              'Title',
              'AgenteEmail',
              'AgenteObjectID',
              'FechaKudo',
              'Atributo',
              'Puntos'
            )
            .getAll<IEvaluacionKudoItem>();

      const faltasPromise: Promise<IEvaluacionFaltaItem[]> = emptyAgentScope
        ? Promise.resolve([])
        : this.sp.web.lists
            .getByTitle(LIST_TITLE)
            .items
            .filter(faltasFilter)
            .select(
              'Id',
              'Title',
              'AgenteEmail',
              'AgenteObjectID',
              'FechaFalta',
              'Categoria',
              'Impacto',
              'Estado',
              'EstadoAprobacion'
            )
            .getAll<IEvaluacionFaltaItem>();

      const [rawProductividad, rawKudos, rawFaltas, config] =
        await Promise.all([
        productividadPromise,
        kudosPromise,
        faltasPromise,
        this.getConfiguracion()
      ]);
      const scopedProductividad = hasAgentScope
        ? rawProductividad.filter(isItemWithinEvaluationScope)
        : rawProductividad;
      const productividad = scopedProductividad.map(
        normalizeProductividadMetrics
      );
      const kudos = hasAgentScope
        ? rawKudos.filter(isItemWithinEvaluationScope)
        : rawKudos;
      const approvedFaltas = rawFaltas.filter((item) =>
        isFaltaApprovedForScoring(item.EstadoAprobacion)
      );
      const faltas = hasAgentScope
        ? approvedFaltas.filter(isItemWithinEvaluationScope)
        : approvedFaltas;

      return {
        productividad,
        kudos,
        faltas,
        config
      };
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `No fue posible cargar los datos de evaluación: ${detail}`
      );
    }
  }

  public async getDatosDashboard(
    startDate?: Date,
    endDate?: Date
  ): Promise<IDatosDashboard> {
    try {
      if ((startDate && !endDate) || (!startDate && endDate)) {
        throw new Error(
          'Debe indicar ambas fechas para calcular el período del Dashboard.'
        );
      }

      if (startDate && endDate) {
        const evaluationData = await this.getDatosEvaluacion(
          startDate,
          endDate
        );

        return {
          config: evaluationData.config,
          productividad: evaluationData.productividad,
          faltas: evaluationData.faltas,
          kudos: evaluationData.kudos
        };
      }

      await Promise.all([
        this.ensureRegistroProductividadList(),
        this.ensureRegistroFaltasList(),
        this.ensureRegistroKudosList()
      ]);

      const productividadPromise: Promise<IDashboardProductividadItem[]> =
        this.sp.web.lists
          .getByTitle(PRODUCTIVITY_LIST_TITLE)
          .items
          .select(
            'Title',
            'AgenteEmail',
            'AgenteObjectID',
            'FechaRegistro',
            'FechaInicio',
            'FechaFin',
            'Casos',
            'CasosAtendidos',
            'CasosATiempo',
            'Emisiones',
            'Movimientos',
            'EmisionesTx',
            'EmisionesPg',
            'MovimientosTx',
            'MovimientosPg',
            'EscaneoTx',
            'EscaneoPg'
          )
          .getAll<IDashboardProductividadItem>();

      const faltasPromise: Promise<IDashboardFaltaItem[]> = this.sp.web.lists
        .getByTitle(LIST_TITLE)
        .items
        .select(
          'Title',
          'AgenteEmail',
          'AgenteObjectID',
          'Categoria',
          'Impacto',
          'Estado',
          'EstadoAprobacion'
        )
        .getAll<IDashboardFaltaItem>();

      const kudosPromise: Promise<IKudoListItem[]> = this.sp.web.lists
        .getByTitle(KUDOS_LIST_TITLE)
        .items
        .select('Title', 'AgenteEmail', 'AgenteObjectID', 'Puntos')
        .getAll<IKudoListItem>();

      const [config, productividad, faltas, kudos] = await Promise.all([
        this.getConfiguracion(),
        productividadPromise,
        faltasPromise,
        kudosPromise
      ]);

      return {
        config,
        productividad: productividad.map(normalizeProductividadMetrics),
        faltas: faltas.filter((item) =>
          isFaltaApprovedForScoring(item.EstadoAprobacion)
        ),
        kudos
      };
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`No fue posible cargar los datos del Dashboard: ${detail}`);
    }
  }
}

export default SharePointService;
