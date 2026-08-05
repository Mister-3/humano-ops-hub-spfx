import * as React from 'react';
import {
  DefaultButton,
  DetailsList,
  DetailsListLayoutMode,
  Dropdown,
  type IColumn,
  type IDropdownOption,
  MessageBar,
  MessageBarType,
  PrimaryButton,
  SelectionMode,
  Spinner,
  SpinnerSize
} from '@fluentui/react';

import { useAuth } from '../../../../auth/AuthProvider';
import { ADMIN_NOTIFICATION_EMAIL } from '../../../../auth/AuthService';
import type {
  AppUserRole,
  IAppUserRecord
} from '../../../../auth/AuthModels';
import styles from './UserAdminPanel.module.scss';

type AssignableRole = Extract<
  AppUserRole,
  'Admin' | 'Supervisor' | 'Asistente'
>;

const roleOptions: IDropdownOption[] = [
  { key: 'Supervisor', text: 'Supervisor' },
  { key: 'Asistente', text: 'Asistente' },
  { key: 'Admin', text: 'Admin' }
];

const isAssignableRole = (value: string): value is AssignableRole =>
  roleOptions.some((option) => option.key === value);

const isMasterAdminRole = (role?: string): boolean => {
  if (!role) return false;
  const normalized = role.trim().toLowerCase().replace(/[\s_-]+/g, '_');
  return (
    normalized === 'master_admin' ||
    role === 'Master Admin' ||
    role === 'Master_Admin' ||
    role.toLowerCase().includes('master')
  );
};

const UserAdminPanel: React.FC = () => {
  const { currentUser, listUsers, authorizeUser } = useAuth();
  const [users, setUsers] = React.useState<Array<IAppUserRecord & { Id: number }>>([]);
  const [selectedRoles, setSelectedRoles] = React.useState<Record<number, AssignableRole>>({});
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [processingId, setProcessingId] = React.useState<number>();
  const [provisionalPasswords, setProvisionalPasswords] =
    React.useState<Record<number, string>>({});
  const [message, setMessage] = React.useState<{ type: MessageBarType; text: string }>();

  const loadUsers = React.useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const loaded = await listUsers();
      setUsers(loaded);
      setSelectedRoles((current) => loaded.reduce<Record<number, AssignableRole>>(
        (result, user) => {
          const role = isAssignableRole(user.Rol) ? user.Rol : 'Asistente';
          result[user.Id] = current[user.Id] || role;
          return result;
        },
        {}
      ));
    } catch (error: unknown) {
      setMessage({
        type: MessageBarType.error,
        text: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setIsLoading(false);
    }
  }, [listUsers]);

  React.useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const approve = async (user: IAppUserRecord & { Id: number }): Promise<void> => {
    const role = selectedRoles[user.Id] || 'Asistente';
    setProcessingId(user.Id);
    setMessage(undefined);
    try {
      const result = await authorizeUser(user.Id, role);
      setProvisionalPasswords((current) => ({
        ...current,
        [user.Id]: result.provisionalPassword
      }));
      await loadUsers();
      setMessage({
        type: MessageBarType.success,
        text: `${user.Nombre} fue activado con el rol ${role}. Copia y entrega su clave provisional por un canal seguro.`
      });
    } catch (error: unknown) {
      setMessage({
        type: MessageBarType.error,
        text: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setProcessingId(undefined);
    }
  };

  const copyProvisionalPassword = async (
    userId: number
  ): Promise<void> => {
    const password = provisionalPasswords[userId];
    if (!password) {
      return;
    }

    try {
      await navigator.clipboard.writeText(password);
      setMessage({
        type: MessageBarType.success,
        text: 'Clave provisional copiada. Compártela únicamente por un canal seguro.'
      });
    } catch {
      setMessage({
        type: MessageBarType.warning,
        text: 'El navegador bloqueó el portapapeles. Selecciona y copia la clave manualmente.'
      });
    }
  };

  const columns = React.useMemo<IColumn[]>(() => [
    {
      key: 'identity',
      name: 'Usuario',
      minWidth: 210,
      maxWidth: 300,
      onRender: (item: IAppUserRecord & { Id: number }) => (
        <div className={styles.identityCell}>
          <strong>{item.Nombre}</strong>
          <span>{item.Email}</span>
        </div>
      )
    },
    {
      key: 'state',
      name: 'Estado',
      minWidth: 145,
      onRender: (item: IAppUserRecord) => (
        <span className={`${styles.statusBadge} ${
          item.Estado === 'Active'
            ? styles.statusActive
            : item.Estado === 'Disabled'
              ? styles.statusDisabled
              : styles.statusPending
        }`}>
          {item.Estado}
        </span>
      )
    },
    {
      key: 'validation',
      name: 'Validación PA',
      minWidth: 145,
      onRender: (item: IAppUserRecord) => (
        <span className={`${styles.validationBadge} ${
          item.IsProfileValidatedByPA
            ? styles.validationReady
            : styles.validationWaiting
        }`}>
          {item.IsProfileValidatedByPA ? '✓ Validado' : 'Pendiente'}
        </span>
      )
    },
    {
      key: 'approval',
      name: 'Rol y autorización',
      minWidth: 300,
      maxWidth: 430,
      onRender: (item: IAppUserRecord & { Id: number }) => {
        const isMaster = isMasterAdminRole(item.Rol);
        const isActive = item.Estado === 'Active';
        const provisionalPassword = provisionalPasswords[item.Id];
        return (
          <div className={styles.approvalCell}>
            <div className={styles.roleEditor}>
              <Dropdown
                ariaLabel={`Rol para ${item.Nombre}`}
                disabled={isMaster || processingId === item.Id}
                onChange={(_, option) => {
                  const value = String(option?.key || '');
                  if (isAssignableRole(value)) {
                    setSelectedRoles((current) => ({ ...current, [item.Id]: value }));
                  }
                }}
                options={roleOptions}
                selectedKey={selectedRoles[item.Id] || 'Asistente'}
              />
              <PrimaryButton
                disabled={isMaster || processingId === item.Id}
                onClick={() => void approve(item)}
                text={isActive ? 'Actualizar rol' : 'Autorizar'}
              />
            </div>

            {provisionalPassword && (
              <div
                aria-live="polite"
                className={styles.provisionalPassword}
              >
                <span>Clave provisional (visible solo en esta sesión)</span>
                <code>{provisionalPassword}</code>
                <DefaultButton
                  iconProps={{ iconName: 'Copy' }}
                  onClick={() => void copyProvisionalPassword(item.Id)}
                  text="Copiar Clave Provisional"
                />
              </div>
            )}
          </div>
        );
      }
    }
  ], [processingId, provisionalPasswords, selectedRoles]);

  if (!isMasterAdminRole(currentUser?.role)) {
    return (
      <MessageBar messageBarType={MessageBarType.blocked}>
        Acceso exclusivo para el Master Admin.
      </MessageBar>
    );
  }

  return (
    <section className={styles.panel}>
      <div className={styles.headerCard}>
        <div className={styles.headerRow}>
          <div>
            <h3 className={styles.title}>Administración de Usuarios</h3>
            <p className={styles.description}>
              Autoriza cuentas validadas por Power Automate y asigna su rol operativo.
            </p>
            <p className={styles.adminRecipient}>
              Alertas administrativas: <a href={`mailto:${ADMIN_NOTIFICATION_EMAIL}`}>{ADMIN_NOTIFICATION_EMAIL}</a>
            </p>
          </div>
          <div className={styles.headerActions}>
            <DefaultButton
              href={`mailto:${ADMIN_NOTIFICATION_EMAIL}?subject=${encodeURIComponent('Humano Ops Hub - Gestión de usuarios')}`}
              iconProps={{ iconName: 'Mail' }}
              text="Notificar Admin"
            />
            <DefaultButton iconProps={{ iconName: 'Refresh' }} onClick={() => void loadUsers()} text="Actualizar" />
          </div>
        </div>
      </div>

      {message && (
        <MessageBar messageBarType={message.type} onDismiss={() => setMessage(undefined)}>
          {message.text}
        </MessageBar>
      )}

      <div className={styles.tableCard}>
        {isLoading ? (
          <Spinner label="Cargando usuarios locales..." size={SpinnerSize.large} />
        ) : users.length === 0 ? (
          <div className={styles.emptyState}>No existen usuarios registrados.</div>
        ) : (
          <DetailsList
            columns={columns}
            items={users}
            layoutMode={DetailsListLayoutMode.justified}
            selectionMode={SelectionMode.none}
          />
        )}
      </div>
    </section>
  );
};

export default UserAdminPanel;
