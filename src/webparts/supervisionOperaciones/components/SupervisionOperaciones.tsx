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

import type { IUsuario, RoleType } from '../models/AppModels';
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
import Dashboard from './Dashboard/Dashboard';
import { ErrorBoundary } from './ErrorBoundary/ErrorBoundary';
import EvaluacionRendimiento from './EvaluacionRendimiento/EvaluacionRendimiento';
import FaltasForm from './Faltas/FaltasForm';
import KudosForm from './Kudos/KudosForm';
import {
  type AppModuleKey,
  defaultSidebarItems,
  type ISidebarNavItem,
  SidebarNav
} from './Navigation/SidebarNav';
import SupervisorTimeView from './Ocupacion/SupervisorTimeView';
import ProductividadForm from './Productividad/ProductividadForm';
import styles from './SupervisionOperaciones.module.scss';

initializeIcons(undefined, { disableWarnings: true });
ensureTechFontLoaded();

export interface ISupervisionOperacionesProps {
  currentUser: IUsuario;
  graphService: GraphService;
  onSignOut: () => void;
}

const canAccessModule = (
  moduleKey: AppModuleKey,
  userRole: RoleType
): boolean => {
  if (moduleKey === 'userAdmin') {
    return userRole === 'Master_Admin';
  }

  if (moduleKey === 'admin') {
    return userRole === 'Master_Admin' || userRole === 'Admin';
  }

  if (moduleKey === 'productividad' || moduleKey === 'Ocupacion') {
    return userRole === 'Master_Admin' ||
      userRole === 'Admin' ||
      userRole === 'Gerente' ||
      userRole === 'Supervisor';
  }

  return true;
};

const getNavigationItems = (
  userRole: RoleType
): ReadonlyArray<ISidebarNavItem> => defaultSidebarItems.filter(
  (item) => canAccessModule(item.key, userRole)
);

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
  onSignOut
}) => {
  const [usuario, setUsuario] = React.useState<IUsuario | null>(currentUser);
  const [isLoading] = React.useState<boolean>(false);
  const [errorMessage] = React.useState<string | null>(null);
  const [activeModule, setActiveModule] = React.useState<AppModuleKey>('dashboard');
  const [visibleAgents, setVisibleAgents] = React.useState<IDirectReport[]>([]);
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

  React.useEffect(() => {
    if (usuario && !canAccessModule(activeModule, usuario.rol)) {
      setActiveModule('dashboard');
    }
  }, [activeModule, usuario]);

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
        const scopedUsers =
          usuario.rol === 'Asistente' ||
          usuario.rol === 'Analista' ||
          usuario.rol === 'Oficial'
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
    if (moduleKey === activeModule) {
      moduleHeadingRef.current?.focus();
      return;
    }

    shouldFocusModuleHeadingRef.current = true;
    setActiveModule(moduleKey);
  };

  const renderActiveModule = (currentUser: IUsuario): React.ReactElement => {
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
              currentUser.rol === 'Master_Admin' || currentUser.rol === 'Admin'
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
            <PivotItem
              headerText="➕ Registro Operativo / Faltas"
              itemKey="faltas"
            >
              <FaltasForm
                availableAgents={visibleAgents}
                currentUserEmail={currentUser.email}
                currentUserName={currentUser.displayName}
                isLoadingAgents={isLoadingVisibleAgents}
                userRole={currentUser.rol}
              />
            </PivotItem>

            <PivotItem
              headerText="🌴 Registrar Ausencia / Vacaciones"
              itemKey="ausencias"
            >
              <AusenciasForm
                availableAgents={visibleAgents}
                isLoadingAgents={isLoadingVisibleAgents}
                onSaved={() => {
                  setAbsenceRefreshVersion((current) => current + 1);
                }}
              />
            </PivotItem>

            <PivotItem
              headerText="📅 Planificación Semanal de Trabajo"
              itemKey="planificacion"
            >
              <PlanificacionSemanal
                availableAgents={visibleAgents}
                isLoadingAgents={isLoadingVisibleAgents}
              />
            </PivotItem>
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
        return canAccessModule('productividad', currentUser.rol) ? (
          <ProductividadForm
            availableAgents={visibleAgents}
            currentUserEmail={currentUser.email}
            currentUserName={currentUser.displayName}
            isLoadingAgents={isLoadingVisibleAgents}
            userRole={currentUser.rol}
          />
        ) : (
          <MessageBar messageBarType={MessageBarType.blocked}>
            No tiene permisos para acceder al módulo de Productividad.
          </MessageBar>
        );

      case 'Ocupacion':
        return canAccessModule('Ocupacion', currentUser.rol) ? (
          <SupervisorTimeView
            currentUserEmail={currentUser.email}
            graphService={graphService}
          />
        ) : (
          <MessageBar messageBarType={MessageBarType.blocked}>
            No tiene permisos para acceder a Ocupación del Supervisor.
          </MessageBar>
        );

      case 'admin':
        return <AdminPanel userRole={currentUser.rol} />;

      case 'userAdmin':
        return <UserAdminPanel />;
    }
  };

  const renderContent = (): React.ReactElement => {
    if (isLoading) {
      return (
        <Stack
          className={styles.stateContainer}
          horizontalAlign="center"
          verticalAlign="center"
        >
          <Stack className={styles.stateCard} styles={glowCardStyles}>
            <Spinner
              label="Cargando identidad de Microsoft 365..."
              size={SpinnerSize.large}
            />
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

    const navigationItems = getNavigationItems(usuario.rol);
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
              <h1 className={styles.brandTitle}>Humano Ops Hub</h1>
              <span className={styles.brandSubtitle}>
                Cultura · Rendimiento · Operaciones
              </span>
            </div>
          </div>

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
              ariaLabel="Cerrar sesión"
              className={styles.signOutButton}
              iconProps={{ iconName: 'SignOut' }}
              onClick={onSignOut}
              title="Cerrar sesión"
            />
          </div>
        </header>

        <div className={styles.workspaceLayout}>
          <SidebarNav
            activeModule={activeModule}
            items={navigationItems}
            onModuleChange={handleModuleChange}
          />

          <main
            aria-labelledby="humano-ops-active-module"
            className={styles.moduleViewport}
          >
            <div className={styles.moduleHeader}>
              <span className={styles.moduleHeaderIcon} aria-hidden="true">
                <Icon iconName={currentNavigationItem.iconName} />
              </span>
              <h2
                className={styles.moduleHeaderTitle}
                id="humano-ops-active-module"
                ref={moduleHeadingRef}
                tabIndex={-1}
              >
                {currentNavigationItem.label}
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
    <SupervisionOperacionesContent {...props} />
  </ErrorBoundary>
);

export default SupervisionOperaciones;
