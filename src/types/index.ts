import type { ILocalEntity } from '../services/IndexedDbAdapter';

export type {
  EndToEndFlow,
  EndToEndIssueLevel,
  EndToEndSeverity,
  EndToEndStage,
  IEndToEndAnalyzedRow,
  IEndToEndCapabilities,
  IEndToEndClosure,
  IEndToEndGroup,
  IEndToEndIssue,
  IEndToEndNormalizedRow,
  IEndToEndParsedReport,
  IEndToEndReportAction,
  IEndToEndRowSource,
  IEndToEndSlaResult,
  IEndToEndSnapshot,
  IEndToEndValidationSummary,
  IEndToEndVersionConflict
} from './endToEnd';

export const CANONICAL_ROLES = [
  'Admin',
  'Gerente',
  'Supervisor',
  'Asistente',
  'Agente'
] as const;

export type RoleType = typeof CANONICAL_ROLES[number];
export type RoleSlug = 'admin' | 'gerente' | 'supervisor' | 'asistente' | 'agente';
export const CANONICAL_ROLE_SLUGS: ReadonlyArray<RoleSlug> = [
  'admin',
  'gerente',
  'supervisor',
  'asistente',
  'agente'
];

export const ROLE_SLUGS: Record<RoleType, RoleSlug> = {
  Admin: 'admin',
  Gerente: 'gerente',
  Supervisor: 'supervisor',
  Asistente: 'asistente',
  Agente: 'agente'
};

export const canonicalizeRoleSlug = (value?: string | null): RoleSlug | undefined => {
  const normalized = (value || '').trim().toLocaleLowerCase().replace(/[\s-]+/g, '_');
  if (normalized === 'admin' || normalized === 'master_admin') return 'admin';
  if (normalized === 'gerente') return 'gerente';
  if (normalized === 'supervisor') return 'supervisor';
  if (normalized === 'asistente' || normalized === 'analista' || normalized === 'custodio') {
    return 'asistente';
  }
  if (normalized === 'agente' || normalized === 'oficial' || normalized === 'colaborador') {
    return 'agente';
  }
  return undefined;
};

export const normalizeRoleType = (value?: string | null): RoleType => {
  const slug = canonicalizeRoleSlug(value) || 'agente';
  return CANONICAL_ROLES[CANONICAL_ROLE_SLUGS.indexOf(slug)];
};

export const toRoleSlug = (value?: string | null): RoleSlug =>
  canonicalizeRoleSlug(value) || 'agente';

export type FaltaApprovalStatus =
  | 'Pendiente'
  | 'Pendiente_Aprobacion'
  | 'Registrado'
  | 'Aprobado'
  | 'Rechazado';

export interface IUsuario {
  id: number;
  email: string;
  displayName: string;
  rol: RoleType;
}

export interface IFalta {
  id: number;
  agenteId: number;
  fecha: Date;
  categoria: string;
  estado: 'Borrador' | 'Aprobado' | 'Rechazado';
  evidenciaUrl: string;
}

export interface IFaltaAttachment {
  FileName: string;
  ServerRelativeUrl: string;
}

export interface IFaltaAprobacionItem {
  Id: number;
  rawId?: string;
  Title: string;
  AgenteEmail?: string;
  AgenteObjectID?: string;
  AuditID?: string;
  FechaFalta: string;
  Categoria: string;
  Subcategoria?: string;
  CasoRef?: string;
  IdCasoHelpdesk?: string;
  ProcesoArea?: string;
  HorasPerdidas?: number;
  MinutosTardanza?: number;
  HoraLlegada?: string;
  OrigenError?: string;
  SubcategoriaError?: string;
  ComentariosCapacitacion?: string;
  IdAuditoria?: string;
  Comentarios?: string;
  Impacto: string;
  Estado: IFalta['estado'];
  EstadoAprobacion: FaltaApprovalStatus;
  RolOriginador: RoleType;
  AttachmentFiles: IFaltaAttachment[];
  Author?: { Title?: string; EMail?: string };
}

export interface IKudo {
  id: number;
  agenteId: number;
  atributoCorporativo: string;
  puntos: number;
  fecha: Date;
}

export type CatalogCategory =
  | 'Falta'
  | 'ErrorProceso'
  | 'CodigoEtica'
  | 'Kudo'
  | 'ConceptoKudo'
  | 'ProcesoArea'
  | 'modulos_pantallas'
  | 'aplicativos'
  | 'modulos'
  | 'pantallas';

export interface IKudoConceptoItem {
  id?: string | number;
  atributo: string;
  concepto: string;
  descripcion?: string;
}

export interface ICatalogoItem extends ILocalEntity {
  Id: number;
  rawId?: string | number;
  Title: CatalogCategory;
  Valor: string;
  parent_id?: string | number;
  activo?: boolean;
}

export type AusenciaType =
  | 'Vacaciones'
  | 'Día Libre Cumpleaños'
  | 'Día Libre Empleado del Mes'
  | 'Licencia / Incapacidad';

export interface IRegistrarAusenciaData {
  agente: string;
  agenteEmail?: string;
  agenteObjectId?: string;
  tipoAusencia: AusenciaType;
  fechaInicio: Date;
  fechaFin: Date;
  comentarios?: string;
  periodoAnio?: number;
  premioEmpleadoMesId?: string | number;
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
  PeriodoAnio?: number;
  PremioEmpleadoMesID?: string | number;
}

export interface IEmpleadoDelMes {
  id?: number | string;
  email_empleado: string;
  nombre_empleado?: string;
  mes: number;
  anio: number;
  dedicatoria?: string;
  supervisor_email?: string;
  supervisor_nombre?: string;
  dia_libre_reclamado?: boolean;
  fecha_reclamado?: string;
  fecha_publicacion?: string;
  created_at?: string;
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

export type InitiativePriority = 'Baja' | 'Media' | 'Alta' | 'Critica';
export type InitiativeLifecycleStatus =
  | 'Borrador'
  | 'En Revision'
  | 'Aprobada'
  | 'En Desarrollo'
  | 'Implementada'
  | 'Descartada';

export type AcceptanceCriterionMode = 'checklist' | 'gherkin';

export interface IAcceptanceCriterion {
  id: string;
  mode: AcceptanceCriterionMode;
  text: string;
  given?: string;
  when?: string;
  then?: string;
  verified: boolean;
}

export interface ISolicitudMejora {
  id?: string;
  audit_id?: string;
  owner_id?: string;
  autor_nombre: string;
  autor_email: string;
  aplicativo?: string;
  modulo_afectado: string;
  pantalla_afectada?: string;
  titulo: string;
  descripcion: string;
  criterios_aceptacion: string;
  criterios_aceptacion_json?: IAcceptanceCriterion[];
  actor?: string;
  necesidad?: string;
  beneficio?: string;
  modulo_clave?: string;
  prioridad?: InitiativePriority;
  estado_ciclo?: InitiativeLifecycleStatus;
  estado: 'Pendiente_Aprobacion' | 'Aprobada' | 'Declinada';
  comentario_supervisor?: string;
  supervisor_email?: string;
  supervisor_nombre?: string;
  fecha_revision?: string;
  created_at?: string;
  updated_at?: string;
}

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
  evidenciaUrl?: string;
  estadoAprobacion?: string;
}

export interface IFaltaHistorialItem extends ILocalEntity {
  Id: number;
  rawId?: string;
  Title: string;
  AgenteEmail?: string;
  AgenteObjectID?: string;
  EmailSupervisor?: string;
  FechaFalta: string;
  Categoria: string;
  Subcategoria?: string;
  CasoRef?: string;
  IdCasoHelpdesk?: string;
  ProcesoArea?: string;
  ComentariosCapacitacion?: string;
  Comentarios?: string;
  HoraLlegada?: string;
  MinutosTardanza?: number;
  HorasPerdidas?: number;
  OrigenError?: string;
  SubcategoriaError?: string;
  Impacto: string;
  Estado: IFalta['estado'];
  EstadoAprobacion?: FaltaApprovalStatus;
  RolOriginador: RoleType;
  AuditID?: string;
  IdAuditoria?: string;
  Author?: { EMail?: string; Title?: string };
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

export interface IKudoHistorialItem extends ILocalEntity {
  Id: number;
  rawId?: string;
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
  devolucionesEmisiones?: number;
  devolucionesMovimientos?: number;
  devolucionesEscaneo?: number;
  carnetsTx?: number;
  carnetsPg?: number;
  emisiones?: number;
  movimientos?: number;
}

export interface IProductividadHistorialItem {
  Id: number;
  rawId?: string;
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
  DevolucionesEmisiones?: number;
  MovimientosTx: number;
  MovimientosPg: number;
  DevolucionesMovimientos?: number;
  EscaneoTx: number;
  EscaneoPg: number;
  DevolucionesEscaneo?: number;
  CarnetsTx?: number;
  CarnetsPg?: number;
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
