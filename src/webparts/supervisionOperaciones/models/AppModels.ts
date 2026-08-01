export type RoleType =
  | 'Admin'
  | 'Gerente'
  | 'Supervisor'
  | 'Analista'
  | 'Asistente'
  | 'Oficial';

export type FaltaApprovalStatus =
  | 'Pendiente'
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
