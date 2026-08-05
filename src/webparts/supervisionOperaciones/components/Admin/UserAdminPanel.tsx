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
  SpinnerSize,
  Stack
} from '@fluentui/react';

import { useAuth } from '../../../../auth/AuthProvider';
import { ADMIN_NOTIFICATION_EMAIL } from '../../../../auth/AuthService';
import type {
  AppUserRole,
  IAppUserRecord
} from '../../../../auth/AuthModels';
import { cloudDbClient } from '../../../../services/CloudDbClient';
import styles from './UserAdminPanel.module.scss';

const roleOptions: IDropdownOption[] = [
  { key: 'Agente', text: 'Agente' },
  { key: 'Supervisor', text: 'Supervisor' },
  { key: 'Admin', text: 'Admin' },
  { key: 'Master_Admin', text: 'Master Admin' }
];

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

const formatStatusText = (status: string): string => {
  switch (status) {
    case 'Active':
      return 'Activo';
    case 'Disabled':
      return 'Deshabilitado';
    case 'Pending_Admin_Approval':
    case 'Pending_Validation':
    default:
      return 'Pendiente de Aprobación';
  }
};

const UserAdminPanel: React.FC = () => {
  const { currentUser, listUsers } = useAuth();
  const [users, setUsers] = React.useState<Array<IAppUserRecord & { Id: number }>>([]);
  const [selectedRoles, setSelectedRoles] = React.useState<Record<number, AppUserRole>>({});
  const [statusFilter, setStatusFilter] = React.useState<string>('ALL');
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [processingId, setProcessingId] = React.useState<number>();
  const [message, setMessage] = React.useState<{ type: MessageBarType; text: string }>();

  const statusFilterOptions: IDropdownOption[] = [
    { key: 'ALL', text: 'Todos los estados' },
    { key: 'PENDING', text: 'Pendientes de Aprobación' },
    { key: 'ACTIVE', text: 'Activos' },
    { key: 'DISABLED', text: 'Deshabilitados' }
  ];

  const filteredUsers = React.useMemo(() => {
    if (statusFilter === 'PENDING') {
      return users.filter(u => u.Estado === 'Pending_Admin_Approval' || u.Estado === 'Pending_Validation');
    }
    if (statusFilter === 'ACTIVE') {
      return users.filter(u => u.Estado === 'Active');
    }
    if (statusFilter === 'DISABLED') {
      return users.filter(u => u.Estado === 'Disabled');
    }
    return users;
  }, [users, statusFilter]);

  const loadUsers = React.useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const loaded = await listUsers();
      setUsers(loaded);
      setSelectedRoles((current) => loaded.reduce<Record<number, AppUserRole>>(
        (result, user) => {
          result[user.Id] = current[user.Id] || user.Rol || 'Agente';
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

  const approveUser = async (user: IAppUserRecord & { Id: number }): Promise<void> => {
    const role = selectedRoles[user.Id] || user.Rol || 'Agente';
    setProcessingId(user.Id);
    setMessage(undefined);
    try {
      await cloudDbClient.updateUsuarioStatus(user.Id, 'Active', role, true);
      await loadUsers();
      setMessage({
        type: MessageBarType.success,
        text: `${user.Nombre} fue aprobado exitosamente con el rol ${role}.`
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

  const updateUserRole = async (user: IAppUserRecord & { Id: number }): Promise<void> => {
    const role = selectedRoles[user.Id] || user.Rol || 'Agente';
    setProcessingId(user.Id);
    setMessage(undefined);
    try {
      await cloudDbClient.updateUsuarioRole(user.Id, role);
      await loadUsers();
      setMessage({
        type: MessageBarType.success,
        text: `El rol de ${user.Nombre} fue actualizado a ${role}.`
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

  const disableUser = async (user: IAppUserRecord & { Id: number }): Promise<void> => {
    setProcessingId(user.Id);
    setMessage(undefined);
    try {
      await cloudDbClient.updateUsuarioStatus(user.Id, 'Disabled');
      await loadUsers();
      setMessage({
        type: MessageBarType.warning,
        text: `${user.Nombre} fue deshabilitado.`
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
      minWidth: 200,
      maxWidth: 280,
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
      minWidth: 160,
      onRender: (item: IAppUserRecord) => (
        <span className={`${styles.statusBadge} ${
          item.Estado === 'Active'
            ? styles.statusActive
            : item.Estado === 'Disabled'
              ? styles.statusDisabled
              : styles.statusPending
        }`}>
          {formatStatusText(item.Estado)}
        </span>
      )
    },
    {
      key: 'validation',
      name: 'Validación PA',
      minWidth: 120,
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
      key: 'roleDropdown',
      name: 'Rol asignado',
      minWidth: 170,
      onRender: (item: IAppUserRecord & { Id: number }) => {
        const isMaster = isMasterAdminRole(item.Rol);
        return (
          <Dropdown
            ariaLabel={`Rol para ${item.Nombre}`}
            disabled={isMaster || processingId === item.Id}
            onChange={(_, option) => {
              const value = String(option?.key || '') as AppUserRole;
              if (value) {
                setSelectedRoles((current) => ({ ...current, [item.Id]: value }));
              }
            }}
            options={roleOptions}
            selectedKey={selectedRoles[item.Id] || item.Rol || 'Agente'}
          />
        );
      }
    },
    {
      key: 'actions',
      name: 'Acciones de administración',
      minWidth: 260,
      onRender: (item: IAppUserRecord & { Id: number }) => {
        const isMaster = isMasterAdminRole(item.Rol);
        const isActive = item.Estado === 'Active';
        const isDisabled = item.Estado === 'Disabled';
        const isProcessing = processingId === item.Id;

        return (
          <Stack horizontal tokens={{ childrenGap: 6 }}>
            {!isActive && (
              <PrimaryButton
                disabled={isMaster || isProcessing}
                onClick={() => void approveUser(item)}
                text="Aprobar"
              />
            )}
            <DefaultButton
              disabled={isMaster || isProcessing}
              onClick={() => void updateUserRole(item)}
              text="Guardar Rol"
            />
            {!isDisabled && !isMaster && (
              <DefaultButton
                disabled={isProcessing}
                onClick={() => void disableUser(item)}
                text="Deshabilitar"
              />
            )}
          </Stack>
        );
      }
    }
  ], [processingId, selectedRoles]);

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
              Gestiona el estado y rol de todos los usuarios del sistema. Autoriza solicitudes pendientes y actualiza asignaciones de rol en tiempo real.
            </p>
            <p className={styles.adminRecipient}>
              Alertas administrativas: <a href={`mailto:${ADMIN_NOTIFICATION_EMAIL}`}>{ADMIN_NOTIFICATION_EMAIL}</a>
            </p>
          </div>
          <div className={styles.headerActions}>
            <Dropdown
              ariaLabel="Filtrar por estado"
              onChange={(_, option) => {
                if (option) setStatusFilter(String(option.key));
              }}
              options={statusFilterOptions}
              selectedKey={statusFilter}
              styles={{ root: { minWidth: 180 } }}
            />
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
          <Spinner label="Cargando usuarios..." size={SpinnerSize.large} />
        ) : filteredUsers.length === 0 ? (
          <div className={styles.emptyState}>No existen usuarios registrados para este filtro.</div>
        ) : (
          <DetailsList
            columns={columns}
            items={filteredUsers}
            layoutMode={DetailsListLayoutMode.justified}
            selectionMode={SelectionMode.none}
          />
        )}
      </div>
    </section>
  );
};

export default UserAdminPanel;
