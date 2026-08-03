import * as React from 'react';
import {
  Dialog,
  DialogFooter,
  DialogType,
  MessageBar,
  MessageBarType,
  PrimaryButton,
  DefaultButton,
  Spinner,
  SpinnerSize,
  Stack,
  TextField,
  ThemeProvider
} from '@fluentui/react';

import { darkTheme } from '../webparts/supervisionOperaciones/theme/DarkTheme';
import { useAuth } from './AuthProvider';
import { SECURITY_PASSWORD_NOTICE } from './AuthService';
import styles from './ChangePasswordDialog.module.scss';

interface IChangePasswordDialogProps {
  isOpen: boolean;
  onDismiss: () => void;
}

const ChangePasswordDialog: React.FC<IChangePasswordDialogProps> = ({
  isOpen,
  onDismiss
}) => {
  const { changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = React.useState<string>('');
  const [newPassword, setNewPassword] = React.useState<string>('');
  const [confirmation, setConfirmation] = React.useState<string>('');
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [message, setMessage] = React.useState<{
    type: MessageBarType;
    text: string;
  }>();

  React.useEffect(() => {
    if (!isOpen) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmation('');
      setMessage(undefined);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const submit = async (): Promise<void> => {
    setMessage(undefined);

    if (!currentPassword || !newPassword || !confirmation) {
      setMessage({
        type: MessageBarType.warning,
        text: 'Completa los tres campos de contraseña.'
      });
      return;
    }

    if (newPassword !== confirmation) {
      setMessage({
        type: MessageBarType.error,
        text: 'La nueva contraseña y su confirmación no coinciden.'
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmation('');
      setMessage({
        type: MessageBarType.success,
        text: 'Contraseña actualizada con PBKDF2. El cambio quedó pendiente de sincronización.'
      });
    } catch (error: unknown) {
      setMessage({
        type: MessageBarType.error,
        text: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <Dialog
        dialogContentProps={{
          type: DialogType.normal,
          title: 'Cambiar contraseña',
          closeButtonAriaLabel: 'Cerrar'
        }}
        hidden={!isOpen}
        modalProps={{
          isBlocking: isSubmitting,
          styles: { main: { background: '#1a1a1e', color: '#e1dfdd' } }
        }}
        onDismiss={onDismiss}
      >
        <Stack className={styles.content} tokens={{ childrenGap: 14 }}>
          <MessageBar
            className={styles.securityNotice}
            messageBarType={MessageBarType.severeWarning}
          >
            {SECURITY_PASSWORD_NOTICE}
          </MessageBar>

          {message && (
            <MessageBar messageBarType={message.type}>{message.text}</MessageBar>
          )}

          <TextField
            autoComplete="current-password"
            canRevealPassword
            disabled={isSubmitting}
            label="Contraseña actual"
            onChange={(_, value) => setCurrentPassword(value || '')}
            required
            type="password"
            value={currentPassword}
          />
          <TextField
            autoComplete="new-password"
            canRevealPassword
            description="Mínimo 10 caracteres"
            disabled={isSubmitting}
            label="Nueva contraseña"
            onChange={(_, value) => setNewPassword(value || '')}
            required
            type="password"
            value={newPassword}
          />
          <TextField
            autoComplete="new-password"
            canRevealPassword
            disabled={isSubmitting}
            label="Confirmar nueva contraseña"
            onChange={(_, value) => setConfirmation(value || '')}
            required
            type="password"
            value={confirmation}
          />

          {isSubmitting && (
            <Spinner
              label="Protegiendo la nueva contraseña..."
              size={SpinnerSize.small}
            />
          )}
        </Stack>
        <DialogFooter>
          <PrimaryButton
            disabled={isSubmitting}
            onClick={() => void submit()}
            text="Actualizar contraseña"
          />
          <DefaultButton
            disabled={isSubmitting}
            onClick={onDismiss}
            text="Cancelar"
          />
        </DialogFooter>
      </Dialog>
    </ThemeProvider>
  );
};

export default ChangePasswordDialog;
