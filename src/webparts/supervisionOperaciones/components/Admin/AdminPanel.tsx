import * as React from 'react';
import {
  DefaultButton,
  Dropdown,
  IconButton,
  type IDropdownOption,
  MessageBar,
  MessageBarType,
  PrimaryButton,
  SpinButton,
  Spinner,
  SpinnerSize,
  Stack,
  Text,
  TextField
} from '@fluentui/react';
import PowerAutomateSyncService from '../../../../services/PowerAutomateSyncService';

import type { RoleType } from '../../models/AppModels';
import SharePointService, {
  type CatalogCategory,
  type ICatalogoItem,
  type IConfiguracionMetricasUpdate
} from '../../services/SharePointService';
import styles from './AdminPanel.module.scss';

export interface IAdminPanelProps {
  userRole: RoleType;
}

const roleOptions: IDropdownOption[] = [
  { key: 'Admin', text: 'Admin' },
  { key: 'Gerente', text: 'Gerente' },
  { key: 'Supervisor', text: 'Supervisor' },
  { key: 'Analista', text: 'Analista' },
  { key: 'Asistente', text: 'Asistente' },
  { key: 'Oficial', text: 'Oficial' }
];

const catalogCategories: ReadonlyArray<CatalogCategory> = [
  'Falta',
  'ErrorProceso',
  'CodigoEtica',
  'Kudo',
  'ProcesoArea'
];

const catalogCategoryLabels: Record<CatalogCategory, string> = {
  Falta: 'Categorías de faltas',
  ErrorProceso: 'Subcategorías de errores',
  CodigoEtica: 'Subcategorías de Código de Ética',
  Kudo: 'Atributos de Kudos',
  ProcesoArea: 'Procesos del área'
};

const catalogCategoryOptions: IDropdownOption[] = catalogCategories.map(
  (category) => ({
    key: category,
    text: catalogCategoryLabels[category]
  })
);

const isRoleType = (value: string): value is RoleType =>
  roleOptions.some((option) => option.key === value);

const isCatalogCategory = (value: string): value is CatalogCategory =>
  catalogCategories.indexOf(value as CatalogCategory) >= 0;

const parseNumber = (value: string | undefined): number | undefined => {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }

  const parsedValue = Number(value.replace(',', '.'));
  return Number.isFinite(parsedValue) ? parsedValue : undefined;
};

interface INumericConfigurationFieldProps {
  disabled: boolean;
  label: string;
  max?: number;
  onValueChange: (value: number) => void;
  step?: number;
  value: number;
}

const NumericConfigurationField: React.FC<
  INumericConfigurationFieldProps
> = ({
  disabled,
  label,
  max,
  onValueChange,
  step = 1,
  value
}) => (
  <SpinButton
    disabled={disabled}
    label={label}
    max={max}
    min={0}
    onChange={(_, rawValue) => {
      const parsedValue = parseNumber(rawValue);

      if (parsedValue !== undefined) {
        onValueChange(parsedValue);
      }
    }}
    step={step}
    value={String(value)}
  />
);

const AdminConfiguration: React.FC = () => {
  const [configurationId, setConfigurationId] = React.useState<number>();
  const [pesoCasos, setPesoCasos] = React.useState<number>(20);
  const [pesoEmisionesTx, setPesoEmisionesTx] = React.useState<number>(15);
  const [pesoEmisionesPg, setPesoEmisionesPg] = React.useState<number>(10);
  const [pesoMovimientosTx, setPesoMovimientosTx] =
    React.useState<number>(15);
  const [pesoMovimientosPg, setPesoMovimientosPg] =
    React.useState<number>(15);
  const [pesoEscaneoTx, setPesoEscaneoTx] = React.useState<number>(10);
  const [pesoEscaneoPg, setPesoEscaneoPg] = React.useState<number>(15);
  const [metaSlaCasos, setMetaSlaCasos] = React.useState<number>(90);
  const [metaEmisionesTx, setMetaEmisionesTx] = React.useState<number>(10);
  const [metaMovimientosPg, setMetaMovimientosPg] =
    React.useState<number>(350);
  const [metaEscaneoPg, setMetaEscaneoPg] = React.useState<number>(350);
  const [puntosPorKudo, setPuntosPorKudo] = React.useState<number>(10);
  const [penalidadBaja, setPenalidadBaja] = React.useState<number>(5);
  const [penalidadMedia, setPenalidadMedia] = React.useState<number>(15);
  const [penalidadCritica, setPenalidadCritica] = React.useState<number>(50);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [successMessage, setSuccessMessage] = React.useState<string>('');
  const [errorMessage, setErrorMessage] = React.useState<string>('');
  const [overrideEmail, setOverrideEmail] = React.useState<string>('');
  const [overrideRole, setOverrideRole] = React.useState<RoleType>('Oficial');
  const [isRoleSubmitting, setIsRoleSubmitting] = React.useState<boolean>(false);
  const [roleSuccessMessage, setRoleSuccessMessage] = React.useState<string>('');
  const [roleErrorMessage, setRoleErrorMessage] = React.useState<string>('');
  const [catalogItems, setCatalogItems] = React.useState<ICatalogoItem[]>([]);
  const [catalogCategory, setCatalogCategory] =
    React.useState<CatalogCategory>('Falta');
  const [catalogValue, setCatalogValue] = React.useState<string>('');
  const [isLoadingCatalogs, setIsLoadingCatalogs] =
    React.useState<boolean>(true);
  const [isCatalogSubmitting, setIsCatalogSubmitting] =
    React.useState<boolean>(false);
  const [deletingCatalogId, setDeletingCatalogId] =
    React.useState<number>();
  const [catalogSuccessMessage, setCatalogSuccessMessage] =
    React.useState<string>('');
  const [catalogErrorMessage, setCatalogErrorMessage] =
    React.useState<string>('');
  const sharePointService = React.useMemo(() => new SharePointService(), []);
  const syncService = React.useMemo(() => new PowerAutomateSyncService(), []);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [isSyncing, setIsSyncing] = React.useState<boolean>(false);
  const [syncSuccessMessage, setSyncSuccessMessage] = React.useState<string>('');
  const [syncErrorMessage, setSyncErrorMessage] = React.useState<string>('');

  React.useEffect(() => {
    let isMounted = true;

    const loadConfiguration = async (): Promise<void> => {
      try {
        const configuration = await sharePointService.getConfiguracion();

        if (isMounted) {
          setConfigurationId(configuration.Id);
          setPesoCasos(configuration.PesoCasos);
          setPesoEmisionesTx(configuration.PesoEmisionesTx);
          setPesoEmisionesPg(configuration.PesoEmisionesPg);
          setPesoMovimientosTx(configuration.PesoMovimientosTx);
          setPesoMovimientosPg(configuration.PesoMovimientosPg);
          setPesoEscaneoTx(configuration.PesoEscaneoTx);
          setPesoEscaneoPg(configuration.PesoEscaneoPg);
          setMetaSlaCasos(configuration.MetaSlaCasos);
          setMetaEmisionesTx(configuration.MetaEmisionesTx);
          setMetaMovimientosPg(configuration.MetaMovimientosPg);
          setMetaEscaneoPg(configuration.MetaEscaneoPg);
          setPuntosPorKudo(configuration.PuntosPorKudo);
          setPenalidadBaja(configuration.PenalidadBaja);
          setPenalidadMedia(configuration.PenalidadMedia);
          setPenalidadCritica(configuration.PenalidadCritica);
        }
      } catch (error: unknown) {
        if (isMounted) {
          const detail = error instanceof Error
            ? error.message
            : 'Ocurrió un error inesperado al cargar la configuración.';
          setErrorMessage(detail);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadConfiguration().catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [sharePointService]);

  const productivityWeights = [
    pesoCasos,
    pesoEmisionesTx,
    pesoEmisionesPg,
    pesoMovimientosTx,
    pesoMovimientosPg,
    pesoEscaneoTx,
    pesoEscaneoPg
  ];
  const productivityWeightTotal = productivityWeights.reduce(
    (total, weight) => total + weight,
    0
  );
  const hasValidProductivityWeights =
    productivityWeights.every(
      (weight) => Number.isFinite(weight) && weight >= 0 && weight <= 100
    ) &&
    Math.abs(productivityWeightTotal - 100) < 0.001;
  const hasValidDailyGoals = [
    metaEmisionesTx,
    metaMovimientosPg,
    metaEscaneoPg
  ].every((goal) => Number.isFinite(goal) && goal > 0);
  const hasValidCaseSlaGoal = Number.isFinite(metaSlaCasos) &&
    metaSlaCasos > 0 && metaSlaCasos <= 100;

  React.useEffect(() => {
    let isMounted = true;

    const loadCatalogs = async (): Promise<void> => {
      setIsLoadingCatalogs(true);

      try {
        const items = await sharePointService.getCatalogos();

        if (isMounted) {
          setCatalogItems(items);
          setCatalogErrorMessage('');
        }
      } catch (error: unknown) {
        if (isMounted) {
          const detail = error instanceof Error
            ? error.message
            : 'Ocurrió un error inesperado al cargar los catálogos.';
          setCatalogErrorMessage(detail);
        }
      } finally {
        if (isMounted) {
          setIsLoadingCatalogs(false);
        }
      }
    };

    loadCatalogs().catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [sharePointService]);

  const saveConfiguration = async (): Promise<void> => {
    setSuccessMessage('');
    setErrorMessage('');

    const values = [
      pesoCasos,
      pesoEmisionesTx,
      pesoEmisionesPg,
      pesoMovimientosTx,
      pesoMovimientosPg,
      pesoEscaneoTx,
      pesoEscaneoPg,
      metaSlaCasos,
      metaEmisionesTx,
      metaMovimientosPg,
      metaEscaneoPg,
      puntosPorKudo,
      penalidadBaja,
      penalidadMedia,
      penalidadCritica
    ];
    const hasInvalidValue = values.some(
      (value) => !Number.isFinite(value) || value < 0
    );

    if (
      configurationId === undefined ||
      hasInvalidValue ||
      !hasValidProductivityWeights ||
      !hasValidDailyGoals ||
      !hasValidCaseSlaGoal
    ) {
      setErrorMessage('Revise los valores antes de guardar la configuración.');
      return;
    }

    setIsSubmitting(true);

    try {
      const data: IConfiguracionMetricasUpdate = {
        PesoCasos: pesoCasos,
        PesoEmisionesTx: pesoEmisionesTx,
        PesoEmisionesPg: pesoEmisionesPg,
        PesoMovimientosTx: pesoMovimientosTx,
        PesoMovimientosPg: pesoMovimientosPg,
        PesoEscaneoTx: pesoEscaneoTx,
        PesoEscaneoPg: pesoEscaneoPg,
        MetaSlaCasos: metaSlaCasos,
        MetaEmisionesTx: metaEmisionesTx,
        MetaMovimientosPg: metaMovimientosPg,
        MetaEscaneoPg: metaEscaneoPg,
        PuntosPorKudo: puntosPorKudo,
        PenalidadBaja: penalidadBaja,
        PenalidadMedia: penalidadMedia,
        PenalidadCritica: penalidadCritica
      };

      await sharePointService.actualizarConfiguracion(configurationId, data);
      setSuccessMessage('Configuración guardada correctamente.');
    } catch (error: unknown) {
      const detail = error instanceof Error
        ? error.message
        : 'Ocurrió un error inesperado al guardar la configuración.';
      setErrorMessage(detail);
    } finally {
      setIsSubmitting(false);
    }
  };

  const saveRoleOverride = async (): Promise<void> => {
    setRoleSuccessMessage('');
    setRoleErrorMessage('');

    const normalizedEmail = overrideEmail.trim().toLocaleLowerCase();
    const hasValidEmail = /^[^\s@]+@humano\.com\.do$/i.test(normalizedEmail);

    if (!hasValidEmail) {
      setRoleErrorMessage('Ingrese un correo corporativo válido.');
      return;
    }

    setIsRoleSubmitting(true);

    try {
      await sharePointService.setRoleOverride(normalizedEmail, overrideRole);
      setOverrideEmail('');
      setRoleSuccessMessage(
        `El rol ${overrideRole} fue asignado a ${normalizedEmail}.`
      );
    } catch (error: unknown) {
      const detail = error instanceof Error
        ? error.message
        : 'Ocurrió un error inesperado al guardar la asignación.';
      setRoleErrorMessage(detail);
    } finally {
      setIsRoleSubmitting(false);
    }
  };

  const saveCatalogItem = async (): Promise<void> => {
    setCatalogSuccessMessage('');
    setCatalogErrorMessage('');

    const normalizedValue = catalogValue.trim();

    if (!normalizedValue) {
      setCatalogErrorMessage('Ingrese el nombre de la nueva opción.');
      return;
    }

    setIsCatalogSubmitting(true);

    try {
      await sharePointService.addCatalogo(catalogCategory, normalizedValue);
      const updatedItems = await sharePointService.getCatalogos();

      setCatalogItems(updatedItems);
      setCatalogValue('');
      setCatalogSuccessMessage(
        `"${normalizedValue}" fue agregado a ${catalogCategoryLabels[catalogCategory]}.`
      );
    } catch (error: unknown) {
      const detail = error instanceof Error
        ? error.message
        : 'Ocurrió un error inesperado al agregar la opción.';
      setCatalogErrorMessage(detail);
    } finally {
      setIsCatalogSubmitting(false);
    }
  };

  const removeCatalogItem = async (item: ICatalogoItem): Promise<void> => {
    setCatalogSuccessMessage('');
    setCatalogErrorMessage('');
    setDeletingCatalogId(item.Id);

    try {
      await sharePointService.deleteCatalogo(item.Id);
      const updatedItems = await sharePointService.getCatalogos();

      setCatalogItems(updatedItems);
      setCatalogSuccessMessage(
        `"${item.Valor}" fue eliminado de ${catalogCategoryLabels[item.Title]}.`
      );
    } catch (error: unknown) {
      const detail = error instanceof Error
        ? error.message
        : 'Ocurrió un error inesperado al eliminar la opción.';
      setCatalogErrorMessage(detail);
    } finally {
      setDeletingCatalogId(undefined);
    }
  };

  const handleExport = async (): Promise<void> => {
    setIsSyncing(true);
    setSyncSuccessMessage('');
    setSyncErrorMessage('');

    try {
      await syncService.downloadExport();
      setSyncSuccessMessage(
        'Diferencias exportadas correctamente para sincronizar AppDB.xlsx mediante Power Automate.'
      );
    } catch (error: unknown) {
      setSyncErrorMessage(
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const handleImport = async (
    event: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsSyncing(true);
    setSyncSuccessMessage('');
    setSyncErrorMessage('');

    try {
      await syncService.importFile(file);
      setSyncSuccessMessage(
        'Respuesta de OneDrive / Excel importada y fusionada correctamente.'
      );
    } catch (error: unknown) {
      setSyncErrorMessage(
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      event.target.value = '';
      setIsSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <Stack className={styles.loading} horizontalAlign="center" verticalAlign="center">
        <Spinner
          label="Cargando configuración de métricas..."
          size={SpinnerSize.large}
        />
      </Stack>
    );
  }

  return (
      <Stack className={styles.panel} tokens={{ childrenGap: 20 }}>
      <Stack tokens={{ childrenGap: 4 }}>
        <Text variant="xxLarge">
          Configuración de Métricas de Productividad v4.5
        </Text>
        <Text className={styles.description}>
          Define las metas fijas y la distribución porcentual utilizada por
          el motor de normalización dinámica.
        </Text>
      </Stack>

      {successMessage && (
        <MessageBar messageBarType={MessageBarType.success}>
          {successMessage}
        </MessageBar>
      )}

      {errorMessage && (
        <MessageBar messageBarType={MessageBarType.error}>
          {errorMessage}
        </MessageBar>
      )}

      <Stack className={styles.roleCard} tokens={{ childrenGap: 18 }}>
        <Stack tokens={{ childrenGap: 4 }}>
          <Text variant="xLarge">Sincronización EntraID y SharePoint</Text>
          <Text className={styles.description}>
            Exporta las novedades hacia AppDB.xlsx para ser procesadas mediante Power Automate e importa las respuestas de validación corporativa.
          </Text>
        </Stack>

        {syncSuccessMessage && (
          <MessageBar messageBarType={MessageBarType.success}>
            {syncSuccessMessage}
          </MessageBar>
        )}

        {syncErrorMessage && (
          <MessageBar messageBarType={MessageBarType.error}>
            {syncErrorMessage}
          </MessageBar>
        )}

        <Stack horizontal wrap verticalAlign="center" tokens={{ childrenGap: 16 }}>
          <PrimaryButton
            disabled={isSyncing}
            iconProps={{ iconName: 'Download' }}
            onClick={() => void handleExport()}
            text="🔄 Exportar a Excel / Power Automate"
          />
          <DefaultButton
            disabled={isSyncing}
            iconProps={{ iconName: 'Upload' }}
            onClick={() => fileInputRef.current?.click()}
            text="Importar respuesta (.xlsx / .json)"
          />
          <input
            ref={fileInputRef}
            accept=".xlsx,.xls,.json"
            aria-label="Seleccionar paquete AppDB"
            style={{ display: 'none' }}
            onChange={(event) => void handleImport(event)}
            type="file"
          />
          {isSyncing && (
            <Spinner label="Sincronizando..." size={SpinnerSize.small} />
          )}
        </Stack>
      </Stack>

      <Stack className={styles.formCard} tokens={{ childrenGap: 20 }}>
        <section className={styles.metricsSection}>
          <div className={styles.sectionHeading}>
            <Text variant="xLarge">Metas Operativas</Text>
            <Text className={styles.description}>
              El SLA se compara como porcentaje; las metas de volumen se
              multiplican por las jornadas equivalentes del período.
            </Text>
          </div>

          <div className={styles.metricGrid}>
            <NumericConfigurationField
              disabled={isSubmitting}
              label="Meta de SLA de Casos (%)"
              max={100}
              onValueChange={setMetaSlaCasos}
              step={0.1}
              value={metaSlaCasos}
            />
            <NumericConfigurationField
              disabled={isSubmitting}
              label="Meta Emisiones Tx"
              onValueChange={setMetaEmisionesTx}
              value={metaEmisionesTx}
            />
            <NumericConfigurationField
              disabled={isSubmitting}
              label="Meta Movimientos Pg"
              onValueChange={setMetaMovimientosPg}
              value={metaMovimientosPg}
            />
            <NumericConfigurationField
              disabled={isSubmitting}
              label="Meta Escaneo Pg"
              onValueChange={setMetaEscaneoPg}
              value={metaEscaneoPg}
            />
          </div>

          {!hasValidDailyGoals && (
            <MessageBar messageBarType={MessageBarType.warning}>
              Las tres metas diarias deben ser mayores que cero.
            </MessageBar>
          )}
          {!hasValidCaseSlaGoal && (
            <MessageBar messageBarType={MessageBarType.warning}>
              La Meta de SLA de Casos debe ser mayor que cero y menor o igual
              a 100%.
            </MessageBar>
          )}
        </section>

        <section className={`${styles.metricsSection} ${styles.section}`}>
          <div className={styles.sectionHeading}>
            <Text variant="xLarge">Pesos Porcentuales (%)</Text>
            <Text className={styles.description}>
              La ponderación se normaliza únicamente entre las métricas
              activas de cada colaborador.
            </Text>
          </div>

          <div className={styles.metricGrid}>
            <NumericConfigurationField
              disabled={isSubmitting}
              label="SLA Casos"
              onValueChange={setPesoCasos}
              step={0.1}
              value={pesoCasos}
            />
            <NumericConfigurationField
              disabled={isSubmitting}
              label="Emisiones Tx"
              onValueChange={setPesoEmisionesTx}
              step={0.1}
              value={pesoEmisionesTx}
            />
            <NumericConfigurationField
              disabled={isSubmitting}
              label="Emisiones Pg"
              onValueChange={setPesoEmisionesPg}
              step={0.1}
              value={pesoEmisionesPg}
            />
            <NumericConfigurationField
              disabled={isSubmitting}
              label="Movimientos Tx"
              onValueChange={setPesoMovimientosTx}
              step={0.1}
              value={pesoMovimientosTx}
            />
            <NumericConfigurationField
              disabled={isSubmitting}
              label="Movimientos Pg"
              onValueChange={setPesoMovimientosPg}
              step={0.1}
              value={pesoMovimientosPg}
            />
            <NumericConfigurationField
              disabled={isSubmitting}
              label="Escaneo Tx"
              onValueChange={setPesoEscaneoTx}
              step={0.1}
              value={pesoEscaneoTx}
            />
            <NumericConfigurationField
              disabled={isSubmitting}
              label="Escaneo Pg"
              onValueChange={setPesoEscaneoPg}
              step={0.1}
              value={pesoEscaneoPg}
            />
          </div>

          <div
            aria-live="polite"
            className={`${styles.weightStatus} ${
              hasValidProductivityWeights
                ? styles.weightStatusValid
                : styles.weightStatusInvalid
            }`}
          >
            <strong>
              Total configurado: {productivityWeightTotal.toLocaleString(
                'es-DO',
                { maximumFractionDigits: 2 }
              )}%
            </strong>
            <span>
              {hasValidProductivityWeights
                ? 'Distribución válida para guardar.'
                : 'La suma de los siete pesos debe ser exactamente 100%.'}
            </span>
          </div>

          {!hasValidProductivityWeights && (
            <MessageBar messageBarType={MessageBarType.warning}>
              Ajuste los pesos antes de guardar. El motor requiere una suma
              total de 100%.
            </MessageBar>
          )}
        </section>

        <section className={`${styles.metricsSection} ${styles.section}`}>
          <div className={styles.sectionHeading}>
            <Text variant="xLarge">Reconocimientos</Text>
          </div>
          <div className={styles.metricGrid}>
            <NumericConfigurationField
              disabled={isSubmitting}
              label="Puntos por Kudo"
              onValueChange={setPuntosPorKudo}
              value={puntosPorKudo}
            />
          </div>
        </section>

        <Stack className={styles.section} tokens={{ childrenGap: 16 }}>
          <Text variant="xLarge">
            Penalidades por Faltas (Puntos a restar)
          </Text>

          <Stack horizontal wrap tokens={{ childrenGap: 20 }}>
            <Stack.Item className={styles.field} grow>
              <SpinButton
                disabled={isSubmitting}
                label="Impacto bajo"
                min={0}
                onChange={(_, value) => {
                  const parsedValue = parseNumber(value);
                  if (parsedValue !== undefined) {
                    setPenalidadBaja(parsedValue);
                  }
                }}
                step={1}
                value={String(penalidadBaja)}
              />
            </Stack.Item>

            <Stack.Item className={styles.field} grow>
              <SpinButton
                disabled={isSubmitting}
                label="Impacto medio"
                min={0}
                onChange={(_, value) => {
                  const parsedValue = parseNumber(value);
                  if (parsedValue !== undefined) {
                    setPenalidadMedia(parsedValue);
                  }
                }}
                step={1}
                value={String(penalidadMedia)}
              />
            </Stack.Item>

            <Stack.Item className={styles.field} grow>
              <SpinButton
                disabled={isSubmitting}
                label="Impacto crítico"
                min={0}
                onChange={(_, value) => {
                  const parsedValue = parseNumber(value);
                  if (parsedValue !== undefined) {
                    setPenalidadCritica(parsedValue);
                  }
                }}
                step={1}
                value={String(penalidadCritica)}
              />
            </Stack.Item>
          </Stack>
        </Stack>

        <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 12 }}>
          <PrimaryButton
            disabled={
              isSubmitting ||
              configurationId === undefined ||
              !hasValidProductivityWeights ||
              !hasValidDailyGoals ||
              !hasValidCaseSlaGoal
            }
            onClick={() => saveConfiguration().catch(() => undefined)}
            text="Guardar Configuración"
          />
          {isSubmitting && (
            <Spinner label="Guardando..." size={SpinnerSize.small} />
          )}
        </Stack>
      </Stack>

      <Stack className={styles.roleCard} tokens={{ childrenGap: 18 }}>
        <Stack tokens={{ childrenGap: 4 }}>
          <Text variant="xLarge">
            Gestión de Roles (Asignación Manual / Override)
          </Text>
          <Text className={styles.description}>
            La asignación manual tiene prioridad sobre el cargo detectado en
            Microsoft Entra ID.
          </Text>
        </Stack>

        {roleSuccessMessage && (
          <MessageBar messageBarType={MessageBarType.success}>
            {roleSuccessMessage}
          </MessageBar>
        )}

        {roleErrorMessage && (
          <MessageBar messageBarType={MessageBarType.error}>
            {roleErrorMessage}
          </MessageBar>
        )}

        <Stack horizontal wrap tokens={{ childrenGap: 20 }}>
          <Stack.Item className={styles.roleEmailField} grow>
            <TextField
              disabled={isRoleSubmitting}
              label="Correo del colaborador"
              onChange={(_, value) => setOverrideEmail(value || '')}
              placeholder="nombre.apellido@humano.com.do"
              value={overrideEmail}
            />
          </Stack.Item>

          <Stack.Item className={styles.roleField}>
            <Dropdown
              disabled={isRoleSubmitting}
              label="Rol asignado"
              onChange={(_, option) => {
                const selectedRole = String(option?.key || '');

                if (isRoleType(selectedRole)) {
                  setOverrideRole(selectedRole);
                }
              }}
              options={roleOptions}
              selectedKey={overrideRole}
            />
          </Stack.Item>
        </Stack>

        <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 12 }}>
          <PrimaryButton
            disabled={isRoleSubmitting || overrideEmail.trim().length === 0}
            onClick={() => saveRoleOverride().catch(() => undefined)}
            text="Guardar Asignación de Rol"
          />
          {isRoleSubmitting && (
            <Spinner label="Guardando rol..." size={SpinnerSize.small} />
          )}
        </Stack>
      </Stack>

      <Stack className={styles.catalogCard} tokens={{ childrenGap: 18 }}>
        <Stack tokens={{ childrenGap: 4 }}>
          <Text variant="xLarge">Gestión de Catálogos Operativos</Text>
          <Text className={styles.description}>
            Administra las opciones disponibles en los formularios sin
            modificar el código de la aplicación.
          </Text>
        </Stack>

        {catalogSuccessMessage && (
          <MessageBar messageBarType={MessageBarType.success}>
            {catalogSuccessMessage}
          </MessageBar>
        )}

        {catalogErrorMessage && (
          <MessageBar messageBarType={MessageBarType.error}>
            {catalogErrorMessage}
          </MessageBar>
        )}

        <Stack
          className={styles.catalogToolbar}
          horizontal
          verticalAlign="end"
          wrap
          tokens={{ childrenGap: 16 }}
        >
          <Stack.Item className={styles.catalogCategoryField}>
            <Dropdown
              disabled={isCatalogSubmitting || deletingCatalogId !== undefined}
              label="Tipo de catálogo"
              onChange={(_, option) => {
                const selectedCategory = String(option?.key || '');

                if (isCatalogCategory(selectedCategory)) {
                  setCatalogCategory(selectedCategory);
                }
              }}
              options={catalogCategoryOptions}
              selectedKey={catalogCategory}
            />
          </Stack.Item>

          <Stack.Item className={styles.catalogValueField} grow>
            <TextField
              disabled={isCatalogSubmitting || deletingCatalogId !== undefined}
              label="Nueva opción"
              maxLength={255}
              onChange={(_, value) => setCatalogValue(value || '')}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && catalogValue.trim()) {
                  event.preventDefault();
                  saveCatalogItem().catch(() => undefined);
                }
              }}
              placeholder="Escriba el valor que verá el usuario"
              value={catalogValue}
            />
          </Stack.Item>

          <PrimaryButton
            disabled={
              isCatalogSubmitting ||
              deletingCatalogId !== undefined ||
              catalogValue.trim().length === 0
            }
            iconProps={{ iconName: 'Add' }}
            onClick={() => saveCatalogItem().catch(() => undefined)}
            text="Agregar opción"
          />
        </Stack>

        {isCatalogSubmitting && (
          <Spinner label="Agregando opción..." size={SpinnerSize.small} />
        )}

        {isLoadingCatalogs ? (
          <Spinner
            label="Cargando catálogos operativos..."
            size={SpinnerSize.medium}
          />
        ) : (
          <div className={styles.catalogGrid}>
            {catalogCategories.map((category) => {
              const categoryItems = catalogItems.filter(
                (item) => item.Title === category
              );

              return (
                <section className={styles.catalogGroup} key={category}>
                  <Text className={styles.catalogGroupTitle} variant="large">
                    {catalogCategoryLabels[category]}
                  </Text>

                  {categoryItems.length === 0 ? (
                    <Text className={styles.catalogEmpty}>
                      No hay opciones configuradas.
                    </Text>
                  ) : (
                    <div className={styles.catalogList}>
                      {categoryItems.map((item) => (
                        <div className={styles.catalogItem} key={item.Id}>
                          <span className={styles.catalogItemValue}>
                            {item.Valor}
                          </span>
                          <IconButton
                            ariaLabel={`Eliminar ${item.Valor}`}
                            className={styles.catalogDeleteButton}
                            disabled={
                              isCatalogSubmitting ||
                              deletingCatalogId !== undefined
                            }
                            iconProps={{
                              iconName: deletingCatalogId === item.Id
                                ? 'Sync'
                                : 'Delete'
                            }}
                            onClick={() => {
                              removeCatalogItem(item).catch(() => undefined);
                            }}
                            title={`Eliminar ${item.Valor}`}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </Stack>
    </Stack>
  );
};

const AdminPanel: React.FC<IAdminPanelProps> = ({ userRole }) => {
  if (userRole !== 'Admin' && userRole !== 'Master_Admin') {
    return (
      <Stack className={styles.panel}>
        <MessageBar messageBarType={MessageBarType.blocked}>
          Acceso Denegado: Esta vista es exclusiva para Administradores.
        </MessageBar>
      </Stack>
    );
  }

  return <AdminConfiguration />;
};

export default AdminPanel;
