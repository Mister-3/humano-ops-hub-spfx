import * as React from 'react';
import { AlignJustify, List } from 'lucide-react';

export type TableDensity = 'compact' | 'comfortable';

const DENSITY_STORAGE_KEY = 'ops_table_density';

export const useDataDensity = (
  defaultDensity: TableDensity = 'comfortable'
): [TableDensity, (density: TableDensity) => void] => {
  const [density, setDensityState] = React.useState<TableDensity>(() => {
    try {
      const stored = localStorage.getItem(DENSITY_STORAGE_KEY);
      if (stored === 'compact' || stored === 'comfortable') {
        return stored;
      }
    } catch {
      // Ignorar errores de storage
    }
    return defaultDensity;
  });

  const setDensity = React.useCallback((newDensity: TableDensity) => {
    setDensityState(newDensity);
    try {
      localStorage.setItem(DENSITY_STORAGE_KEY, newDensity);
    } catch {
      // Ignorar errores de storage
    }
  }, []);

  return [density, setDensity];
};

export interface IDataDensityToggleProps {
  density: TableDensity;
  onChange: (density: TableDensity) => void;
  className?: string;
}

export const DataDensityToggle: React.FC<IDataDensityToggleProps> = ({
  density,
  onChange,
  className = ''
}) => {
  return (
    <div
      className={`inline-flex items-center rounded-xl border border-slate-700/80 bg-slate-900/80 p-0.5 text-xs font-semibold text-slate-300 shadow-inner ${className}`.trim()}
      role="group"
      aria-label="Selector de densidad de datos"
    >
      <button
        type="button"
        onClick={() => onChange('comfortable')}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-all ${
          density === 'comfortable'
            ? 'bg-cyan-500 text-slate-950 shadow-sm font-bold'
            : 'text-slate-400 hover:text-slate-200'
        }`}
        title="Vista Cómoda (Espaciado estándar)"
        aria-pressed={density === 'comfortable'}
      >
        <AlignJustify size={14} />
        <span>Cómoda</span>
      </button>

      <button
        type="button"
        onClick={() => onChange('compact')}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-all ${
          density === 'compact'
            ? 'bg-cyan-500 text-slate-950 shadow-sm font-bold'
            : 'text-slate-400 hover:text-slate-200'
        }`}
        title="Vista Compacta (Alta densidad para 500+ registros)"
        aria-pressed={density === 'compact'}
      >
        <List size={14} />
        <span>Compacta</span>
      </button>
    </div>
  );
};

export default DataDensityToggle;
