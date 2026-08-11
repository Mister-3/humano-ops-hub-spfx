import type {
  AusenciaType,
  CatalogCategory,
  FaltaApprovalStatus,
  IFalta,
  IFaltaAprobacionItem,
  IFaltaHistorialItem,
  IAusenciaItem,
  ICatalogoItem,
  IDashboardFaltaItem,
  IDashboardProductividadItem,
  IEvaluacionFaltaItem,
  IEvaluacionKudoItem,
  IEvaluacionProductividadItem,
  IKudoHistorialItem,
  IKudoListItem,
  IPublicacionEmpleadoMes,
  IPublicarEmpleadoMesData,
  IProductividadHistorialItem,
  IRegistrarAusenciaData,
  IRegistrarFaltaData,
  IRegistrarKudoData,
  IRegistrarProductividadData,
  ISolicitudMejora,
  RoleType
} from '../../../types';
export type {
  AusenciaType,
  CatalogCategory,
  FaltaApprovalStatus,
  IFalta,
  IFaltaAprobacionItem,
  IFaltaHistorialItem,
  IAusenciaItem,
  ICatalogoItem,
  IDashboardFaltaItem,
  IDashboardProductividadItem,
  IEmpleadoDelMes,
  IEvaluacionFaltaItem,
  IEvaluacionKudoItem,
  IEvaluacionProductividadItem,
  IKudoHistorialItem,
  IKudoListItem,
  IPublicacionEmpleadoMes,
  IPublicarEmpleadoMesData,
  IProductividadHistorialItem,
  IRegistrarAusenciaData,
  IRegistrarFaltaData,
  IRegistrarKudoData,
  IRegistrarProductividadData,
  ISolicitudMejora,
  RoleType
} from '../../../types';
import { generateAuditID } from '../utils/auditUtils';
import IndexedDbAdapter, {
  LOCAL_STORES,
  type ILocalEntity
} from '../../../services/IndexedDbAdapter';
import { cloudDbClient, deduplicateKudos, uploadEvidenciaToSupabase } from '../../../services/CloudDbClient';
export { deduplicateKudos } from '../../../services/CloudDbClient';

export const PRODUCTIVITY_OVERLAP_ERROR_MESSAGE =
  '⚠️ Conflicto de Fechas: Ya existe un registro de productividad guardado para este colaborador que se traslapa con el rango ingresado.';

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
  'ProcesoArea',
  'modulos_pantallas',
  'aplicativos',
  'modulos',
  'pantallas'
];

const ABSENCE_TYPES: ReadonlyArray<AusenciaType> = [
  'Vacaciones',
  'Día Libre Cumpleaños',
  'Día Libre Empleado del Mes',
  'Licencia / Incapacidad'
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
  PenalidadCritica: 50,
  LimiteDiaPublicacion: 5
};

interface ILocalAttachment {
  name: string;
  type: string;
  size: number;
  lastModified: number;
  content: Blob;
}

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

const MONTH_NAMES_MAP: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12
};

const parseMesAnioText = (text: string): { mes: number; anio: number } => {
  const parts = text.trim().toLowerCase().split(/\s+/);
  let mes = new Date().getMonth() + 1;
  let anio = new Date().getFullYear();

  parts.forEach((p) => {
    if (MONTH_NAMES_MAP[p]) {
      mes = MONTH_NAMES_MAP[p];
    } else if (/^\d{4}$/.test(p)) {
      anio = Number(p);
    }
  });

  return { mes, anio };
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

export interface IRoleOverrideItem extends ILocalEntity {
  Id: number;
  Title: string;
  RolAsignado: RoleType;
}

export interface IDatosDashboard {
  config: IConfiguracionMetricas;
  productividad: IDashboardProductividadItem[];
  faltas: IDashboardFaltaItem[];
  kudos: IKudoListItem[];
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
  LimiteDiaPublicacion?: number;
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
  'PesoEmisiones' | 'PesoMovimientos' | 'MetaDiaria' | 'LimiteDiaPublicacion'
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

    let publicUrl = faltaData.evidenciaUrl || '';
    if (file && !publicUrl) {
      publicUrl = await uploadEvidenciaToSupabase(file, 'evidencias');
    }

    const faltaConEvidencia: IRegistrarFaltaData = {
      ...faltaData,
      evidenciaUrl: publicUrl
    };

    await cloudDbClient.createFalta(faltaConEvidencia);
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
    const items = await cloudDbClient.getFaltas();

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
    return cloudDbClient.getFaltasPendientes(allowedAuthorEmails);
  }

  public async actualizarEstadoAprobacion(
    id: number | string,
    estado: Extract<FaltaApprovalStatus, 'Aprobado' | 'Rechazado'>
  ): Promise<void> {
    return cloudDbClient.actualizarEstadoAprobacion(id, estado);
  }

  public async getCapacitacionesPeriodo(
    startDate: Date,
    endDate: Date,
    supervisorEmail?: string
  ): Promise<IFaltaHistorialItem[]> {
    const { start, end } = normalizeRange(startDate, endDate);
    const expectedAuthor = normalizeEmail(supervisorEmail);
    const items = await cloudDbClient.getFaltas();

    return items.filter((item) =>
      normalizeText(item.Categoria) === normalizeText('Capacitación') &&
      isDateInRange(item.FechaFalta, start, end) &&
      (!expectedAuthor || normalizeEmail(item.EmailSupervisor) === expectedAuthor)
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

    const uploadedUrls: string[] = [];
    for (const file of files) {
      const url = await uploadEvidenciaToSupabase(file, 'evidencias');
      if (url) uploadedUrls.push(url);
    }

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

    await cloudDbClient.createKudo(kudoData);
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
    const items = await cloudDbClient.getKudos();
    const deduplicated = deduplicateKudos(items);

    return deduplicated
      .filter((item) =>
        isDateInRange(item.FechaKudo, start, end) &&
        isItemInAgentScope(item, agenteNombre, agenteEmail, agenteObjectId)
      )
      .sort((left, right) => right.FechaKudo.localeCompare(left.FechaKudo));
  }

  public async getKudosMensuales(): Promise<IKudoListItem[]> {
    const items = await cloudDbClient.getKudos();
    return deduplicateKudos(items);
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
    const existing = await cloudDbClient.getProductividad();
    const hasConflict = existing.some((item) =>
      normalizeEmail(item.AgenteEmail) === email &&
      rangesOverlap(item.FechaInicio, item.FechaFin, start, end)
    );

    if (hasConflict) {
      throw new Error(PRODUCTIVITY_OVERLAP_ERROR_MESSAGE);
    }

    return cloudDbClient.createProductividad(data);
  }

  public async deleteProductividad(id: number | string): Promise<void> {
    return cloudDbClient.deleteProductividad(id);
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
    const items = await cloudDbClient.getProductividad();

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
    if (!isAusenciaType(data.tipoAusencia)) {
      throw new Error('El tipo de ausencia no es válido.');
    }
    return cloudDbClient.createAusencia(data);
  }

  public async getAusencias(
    startDate: Date,
    endDate: Date
  ): Promise<IAusenciaItem[]> {
    const { start, end } = normalizeRange(startDate, endDate);
    return cloudDbClient.getAusencias(start, end);
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
    return cloudDbClient.createLlamadaFlota(data);
  }

  public async getLlamadasFlota(
    startDate: Date,
    endDate: Date,
    supervisorEmail?: string
  ): Promise<ILlamadaFlotaItem[]> {
    const { start, end } = normalizeRange(startDate, endDate);
    const email = normalizeEmail(supervisorEmail);
    const items = await cloudDbClient.getLlamadasFlota(supervisorEmail);

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
    await Promise.resolve();
  }

  public async getCatalogos(
    categoria?: CatalogCategory,
    parentId?: string | number
  ): Promise<ICatalogoItem[]> {
    if (categoria && !isCatalogCategory(categoria)) {
      throw new Error('La categoría de catálogo no es válida.');
    }
    return cloudDbClient.getCatalogos(categoria, parentId);
  }

  public async addCatalogo(
    categoria: CatalogCategory,
    valor: string,
    parentId?: string | number
  ): Promise<void> {
    const normalizedValue = valor.trim();

    if (!isCatalogCategory(categoria) || !normalizedValue) {
      throw new Error('La categoría y el valor son obligatorios.');
    }

    const items = await this.getCatalogos(categoria, parentId);
    if (items.some((item) => normalizeText(item.Valor) === normalizeText(normalizedValue))) {
      throw new Error('La opción ya existe en el catálogo.');
    }

    return cloudDbClient.addCatalogo(categoria, normalizedValue, parentId);
  }

  public async deleteCatalogo(id: number | string): Promise<void> {
    return cloudDbClient.deleteCatalogo(id);
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
    const period = parseMesAnioText(mesAno);
    const items = await cloudDbClient.getHistorialEmpleadoMes();
    const current = items.find((item) =>
      item.mes === period.mes && item.anio === period.anio
    );

    if (!current) {
      return undefined;
    }

    return {
      Id: typeof current.id === 'number' ? current.id : 0,
      Title: mesAno.trim(),
      AgenteEmail: current.email_empleado,
      AgenteNombre: current.nombre_empleado || '',
      PuntosTotales: 0,
      ConceptoKudo: '',
      Dedicatoria: current.dedicatoria || '',
      Estado: 'Publicado',
      FechaPublicacion: current.fecha_publicacion || current.created_at || ''
    };
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

    const parsed = parseMesAnioText(mesAno);
    const author = getLocalAuthor();
    await cloudDbClient.createEmpleadoMesAward({
      email_empleado: normalizeEmail(data.agenteEmail),
      nombre_empleado: data.agenteNombre.trim(),
      mes: parsed.mes,
      anio: parsed.anio,
      supervisor_email: author.EMail,
      supervisor_nombre: author.Title,
      dedicatoria
    });

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
      cloudDbClient.getProductividad(),
      cloudDbClient.getKudos(),
      cloudDbClient.getFaltas(),
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
    const kudos = deduplicateKudos(rawKudos).filter((item) =>
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

    const [config, productividad, faltas, rawKudos] = await Promise.all([
      this.getConfiguracion(),
      cloudDbClient.getProductividad(),
      cloudDbClient.getFaltas(),
      cloudDbClient.getKudos()
    ]);

    const kudos = deduplicateKudos(rawKudos);

    return {
      config,
      productividad: productividad.map((item) => normalizeProductividadMetrics(item)),
      faltas: faltas.filter((item) => isFaltaApprovedForScoring(item.EstadoAprobacion)),
      kudos
    };
  }
}

export default SharePointService;
