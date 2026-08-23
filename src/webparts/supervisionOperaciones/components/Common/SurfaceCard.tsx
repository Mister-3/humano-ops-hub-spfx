import * as React from 'react';

export type SurfaceCardElevation = 'flat' | 'raised';

export interface ISurfaceCardProps {
  children: React.ReactNode;
  className?: string;
  elevation?: SurfaceCardElevation;
}

const ELEVATION_CLASSES: Record<SurfaceCardElevation, string> = {
  flat: 'shadow-none',
  raised: 'shadow-xl'
};

export const SurfaceCard: React.FC<ISurfaceCardProps> = ({
  children,
  className = '',
  elevation = 'raised'
}) => (
  <div
    className={`rounded-2xl border border-slate-800 bg-slate-900/90 ${ELEVATION_CLASSES[elevation]} ${className}`.trim()}
    data-elevation={elevation}
  >
    {children}
  </div>
);

export default SurfaceCard;
