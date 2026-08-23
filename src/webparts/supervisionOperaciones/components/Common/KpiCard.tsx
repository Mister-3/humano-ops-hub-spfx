import * as React from 'react';

export type KpiCardVariant =
  | 'default'
  | 'cyan'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'purple';

export interface IKpiCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: React.ReactNode;
  variant?: KpiCardVariant;
}

const VARIANT_STYLES: Record<KpiCardVariant, { accent: string; icon: string }> = {
  default: {
    accent: 'bg-slate-500',
    icon: 'border-slate-700 bg-slate-800 text-slate-300'
  },
  cyan: {
    accent: 'bg-cyan-500',
    icon: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
  },
  emerald: {
    accent: 'bg-emerald-500',
    icon: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
  },
  amber: {
    accent: 'bg-amber-500',
    icon: 'border-amber-500/30 bg-amber-500/10 text-amber-300'
  },
  rose: {
    accent: 'bg-rose-500',
    icon: 'border-rose-500/30 bg-rose-500/10 text-rose-300'
  },
  purple: {
    accent: 'bg-purple-500',
    icon: 'border-purple-500/30 bg-purple-500/10 text-purple-300'
  }
};

export const KpiCard: React.FC<IKpiCardProps> = ({
  label,
  value,
  subtext,
  icon,
  variant = 'default'
}) => {
  const styles = VARIANT_STYLES[variant];

  return (
    <article
      className="min-h-[110px] rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl"
      data-variant={variant}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {label}
          </p>
          <p className="mt-1 text-3xl font-bold text-white">{value}</p>
          {subtext && <p className="mt-1 text-xs text-slate-400">{subtext}</p>}
        </div>
        {icon && (
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-lg ${styles.icon}`}
          >
            {icon}
          </span>
        )}
      </div>
      <span
        aria-hidden="true"
        className={`mt-4 block h-1 w-10 rounded-full ${styles.accent}`}
      />
    </article>
  );
};

export default KpiCard;
