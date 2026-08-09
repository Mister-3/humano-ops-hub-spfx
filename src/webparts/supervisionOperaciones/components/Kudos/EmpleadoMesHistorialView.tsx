import * as React from 'react';
import {
  DetailsList,
  DetailsListLayoutMode,
  type IColumn,
  MessageBar,
  MessageBarType,
  SearchBox,
  SelectionMode,
  Spinner,
  SpinnerSize,
  Stack,
  Text
} from '@fluentui/react';

import { getHistorialEmpleadoMes } from '../../../../services/CloudDbClient';
import styles from './EmpleadoMesHistorialView.module.scss';

const NOMBRES_MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const getNombreMes = (mes: number): string =>
  NOMBRES_MESES[mes - 1] || `Mes ${mes}`;

const formatDateStr = (isoStr?: string): string => {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleDateString('es-DO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return isoStr;
  }
};

export const EmpleadoMesHistorialView: React.FC = () => {
  const [items, setItems] = React.useState<any[]>([]);
  const [filteredItems, setFilteredItems] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [searchQuery, setSearchQuery] = React.useState<string>('');
  const [errorMessage, setErrorMessage] = React.useState<string>('');

  const loadHistorial = React.useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const data = await getHistorialEmpleadoMes();
      setItems(data);
      setFilteredItems(data);
    } catch (err) {
      console.error('Error al cargar historial de Empleado del Mes:', err);
      setErrorMessage('No se pudo cargar el historial de Empleado del Mes.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadHistorial().catch(() => undefined);
  }, [loadHistorial]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    const q = query.trim().toLowerCase();
    if (!q) {
      setFilteredItems(items);
      return;
    }

    const filtered = items.filter((item) => {
      const empNombre = (item.nombre_empleado || '').toLowerCase();
      const empEmail = (item.email_empleado || '').toLowerCase();
      const supNombre = (item.supervisor_nombre || '').toLowerCase();
      const supEmail = (item.supervisor_email || '').toLowerCase();
      const mesStr = getNombreMes(Number(item.mes)).toLowerCase();
      const anioStr = String(item.anio || '');

      return (
        empNombre.includes(q) ||
        empEmail.includes(q) ||
        supNombre.includes(q) ||
        supEmail.includes(q) ||
        mesStr.includes(q) ||
        anioStr.includes(q)
      );
    });

    setFilteredItems(filtered);
  };

  const columns: IColumn[] = React.useMemo(
    () => [
      {
        key: 'periodo',
        name: 'Período Premiado',
        fieldName: 'periodo',
        minWidth: 130,
        maxWidth: 160,
        isResizable: true,
        onRender: (item: any) => (
          <Text style={{ fontWeight: 600 }}>
            {getNombreMes(Number(item.mes))} {item.anio}
          </Text>
        )
      },
      {
        key: 'created_at',
        name: 'Fecha Publicación',
        fieldName: 'created_at',
        minWidth: 120,
        maxWidth: 140,
        isResizable: true,
        onRender: (item: any) => (
          <Text>{formatDateStr(item.created_at || item.fecha_publicacion)}</Text>
        )
      },
      {
        key: 'empleado',
        name: 'Empleado Premiado',
        fieldName: 'email_empleado',
        minWidth: 180,
        maxWidth: 240,
        isResizable: true,
        onRender: (item: any) => (
          <Stack tokens={{ childrenGap: 2 }}>
            <Text style={{ fontWeight: 500 }}>{item.nombre_empleado || 'Colaborador'}</Text>
            <Text variant="small" style={{ color: '#64748b' }}>
              {item.email_empleado}
            </Text>
          </Stack>
        )
      },
      {
        key: 'supervisor',
        name: 'Publicado Por (Supervisor)',
        fieldName: 'supervisor_email',
        minWidth: 180,
        maxWidth: 240,
        isResizable: true,
        onRender: (item: any) => (
          <Stack tokens={{ childrenGap: 2 }}>
            <Text style={{ fontWeight: 500 }}>
              {item.supervisor_nombre || 'Sistema / Supervisor'}
            </Text>
            <Text variant="small" style={{ color: '#64748b' }}>
              {item.supervisor_email || '-'}
            </Text>
          </Stack>
        )
      },
      {
        key: 'dia_libre',
        name: 'Estado Día Libre',
        fieldName: 'dia_libre_reclamado',
        minWidth: 180,
        maxWidth: 240,
        isResizable: true,
        onRender: (item: any) => {
          const isClaimed = Boolean(item.dia_libre_reclamado);
          return (
            <div>
              {isClaimed ? (
                <span className={styles.badgeClaimed}>
                  🟢 Reclamado el {formatDateStr(item.fecha_reclamado)}
                </span>
              ) : (
                <span className={styles.badgePending}>
                  🟡 Pendiente por Reclamar
                </span>
              )}
            </div>
          );
        }
      }
    ],
    []
  );

  return (
    <Stack className={styles.container} tokens={{ childrenGap: 16 }}>
      <Stack horizontal wrap verticalAlign="center" horizontalAlign="space-between" tokens={{ childrenGap: 12 }}>
        <Stack tokens={{ childrenGap: 2 }}>
          <Text variant="xLarge" style={{ fontWeight: 600 }}>
            📜 Histórico de Empleado del Mes
          </Text>
          <Text style={{ color: '#64748b' }}>
            Registro de todas las premiaciones otorgadas y el estado de sus días libres.
          </Text>
        </Stack>

        <div className={styles.searchBar}>
          <SearchBox
            placeholder="Buscar por colaborador, supervisor o período..."
            value={searchQuery}
            onChange={(_, newValue) => handleSearch(newValue || '')}
            onClear={() => handleSearch('')}
          />
        </div>
      </Stack>

      {errorMessage && (
        <MessageBar messageBarType={MessageBarType.error}>
          {errorMessage}
        </MessageBar>
      )}

      {isLoading ? (
        <Spinner label="Cargando historial de Empleado del Mes..." size={SpinnerSize.large} />
      ) : filteredItems.length > 0 ? (
        <div className={styles.tableContainer}>
          <DetailsList
            columns={columns}
            compact
            getKey={(item: any) => String(item.id || item.created_at)}
            items={filteredItems}
            layoutMode={DetailsListLayoutMode.justified}
            selectionMode={SelectionMode.none}
          />
        </div>
      ) : (
        <MessageBar messageBarType={MessageBarType.info}>
          No se encontraron registros de Empleado del Mes.
        </MessageBar>
      )}
    </Stack>
  );
};

export default EmpleadoMesHistorialView;
