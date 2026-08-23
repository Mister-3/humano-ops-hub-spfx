import * as React from 'react';

export type StatusBadgeVariant =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'role'
  | 'neutral';

export type StatusBadgeSize = 'sm' | 'md';

export interface IStatusBadgeProps {
  children: React.ReactNode;
  variant: StatusBadgeVariant;
  size?: StatusBadgeSize;
  className?: string;
}

const VARIANT_CLASSES: Record<StatusBadgeVariant, string> = {
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  danger: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  info: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  role: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
  neutral: 'border-slate-700 bg-slate-800 text-slate-300'
};

const SIZE_CLASSES: Record<StatusBadgeSize, string> = {
  sm: 'px-2.5 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm'
};

export const StatusBadge: React.FC<IStatusBadgeProps> = ({
  children,
  variant,
  size = 'sm',
  className = ''
}) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`.trim()}
    data-variant={variant}
  >
    {children}
  </span>
);

export default StatusBadge;
