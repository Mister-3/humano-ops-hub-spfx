import * as React from 'react';

export interface IEmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<IEmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = ''
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800/80 bg-slate-900/40 p-8 text-center ${className}`.trim()}
      data-testid="empty-state"
    >
      {icon && (
        <div
          aria-hidden="true"
          className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700/50 bg-slate-800/60 text-slate-400 shadow-inner"
        >
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-slate-200">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-slate-400">{description}</p>
      )}
      {action && <div className="mt-4 flex items-center justify-center">{action}</div>}
    </div>
  );
};

export default EmptyState;
