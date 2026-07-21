export type RoleType =
  | 'Admin'
  | 'Gerente'
  | 'Supervisor'
  | 'Asistente'
  | 'Lectura';

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

export interface IKudo {
  id: number;
  agenteId: number;
  atributoCorporativo: string;
  puntos: number;
  fecha: Date;
}
