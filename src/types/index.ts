import type { ILocalEntity } from '../services/IndexedDbAdapter';

export type RoleType =
  | 'Master_Admin'
  | 'Admin'
  | 'Gerente'
  | 'Supervisor'
  | 'Analista'
  | 'Asistente'
  | 'Agente'
  | 'Oficial';

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
  | 'ProcesoArea'
  | 'modulos_pantallas'
  | 'aplicativos'
  | 'modulos'
  | 'pantallas';

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

export interface ISolicitudMejora {
  id?: string;
  audit_id?: string;
  autor_nombre: string;
  autor_email: string;
  aplicativo?: string;
  modulo_afectado: string;
  pantalla_afectada?: string;
  titulo: string;
  descripcion: string;
  criterios_aceptacion: string;
  estado: 'Pendiente_Aprobacion' | 'Aprobada' | 'Declinada';
  comentario_supervisor?: string;
  supervisor_email?: string;
  supervisor_nombre?: string;
  fecha_revision?: string;
  created_at?: string;
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
