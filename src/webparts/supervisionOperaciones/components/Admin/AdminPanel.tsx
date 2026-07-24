import * as React from 'react';
import {
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
  { key: 'Asistente', text: 'Asistente' },
  { key: 'Oficial', text: 'Oficial' }
];

const catalogCategories: ReadonlyArray<CatalogCategory> = [
  'Falta',
  'ErrorProceso',
  'Kudo',
  'ProcesoArea'
];

const catalogCategoryLabels: Record<CatalogCategory, string> = {
  Falta: 'Categorías de faltas',
  ErrorProceso: 'Subcategorías de errores',
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

const AdminConfiguration: React.FC = () => {
  const [configurationId, setConfigurationId] = React.useState<number>();
  const [pesoCasos, setPesoCasos] = React.useState<number>(1);
  const [pesoEmisiones, setPesoEmisiones] = React.useState<number>(1.5);
  const [pesoMovimientos, setPesoMovimientos] = React.useState<number>(1.2);
  const [metaDiaria, setMetaDiaria] = React.useState<number>(100);
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

  React.useEffect(() => {
    let isMounted = true;

    const loadConfiguration = async (): Promise<void> => {
      try {
        const configuration = await sharePointService.getConfiguracion();

        if (isMounted) {
          setConfigurationId(configuration.Id);
          setPesoCasos(configuration.PesoCasos);
          setPesoEmisiones(configuration.PesoEmisiones);
          setPesoMovimientos(configuration.PesoMovimientos);
          setMetaDiaria(configuration.MetaDiaria);
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
      pesoEmisiones,
      pesoMovimientos,
      metaDiaria,
      puntosPorKudo,
      penalidadBaja,
      penalidadMedia,
      penalidadCritica
    ];
    const hasInvalidValue = values.some(
      (value) => !Number.isFinite(value) || value < 0
    );

    if (configurationId === undefined || hasInvalidValue) {
      setErrorMessage('Revise los valores antes de guardar la configuración.');
      return;
    }

    setIsSubmitting(true);

    try {
      const data: IConfiguracionMetricasUpdate = {
        PesoCasos: pesoCasos,
        PesoEmisiones: pesoEmisiones,
        PesoMovimientos: pesoMovimientos,
        MetaDiaria: metaDiaria,
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
    const hasValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);

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
        <Text variant="xxLarge">Configuración de métricas</Text>
        <Text className={styles.description}>
          Define los pesos operativos y la meta diaria global del equipo.
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

      <Stack className={styles.formCard} tokens={{ childrenGap: 20 }}>
        <Stack horizontal wrap tokens={{ childrenGap: 20 }}>
          <Stack.Item className={styles.field} grow>
            <SpinButton
              disabled={isSubmitting}
              label="Peso de casos"
              min={0}
              onChange={(_, value) => {
                const parsedValue = parseNumber(value);
                if (parsedValue !== undefined) {
                  setPesoCasos(parsedValue);
                }
              }}
              step={0.1}
              value={String(pesoCasos)}
            />
          </Stack.Item>

          <Stack.Item className={styles.field} grow>
            <SpinButton
              disabled={isSubmitting}
              label="Peso de emisiones"
              min={0}
              onChange={(_, value) => {
                const parsedValue = parseNumber(value);
                if (parsedValue !== undefined) {
                  setPesoEmisiones(parsedValue);
                }
              }}
              step={0.1}
              value={String(pesoEmisiones)}
            />
          </Stack.Item>
        </Stack>

        <Stack horizontal wrap tokens={{ childrenGap: 20 }}>
          <Stack.Item className={styles.field} grow>
            <SpinButton
              disabled={isSubmitting}
              label="Peso de movimientos"
              min={0}
              onChange={(_, value) => {
                const parsedValue = parseNumber(value);
                if (parsedValue !== undefined) {
                  setPesoMovimientos(parsedValue);
                }
              }}
              step={0.1}
              value={String(pesoMovimientos)}
            />
          </Stack.Item>

          <Stack.Item className={styles.field} grow>
            <SpinButton
              disabled={isSubmitting}
              label="Meta diaria"
              min={0}
              onChange={(_, value) => {
                const parsedValue = parseNumber(value);
                if (parsedValue !== undefined) {
                  setMetaDiaria(parsedValue);
                }
              }}
              step={1}
              value={String(metaDiaria)}
            />
          </Stack.Item>

          <Stack.Item className={styles.field} grow>
            <SpinButton
              disabled={isSubmitting}
              label="Puntos por Kudo"
              min={0}
              onChange={(_, value) => {
                const parsedValue = parseNumber(value);
                if (parsedValue !== undefined) {
                  setPuntosPorKudo(parsedValue);
                }
              }}
              step={1}
              value={String(puntosPorKudo)}
            />
          </Stack.Item>
        </Stack>

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
            disabled={isSubmitting || configurationId === undefined}
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
              placeholder="nombre.apellido@humanoseguros.com"
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
  if (userRole !== 'Admin') {
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
