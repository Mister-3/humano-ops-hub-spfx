import type { ILocalEntity } from '../services/IndexedDbAdapter';

export type AppUserRole =
  | 'Master_Admin'
  | 'Admin'
  | 'Gerente'
  | 'Supervisor'
  | 'Analista'
  | 'Asistente'
  | 'Agente'
  | 'Oficial';

export type AppUserStatus =
  | 'Pending_Validation'
  | 'Pending_Admin_Approval'
  | 'Active'
  | 'Disabled';

export interface IAppUserRecord extends ILocalEntity {
  Id?: number;
  ID: string;
  Email: string;
  PasswordHash: string;
  Nombre: string;
  Rol: AppUserRole;
  Estado: AppUserStatus;
  IsProfileValidatedByPA: boolean;
  FechaRegistro: string;
  FechaAprobacion: string;
}

export interface IAuthenticatedUser {
  id: number;
  externalId: string;
  email: string;
  displayName: string;
  role: AppUserRole;
  status: AppUserStatus;
  isProfileValidatedByPA: boolean;
}

export interface IRegistrationInput {
  email: string;
  name: string;
  password: string;
}

export interface IUserAuthorizationResult {
  user: IAppUserRecord & { Id: number };
  provisionalPassword: string;
}

export interface IMasterAdminRecoveryResult {
  provisionalPassword: string;
  auditId: string;
  notificationRecipient: string;
}

export interface IAdminNotificationRecord extends ILocalEntity {
  ID: string;
  Tipo: 'MasterAdminRecovery';
  Destinatario: string;
  Mensaje: string;
  Fecha: string;
  Sincronizado: boolean;
}

export interface IAuthSessionEntity extends ILocalEntity {
  Id: number;
  Email: string;
  TokenHash: string;
  ExpiresAt: string;
}

export const ACTIVE_USER_ROLES: ReadonlyArray<AppUserRole> = [
  'Master_Admin',
  'Admin',
  'Gerente',
  'Supervisor',
  'Analista',
  'Asistente',
  'Oficial'
];

export const APP_USER_STATUSES: ReadonlyArray<AppUserStatus> = [
  'Pending_Validation',
  'Pending_Admin_Approval',
  'Active',
  'Disabled'
];
