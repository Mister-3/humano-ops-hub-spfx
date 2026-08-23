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
import { ShieldCheck, Ticket } from 'lucide-react';

import SharePointService, {
  type FaltaApprovalStatus,
  type IFaltaAprobacionItem
} from '../../services/SharePointService';
import { useRBAC } from '../../../../auth/RBACContext';
import { AppDialog, EmptyState, StatusBadge, SurfaceCard } from '../Common';
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

interface IPendingDecision {
  item: IFaltaAprobacionItem;
  status: ApprovalAction;
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
  const { hasPermission } = useRBAC();
  const canApprove = hasPermission('modulo:faltas:aprobar');
  const sharePointService = React.useMemo(() => new SharePointService(), []);
  const [items, setItems] = React.useState<IFaltaAprobacionItem[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [feedback, setFeedback] = React.useState<IFeedbackMessage>();
  const [processingItems, setProcessingItems] =
    React.useState<IProcessingItems>({});
  const [pendingDecision, setPendingDecision] =
    React.useState<IPendingDecision>();
  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set());
  const [isBatchApproving, setIsBatchApproving] = React.useState<boolean>(false);
  const [isBatchConfirmOpen, setIsBatchConfirmOpen] = React.useState<boolean>(false);

  const loadPendingItems = React.useCallback(async (): Promise<void> => {
    const pendingItems = await sharePointService.getFaltasPendientes(
      allowedAuthorEmails
    );

    setItems(pendingItems);
    setSelectedIds((prev) => new Set(Array.from(prev).filter((id) => pendingItems.some((i) => i.Id === id))));
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
      await sharePointService.actualizarEstadoAprobacion(item.rawId || item.Id, status);
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

  const handleBatchApprove = React.useCallback(async (): Promise<void> => {
    if (selectedIds.size === 0 || !canApprove) return;
    setIsBatchApproving(true);
    setFeedback(undefined);
    try {
      const selectedItems = items.filter((item) => selectedIds.has(item.Id));
      for (const item of selectedItems) {
        await sharePointService.actualizarEstadoAprobacion(item.rawId || item.Id, 'Aprobado');
      }
      setFeedback({
        text: `Se aprobaron exitosamente ${selectedItems.length} registros operativos.`,
        type: MessageBarType.success
      });
      setSelectedIds(new Set());
      setIsBatchConfirmOpen(false);
      await loadPendingItems();
    } catch (error: unknown) {
      setFeedback({
        text: `Error durante la aprobación masiva: ${getErrorMessage(error)}`,
        type: MessageBarType.error
      });
    } finally {
      setIsBatchApproving(false);
    }
  }, [canApprove, items, loadPendingItems, selectedIds, sharePointService]);

  const confirmPendingDecision = React.useCallback(async (): Promise<void> => {
    if (!pendingDecision) return;
    await handleApprovalAction(pendingDecision.item, pendingDecision.status);
    setPendingDecision(undefined);
  }, [handleApprovalAction, pendingDecision]);

  const columns = React.useMemo<IColumn[]>(() => [
    {
      key: 'select',
      maxWidth: 42,
      minWidth: 42,
      name: '',
      onRenderHeader: () => (
        <input
          type="checkbox"
          aria-label="Seleccionar todos los registros pendientes"
          checked={items.length > 0 && items.every((i) => selectedIds.has(i.Id))}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedIds(new Set(items.map((i) => i.Id)));
            } else {
              setSelectedIds(new Set());
            }
          }}
        />
      ),
      onRender: (item?: IFaltaAprobacionItem) => item ? (
        <input
          type="checkbox"
          aria-label={`Seleccionar ${item.AuditID || item.Id}`}
          checked={selectedIds.has(item.Id)}
          onChange={(e) => {
            setSelectedIds((current) => {
              const next = new Set(current);
              if (e.target.checked) next.add(item.Id);
              else next.delete(item.Id);
              return next;
            });
          }}
        />
      ) : null
    },
    {
      key: 'auditId',
      minWidth: 135,
      name: 'Audit ID',
      onRender: (item?: IFaltaAprobacionItem) => (
        <Text className={`${styles.auditIdCell} tabular-nums font-mono`} title={item?.AuditID}>
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
        <Text className="tabular-nums font-mono">{item ? formatDateValue(item.FechaFalta) : '—'}</Text>
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
          <StatusBadge variant="info">
            <Ticket aria-hidden="true" size={13} />
            Helpdesk: {helpdeskCase}
          </StatusBadge>
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
              disabled={isProcessing || !canApprove}
              iconProps={{ iconName: 'Accept' }}
              onClick={() => setPendingDecision({ item, status: 'Aprobado' })}
              text={isProcessing ? 'Procesando' : 'Aprobar'}
            />
            <DefaultButton
              ariaLabel={`Rechazar registro ${item.AuditID || item.Id}`}
              className={styles.rejectButton}
              disabled={isProcessing || !canApprove}
              iconProps={{ iconName: 'Cancel' }}
              onClick={() => setPendingDecision({ item, status: 'Rechazado' })}
              text="Rechazar"
            />
          </Stack>
        );
      }
    }
  ], [canApprove, items, processingItems, selectedIds]);

  return (
    <>
    <SurfaceCard className={styles.approvalCard}>
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
            <StatusBadge variant="warning" size="md">
              {items.length} pendiente{items.length === 1 ? '' : 's'}
            </StatusBadge>
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
          <EmptyState
            className="my-4"
            icon={<ShieldCheck className="text-2xl text-emerald-400" />}
            title="No hay registros pendientes"
            description="La cola de aprobación está al día. Todos los registros han sido procesados."
          />
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
    </SurfaceCard>

    {/* Barra flotante de acciones masivas */}
    {selectedIds.size > 0 && (
      <div className="fixed bottom-6 right-8 z-40 flex items-center gap-4 rounded-2xl border border-cyan-500/40 bg-slate-900/95 px-5 py-3 shadow-2xl backdrop-blur-md animate-fadeIn">
        <span className="text-sm font-semibold text-slate-200 tabular-nums font-mono">
          {selectedIds.size} registro{selectedIds.size === 1 ? '' : 's'} seleccionado{selectedIds.size === 1 ? '' : 's'}
        </span>
        <button
          type="button"
          disabled={!canApprove || isBatchApproving}
          onClick={() => setIsBatchConfirmOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-600/20 transition-colors hover:bg-emerald-500 disabled:opacity-50"
        >
          <ShieldCheck size={16} />
          {isBatchApproving ? 'Aprobando...' : `Aprobar seleccionadas (${selectedIds.size})`}
        </button>
        <button
          type="button"
          onClick={() => setSelectedIds(new Set())}
          className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
        >
          Deseleccionar todo
        </button>
      </div>
    )}

    {/* Modal de decisión individual */}
    <AppDialog
      description={`Registro ${pendingDecision?.item.AuditID || (pendingDecision ? `#${pendingDecision.item.Id}` : '')}`}
      isOpen={Boolean(pendingDecision)}
      maxWidth="md"
      onClose={() => {
        if (!pendingDecision || !processingItems[pendingDecision.item.Id]) {
          setPendingDecision(undefined);
        }
      }}
      title={pendingDecision?.status === 'Aprobado'
        ? 'Aprobar registro operativo'
        : 'Rechazar registro operativo'}
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
          <ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0 text-cyan-400" size={20} />
          <p className="m-0 text-sm leading-6 text-slate-300">
            Confirma que deseas {pendingDecision?.status === 'Aprobado' ? 'aprobar' : 'rechazar'} este registro. Se conservarán exactamente sus datos y trazabilidad actuales.
          </p>
        </div>
        <div className="flex justify-end gap-3">
          <button
            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-700"
            onClick={() => setPendingDecision(undefined)}
            type="button"
          >
            Cancelar
          </button>
          <button
            className={`rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-50 ${pendingDecision?.status === 'Aprobado'
              ? 'bg-emerald-600 hover:bg-emerald-500'
              : 'bg-rose-600 hover:bg-rose-500'}`}
            disabled={Boolean(pendingDecision && processingItems[pendingDecision.item.Id])}
            onClick={() => void confirmPendingDecision()}
            type="button"
          >
            {pendingDecision?.status === 'Aprobado' ? 'Confirmar aprobación' : 'Confirmar rechazo'}
          </button>
        </div>
      </div>
    </AppDialog>

    {/* Modal de decisión masiva */}
    <AppDialog
      description={`Se aprobarán ${selectedIds.size} registros seleccionados de forma simultánea.`}
      isOpen={isBatchConfirmOpen}
      maxWidth="md"
      onClose={() => {
        if (!isBatchApproving) setIsBatchConfirmOpen(false);
      }}
      title="Aprobación Masiva de Registros"
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4">
          <ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0 text-emerald-400" size={20} />
          <p className="m-0 text-sm leading-6 text-slate-300">
            ¿Deseas aprobar en lote los <strong className="text-white">{selectedIds.size} registros</strong> seleccionados? Esta acción actualizará su estado a aprobado e impactará las métricas operativas correspondientes.
          </p>
        </div>
        <div className="flex justify-end gap-3">
          <button
            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-700"
            disabled={isBatchApproving}
            onClick={() => setIsBatchConfirmOpen(false)}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isBatchApproving}
            onClick={() => void handleBatchApprove()}
            type="button"
          >
            {isBatchApproving ? 'Procesando lote...' : `Aprobar ${selectedIds.size} registros`}
          </button>
        </div>
      </div>
    </AppDialog>
    </>
  );
};

export default AprobacionesView;
