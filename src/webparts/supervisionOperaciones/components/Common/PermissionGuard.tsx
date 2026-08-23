import * as React from 'react';
import { Icon, Spinner, SpinnerSize } from '@fluentui/react';

import { useRBAC } from '../../../../auth/RBACContext';

export const NoAccessMessage: React.FC<{ detail?: string }> = ({ detail }) => (
  <section
    aria-live="polite"
    className="bg-slate-900/95 border border-slate-800 text-white rounded-2xl shadow-2xl backdrop-blur-md p-8 text-center"
    role="status"
  >
    <Icon className="text-amber-400 text-3xl" iconName="Blocked2" />
    <h3 className="mt-3 text-xl font-semibold">Acceso restringido</h3>
    <p className="mt-2 text-sm text-slate-400">
      {detail || 'Tu cuenta no posee el permiso requerido para esta función.'}
    </p>
  </section>
);

export interface IPermissionGuardProps {
  children?: React.ReactNode;
  fallback?: React.ReactNode;
  permission: string;
}

export const PermissionGuard: React.FC<IPermissionGuardProps> = ({
  children,
  fallback = <NoAccessMessage />,
  permission
}) => {
  const { hasPermission, loading } = useRBAC();
  if (loading) {
    return (
      <div className="bg-slate-900/95 border border-slate-800 text-white rounded-2xl shadow-2xl backdrop-blur-md p-8">
        <Spinner label="Validando permisos..." size={SpinnerSize.large} />
      </div>
    );
  }
  return hasPermission(permission) ? <>{children}</> : <>{fallback}</>;
};

export default PermissionGuard;
