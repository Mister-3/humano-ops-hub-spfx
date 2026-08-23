import * as React from 'react';
import { Icon, initializeIcons, TooltipHost } from '@fluentui/react';

import styles from './SidebarNav.module.scss';

initializeIcons(undefined, { disableWarnings: true });

export type AppModuleKey =
  | 'dashboard'
  | 'Evaluacion'
  | 'faltas'
  | 'kudos'
  | 'productividad'
  | 'Ocupacion'
  | 'mejoras'
  | 'iniciativas'
  | 'oportunidades'
  | 'solicitudes_mejora'
  | 'endToEnd'
  | 'userAdmin'
  | 'admin';

export interface ISidebarNavItem {
  key: AppModuleKey;
  label: string;
  iconName: string;
}

export interface ISidebarNavProps {
  activeModule: AppModuleKey;
  items: ReadonlyArray<ISidebarNavItem>;
  onModuleChange: (moduleKey: AppModuleKey) => void;
}

export const defaultSidebarItems: ReadonlyArray<ISidebarNavItem> = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    iconName: 'BIDashboard'
  },
  {
    key: 'Evaluacion',
    label: 'Evaluación de Rendimiento',
    iconName: 'LineChart'
  },
  {
    key: 'faltas',
    label: 'Registro Operativo',
    iconName: 'ComplianceAudit'
  },
  {
    key: 'kudos',
    label: 'Reconocimientos',
    iconName: 'Trophy'
  },
  {
    key: 'productividad',
    label: 'Productividad',
    iconName: 'LightningBolt'
  },
  {
    key: 'Ocupacion',
    label: 'Ocupación del Supervisor',
    iconName: 'Clock'
  },
  {
    key: 'mejoras',
    label: 'Iniciativas & Mejoras',
    iconName: 'Lightbulb'
  },
  {
    key: 'endToEnd',
    label: 'Análisis End-to-End',
    iconName: 'Processing'
  },
  {
    key: 'userAdmin',
    label: 'Administración de Usuarios',
    iconName: 'People'
  },
  {
    key: 'admin',
    label: 'Configuración',
    iconName: 'Settings'
  }
];

export const SidebarNav: React.FC<ISidebarNavProps> = ({
  activeModule,
  items,
  onModuleChange
}) => {
  const [isPinned, setIsPinned] = React.useState<boolean>(false);
  const [isHovered, setIsHovered] = React.useState<boolean>(false);
  const [hasFocusWithin, setHasFocusWithin] = React.useState<boolean>(false);

  const isExpanded = isPinned || isHovered || hasFocusWithin;
  const pinLabel = isPinned ? 'Liberar menú' : 'Fijar menú';

  const handleBlur = React.useCallback(
    (event: React.FocusEvent<HTMLElement>): void => {
      const nextTarget = event.relatedTarget as Node | null;

      if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
        setHasFocusWithin(false);
      }
    },
    []
  );

  const handlePinClick = React.useCallback((
    event: React.MouseEvent<HTMLButtonElement>
  ): void => {
    const nextPinnedState = !isPinned;
    setIsPinned(nextPinnedState);

    // Al liberar con mouse/touch, el foco no debe mantener el panel expandido.
    // Con teclado se conserva para no interrumpir la navegación accesible.
    if (!nextPinnedState && event.detail > 0) {
      event.currentTarget.blur();
    }
  }, [isPinned]);

  return (
    <aside
      className={`${styles.sidebar} ${isExpanded ? styles.expanded : ''}`}
      aria-label="Navegación principal de Humano Ops Hub"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setHasFocusWithin(true)}
      onBlur={handleBlur}
    >
      <div className={styles.sidebarGlow} aria-hidden="true" />

      <div className={styles.pinArea}>
        <TooltipHost
          content={isExpanded ? undefined : pinLabel}
          calloutProps={{ gapSpace: 10 }}
        >
          <button
            type="button"
            className={`${styles.pinButton} ${isPinned ? styles.pinButtonActive : ''}`}
            aria-label={pinLabel}
            aria-controls="humano-ops-primary-navigation"
            aria-expanded={isExpanded}
            aria-pressed={isPinned}
            onClick={handlePinClick}
          >
            <Icon
              className={styles.pinIcon}
              iconName={isPinned ? 'Pinned' : 'Pin'}
              aria-hidden="true"
            />
            <span className={styles.pinLabel}>{pinLabel}</span>
          </button>
        </TooltipHost>
      </div>

      <nav
        id="humano-ops-primary-navigation"
        className={styles.navigation}
        aria-label="Módulos principales"
      >
        <ul className={styles.navigationList}>
          {items.map((item: ISidebarNavItem) => {
            const isActive = item.key === activeModule;

            return (
              <li key={item.key} className={styles.navigationItem}>
                <TooltipHost
                  content={isExpanded ? undefined : item.label}
                  calloutProps={{ gapSpace: 10 }}
                >
                  <button
                    type="button"
                    className={`${styles.navigationButton} ${
                      isActive ? styles.navigationButtonActive : ''
                    }`}
                    aria-label={item.label}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => onModuleChange(item.key)}
                  >
                    <span className={styles.activeIndicator} aria-hidden="true" />
                    <Icon
                      className={styles.navigationIcon}
                      iconName={item.iconName}
                      aria-hidden="true"
                    />
                    <span className={styles.navigationLabel}>{item.label}</span>
                  </button>
                </TooltipHost>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={styles.sidebarFooter} aria-hidden="true">
        <span className={styles.versionMark}>OPS HUB · V4.5.0</span>
      </div>
    </aside>
  );
};
