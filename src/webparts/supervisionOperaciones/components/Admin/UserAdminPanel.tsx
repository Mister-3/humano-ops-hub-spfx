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

const UserAdminPanel: React.FC = () => {
  const { currentUser, listUsers, authorizeUser } = useAuth();
  const [users, setUsers] = React.useState<Array<IAppUserRecord & { Id: number }>>([]);
  const [selectedRoles, setSelectedRoles] = React.useState<Record<number, AssignableRole>>({});
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [processingId, setProcessingId] = React.useState<number>();
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
      await authorizeUser(user.Id, role);
      await loadUsers();
      setMessage({
        type: MessageBarType.success,
        text: `${user.Nombre} fue activado con el rol ${role}.`
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
      minWidth: 250,
      onRender: (item: IAppUserRecord & { Id: number }) => {
        const isMaster = item.Rol === 'Master_Admin';
        const isActive = item.Estado === 'Active';
        return (
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
              disabled={
                isMaster ||
                isActive ||
                !item.IsProfileValidatedByPA ||
                processingId !== undefined
              }
              onClick={() => void approve(item)}
              text={isActive ? 'Activo' : 'Autorizar Acceso'}
            />
          </div>
        );
      }
    }
  ], [processingId, selectedRoles]);

  if (currentUser?.role !== 'Master_Admin') {
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
          </div>
          <DefaultButton iconProps={{ iconName: 'Refresh' }} onClick={() => void loadUsers()} text="Actualizar" />
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
