import * as React from 'react';
import {
  getDevMockRoleSlug,
  setDevMockRole,
  isDevEnvironment,
  DEV_MOCK_STORAGE_KEY
} from '../../../../auth/devMockUsers';
import { CANONICAL_ROLES, ROLE_SLUGS, type RoleSlug } from '../../../../types';

export const DevRoleSwitcher: React.FC = () => {
  // Solo se renderiza en entorno de desarrollo
  if (!isDevEnvironment()) {
    return null;
  }

  const [activeRole, setActiveRole] = React.useState<RoleSlug | 'none'>(() => {
    return getDevMockRoleSlug() || 'admin';
  });
  const [isMinimized, setIsMinimized] = React.useState<boolean>(false);

  React.useEffect(() => {
    const handleRoleChange = () => {
      const current = getDevMockRoleSlug();
      setActiveRole(current || 'none');
    };

    window.addEventListener('ops-dev-role-change', handleRoleChange);
    window.addEventListener('storage', (event) => {
      if (event.key === DEV_MOCK_STORAGE_KEY) {
        handleRoleChange();
      }
    });

    return () => {
      window.removeEventListener('ops-dev-role-change', handleRoleChange);
    };
  }, []);

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    if (value === 'none') {
      setDevMockRole(null);
      setActiveRole('none');
    } else {
      setDevMockRole(value);
      setActiveRole(value as RoleSlug);
    }
  };

  if (isMinimized) {
    return (
      <aside
        aria-label="Selector de rol de desarrollo minimizado"
        className="fixed bottom-4 left-4 z-[9999]"
      >
        <button
          className="flex items-center gap-1.5 rounded-full border border-cyan-500/40 bg-slate-900/95 px-3 py-1.5 text-[11px] font-bold text-cyan-400 shadow-2xl backdrop-blur-md transition-all hover:bg-slate-800 hover:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          onClick={() => setIsMinimized(false)}
          title="Desplegar Dev Auth Switcher"
          type="button"
        >
          <span>⚡</span>
          <span>DEV ROLES</span>
        </button>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Panel flotante de bypass de autenticación para desarrollo"
      className="fixed bottom-4 left-4 z-[9999] flex items-center gap-2.5 rounded-2xl border border-cyan-500/40 bg-slate-900/95 p-2.5 text-xs text-white shadow-2xl backdrop-blur-md transition-all md:text-sm"
    >
      <div className="flex items-center gap-1.5">
        <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
        <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300">
          Dev Auth Bypass
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <label htmlFor="dev-role-select" className="sr-only">
          Seleccionar Rol Mock
        </label>
        <select
          id="dev-role-select"
          aria-label="Rol simulado de desarrollo"
          className="rounded-xl border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs font-semibold text-slate-100 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
          onChange={handleChange}
          value={activeRole}
        >
          {CANONICAL_ROLES.map((roleName) => {
            const slug = ROLE_SLUGS[roleName];
            return (
              <option key={slug} value={slug} className="bg-slate-900 text-white">
                Rol: {roleName}
              </option>
            );
          })}
          <option value="none" className="bg-slate-900 text-amber-300">
            ⛔ Desactivar (Login Real)
          </option>
        </select>
      </div>

      <button
        aria-label="Minimizar panel de desarrollo"
        className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
        onClick={() => setIsMinimized(true)}
        title="Minimizar panel"
        type="button"
      >
        ✕
      </button>
    </aside>
  );
};

export default DevRoleSwitcher;
