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
import styles from './AuthView.module.scss';

const LoginForm: React.FC = () => {
  const { signIn } = useAuth();
  const [email, setEmail] = React.useState<string>('');
  const [password, setPassword] = React.useState<string>('');
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string>('');

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await signIn(email, password);
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setIsSubmitting(false);
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
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)}>
      {error && <MessageBar messageBarType={MessageBarType.error}>{error}</MessageBar>}
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
