import * as React from 'react';
import {
  DefaultButton,
  DetailsList,
  DetailsListLayoutMode,
  type IColumn,
  Link,
  MessageBar,
  MessageBarType,
  PrimaryButton,
  SelectionMode,
  Stack,
  Text
} from '@fluentui/react';

import SharePointService, {
  type FaltaApprovalStatus,
  type IFaltaAprobacionItem
} from '../../services/SharePointService';
import { SkeletonLoader } from '../Common/SkeletonLoader';
import styles from './AprobacionesView.module.scss';

type ApprovalAction = Extract<
  FaltaApprovalStatus,
  'Aprobado' | 'Rechazado'
>;

interface IFeedbackMessage {
  text: string;
  type: MessageBarType;
}

interface IProcessingItems {
  [itemId: number]: boolean;
}

export interface IAprobacionesViewProps {
  allowedAuthorEmails?: ReadonlyArray<string>;
}

const padDatePart = (value: number): string => (
  value < 10 ? `0${value}` : String(value)
);

const formatDateValue = (value: string): string => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return `${padDatePart(date.getDate())}/${padDatePart(
    date.getMonth() + 1
  )}/${date.getFullYear()}`;
};

const getErrorMessage = (error: unknown): string => (
  error instanceof Error ? error.message : String(error)
);

const getAuthorLabel = (item?: IFaltaAprobacionItem): string => (
  item?.Author?.Title?.trim() || item?.Author?.EMail?.trim() || '—'
);

const getAuthorEmail = (item?: IFaltaAprobacionItem): string => {
  const email = item?.Author?.EMail?.trim() || '';
  const title = item?.Author?.Title?.trim() || '';

  return email && email !== title ? email : '';
};

const formatHelpdeskCase = (value?: string): string => {
  const normalizedValue = value?.trim() || '';

  if (!normalizedValue) {
    return '';
  }

  return normalizedValue.startsWith('#')
    ? normalizedValue
    : `#${normalizedValue}`;
};

export const AprobacionesView: React.FC<IAprobacionesViewProps> = ({
  allowedAuthorEmails
}) => {
  const sharePointService = React.useMemo(() => new SharePointService(), []);
  const [items, setItems] = React.useState<IFaltaAprobacionItem[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [feedback, setFeedback] = React.useState<IFeedbackMessage>();
  const [processingItems, setProcessingItems] =
    React.useState<IProcessingItems>({});

  const loadPendingItems = React.useCallback(async (): Promise<void> => {
    const pendingItems = await sharePointService.getFaltasPendientes(
      allowedAuthorEmails
    );

    setItems(pendingItems);
  }, [allowedAuthorEmails, sharePointService]);

  React.useEffect(() => {
    let isActive = true;

    const loadInitialItems = async (): Promise<void> => {
      setIsLoading(true);

      try {
        const pendingItems = await sharePointService.getFaltasPendientes(
          allowedAuthorEmails
        );

        if (isActive) {
          setItems(pendingItems);
        }
      } catch (error: unknown) {
        if (isActive) {
          setFeedback({
            text: `No fue posible cargar la cola de aprobación: ${getErrorMessage(error)}`,
            type: MessageBarType.error
          });
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    loadInitialItems().catch(() => undefined);

    return () => {
      isActive = false;
    };
  }, [allowedAuthorEmails, sharePointService]);

  const handleRefresh = React.useCallback(async (): Promise<void> => {
    setFeedback(undefined);
    setIsLoading(true);

    try {
      await loadPendingItems();
    } catch (error: unknown) {
      setFeedback({
        text: `No fue posible actualizar la cola: ${getErrorMessage(error)}`,
        type: MessageBarType.error
      });
    } finally {
      setIsLoading(false);
    }
  }, [loadPendingItems]);

  const handleApprovalAction = React.useCallback(async (
    item: IFaltaAprobacionItem,
    status: ApprovalAction
  ): Promise<void> => {
    setFeedback(undefined);
    setProcessingItems((current) => ({
      ...current,
      [item.Id]: true
    }));

    try {
      await sharePointService.actualizarEstadoAprobacion(item.Id, status);
      setItems((currentItems) => currentItems.filter(
        (currentItem) => currentItem.Id !== item.Id
      ));

      const successText = status === 'Aprobado'
        ? `Registro ${item.AuditID || `#${item.Id}`} aprobado correctamente.`
        : `Registro ${item.AuditID || `#${item.Id}`} rechazado correctamente.`;

      try {
        await loadPendingItems();
        setFeedback({
          text: successText,
          type: MessageBarType.success
        });
      } catch (refreshError: unknown) {
        setFeedback({
          text:
            `${successText} La cola no pudo recargarse automáticamente: ` +
            getErrorMessage(refreshError),
          type: MessageBarType.warning
        });
      }
    } catch (error: unknown) {
      setFeedback({
        text: `No fue posible ${
          status === 'Aprobado' ? 'aprobar' : 'rechazar'
        } el registro: ${getErrorMessage(error)}`,
        type: MessageBarType.error
      });
    } finally {
      setProcessingItems((current) => {
        const nextItems = { ...current };
        delete nextItems[item.Id];
        return nextItems;
      });
    }
  }, [loadPendingItems, sharePointService]);

  const columns = React.useMemo<IColumn[]>(() => [
    {
      key: 'auditId',
      minWidth: 135,
      name: 'Audit ID',
      onRender: (item?: IFaltaAprobacionItem) => (
        <Text className={styles.auditIdCell} title={item?.AuditID}>
          {item?.AuditID || '—'}
        </Text>
      )
    },
    {
      key: 'fecha',
      maxWidth: 105,
      minWidth: 92,
      name: 'Fecha',
      onRender: (item?: IFaltaAprobacionItem) => (
        <Text>{item ? formatDateValue(item.FechaFalta) : '—'}</Text>
      )
    },
    {
      fieldName: 'Title',
      isResizable: true,
      key: 'agente',
      minWidth: 145,
      name: 'Agente'
    },
    {
      fieldName: 'Categoria',
      isResizable: true,
      key: 'categoria',
      minWidth: 135,
      name: 'Categoría'
    },
    {
      key: 'subcategoria',
      minWidth: 145,
      name: 'Subcategoría',
      onRender: (item?: IFaltaAprobacionItem) => (
        <Text>{item?.Subcategoria || '—'}</Text>
      )
    },
    {
      key: 'casoRef',
      minWidth: 190,
      name: 'ID Caso Helpdesk / Calidad',
      onRender: (item?: IFaltaAprobacionItem) => {
        const helpdeskCase = formatHelpdeskCase(item?.CasoRef);

        return helpdeskCase ? (
          <span className={styles.helpdeskBadge} title={item?.CasoRef}>
            🎫 Helpdesk: {helpdeskCase}
          </span>
        ) : (
          <Text className={styles.emptyValue}>Sin ID registrado</Text>
        );
      }
    },
    {
      key: 'author',
      minWidth: 180,
      name: 'Creado por',
      onRender: (item?: IFaltaAprobacionItem) => (
        <Stack tokens={{ childrenGap: 2 }}>
          <Text className={styles.authorName}>{getAuthorLabel(item)}</Text>
          {getAuthorEmail(item) && (
            <Text className={styles.authorEmail}>{getAuthorEmail(item)}</Text>
          )}
        </Stack>
      )
    },
    {
      key: 'comentarios',
      minWidth: 210,
      name: 'Comentarios',
      onRender: (item?: IFaltaAprobacionItem) => (
        <Text className={styles.commentsCell} title={item?.Comentarios}>
          {item?.Comentarios || '—'}
        </Text>
      )
    },
    {
      key: 'attachments',
      minWidth: 175,
      name: 'Evidencias adjuntas',
      onRender: (item?: IFaltaAprobacionItem) => {
        if (!item?.AttachmentFiles.length) {
          return <Text className={styles.emptyValue}>Sin adjuntos</Text>;
        }

        return (
          <Stack tokens={{ childrenGap: 5 }}>
            {item.AttachmentFiles.map((attachment) => (
              <Link
                className={styles.attachmentLink}
                href={attachment.ServerRelativeUrl}
                key={`${item.Id}-${attachment.ServerRelativeUrl}`}
                rel="noopener noreferrer"
                target="_blank"
                title={attachment.FileName}
              >
                {attachment.FileName}
              </Link>
            ))}
          </Stack>
        );
      }
    },
    {
      key: 'actions',
      minWidth: 210,
      name: 'Acciones',
      onRender: (item?: IFaltaAprobacionItem) => {
        if (!item) {
          return null;
        }

        const isProcessing = Boolean(processingItems[item.Id]);

        return (
          <Stack horizontal tokens={{ childrenGap: 8 }}>
            <PrimaryButton
              ariaLabel={`Aprobar registro ${item.AuditID || item.Id}`}
              className={styles.approveButton}
              disabled={isProcessing}
              iconProps={{ iconName: 'Accept' }}
              onClick={() => handleApprovalAction(item, 'Aprobado').catch(() => undefined)}
              text={isProcessing ? 'Procesando' : 'Aprobar'}
            />
            <DefaultButton
              ariaLabel={`Rechazar registro ${item.AuditID || item.Id}`}
              className={styles.rejectButton}
              disabled={isProcessing}
              iconProps={{ iconName: 'Cancel' }}
              onClick={() => handleApprovalAction(item, 'Rechazado').catch(() => undefined)}
              text="Rechazar"
            />
          </Stack>
        );
      }
    }
  ], [handleApprovalAction, processingItems]);

  return (
    <section className={styles.approvalCard}>
      <Stack tokens={{ childrenGap: 18 }}>
        <Stack
          horizontal
          horizontalAlign="space-between"
          tokens={{ childrenGap: 16 }}
          verticalAlign="center"
          wrap
        >
          <Stack tokens={{ childrenGap: 4 }}>
            <Text className={styles.title} variant="xLarge">
              Cola de Aprobación
            </Text>
            <Text className={styles.description}>
              Revisa los registros operativos pendientes antes de incorporarlos
              a las métricas del portal.
            </Text>
          </Stack>

          <Stack horizontal tokens={{ childrenGap: 10 }} verticalAlign="center">
            <span className={styles.pendingBadge}>
              {items.length} pendiente{items.length === 1 ? '' : 's'}
            </span>
            <DefaultButton
              disabled={isLoading}
              iconProps={{ iconName: 'Refresh' }}
              onClick={() => handleRefresh().catch(() => undefined)}
              text="Actualizar"
            />
          </Stack>
        </Stack>

        {feedback && (
          <MessageBar
            isMultiline
            messageBarType={feedback.type}
            onDismiss={() => setFeedback(undefined)}
          >
            {feedback.text}
          </MessageBar>
        )}

        {isLoading ? (
          <SkeletonLoader
            cardCount={2}
            label="Cargando registros pendientes de aprobación"
            rowCount={5}
          />
        ) : items.length === 0 ? (
          <div className={styles.emptyState} role="status">
            <Text className={styles.emptyTitle} variant="large">
              No hay registros pendientes
            </Text>
            <Text className={styles.description}>
              La cola de aprobación está al día.
            </Text>
          </div>
        ) : (
          <div className={styles.tableContainer}>
            <DetailsList
              ariaLabelForGrid="Registros operativos pendientes de aprobación"
              columns={columns}
              compact
              items={items}
              layoutMode={DetailsListLayoutMode.justified}
              selectionMode={SelectionMode.none}
            />
          </div>
        )}
      </Stack>
    </section>
  );
};

export default AprobacionesView;
