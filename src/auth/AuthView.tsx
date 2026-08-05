import * as React from 'react';
import {
  DefaultButton,
  Icon,
  MessageBar,
  MessageBarType,
  Pivot,
  PivotItem,
  PrimaryButton,
  Spinner,
  SpinnerSize,
  TextField
} from '@fluentui/react';

import { HumanoOpsLogo } from '../webparts/supervisionOperaciones/components/Brand/HumanoOpsLogo';
import { useAuth } from './AuthProvider';
import {
  ADMIN_NOTIFICATION_EMAIL,
  SECURITY_PASSWORD_NOTICE
} from './AuthService';
import styles from './AuthView.module.scss';

const LoginForm: React.FC = () => {
  const { requestMasterAdminRecovery, signIn } = useAuth();
  const [email, setEmail] = React.useState<string>('');
  const [password, setPassword] = React.useState<string>('');
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string>('');
  const [isRecoveryVisible, setIsRecoveryVisible] =
    React.useState<boolean>(false);
  const [recoveryEmail, setRecoveryEmail] = React.useState<string>('');
  const [isRecovering, setIsRecovering] = React.useState<boolean>(false);
  const [recoveryError, setRecoveryError] = React.useState<string>('');
  const [recoveryResult, setRecoveryResult] = React.useState<{
    password: string;
    auditId: string;
    recipient: string;
  }>();

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await signIn(email, password);
    } catch (submitError: any) {
      setError(submitError?.message || submitError?.error_description || (typeof submitError === 'string' ? submitError : 'Error al iniciar sesión'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const recoverMasterAdmin = async (): Promise<void> => {
    setRecoveryError('');
    setRecoveryResult(undefined);
    setIsRecovering(true);

    try {
      const result = await requestMasterAdminRecovery(recoveryEmail);
      setRecoveryResult({
        password: result.provisionalPassword,
        auditId: result.auditId,
        recipient: result.notificationRecipient
      });
    } catch (recoveryFailure: any) {
      setRecoveryError(
        recoveryFailure?.message || recoveryFailure?.error_description || (typeof recoveryFailure === 'string' ? recoveryFailure : 'Error al recuperar la cuenta')
      );
    } finally {
      setIsRecovering(false);
    }
  };

  const copyRecoveryPassword = async (): Promise<void> => {
    if (!recoveryResult?.password) {
      return;
    }

    try {
      await navigator.clipboard.writeText(recoveryResult.password);
    } catch {
      setRecoveryError(
        'El navegador bloqueó el portapapeles. Selecciona y copia la clave manualmente.'
      );
    }
  };

  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)}>
      {error && <MessageBar messageBarType={MessageBarType.error}>{error}</MessageBar>}
      <TextField
        autoComplete="email"
        label="Correo corporativo"
        onChange={(_, value) => setEmail(value || '')}
        required
        type="email"
        value={email}
      />
      <TextField
        autoComplete="current-password"
        canRevealPassword
        label="Contraseña"
        onChange={(_, value) => setPassword(value || '')}
        required
        type="password"
        value={password}
      />
      <PrimaryButton
        disabled={isSubmitting || !email.trim() || !password}
        type="submit"
        text={isSubmitting ? 'Validando...' : 'Ingresar a Humano Ops Hub'}
      />

      <button
        aria-expanded={isRecoveryVisible}
        className={styles.emergencyTrigger}
        onClick={() => {
          setIsRecoveryVisible((current) => !current);
          setRecoveryError('');
        }}
        type="button"
      >
        Acceso de emergencia Master Admin
      </button>

      {isRecoveryVisible && (
        <section
          aria-label="Recuperación de emergencia Master Admin"
          className={styles.emergencyPanel}
        >
          <MessageBar messageBarType={MessageBarType.severeWarning}>
            Esta recuperación modifica únicamente la credencial local de este
            dispositivo y genera una alerta auditable para Power Automate.
          </MessageBar>
          {recoveryError && (
            <MessageBar messageBarType={MessageBarType.error}>
              {recoveryError}
            </MessageBar>
          )}
          <TextField
            autoComplete="email"
            disabled={isRecovering}
            label="Correo autorizado de recuperación"
            onChange={(_, value) => setRecoveryEmail(value || '')}
            placeholder="Correo Master Admin"
            type="email"
            value={recoveryEmail}
          />
          <PrimaryButton
            disabled={isRecovering || !recoveryEmail.trim()}
            onClick={() => void recoverMasterAdmin()}
            text={isRecovering ? 'Generando clave...' : 'Generar clave temporal'}
            type="button"
          />

          {recoveryResult && (
            <div aria-live="polite" className={styles.recoveryResult}>
              <strong>
                Contraseña provisional generada y notificación preparada.
              </strong>
              <span>
                Sincroniza el paquete para despachar la alerta a{' '}
                {recoveryResult.recipient}. Puedes utilizar ahora la clave
                temporal mostrada para acceder.
              </span>
              <code>{recoveryResult.password}</code>
              <span>AuditID: {recoveryResult.auditId}</span>
              <DefaultButton
                iconProps={{ iconName: 'Copy' }}
                onClick={() => void copyRecoveryPassword()}
                text="Copiar clave temporal"
                type="button"
              />
            </div>
          )}
        </section>
      )}
    </form>
  );
};

const RegisterForm: React.FC = () => {
  const { register } = useAuth();
  const [name, setName] = React.useState<string>('');
  const [email, setEmail] = React.useState<string>('');
  const [password, setPassword] = React.useState<string>('');
  const [confirmation, setConfirmation] = React.useState<string>('');
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string>('');

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setError('');
    if (password !== confirmation) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setIsSubmitting(true);
    try {
      await register({ email, name, password });
    } catch (submitError: any) {
      setError(submitError?.message || submitError?.error_description || (typeof submitError === 'string' ? submitError : 'Error al registrar la cuenta'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)}>
      {error && <MessageBar messageBarType={MessageBarType.error}>{error}</MessageBar>}
      <MessageBar
        className={styles.securityNotice}
        messageBarType={MessageBarType.severeWarning}
      >
        {SECURITY_PASSWORD_NOTICE}
      </MessageBar>
      <TextField
        autoComplete="name"
        label="Nombre completo"
        onChange={(_, value) => setName(value || '')}
        required
        value={name}
      />
      <TextField
        autoComplete="email"
        description="Solo se permiten correos @humano.com.do"
        label="Correo corporativo"
        onChange={(_, value) => setEmail(value || '')}
        required
        type="email"
        value={email}
      />
      <TextField
        autoComplete="new-password"
        canRevealPassword
        description="Mínimo 10 caracteres"
        label="Contraseña"
        onChange={(_, value) => setPassword(value || '')}
        required
        type="password"
        value={password}
      />
      <TextField
        autoComplete="new-password"
        canRevealPassword
        label="Confirmar contraseña"
        onChange={(_, value) => setConfirmation(value || '')}
        required
        type="password"
        value={confirmation}
      />
      <PrimaryButton
        disabled={isSubmitting || !name.trim() || !email.trim() || !password}
        type="submit"
        text={isSubmitting ? 'Registrando...' : 'Registrar cuenta corporativa'}
      />
    </form>
  );
};

interface IAuthViewProps {
  children?: React.ReactNode;
}

export const AuthView: React.FC<IAuthViewProps> = ({ children }) => {
  const { currentUser, isLoading, signOut } = useAuth();

  if (isLoading) {
    return (
      <main className={styles.shell}>
        <Spinner label="Inicializando base local segura..." size={SpinnerSize.large} />
      </main>
    );
  }

  if (currentUser?.status === 'Active') {
    return <>{children}</>;
  }

  if (currentUser) {
    const isValidated = currentUser.isProfileValidatedByPA;
    return (
      <main className={styles.shell}>
        <section className={styles.card}>
          <div className={styles.statusIcon}><Icon iconName="Lock" /></div>
          <h1 className={styles.title}>Acceso pendiente</h1>
          <p className={styles.subtitle}>
            {isValidated
              ? 'Tu identidad corporativa ya fue validada. La cuenta espera autorización del Master Admin.'
              : 'Tu cuenta está en proceso de validación con el directorio corporativo.'}
          </p>
          <span className={styles.emailBadge}>{currentUser.email}</span>
          <MessageBar messageBarType={isValidated ? MessageBarType.info : MessageBarType.warning}>
            {isValidated
              ? 'Estado: Pending_Admin_Approval'
              : 'Estado: Pending_Validation. Usa la sincronización superior para importar la respuesta de Power Automate.'}
          </MessageBar>
          <a
            className={styles.adminContact}
            href={`mailto:${ADMIN_NOTIFICATION_EMAIL}?subject=${encodeURIComponent('Humano Ops Hub - Solicitud de validación de acceso')}`}
          >
            Contactar al administrador: {ADMIN_NOTIFICATION_EMAIL}
          </a>
          <div className={styles.actions}>
            <span className={styles.helper}>Los datos locales permanecen disponibles en este dispositivo.</span>
            <DefaultButton onClick={() => void signOut()} text="Cerrar sesión" />
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      <section className={styles.card}>
        <div className={styles.brand}>
          <HumanoOpsLogo size={48} />
          <div>
            <h1 className={styles.title}>Humano Ops Hub</h1>
            <span className={styles.subtitle}>Acceso corporativo local-first</span>
          </div>
        </div>
        <Pivot aria-label="Acceso o registro">
          <PivotItem headerText="Iniciar sesión"><LoginForm /></PivotItem>
          <PivotItem headerText="Registrar cuenta"><RegisterForm /></PivotItem>
        </Pivot>
      </section>
    </main>
  );
};

export default AuthView;
