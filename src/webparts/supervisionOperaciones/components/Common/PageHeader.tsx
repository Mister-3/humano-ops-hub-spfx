import * as React from 'react';

export interface IPageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  action?: React.ReactNode;
}

export const PageHeader: React.FC<IPageHeaderProps> = ({
  title,
  subtitle,
  icon,
  badge,
  action
}) => (
  <header className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl md:flex-row md:items-center md:justify-between">
    <div className="flex min-w-0 items-start gap-4">
      {icon && (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-xl text-cyan-300">
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="m-0 text-2xl font-bold text-white">{title}</h1>
          {badge && <div className="shrink-0">{badge}</div>}
        </div>
        {subtitle && (
          <p className="mt-1 text-sm leading-6 text-slate-400">{subtitle}</p>
        )}
      </div>
    </div>
    {action && <div className="flex shrink-0 items-center gap-3">{action}</div>}
  </header>
);

export default PageHeader;
