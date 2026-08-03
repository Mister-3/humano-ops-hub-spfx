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
import IndexedDbAdapter, {
  LOCAL_STORES,
  type ILocalEntity
} from '../../../services/IndexedDbAdapter';

export const PRODUCTIVITY_OVERLAP_ERROR_MESSAGE =
  '⚠️ Conflicto de Fechas: Ya existe un registro de productividad guardado para este colaborador que se traslapa con el rango ingresado.';

export type CatalogCategory =
  | 'Falta'
  | 'ErrorProceso'
  | 'CodigoEtica'
  | 'Kudo'
  | 'ProcesoArea';

export type AusenciaType =
  | 'Vacaciones'
  | 'Día Libre Cumpleaños'
  | 'Día Libre Empleado del Mes'
  | 'Licencia / Incapacidad';

const ROLE_VALUES: ReadonlyArray<RoleType> = [
  'Master_Admin',
  'Admin',
  'Gerente',
  'Supervisor',
  'Analista',
  'Asistente',
  'Oficial'
];

const CATALOG_CATEGORIES: ReadonlyArray<CatalogCategory> = [
  'Falta',
  'ErrorProceso',
  'CodigoEtica',
  'Kudo',
  'ProcesoArea'
];

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

const DEFAULT_CONFIG: IConfiguracionMetricas = {
  Id: 1,
  Title: 'Config_Global',
  PesoCasos: 20,
  PesoEmisionesTx: 15,
  PesoEmisionesPg: 10,
  PesoMovimientosTx: 15,
  PesoMovimientosPg: 15,
  PesoEscaneoTx: 10,
  PesoEscaneoPg: 15,
  MetaSlaCasos: 90,
  MetaEmisionesTx: 10,
  MetaMovimientosPg: 350,
  MetaEscaneoPg: 350,
  PesoEmisiones: 1.5,
  PesoMovimientos: 1.2,
  MetaDiaria: 100,
  PuntosPorKudo: 10,
  PenalidadBaja: 5,
  PenalidadMedia: 15,
  PenalidadCritica: 50
};

interface ILocalAttachment {
  name: string;
  type: string;
  size: number;
  lastModified: number;
  content: Blob;
}

type ILocalFaltaRecord = IFaltaHistorialItem & ILocalEntity & {
  AttachmentData?: ILocalAttachment[];
};

type ILocalKudoRecord = IKudoHistorialItem & ILocalEntity & {
  AttachmentData?: ILocalAttachment[];
};

const normalizeEmail = (email?: string): string =>
  email?.trim().toLocaleLowerCase() || '';

const normalizeText = (value?: string): string =>
  value?.trim().toLocaleLowerCase() || '';

const isRoleType = (value: string): value is RoleType =>
  ROLE_VALUES.indexOf(value as RoleType) >= 0;

const isCatalogCategory = (value: string): value is CatalogCategory =>
  CATALOG_CATEGORIES.indexOf(value as CatalogCategory) >= 0;

const isAusenciaType = (value: string): value is AusenciaType =>
  ABSENCE_TYPES.indexOf(value as AusenciaType) >= 0;

const getApprovalStatusForRole = (role: RoleType): FaltaApprovalStatus =>
  role === 'Analista' || role === 'Asistente' || role === 'Oficial'
    ? 'Pendiente'
    : 'Aprobado';

export const isFaltaApprovedForScoring = (
  approvalStatus?: string
): boolean => {
  const normalizedStatus = normalizeText(approvalStatus);
  return normalizedStatus === '' || normalizedStatus === 'aprobado';
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
  result.setHours(
    boundary === 'start' ? 0 : 23,
    boundary === 'start' ? 0 : 59,
    boundary === 'start' ? 0 : 59,
    boundary === 'start' ? 0 : 999
  );
  return result;
};

const normalizeRange = (
  startDate: Date,
  endDate: Date
): { start: Date; end: Date } => {
  const start = getDayBoundary(startDate, 'start', 'La fecha de inicio');
  const end = getDayBoundary(endDate, 'end', 'La fecha de fin');

  if (start.getTime() > end.getTime()) {
    throw new Error('La fecha de inicio no puede ser posterior a la fecha de fin.');
  }

  return { start, end };
};

const isDateInRange = (
  value: string | undefined,
  start?: Date,
  end?: Date
): boolean => {
  if (!start && !end) {
    return true;
  }

  if (!value) {
    return false;
  }

  const timestamp = new Date(value).getTime();
  return !Number.isNaN(timestamp) &&
    (!start || timestamp >= start.getTime()) &&
    (!end || timestamp <= end.getTime());
};

const rangesOverlap = (
  leftStart: string | undefined,
  leftEnd: string | undefined,
  rightStart: Date,
  rightEnd: Date
): boolean => {
  if (!leftStart && !leftEnd) {
    return false;
  }

  const existingStart = new Date(leftStart || leftEnd || '').getTime();
  const existingEnd = new Date(leftEnd || leftStart || '').getTime();

  return !Number.isNaN(existingStart) &&
    !Number.isNaN(existingEnd) &&
    rightStart.getTime() <= existingEnd &&
    rightEnd.getTime() >= existingStart;
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
  const expectedObjectId = normalizeText(agenteObjectId);
  const expectedName = normalizeText(agenteNombre);

  if (!expectedEmail && !expectedObjectId && !expectedName) {
    return true;
  }

  const itemEmail = normalizeEmail(item.AgenteEmail);
  const itemObjectId = normalizeText(item.AgenteObjectID);

  if (itemEmail && expectedEmail && itemEmail === expectedEmail) {
    return true;
  }

  if (itemObjectId && expectedObjectId && itemObjectId === expectedObjectId) {
    return true;
  }

  if (itemEmail || itemObjectId) {
    return false;
  }

  return Boolean(expectedName && normalizeText(item.Title) === expectedName);
};

const getLocalAuthor = (): { Title: string; EMail: string } => {
  if (typeof localStorage === 'undefined') {
    return { Title: 'Usuario local', EMail: '' };
  }

  try {
    const value = JSON.parse(
      localStorage.getItem('humanoOps.currentUser') || '{}'
    ) as { displayName?: string; email?: string };

    return {
      Title: value.displayName?.trim() || 'Usuario local',
      EMail: normalizeEmail(value.email)
    };
  } catch {
    return { Title: 'Usuario local', EMail: '' };
  }
};

const toAttachment = (file: File): ILocalAttachment => ({
  name: file.name,
  type: file.type,
  size: file.size,
  lastModified: file.lastModified,
  content: file
});

const getMetricValue = (
  value: number | undefined,
  fallback = 0
): number => typeof value === 'number' && Number.isFinite(value) && value >= 0
  ? value
  : fallback;

const normalizeProductividadMetrics = <
  T extends IDashboardProductividadItem
>(item: T): T & Required<Pick<
  IDashboardProductividadItem,
  | 'Casos'
  | 'CasosAtendidos'
  | 'TieneDatosSLA'
  | 'Emisiones'
  | 'Movimientos'
  | 'EmisionesTx'
  | 'EmisionesPg'
  | 'MovimientosTx'
  | 'MovimientosPg'
  | 'EscaneoTx'
  | 'EscaneoPg'
>> => {
  const emisionesTx = getMetricValue(item.EmisionesTx, getMetricValue(item.Emisiones));
  const movimientosPg = getMetricValue(item.MovimientosPg, getMetricValue(item.Movimientos));
  const casosAtendidos = getMetricValue(item.CasosAtendidos, getMetricValue(item.Casos));
  const tieneDatosSLA = typeof item.CasosATiempo === 'number' &&
    Number.isFinite(item.CasosATiempo) &&
    item.CasosATiempo >= 0;

  return {
    ...item,
    Casos: getMetricValue(item.Casos, casosAtendidos),
    CasosAtendidos: casosAtendidos,
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

export interface IRegistrarFaltaData {
  agente: string;
  agenteEmail?: string;
  agenteObjectId?: string;
  emailSupervisor?: string;
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
  remitenteEmail?: string;
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
  emisiones?: number;
  movimientos?: number;
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
  EmailSupervisor?: string;
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
  Author?: { EMail?: string; Title?: string };
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
  EmailEmisor?: string;
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
  Id?: number;
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
  Id?: number;
  Title?: string;
  AgenteEmail?: string;
  AgenteObjectID?: string;
  FechaFalta?: string;
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

export interface IEvaluacionProductividadItem extends IDashboardProductividadItem {
  Id: number;
}

export interface IEvaluacionKudoItem extends IKudoListItem {
  FechaKudo?: string;
  Atributo?: string;
}

export interface IEvaluacionFaltaItem extends IDashboardFaltaItem {
  Id: number;
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
  PesoEmisiones: number;
  PesoMovimientos: number;
  MetaDiaria: number;
  PuntosPorKudo: number;
  PenalidadBaja: number;
  PenalidadMedia: number;
  PenalidadCritica: number;
}

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
> & Partial<Pick<
  IConfiguracionMetricas,
  'PesoEmisiones' | 'PesoMovimientos' | 'MetaDiaria'
>>;

export class SharePointService {
  public constructor(
    private readonly database: IndexedDbAdapter = new IndexedDbAdapter()
  ) {}

  public async ensureRegistroFaltasList(): Promise<void> {
    await Promise.resolve();
  }

  public async registrarFalta(
    faltaData: IRegistrarFaltaData,
    file: File | null
  ): Promise<void> {
    if (!faltaData.agente.trim() || Number.isNaN(faltaData.fecha.getTime())) {
      throw new Error('El agente y la fecha de la falta son obligatorios.');
    }

    const author = getLocalAuthor();
    const record: Omit<ILocalFaltaRecord, 'Id'> = {
      Title: faltaData.agente.trim(),
      AgenteEmail: normalizeEmail(faltaData.agenteEmail),
      AgenteObjectID: faltaData.agenteObjectId?.trim() || '',
      EmailSupervisor: normalizeEmail(faltaData.emailSupervisor),
      FechaFalta: faltaData.fecha.toISOString(),
      Categoria: faltaData.categoria.trim(),
      Subcategoria: faltaData.subcategoria?.trim() || '',
      CasoRef: faltaData.casoRef?.trim() || '',
      ProcesoArea: faltaData.procesoArea?.trim() || '',
      ComentariosCapacitacion: faltaData.comentariosCapacitacion?.trim() || '',
      Comentarios: faltaData.comentarios?.trim() || '',
      HoraLlegada: faltaData.horaLlegada?.trim() || '',
      MinutosTardanza: faltaData.minutosTardanza || 0,
      HorasPerdidas: faltaData.horasPerdidas || 0,
      OrigenError: faltaData.origenError?.trim() || '',
      Impacto: faltaData.impacto,
      Estado: faltaData.estado,
      EstadoAprobacion: getApprovalStatusForRole(faltaData.rolOriginador),
      RolOriginador: faltaData.rolOriginador,
      AuditID: generateAuditID(),
      Author: author,
      AttachmentData: file ? [toAttachment(file)] : [],
      SyncStatus: 'Pendiente',
      UpdatedAt: new Date().toISOString()
    };

    await this.database.add(LOCAL_STORES.faltas, record);
  }

  public async getFaltasHistorial(
    startDate?: Date,
    endDate?: Date,
    agenteNombre?: string,
    categoriaFilter?: string,
    agenteEmail?: string,
    agenteObjectId?: string
  ): Promise<IFaltaHistorialItem[]> {
    const start = startDate
      ? getDayBoundary(startDate, 'start', 'La fecha de inicio')
      : undefined;
    const end = endDate
      ? getDayBoundary(endDate, 'end', 'La fecha de fin')
      : undefined;

    if (start && end && start.getTime() > end.getTime()) {
      throw new Error('La fecha de inicio no puede ser posterior a la fecha de fin.');
    }

    const category = normalizeText(categoriaFilter);
    const items = await this.database.getAll<ILocalFaltaRecord>(LOCAL_STORES.faltas);

    return items
      .filter((item) =>
        isDateInRange(item.FechaFalta, start, end) &&
        isItemInAgentScope(item, agenteNombre, agenteEmail, agenteObjectId) &&
        (!category || category === 'todas' || normalizeText(item.Categoria) === category) &&
        isFaltaApprovedForScoring(item.EstadoAprobacion)
      )
      .sort((left, right) => right.FechaFalta.localeCompare(left.FechaFalta));
  }

  public async getFaltasPendientes(
    allowedAuthorEmails?: ReadonlyArray<string>
  ): Promise<IFaltaAprobacionItem[]> {
    const allowed = allowedAuthorEmails === undefined
      ? undefined
      : new Set(allowedAuthorEmails.map(normalizeEmail).filter(Boolean));

    if (allowed && allowed.size === 0) {
      return [];
    }

    const items = await this.database.getAll<ILocalFaltaRecord>(LOCAL_STORES.faltas);

    return items
      .filter((item) =>
        item.EstadoAprobacion === 'Pendiente' &&
        (!allowed || allowed.has(normalizeEmail(item.Author?.EMail)))
      )
      .map((item): IFaltaAprobacionItem => ({
        ...item,
        Id: item.Id,
        EstadoAprobacion: 'Pendiente',
        AttachmentFiles: (item.AttachmentData || []).map((attachment) => ({
          FileName: attachment.name,
          ServerRelativeUrl: URL.createObjectURL(attachment.content)
        }))
      }))
      .sort((left, right) => right.FechaFalta.localeCompare(left.FechaFalta));
  }

  public async actualizarEstadoAprobacion(
    id: number,
    estado: Extract<FaltaApprovalStatus, 'Aprobado' | 'Rechazado'>
  ): Promise<void> {
    const item = await this.database.getById<ILocalFaltaRecord>(LOCAL_STORES.faltas, id);

    if (!item) {
      throw new Error('No se encontró la falta indicada.');
    }

    await this.database.put(LOCAL_STORES.faltas, {
      ...item,
      Id: id,
      EstadoAprobacion: estado,
      SyncStatus: 'Pendiente'
    });
  }

  public async getCapacitacionesPeriodo(
    startDate: Date,
    endDate: Date,
    supervisorEmail?: string
  ): Promise<IFaltaHistorialItem[]> {
    const { start, end } = normalizeRange(startDate, endDate);
    const expectedAuthor = normalizeEmail(supervisorEmail);
    const items = await this.database.getAll<ILocalFaltaRecord>(LOCAL_STORES.faltas);

    return items.filter((item) =>
      normalizeText(item.Categoria) === normalizeText('Capacitación') &&
      isDateInRange(item.FechaFalta, start, end) &&
      (!expectedAuthor || normalizeEmail(item.Author?.EMail) === expectedAuthor)
    );
  }

  public async ensureRegistroKudosList(): Promise<void> {
    await Promise.resolve();
  }

  public async registrarKudo(
    kudoData: IRegistrarKudoData,
    files: ReadonlyArray<File> = []
  ): Promise<void> {
    const allowedExtensions = new Set(['pdf', 'jpg', 'jpeg', 'png']);

    files.forEach((file) => {
      const extension = file.name.split('.').pop()?.toLocaleLowerCase() || '';
      if (!allowedExtensions.has(extension)) {
        throw new Error(`El archivo ${file.name} no es PDF, JPG, JPEG o PNG.`);
      }
    });

    const record: Omit<ILocalKudoRecord, 'Id'> = {
      Title: kudoData.agente.trim(),
      AgenteEmail: normalizeEmail(kudoData.agenteEmail),
      AgenteObjectID: kudoData.agenteObjectId?.trim() || '',
      Atributo: kudoData.atributo.trim(),
      Mensaje: kudoData.mensaje.trim(),
      Puntos: kudoData.puntos,
      FechaKudo: kudoData.fecha.toISOString(),
      Remitente: kudoData.remitente.trim(),
      EmailEmisor: normalizeEmail(kudoData.remitenteEmail),
      AuditID: generateAuditID(),
      AttachmentData: files.map(toAttachment),
      SyncStatus: 'Pendiente',
      UpdatedAt: new Date().toISOString()
    };

    await this.database.add(LOCAL_STORES.kudos, record);
  }

  public async getKudosHistorial(
    startDate?: Date,
    endDate?: Date,
    agenteNombre?: string,
    agenteEmail?: string,
    agenteObjectId?: string
  ): Promise<IKudoHistorialItem[]> {
    const start = startDate
      ? getDayBoundary(startDate, 'start', 'La fecha de inicio')
      : undefined;
    const end = endDate
      ? getDayBoundary(endDate, 'end', 'La fecha de fin')
      : undefined;
    const items = await this.database.getAll<ILocalKudoRecord>(LOCAL_STORES.kudos);

    return items
      .filter((item) =>
        isDateInRange(item.FechaKudo, start, end) &&
        isItemInAgentScope(item, agenteNombre, agenteEmail, agenteObjectId)
      )
      .sort((left, right) => right.FechaKudo.localeCompare(left.FechaKudo));
  }

  public async getKudosMensuales(): Promise<IKudoListItem[]> {
    return this.database.getAll<ILocalKudoRecord>(LOCAL_STORES.kudos);
  }

  public async ensureRegistroProductividadList(): Promise<void> {
    await Promise.resolve();
  }

  public async ensureProductividadList(): Promise<void> {
    await this.ensureRegistroProductividadList();
  }

  public async registrarProductividad(
    data: IRegistrarProductividadData
  ): Promise<void> {
    const { start, end } = normalizeRange(data.fechaInicio, data.fechaFin);
    const email = normalizeEmail(data.agenteEmail);
    const existing = await this.database.getAll<IProductividadHistorialItem & ILocalEntity>(
      LOCAL_STORES.productividad
    );
    const hasConflict = existing.some((item) =>
      normalizeEmail(item.AgenteEmail) === email &&
      rangesOverlap(item.FechaInicio, item.FechaFin, start, end)
    );

    if (hasConflict) {
      throw new Error(PRODUCTIVITY_OVERLAP_ERROR_MESSAGE);
    }

    await this.database.add(LOCAL_STORES.productividad, {
      Title: data.agente.trim(),
      AgenteEmail: email,
      AgenteObjectID: data.agenteObjectId?.trim() || '',
      FechaRegistro: new Date().toISOString(),
      FechaInicio: start.toISOString(),
      FechaFin: end.toISOString(),
      Casos: data.casosAtendidos,
      CasosAtendidos: data.casosAtendidos,
      CasosATiempo: data.casosATiempo,
      TieneDatosSLA: true,
      Emisiones: data.emisiones ?? data.emisionesTx,
      Movimientos: data.movimientos ?? data.movimientosPg,
      EmisionesTx: data.emisionesTx,
      EmisionesPg: data.emisionesPg,
      MovimientosTx: data.movimientosTx,
      MovimientosPg: data.movimientosPg,
      EscaneoTx: data.escaneoTx,
      EscaneoPg: data.escaneoPg,
      AuditID: generateAuditID(),
      SyncStatus: 'Pendiente'
    });
  }

  public async getProductividadHistorial(
    startDate?: Date,
    endDate?: Date,
    agenteNombre?: string,
    agenteEmail?: string,
    agenteObjectId?: string
  ): Promise<IProductividadHistorialItem[]> {
    const start = startDate
      ? getDayBoundary(startDate, 'start', 'La fecha de inicio')
      : undefined;
    const end = endDate
      ? getDayBoundary(endDate, 'end', 'La fecha de fin')
      : undefined;
    const items = await this.database.getAll<IProductividadHistorialItem>(
      LOCAL_STORES.productividad
    );

    return items
      .filter((item) => {
        const matchesDate = start && end
          ? rangesOverlap(item.FechaInicio || item.FechaRegistro, item.FechaFin || item.FechaRegistro, start, end)
          : isDateInRange(item.FechaRegistro, start, end);
        return matchesDate &&
          isItemInAgentScope(item, agenteNombre, agenteEmail, agenteObjectId);
      })
      .map((item) => normalizeProductividadMetrics(item) as IProductividadHistorialItem)
      .sort((left, right) => right.FechaRegistro.localeCompare(left.FechaRegistro));
  }

  public async ensureRegistroAusenciasList(): Promise<void> {
    await Promise.resolve();
  }

  public async registrarAusencia(data: IRegistrarAusenciaData): Promise<void> {
    const { start, end } = normalizeRange(data.fechaInicio, data.fechaFin);

    if (!isAusenciaType(data.tipoAusencia)) {
      throw new Error('El tipo de ausencia no es válido.');
    }

    await this.database.add(LOCAL_STORES.ausencias, {
      Title: data.agente.trim(),
      AgenteEmail: normalizeEmail(data.agenteEmail),
      AgenteObjectID: data.agenteObjectId?.trim() || '',
      TipoAusencia: data.tipoAusencia,
      FechaInicio: start.toISOString(),
      FechaFin: end.toISOString(),
      Comentarios: data.comentarios?.trim() || '',
      AuditID: generateAuditID(),
      SyncStatus: 'Pendiente'
    });
  }

  public async getAusencias(
    startDate: Date,
    endDate: Date
  ): Promise<IAusenciaItem[]> {
    const { start, end } = normalizeRange(startDate, endDate);
    const items = await this.database.getAll<IAusenciaItem>(LOCAL_STORES.ausencias);

    return items
      .filter((item) => rangesOverlap(item.FechaInicio, item.FechaFin, start, end))
      .sort((left, right) => left.FechaInicio.localeCompare(right.FechaInicio));
  }

  public async ensureRegistroOcupacionLlamadasList(): Promise<void> {
    await Promise.resolve();
  }

  public async registrarLlamadaFlota(
    data: IRegistrarLlamadaFlotaData
  ): Promise<void> {
    if (!data.casoContacto.trim() || !normalizeEmail(data.supervisorEmail)) {
      throw new Error('Caso/contacto y correo del supervisor son obligatorios.');
    }

    await this.database.add(LOCAL_STORES.llamadas, {
      Title: data.casoContacto.trim(),
      SupervisorEmail: normalizeEmail(data.supervisorEmail),
      FechaHora: data.fechaHora.toISOString(),
      DuracionMinutos: data.duracionMinutos,
      Comentarios: data.comentarios?.trim() || '',
      AuditID: generateAuditID(),
      SyncStatus: 'Pendiente'
    });
  }

  public async getLlamadasFlota(
    startDate: Date,
    endDate: Date,
    supervisorEmail?: string
  ): Promise<ILlamadaFlotaItem[]> {
    const { start, end } = normalizeRange(startDate, endDate);
    const email = normalizeEmail(supervisorEmail);
    const items = await this.database.getAll<ILlamadaFlotaItem>(LOCAL_STORES.llamadas);

    return items.filter((item) =>
      isDateInRange(item.FechaHora, start, end) &&
      (!email || normalizeEmail(item.SupervisorEmail) === email)
    );
  }

  public async ensureRegistroOcupacionCorreosList(): Promise<void> {
    await Promise.resolve();
  }

  public async registrarConteoCorreos(
    data: IRegistrarConteoCorreosData
  ): Promise<void> {
    await this.database.add(LOCAL_STORES.correos, {
      Title: normalizeEmail(data.supervisorEmail),
      Fecha: data.fecha.toISOString(),
      CantidadCorreos: Math.max(0, data.cantidadCorreos),
      Comentarios: data.comentarios?.trim() || '',
      SyncStatus: 'Pendiente'
    });
  }

  public async getOcupacionCorreos(
    startDate: Date,
    endDate: Date,
    supervisorEmail: string
  ): Promise<IOcupacionCorreoItem[]> {
    const { start, end } = normalizeRange(startDate, endDate);
    const email = normalizeEmail(supervisorEmail);
    const items = await this.database.getAll<IOcupacionCorreoItem>(LOCAL_STORES.correos);

    return items.filter((item) =>
      normalizeEmail(item.Title) === email &&
      isDateInRange(item.Fecha, start, end)
    );
  }

  public async ensureConfiguracionRolesList(): Promise<void> {
    await Promise.resolve();
  }

  public async getRoleOverrides(): Promise<IRoleOverrideItem[]> {
    return this.database.getAll<IRoleOverrideItem>(LOCAL_STORES.roles);
  }

  public async setRoleOverride(email: string, role: RoleType): Promise<void> {
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !isRoleType(role)) {
      throw new Error('El correo o el rol no es válido.');
    }

    const items = await this.getRoleOverrides();
    const existing = items.find((item) => normalizeEmail(item.Title) === normalizedEmail);

    if (existing) {
      await this.database.put(LOCAL_STORES.roles, {
        ...existing,
        Title: normalizedEmail,
        RolAsignado: role,
        SyncStatus: 'Pendiente'
      });
      return;
    }

    await this.database.add(LOCAL_STORES.roles, {
      Title: normalizedEmail,
      RolAsignado: role,
      SyncStatus: 'Pendiente'
    });
  }

  public async ensureConfiguracionCatalogosList(): Promise<void> {
    const items = await this.database.getAll<ICatalogoItem>(LOCAL_STORES.catalogos);

    if (items.length > 0) {
      return;
    }

    for (const item of DEFAULT_CATALOG_ITEMS) {
      await this.database.add(LOCAL_STORES.catalogos, {
        Title: item.categoria,
        Valor: item.valor,
        SyncStatus: 'Sincronizado'
      });
    }
  }

  public async getCatalogos(
    categoria?: CatalogCategory
  ): Promise<ICatalogoItem[]> {
    if (categoria && !isCatalogCategory(categoria)) {
      throw new Error('La categoría de catálogo no es válida.');
    }

    await this.ensureConfiguracionCatalogosList();
    const items = await this.database.getAll<ICatalogoItem>(LOCAL_STORES.catalogos);

    return items
      .filter((item) => !categoria || item.Title === categoria)
      .sort((left, right) => left.Valor.localeCompare(right.Valor));
  }

  public async addCatalogo(
    categoria: CatalogCategory,
    valor: string
  ): Promise<void> {
    const normalizedValue = valor.trim();

    if (!isCatalogCategory(categoria) || !normalizedValue) {
      throw new Error('La categoría y el valor son obligatorios.');
    }

    const items = await this.getCatalogos(categoria);
    if (items.some((item) => normalizeText(item.Valor) === normalizeText(normalizedValue))) {
      throw new Error('La opción ya existe en el catálogo.');
    }

    await this.database.add(LOCAL_STORES.catalogos, {
      Title: categoria,
      Valor: normalizedValue,
      SyncStatus: 'Pendiente'
    });
  }

  public async deleteCatalogo(id: number): Promise<void> {
    await this.database.remove(LOCAL_STORES.catalogos, id);
  }

  public async ensureConfiguracionList(): Promise<void> {
    const items = await this.database.getAll<IConfiguracionMetricas>(LOCAL_STORES.configuracion);
    if (items.length === 0) {
      await this.database.add(LOCAL_STORES.configuracion, DEFAULT_CONFIG);
    }
  }

  public async getConfiguracion(): Promise<IConfiguracionMetricas> {
    await this.ensureConfiguracionList();
    const items = await this.database.getAll<IConfiguracionMetricas>(LOCAL_STORES.configuracion);
    return { ...DEFAULT_CONFIG, ...items[0] };
  }

  public async actualizarConfiguracion(
    id: number,
    data: IConfiguracionMetricasUpdate
  ): Promise<void> {
    const weights = [
      data.PesoCasos,
      data.PesoEmisionesTx,
      data.PesoEmisionesPg,
      data.PesoMovimientosTx,
      data.PesoMovimientosPg,
      data.PesoEscaneoTx,
      data.PesoEscaneoPg
    ];
    const total = weights.reduce((sum, value) => sum + Number(value), 0);

    if (Math.abs(total - 100) > 0.001) {
      throw new Error('La suma de los siete pesos debe ser exactamente 100%.');
    }

    const current = await this.getConfiguracion();
    await this.database.put(LOCAL_STORES.configuracion, {
      ...current,
      ...data,
      Id: id || current.Id,
      SyncStatus: 'Pendiente'
    });
  }

  public async ensurePublicacionEmpleadoMesList(): Promise<void> {
    await Promise.resolve();
  }

  public async getPublicacionMes(
    mesAno: string
  ): Promise<IPublicacionEmpleadoMes | undefined> {
    const month = normalizeText(mesAno);
    const items = await this.database.getAll<IPublicacionEmpleadoMes>(LOCAL_STORES.publicaciones);

    return items
      .filter((item) => normalizeText(item.Title) === month && item.Estado === 'Publicado')
      .sort((left, right) => right.FechaPublicacion.localeCompare(left.FechaPublicacion))[0];
  }

  public async publicarEmpleadoMes(data: IPublicarEmpleadoMesData): Promise<void> {
    const mesAno = data.mesAno.trim();
    const dedicatoria = data.dedicatoria.trim();

    if (!mesAno || !data.agenteNombre.trim() || !normalizeEmail(data.agenteEmail)) {
      throw new Error('Mes, agente y correo son obligatorios.');
    }

    if (!dedicatoria || dedicatoria.length > 150 || dedicatoria.split(/\r?\n/).length > 2) {
      throw new Error('La dedicatoria debe contener máximo 150 caracteres y dos líneas.');
    }

    const items = await this.database.getAll<IPublicacionEmpleadoMes>(LOCAL_STORES.publicaciones);
    const existing = items.find((item) => normalizeText(item.Title) === normalizeText(mesAno));
    const record = {
      Title: mesAno,
      AgenteEmail: normalizeEmail(data.agenteEmail),
      AgenteNombre: data.agenteNombre.trim(),
      PuntosTotales: data.puntosTotales,
      ConceptoKudo: data.conceptoKudo.trim(),
      Dedicatoria: dedicatoria,
      Estado: data.estado || 'Publicado',
      FechaPublicacion: (data.fechaPublicacion || new Date()).toISOString(),
      SyncStatus: 'Pendiente' as const
    };

    if (existing) {
      await this.database.put(LOCAL_STORES.publicaciones, {
        ...existing,
        ...record,
        Id: existing.Id
      });
    } else {
      await this.database.add(LOCAL_STORES.publicaciones, record);
    }
  }

  public async getDatosEvaluacion(
    startDate: Date,
    endDate: Date,
    agentes?: ReadonlyArray<IAgenteIdentityFilter | string>
  ): Promise<IDatosEvaluacion> {
    const { start, end } = normalizeRange(startDate, endDate);
    const identities = (agentes || []).map((agent): IAgenteIdentityFilter =>
      typeof agent === 'string' ? { name: agent } : agent
    );
    const hasScope = agentes !== undefined;
    const inScope = (item: {
      Title?: string;
      AgenteEmail?: string;
      AgenteObjectID?: string;
    }): boolean => !hasScope || identities.some((identity) =>
      isItemInAgentScope(item, identity.name, identity.email, identity.objectId)
    );

    if (hasScope && identities.length === 0) {
      return {
        productividad: [],
        kudos: [],
        faltas: [],
        config: await this.getConfiguracion()
      };
    }

    const [rawProductividad, rawKudos, rawFaltas, config] = await Promise.all([
      this.database.getAll<IProductividadHistorialItem>(LOCAL_STORES.productividad),
      this.database.getAll<IKudoHistorialItem>(LOCAL_STORES.kudos),
      this.database.getAll<IFaltaHistorialItem>(LOCAL_STORES.faltas),
      this.getConfiguracion()
    ]);

    const productividad = rawProductividad
      .filter((item) =>
        rangesOverlap(
          item.FechaInicio || item.FechaRegistro,
          item.FechaFin || item.FechaRegistro,
          start,
          end
        ) && inScope(item)
      )
      .map((item) => normalizeProductividadMetrics(item) as IEvaluacionProductividadItem);
    const kudos = rawKudos.filter((item) =>
      isDateInRange(item.FechaKudo, start, end) && inScope(item)
    );
    const faltas = rawFaltas.filter((item) =>
      isDateInRange(item.FechaFalta, start, end) &&
      inScope(item) &&
      isFaltaApprovedForScoring(item.EstadoAprobacion)
    );

    return { productividad, kudos, faltas, config };
  }

  public async getDatosDashboard(
    startDate?: Date,
    endDate?: Date
  ): Promise<IDatosDashboard> {
    if ((startDate && !endDate) || (!startDate && endDate)) {
      throw new Error('Debe indicar ambas fechas para calcular el Dashboard.');
    }

    if (startDate && endDate) {
      return this.getDatosEvaluacion(startDate, endDate);
    }

    const [config, productividad, faltas, kudos] = await Promise.all([
      this.getConfiguracion(),
      this.database.getAll<IProductividadHistorialItem>(LOCAL_STORES.productividad),
      this.database.getAll<IFaltaHistorialItem>(LOCAL_STORES.faltas),
      this.database.getAll<IKudoHistorialItem>(LOCAL_STORES.kudos)
    ]);

    return {
      config,
      productividad: productividad.map((item) => normalizeProductividadMetrics(item)),
      faltas: faltas.filter((item) => isFaltaApprovedForScoring(item.EstadoAprobacion)),
      kudos
    };
  }
}

export default SharePointService;
