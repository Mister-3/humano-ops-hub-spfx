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
  Author?: {
    Title?: string;
    EMail?: string;
  };
}

export interface IKudo {
  id: number;
  agenteId: number;
  atributoCorporativo: string;
  puntos: number;
  fecha: Date;
}
