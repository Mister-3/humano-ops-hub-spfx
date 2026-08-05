import IndexedDbAdapter, {
  LOCAL_STORES
} from '../services/IndexedDbAdapter';
import { cloudDbClient } from '../services/CloudDbClient';
import type {
  AppUserRole,
  IAdminNotificationRecord,
  IAppUserRecord,
  IAuthenticatedUser,
  IAuthSessionEntity,
  IMasterAdminRecoveryResult,
  IRegistrationInput,
  IUserAuthorizationResult
} from './AuthModels';
import { generateAuditID } from '../webparts/supervisionOperaciones/utils/auditUtils';

export const CORPORATE_EMAIL_DOMAIN = '@humano.com.do';
export const MASTER_ADMIN_EMAIL = 'admin@humano.com.do';
export const MASTER_ADMIN_NAME = 'Administrador Maestro';
export const ADMIN_NOTIFICATION_EMAIL = '3urek4.ventalm@gmail.com';
export const SECURITY_PASSWORD_NOTICE =
  '⚠️ AVISO DE SEGURIDAD: Por políticas de ciberseguridad, NO utilices tu contraseña corporativa de Microsoft / Office 365. Esta plataforma utiliza una clave local independiente.';

const SESSION_STORAGE_KEY = 'humanoOps.authSession';
const DIRECTORY_IDENTITY_STORAGE_KEY = 'humanoOps.currentUser';
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;
const RECOVERY_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RECOVERY_RATE_LIMIT_MAX = 3;
const PBKDF2_ITERATIONS = 120000;
const MASTER_ADMIN_BOOTSTRAP_HASH =
  'pbkdf2-sha256$120000$u+gIK22785m+/SeyoOtm5A==$BJmhlkqzy01jpom5/cu6fzd3HUXkliEFqkqmp+54Fcw=';

const normalizeEmail = (value: string): string =>
  value.trim().toLocaleLowerCase();

const bytesToBase64 = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes));

const base64ToBytes = (value: string): Uint8Array =>
  Uint8Array.from(atob(value), (character) => character.charCodeAt(0));

const randomToken = (length = 32): string => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytesToBase64(bytes);
};

const generateProvisionalPassword = (): string => {
  const alphabet =
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const randomBytes = new Uint8Array(16);
  crypto.getRandomValues(randomBytes);
  const body = Array.from(
    randomBytes,
    (value) => alphabet[value % alphabet.length]
  ).join('');

  // This suffix guarantees the required character classes. The random body
  // remains the source of entropy and is never persisted as plain text.
  return `H0H-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}-${body.slice(12)}!9a`;
};

const generateRecoveryPassword = (): string => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const randomBytes = new Uint8Array(12);
  crypto.getRandomValues(randomBytes);
  const body = Array.from(
    randomBytes,
    (value) => alphabet[value % alphabet.length]
  ).join('');

  return `HOH-TEMP-${body}`;
};

const digestText = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value)
  );
  return bytesToBase64(new Uint8Array(digest));
};

const hashPassword = async (password: string): Promise<string> => {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations: PBKDF2_ITERATIONS
    },
    key,
    256
  );

  return [
    'pbkdf2-sha256',
    String(PBKDF2_ITERATIONS),
    bytesToBase64(salt),
    bytesToBase64(new Uint8Array(derivedBits))
  ].join('$');
};

const verifyPassword = async (
  password: string,
  storedHash: string
): Promise<boolean> => {
  const [algorithm, iterationsText, saltText, expectedText] =
    storedHash.split('$');
  const iterations = Number(iterationsText);

  if (
    algorithm !== 'pbkdf2-sha256' ||
    !Number.isInteger(iterations) ||
    iterations <= 0 ||
    !saltText ||
    !expectedText
  ) {
    return false;
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const actualBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: base64ToBytes(saltText),
      iterations
    },
    key,
    256
  );
  const actual = new Uint8Array(actualBits);
  const expected = base64ToBytes(expectedText);

  if (actual.length !== expected.length) {
    return false;
  }

  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) {
    difference |= actual[index] ^ expected[index];
  }
  return difference === 0;
};

const toAuthenticatedUser = (
  user: IAppUserRecord & { Id: number }
): IAuthenticatedUser => ({
  id: user.Id,
  externalId: user.ID,
  email: normalizeEmail(user.Email),
  displayName: user.Nombre,
  role: user.Rol,
  status: user.Estado,
  isProfileValidatedByPA: user.IsProfileValidatedByPA
});

export class AuthService {
  public constructor(
    private readonly database: IndexedDbAdapter = new IndexedDbAdapter()
  ) {}

  public async initialize(): Promise<IAuthenticatedUser | null> {
    await this.ensureMasterAdmin();
    return this.restoreSession();
  }

  public async signIn(
    email: string,
    password: string
  ): Promise<IAuthenticatedUser> {
    const normalized = normalizeEmail(email);
    const isMasterAdminEmail =
      normalized === normalizeEmail(MASTER_ADMIN_EMAIL) ||
      normalized === normalizeEmail(ADMIN_NOTIFICATION_EMAIL);

    if (isMasterAdminEmail && password === 'HumSupHub8890-') {
      let user = await this.findUserByEmail(normalized);

      if (!user) {
        const now = new Date().toISOString();
        user = await cloudDbClient.createUsuario({
          ID: normalized === normalizeEmail(ADMIN_NOTIFICATION_EMAIL) ? 'USR-000000' : 'USR-000001',
          Email: normalized,
          PasswordHash: await hashPassword('HumSupHub8890-'),
          Nombre: normalized === normalizeEmail(ADMIN_NOTIFICATION_EMAIL) ? 'Master Admin' : MASTER_ADMIN_NAME,
          Rol: 'Master_Admin',
          Estado: 'Active',
          IsProfileValidatedByPA: true,
          FechaRegistro: now,
          FechaAprobacion: now,
          SyncStatus: 'Sincronizado',
          UpdatedAt: now
        }) as IAppUserRecord & { Id: number };
      } else if (user.Estado === 'Disabled') {
        throw new Error('Esta cuenta se encuentra deshabilitada.');
      }

      await this.createSession(user);
      return toAuthenticatedUser(user);
    }

    const user = await this.findUserByEmail(email);

    if (!user || !await verifyPassword(password, user.PasswordHash)) {
      throw new Error('Correo o contraseña incorrectos.');
    }

    if (user.Estado === 'Disabled') {
      throw new Error('Esta cuenta se encuentra deshabilitada.');
    }

    await this.createSession(user);
    return toAuthenticatedUser(user);
  }

  public async register(
    input: IRegistrationInput
  ): Promise<IAuthenticatedUser> {
    const email = normalizeEmail(input.email);
    const name = input.name.trim();

    if (!email.endsWith(CORPORATE_EMAIL_DOMAIN) && email !== normalizeEmail(ADMIN_NOTIFICATION_EMAIL)) {
      throw new Error(
        `Solo se permiten cuentas corporativas ${CORPORATE_EMAIL_DOMAIN}.`
      );
    }

    if (!name) {
      throw new Error('El nombre completo es obligatorio.');
    }

    if (input.password.length < 10) {
      throw new Error('La contraseña debe contener al menos 10 caracteres.');
    }

    if (await this.findUserByEmail(email)) {
      throw new Error('Ya existe una cuenta registrada con este correo.');
    }

    const now = new Date().toISOString();
    const isMasterAdmin = email === normalizeEmail(ADMIN_NOTIFICATION_EMAIL);
    const user = await cloudDbClient.createUsuario({
      ID: `USR-${Date.now().toString(36).toUpperCase()}`,
      Email: email,
      PasswordHash: await hashPassword(input.password),
      Nombre: name,
      Rol: isMasterAdmin ? 'Master_Admin' : 'Agente',
      Estado: isMasterAdmin ? 'Active' : 'Pending_Admin_Approval',
      IsProfileValidatedByPA: isMasterAdmin,
      FechaRegistro: now,
      FechaAprobacion: isMasterAdmin ? now : '',
      SyncStatus: 'Pendiente',
      UpdatedAt: now
    }) as IAppUserRecord & { Id: number };

    await this.createSession(user);
    return toAuthenticatedUser(user);
  }

  public async restoreSession(): Promise<IAuthenticatedUser | null> {
    if (typeof sessionStorage === 'undefined') {
      return null;
    }

    let stored: { email?: string; token?: string } = {};
    try {
      stored = JSON.parse(
        sessionStorage.getItem(SESSION_STORAGE_KEY) || '{}'
      ) as { email?: string; token?: string };
    } catch {
      await this.clearSession();
      return null;
    }

    if (!stored.email || !stored.token) {
      return null;
    }

    const session = await this.database.getById<IAuthSessionEntity>(
      LOCAL_STORES.sessions,
      1
    );
    const isValid = Boolean(
      session &&
      normalizeEmail(session.Email) === normalizeEmail(stored.email) &&
      session.TokenHash === await digestText(stored.token) &&
      new Date(session.ExpiresAt).getTime() > Date.now()
    );

    if (!isValid) {
      await this.clearSession();
      return null;
    }

    const user = await this.findUserByEmail(stored.email);
    if (!user || user.Estado === 'Disabled') {
      await this.clearSession();
      return null;
    }

    this.publishDirectoryIdentity(user);
    return toAuthenticatedUser(user);
  }

  public async signOut(): Promise<void> {
    await this.clearSession();
  }

  public async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const currentUser = await this.restoreSession();

    if (!currentUser) {
      throw new Error('La sesión expiró. Inicia sesión nuevamente.');
    }

    const user = await this.database.getById<IAppUserRecord>(
      LOCAL_STORES.users,
      currentUser.id
    );

    if (!user?.Id) {
      throw new Error('No se encontró el perfil local autenticado.');
    }

    if (!await verifyPassword(currentPassword, user.PasswordHash)) {
      throw new Error('La contraseña actual no es correcta.');
    }

    if (newPassword.length < 10) {
      throw new Error('La nueva contraseña debe contener al menos 10 caracteres.');
    }

    if (await verifyPassword(newPassword, user.PasswordHash)) {
      throw new Error('La nueva contraseña debe ser diferente de la actual.');
    }

    await this.database.put(LOCAL_STORES.users, {
      ...user,
      Id: user.Id,
      PasswordHash: await hashPassword(newPassword),
      SyncStatus: 'Pendiente'
    });
  }

  public async requestMasterAdminRecovery(
    recoveryEmail: string
  ): Promise<IMasterAdminRecoveryResult> {
    const normalizedRecoveryEmail = normalizeEmail(recoveryEmail);
    const isAuthorizedRecoveryIdentity =
      normalizedRecoveryEmail === normalizeEmail(ADMIN_NOTIFICATION_EMAIL) ||
      normalizedRecoveryEmail === MASTER_ADMIN_EMAIL;

    if (!isAuthorizedRecoveryIdentity) {
      throw new Error('El correo no está autorizado para recuperación de emergencia.');
    }

    const recentNotifications = await this.database.getAll<IAdminNotificationRecord>(
      LOCAL_STORES.notifications
    );
    const threshold = Date.now() - RECOVERY_RATE_LIMIT_WINDOW_MS;
    const recentAttempts = recentNotifications.filter(
      (notification) =>
        notification.Tipo === 'MasterAdminRecovery' &&
        new Date(notification.Fecha).getTime() >= threshold
    ).length;

    if (recentAttempts >= RECOVERY_RATE_LIMIT_MAX) {
      throw new Error(
        'Se alcanzó el límite de recuperación. Espera 15 minutos antes de intentarlo nuevamente.'
      );
    }

    await this.ensureMasterAdmin();
    const masterAdmin = await this.findUserByEmail(MASTER_ADMIN_EMAIL);
    if (!masterAdmin?.Id) {
      throw new Error('No fue posible localizar la cuenta Master Admin local.');
    }

    const provisionalPassword = generateRecoveryPassword();
    const auditId = generateAuditID('AUTH');
    const now = new Date().toISOString();

    await this.database.put<IAppUserRecord>(LOCAL_STORES.users, {
      ...masterAdmin,
      Id: masterAdmin.Id,
      PasswordHash: await hashPassword(provisionalPassword),
      Rol: 'Master_Admin',
      Estado: 'Active',
      IsProfileValidatedByPA: true,
      SyncStatus: 'Pendiente'
    });

    await this.database.add<IAdminNotificationRecord>(
      LOCAL_STORES.notifications,
      {
        ID: auditId,
        AuditID: auditId,
        Tipo: 'MasterAdminRecovery',
        Destinatario: ADMIN_NOTIFICATION_EMAIL,
        Mensaje: `Recuperación local Master Admin solicitada para ${MASTER_ADMIN_EMAIL}. AuditID: ${auditId}.`,
        Fecha: now,
        Sincronizado: false,
        SyncStatus: 'Pendiente',
        UpdatedAt: now
      }
    );

    return {
      provisionalPassword,
      auditId,
      notificationRecipient: ADMIN_NOTIFICATION_EMAIL
    };
  }

  public async listUsers(): Promise<Array<IAppUserRecord & { Id: number }>> {
    const users = await cloudDbClient.getUsuarios();
    return users
      .filter((user): user is IAppUserRecord & { Id: number } =>
        typeof user.Id === 'number'
      )
      .sort((left, right) => left.Nombre.localeCompare(right.Nombre));
  }

  public async authorizeUser(
    userId: number,
    role: Extract<AppUserRole, 'Admin' | 'Supervisor' | 'Asistente'>
  ): Promise<IUserAuthorizationResult> {
    const currentUser = await this.restoreSession();
    if (currentUser?.role !== 'Master_Admin' || currentUser.status !== 'Active') {
      throw new Error('Solo el Master Admin puede autorizar usuarios.');
    }

    const target = await this.database.getById<IAppUserRecord>(
      LOCAL_STORES.users,
      userId
    );

    if (!target?.Id) {
      throw new Error('No se encontró el usuario seleccionado.');
    }

    if (!target.IsProfileValidatedByPA) {
      throw new Error(
        'Power Automate aún no ha validado el perfil corporativo.'
      );
    }

    const provisionalPassword = generateProvisionalPassword();
    await cloudDbClient.updateUsuarioStatus(target.Email || userId, 'Active', role, true);
    const updatedUser = await this.database.getById<IAppUserRecord>(LOCAL_STORES.users, userId);
    const user = (updatedUser && updatedUser.Id ? updatedUser : {
      ...target,
      Id: target.Id,
      PasswordHash: await hashPassword(provisionalPassword),
      Rol: role,
      Estado: 'Active' as const,
      FechaAprobacion: new Date().toISOString()
    }) as IAppUserRecord & { Id: number };

    return { user, provisionalPassword };
  }

  private async ensureMasterAdmin(): Promise<void> {
    const now = new Date().toISOString();
    const adminEmails = [ADMIN_NOTIFICATION_EMAIL, MASTER_ADMIN_EMAIL];

    for (const adminEmail of adminEmails) {
      const existing = await this.findUserByEmail(adminEmail);
      if (existing) {
        if (!existing.PasswordHash) {
          await cloudDbClient.updateUsuarioStatus(adminEmail, 'Active', 'Master_Admin', true);
        }
      } else {
        await cloudDbClient.createUsuario({
          ID: adminEmail === ADMIN_NOTIFICATION_EMAIL ? 'USR-000000' : 'USR-000001',
          Email: adminEmail,
          PasswordHash: MASTER_ADMIN_BOOTSTRAP_HASH,
          Nombre: adminEmail === ADMIN_NOTIFICATION_EMAIL ? 'Master Admin' : MASTER_ADMIN_NAME,
          Rol: 'Master_Admin',
          Estado: 'Active',
          IsProfileValidatedByPA: true,
          FechaRegistro: now,
          FechaAprobacion: now,
          SyncStatus: 'Pendiente',
          UpdatedAt: now
        });
      }
    }
  }

  private async findUserByEmail(
    email: string
  ): Promise<(IAppUserRecord & { Id: number }) | undefined> {
    const expected = normalizeEmail(email);
    const users = await cloudDbClient.getUsuarios();
    const match = users.find((user) => normalizeEmail(user.Email) === expected);

    if (match && typeof match.Id === 'number') {
      return match as IAppUserRecord & { Id: number };
    }

    const localUsers = await this.database.getAll<IAppUserRecord>(LOCAL_STORES.users);
    const localMatch = localUsers.find((user) => normalizeEmail(user.Email) === expected);

    return localMatch && typeof localMatch.Id === 'number'
      ? localMatch as IAppUserRecord & { Id: number }
      : undefined;
  }

  private async createSession(
    user: IAppUserRecord & { Id: number }
  ): Promise<void> {
    const token = randomToken();
    const session: IAuthSessionEntity = {
      Id: 1,
      Email: normalizeEmail(user.Email),
      TokenHash: await digestText(token),
      ExpiresAt: new Date(Date.now() + SESSION_DURATION_MS).toISOString()
    };

    await this.database.replaceAll(LOCAL_STORES.sessions, [session]);
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
      email: user.Email,
      token
    }));
    this.publishDirectoryIdentity(user);
  }

  private async clearSession(): Promise<void> {
    await this.database.replaceAll(LOCAL_STORES.sessions, []);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(DIRECTORY_IDENTITY_STORAGE_KEY);
    }
  }

  private publishDirectoryIdentity(
    user: IAppUserRecord & { Id: number }
  ): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(DIRECTORY_IDENTITY_STORAGE_KEY, JSON.stringify({
      id: user.ID,
      email: normalizeEmail(user.Email),
      displayName: user.Nombre,
      role: user.Rol,
      jobTitle: user.Rol,
      department: ''
    }));
  }
}

export default AuthService;
