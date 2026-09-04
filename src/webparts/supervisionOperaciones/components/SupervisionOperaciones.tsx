import * as React from 'react';
import {
  Icon,
  IconButton,
  initializeIcons,
  MessageBar,
  MessageBarType,
  Pivot,
  PivotItem,
  Spinner,
  SpinnerSize,
  Stack,
  ThemeProvider
} from '@fluentui/react';

import type { IUsuario } from '../models/AppModels';
import { useRBAC } from '../../../auth/RBACContext';
import { supabaseEnvironment } from '../../../services/supabase';
import type GraphService from '../services/GraphService';
import type { IDirectReport } from '../services/GraphService';
import SecurityService from '../services/SecurityService';
import SharePointService, {
  type IAusenciaItem
} from '../services/SharePointService';
import {
  darkTheme,
  ensureTechFontLoaded,
  glowCardStyles
} from '../theme/DarkTheme';
import AdminPanel from './Admin/AdminPanel';
import UserAdminPanel from './Admin/UserAdminPanel';
import AusenciasForm from './Ausencias/AusenciasForm';
import PlanificacionSemanal from './Ausencias/PlanificacionSemanal';
import { HumanoOpsLogo } from './Brand/HumanoOpsLogo';
import { CommandPalette, ToastProvider, useToast } from './Common';
import { getViewFromHash, updateHashForView } from '../utils/routeUtils';
import { Search } from 'lucide-react';
import Dashboard from './Dashboard/Dashboard';
import { ErrorBoundary } from './ErrorBoundary/ErrorBoundary';
import { NoAccessMessage } from './Common/PermissionGuard';
import EvaluacionRendimiento from './EvaluacionRendimiento/EvaluacionRendimiento';
import EndToEndView from './EndToEnd/EndToEndView';
import FaltasForm from './Faltas/FaltasForm';
import KudosForm from './Kudos/KudosForm';
import {
  type AppModuleKey,
  defaultSidebarItems,
  type ISidebarNavItem,
  SidebarNav
} from './Navigation/SidebarNav';
import SupervisorTimeView from './Ocupacion/SupervisorTimeView';
import IniciativasMejorasView from './Mejoras/IniciativasMejorasView';
import ProductividadForm from './Productividad/ProductividadForm';
import AyudaView from './Ayuda/AyudaView';
import styles from './SupervisionOperaciones.module.scss';

initializeIcons(undefined, { disableWarnings: true });
ensureTechFontLoaded();

export interface ISupervisionOperacionesProps {
  currentUser: IUsuario;
  graphService: GraphService;
  onChangePassword: () => void;
  onSignOut: () => void;
}

const MODULE_VIEW_PERMISSIONS: Record<AppModuleKey, ReadonlyArray<string>> = {
  dashboard: ['modulo:dashboard:ver'],
  Evaluacion: ['modulo:evaluacion:ver'],
  faltas: ['modulo:faltas:ver', 'modulo:ausencias:ver'],
  kudos: ['modulo:kudos:ver'],
  productividad: ['modulo:productividad:ver'],
  Ocupacion: ['modulo:ocupacion:ver'],
  mejoras: ['modulo:iniciativas:ver'],
  iniciativas: ['modulo:iniciativas:ver'],
  oportunidades: ['modulo:iniciativas:ver'],
  solicitudes_mejora: ['modulo:iniciativas:ver'],
  endToEnd: ['modulo:end_to_end:ver'],
  userAdmin: [
    'modulo:admin:gestionar_usuarios',
    'modulo:admin:gestionar_permisos'
  ],
  admin: ['modulo:admin:ver'],
  ayuda: []
};

const includeCurrentUserInScope = (
  users: ReadonlyArray<IDirectReport>,
  currentUser: IUsuario
): IDirectReport[] => {
  const normalizedUsers: IDirectReport[] = [];
  const currentUserScope: IDirectReport = {
    id: `current-user-${currentUser.id}`,
    name: currentUser.displayName,
    email: currentUser.email
  };

  [...users, currentUserScope].forEach((candidate) => {
    const candidateEmail = candidate.email.trim().toLocaleLowerCase();
    const candidateName = candidate.name.trim().toLocaleLowerCase();
    const alreadyIncluded = normalizedUsers.some((existing) => {
      const existingEmail = existing.email.trim().toLocaleLowerCase();
      const existingName = existing.name.trim().toLocaleLowerCase();

      return Boolean(candidateEmail && candidateEmail === existingEmail) ||
        Boolean(candidateName && candidateName === existingName);
    });

    if (!alreadyIncluded) {
      normalizedUsers.push(candidate);
    }
  });

  return normalizedUsers;
};

const normalizeAgentIdentity = (value?: string): string =>
  value?.trim().toLocaleLowerCase() || '';

const absenceMatchesAgent = (
  absence: IAusenciaItem,
  agent: IDirectReport
): boolean => {
  const absenceEmail = normalizeAgentIdentity(absence.AgenteEmail);
  const agentEmail = normalizeAgentIdentity(agent.email);

  if (absenceEmail && agentEmail && absenceEmail === agentEmail) {
    return true;
  }

  const absenceObjectId = normalizeAgentIdentity(absence.AgenteObjectID);
  const agentObjectId = normalizeAgentIdentity(agent.id);

  if (
    absenceObjectId &&
    agentObjectId &&
    absenceObjectId === agentObjectId
  ) {
    return true;
  }

  if (absenceEmail || absenceObjectId) {
    return false;
  }

  return Boolean(
    normalizeAgentIdentity(absence.Title) &&
    normalizeAgentIdentity(absence.Title) ===
      normalizeAgentIdentity(agent.name)
  );
};

const SupervisionOperacionesContent: React.FC<ISupervisionOperacionesProps> = ({
  currentUser,
  graphService,
  onChangePassword,
  onSignOut
}) => {
  const {
    error: rbacError,
    hasAnyPermission,
    hasPermission,
    loading: isRBACLoading
  } = useRBAC();
  const { showToast } = useToast();
  const [usuario, setUsuario] = React.useState<IUsuario | null>(currentUser);
  const [isLoading] = React.useState<boolean>(false);
  const [errorMessage] = React.useState<string | null>(null);
  const [activeModule, setActiveModule] = React.useState<AppModuleKey>(() => getViewFromHash());
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = React.useState<boolean>(false);
  const [visibleAgents, setVisibleAgents] = React.useState<IDirectReport[]>([]);

  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);
  const [
    isLoadingVisibleAgents,
    setIsLoadingVisibleAgents
  ] = React.useState<boolean>(true);
  const [
    visibleAgentsError,
    setVisibleAgentsError
  ] = React.useState<string | null>(null);
  const [todayAbsences, setTodayAbsences] =
    React.useState<IAusenciaItem[]>([]);
  const [isAbsenceAlertDismissed, setIsAbsenceAlertDismissed] =
    React.useState<boolean>(false);
  const [absenceRefreshVersion, setAbsenceRefreshVersion] =
    React.useState<number>(0);
  const sharePointService = React.useMemo(() => new SharePointService(), []);
  const moduleHeadingRef = React.useRef<HTMLHeadingElement | null>(null);
  const shouldFocusModuleHeadingRef = React.useRef<boolean>(false);

  React.useEffect(() => {
    setUsuario(currentUser);
  }, [currentUser]);

  const canAccessModule = React.useCallback((moduleKey: AppModuleKey): boolean => {
    if (moduleKey === 'ayuda') return true;
    return hasAnyPermission(MODULE_VIEW_PERMISSIONS[moduleKey]);
  }, [hasAnyPermission]);
  const navigationItems = React.useMemo<ReadonlyArray<ISidebarNavItem>>(() =>
    defaultSidebarItems.filter((item) => canAccessModule(item.key)), [canAccessModule]);

  React.useEffect(() => {
    if (!isRBACLoading && usuario) {
      if (!canAccessModule(activeModule)) {
        showToast({
          title: 'Acceso no autorizado',
          message: 'No posees permisos para acceder al módulo solicitado. Redirigiendo a Dashboard.',
          variant: 'warning'
        });
        const fallback = canAccessModule('dashboard')
          ? 'dashboard'
          : (navigationItems[0]?.key || 'dashboard');
        setActiveModule(fallback);
        updateHashForView(fallback);
      } else {
        updateHashForView(activeModule);
      }
    }
  }, [activeModule, canAccessModule, isRBACLoading, navigationItems, showToast, usuario]);

  React.useEffect(() => {
    const handleHashChange = (): void => {
      const targetView = getViewFromHash();
      if (targetView === activeModule) {
        return;
      }

      if (!isRBACLoading && usuario && !canAccessModule(targetView)) {
        showToast({
          title: 'Acceso no autorizado',
          message: 'No posees permisos para acceder al módulo solicitado. Redirigiendo a Dashboard.',
          variant: 'warning'
        });
        const fallback = canAccessModule('dashboard')
          ? 'dashboard'
          : (navigationItems[0]?.key || 'dashboard');
        updateHashForView(fallback);
        setActiveModule(fallback);
        return;
      }

      shouldFocusModuleHeadingRef.current = true;
      setActiveModule(targetView);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [activeModule, canAccessModule, isRBACLoading, navigationItems, showToast, usuario]);

  React.useEffect(() => {
    if (!usuario) {
      return undefined;
    }

    let isMounted = true;

    const loadVisibleAgents = async (): Promise<void> => {
      setIsLoadingVisibleAgents(true);
      setVisibleAgentsError(null);

      // Ante una consulta pendiente o fallida se niega el alcance por defecto.
      setVisibleAgents([]);

      try {
        const securityService = new SecurityService(undefined, graphService);
        const resolvedUsers = await securityService.getVisibleAgents(
          usuario.rol
        );
        const userRoleStr = (usuario.rol || '').toString().toLowerCase();
        const isAgent = userRoleStr === 'agente';
        const scopedUsers = isAgent
          ? includeCurrentUserInScope([], usuario)
          : usuario.rol === 'Asistente'
            ? includeCurrentUserInScope(resolvedUsers, usuario)
            : resolvedUsers;

        if (isMounted) {
          setVisibleAgents(scopedUsers);
        }
      } catch (error: unknown) {
        if (isMounted) {
          const detail = error instanceof Error
            ? error.message
            : 'Ocurrió un error inesperado.';

          setVisibleAgentsError(
            `No fue posible determinar el alcance autorizado: ${detail}`
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingVisibleAgents(false);
        }
      }
    };

    loadVisibleAgents().catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [graphService, usuario]);

  React.useEffect(() => {
    if (!usuario || isLoadingVisibleAgents) {
      return undefined;
    }

    let isMounted = true;

    const loadTodayAbsences = async (): Promise<void> => {
      if (visibleAgents.length === 0) {
        setTodayAbsences([]);
        return;
      }

      try {
        const today = new Date();
        const absences = await sharePointService.getAusencias(today, today);
        const scopedAbsences = absences.filter((absence) =>
          visibleAgents.some((agent) =>
            absenceMatchesAgent(absence, agent)
          )
        );

        if (isMounted) {
          setTodayAbsences(scopedAbsences);
          setIsAbsenceAlertDismissed(false);
        }
      } catch {
        // La alerta diaria es informativa y no debe bloquear el resto del Hub.
        if (isMounted) {
          setTodayAbsences([]);
        }
      }
    };

    loadTodayAbsences().catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [
    absenceRefreshVersion,
    isLoadingVisibleAgents,
    sharePointService,
    usuario,
    visibleAgents
  ]);

  React.useEffect(() => {
    if (shouldFocusModuleHeadingRef.current) {
      moduleHeadingRef.current?.focus();
      shouldFocusModuleHeadingRef.current = false;
    }
  }, [activeModule]);

  const handleModuleChange = (moduleKey: AppModuleKey): void => {
    if (!canAccessModule(moduleKey)) {
      showToast({
        title: 'Acceso no autorizado',
        message: 'No posees permisos para acceder a este módulo.',
        variant: 'warning'
      });
      return;
    }

    if (moduleKey === activeModule) {
      moduleHeadingRef.current?.focus();
      updateHashForView(moduleKey);
      return;
    }

    shouldFocusModuleHeadingRef.current = true;
    setActiveModule(moduleKey);
    updateHashForView(moduleKey);
  };

  const renderActiveModule = (currentUser: IUsuario): React.ReactElement => {
    if (!canAccessModule(activeModule)) {
      return <NoAccessMessage detail="No posees el permiso de vista requerido para este módulo." />;
    }

    switch (activeModule) {
      case 'dashboard':
        if (isLoadingVisibleAgents) {
          return (
            <Stack
              className={styles.stateCard}
              horizontalAlign="center"
              styles={glowCardStyles}
            >
              <Spinner
                label="Determinando alcance del Dashboard..."
                size={SpinnerSize.large}
              />
            </Stack>
          );
        }

        return (
          <Dashboard
            availableAgents={visibleAgents}
            hasGlobalScope={
              currentUser.rol === 'Admin' || currentUser.rol === 'Gerente'
            }
          />
        );

      case 'Evaluacion':
        if (isLoadingVisibleAgents) {
          return (
            <Stack
              className={styles.stateCard}
              horizontalAlign="center"
              styles={glowCardStyles}
            >
              <Spinner
                label="Determinando alcance de analíticas..."
                size={SpinnerSize.large}
              />
            </Stack>
          );
        }

        if (visibleAgentsError) {
          return (
            <MessageBar messageBarType={MessageBarType.error}>
              {visibleAgentsError}
            </MessageBar>
          );
        }

        return (
          <EvaluacionRendimiento
            currentUserEmail={currentUser.email}
            directReports={visibleAgents}
            userRole={currentUser.rol}
          />
        );

      case 'faltas':
        return (
          <Pivot
            aria-label="Vistas de Registro Operativo"
            className={styles.operationalPivot}
          >
            {hasPermission('modulo:faltas:ver') && <PivotItem
              headerText="Oportunidades operativas"
              itemKey="faltas"
            >
              <FaltasForm
                availableAgents={visibleAgents}
                currentUserEmail={currentUser.email}
                currentUserName={currentUser.displayName}
                isLoadingAgents={isLoadingVisibleAgents}
                userRole={currentUser.rol}
              />
            </PivotItem>}

            {hasPermission('modulo:ausencias:ver') && <PivotItem
              headerText="Registrar ausencia"
              itemKey="ausencias"
            >
              <AusenciasForm
                availableAgents={visibleAgents}
                isLoadingAgents={isLoadingVisibleAgents}
                onSaved={() => {
                  setAbsenceRefreshVersion((current) => current + 1);
                }}
              />
            </PivotItem>}

            {hasPermission('modulo:ausencias:ver') && <PivotItem
              headerText="Planificación semanal"
              itemKey="planificacion"
            >
              <PlanificacionSemanal
                availableAgents={visibleAgents}
                isLoadingAgents={isLoadingVisibleAgents}
              />
            </PivotItem>}
          </Pivot>
        );

      case 'kudos':
        return (
          <KudosForm
            availableAgents={visibleAgents}
            currentUserEmail={currentUser.email}
            isLoadingAgents={isLoadingVisibleAgents}
            remitente={currentUser.displayName}
            userRole={currentUser.rol}
          />
        );

      case 'productividad':
        return (
          <ProductividadForm
            availableAgents={visibleAgents}
            currentUserEmail={currentUser.email}
            currentUserName={currentUser.displayName}
            isLoadingAgents={isLoadingVisibleAgents}
            userRole={currentUser.rol}
          />
        );

      case 'Ocupacion':
        return (
          <SupervisorTimeView
            currentUserEmail={currentUser.email}
            graphService={graphService}
          />
        );

      case 'iniciativas':
      case 'mejoras':
      case 'oportunidades':
      case 'solicitudes_mejora':
        return (
          <IniciativasMejorasView
            currentUserEmail={currentUser.email}
            currentUserName={currentUser.displayName}
            userRole={currentUser.rol}
          />
        );

      case 'endToEnd':
        return (
          <EndToEndView
            currentUserEmail={currentUser.email}
            currentUserName={currentUser.displayName}
          />
        );

      case 'admin':
        return <AdminPanel />;

      case 'userAdmin':
        return <UserAdminPanel />;

      case 'ayuda':
        return <AyudaView />;
    }
  };

  const renderContent = (): React.ReactElement => {
    if (isLoading || isRBACLoading) {
      return (
        <Stack
          className={styles.stateContainer}
          horizontalAlign="center"
          verticalAlign="center"
        >
          <Stack className={styles.stateCard} styles={glowCardStyles}>
            <Spinner
              label={isRBACLoading ? 'Cargando permisos de acceso...' : 'Cargando identidad...'}
              size={SpinnerSize.large}
            />
          </Stack>
        </Stack>
      );
    }

    if (rbacError) {
      return (
        <Stack className={styles.stateContainer} horizontalAlign="center" verticalAlign="center">
          <Stack className={styles.stateCard} styles={glowCardStyles}>
            <MessageBar messageBarType={MessageBarType.error}>
              {rbacError} Aplica la migración RBAC incluida antes de continuar.
            </MessageBar>
          </Stack>
        </Stack>
      );
    }

    if (errorMessage || !usuario) {
      return (
        <Stack
          className={styles.stateContainer}
          horizontalAlign="center"
          verticalAlign="center"
        >
          <Stack className={styles.stateCard} styles={glowCardStyles}>
            <MessageBar messageBarType={MessageBarType.error}>
              {errorMessage || 'No fue posible identificar al usuario actual.'}
            </MessageBar>
          </Stack>
        </Stack>
      );
    }

    const currentNavigationItem = navigationItems.find(
      (item) => item.key === activeModule
    ) || navigationItems[0];
    const todayAbsenceSummary = todayAbsences.map(
      (absence) =>
        `${absence.Title} se encuentra ausente (${absence.TipoAusencia})`
    ).join('; ');

    return (
      <div className={styles.supervisionOperaciones}>
        {todayAbsences.length > 0 && !isAbsenceAlertDismissed && (
          <aside
            aria-live="polite"
            className={styles.absenceAlert}
            role="status"
          >
            <Icon
              aria-hidden="true"
              className={styles.absenceAlertIcon}
              iconName="Warning"
            />
            <div className={styles.absenceAlertContent}>
              <strong className={styles.absenceAlertTitle}>
                ⚠️ Atención Operativa Hoy
              </strong>
              <span className={styles.absenceAlertText}>
                {todayAbsenceSummary}.
              </span>
            </div>
            <IconButton
              ariaLabel="Cerrar alerta de ausencias"
              className={styles.absenceAlertClose}
              iconProps={{ iconName: 'Cancel' }}
              onClick={() => setIsAbsenceAlertDismissed(true)}
              title="Cerrar"
            />
          </aside>
        )}

        <header className={styles.topBar}>
          <div className={styles.brandGroup}>
            <HumanoOpsLogo className={styles.brandLogo} size={40} />
            <div className={styles.brandCopy}>
              <h1 className={styles.brandTitle}>Manager Hub</h1>
              <span className={styles.brandSubtitle}>
                Cultura · Rendimiento · Operaciones
              </span>
            </div>
          </div>

          <div className={styles.topBarControls}>
            <button
              type="button"
              onClick={() => setIsCommandPaletteOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-850 px-3 py-1.5 text-xs text-slate-300 transition-all hover:border-cyan-500/50 hover:bg-slate-800 hover:text-white shadow-sm"
              aria-label="Abrir paleta de comandos (Cmd+K)"
              title="Abrir paleta de comandos (Cmd+K / Ctrl+K)"
            >
              <Search size={14} className="text-cyan-400" />
              <span className="hidden sm:inline text-slate-400">Buscar o ejecutar...</span>
              <kbd className="rounded border border-slate-600 bg-slate-900 px-1.5 py-0.5 text-[10px] font-mono text-cyan-300">
                ⌘K
              </kbd>
            </button>

            <div
              className={styles.userWidget}
              aria-label={`${usuario.displayName}, rol ${usuario.rol}`}
            >
              <span className={styles.statusDot} aria-hidden="true" />
              <span className={styles.userName}>{usuario.displayName}</span>
              <span className={styles.userDivider} aria-hidden="true">|</span>
              <span className={styles.rolePrefix}>Rol:</span>
              <span className={styles.roleBadge}>{usuario.rol}</span>
              <IconButton
                ariaLabel="Abrir menú de perfil"
                className={styles.signOutButton}
                iconProps={{ iconName: 'Contact' }}
                menuProps={{
                  items: [
                    {
                      key: 'changePassword',
                      text: 'Cambiar contraseña',
                      iconProps: { iconName: 'Permissions' },
                      onClick: onChangePassword
                    },
                    {
                      key: 'signOut',
                      text: 'Cerrar sesión',
                      iconProps: { iconName: 'SignOut' },
                      onClick: onSignOut
                    }
                  ]
                }}
                title="Menú de perfil"
              />
            </div>

            {import.meta.env.DEV && supabaseEnvironment === 'qa' && (
              <span
                aria-label="Base de datos QA"
                className={`${styles.environmentBadge} ${styles.environmentBadgeQa}`}
                title={`Supabase: ${import.meta.env.VITE_SUPABASE_URL}`}
              >
                🟢 BASE DE DATOS QA
              </span>
            )}
          </div>
        </header>

        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          onNavigate={handleModuleChange}
        />

        <div className={styles.workspaceLayout}>
          <SidebarNav
            activeModule={activeModule}
            items={navigationItems}
            onModuleChange={handleModuleChange}
          />

          <main
            aria-labelledby="manager-hub-active-module"
            className={styles.moduleViewport}
          >
            <div className={styles.moduleHeader}>
              <span className={styles.moduleHeaderIcon} aria-hidden="true">
                <Icon iconName={currentNavigationItem?.iconName || 'Blocked2'} />
              </span>
              <h2
                className={styles.moduleHeaderTitle}
                id="manager-hub-active-module"
                ref={moduleHeadingRef}
                tabIndex={-1}
              >
                {currentNavigationItem?.label || 'Acceso restringido'}
              </h2>
            </div>

            <div className={styles.moduleContent}>
              {renderActiveModule(usuario)}
            </div>
          </main>
        </div>
      </div>
    );
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <div className={styles.themeRoot}>{renderContent()}</div>
    </ThemeProvider>
  );
};

const SupervisionOperaciones: React.FC<ISupervisionOperacionesProps> = (props) => (
  <ErrorBoundary>
    <ToastProvider>
      <SupervisionOperacionesContent {...props} />
    </ToastProvider>
  </ErrorBoundary>
);

export default SupervisionOperaciones;
