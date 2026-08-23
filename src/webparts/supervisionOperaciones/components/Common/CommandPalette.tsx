import * as React from 'react';
import {
  Award,
  Calendar,
  CheckSquare,
  Clock,
  Code2,
  FileSpreadsheet,
  HelpCircle,
  History,
  Home,
  Layers,
  Lightbulb,
  Search,
  Settings,
  Shield,
  UserCheck,
  Users,
  X
} from 'lucide-react';
import type { AppModuleKey } from '../Navigation/SidebarNav';

export interface ICommandItem {
  id: string;
  title: string;
  category: 'Navegación' | 'Acciones' | 'Desarrollo';
  subtitle?: string;
  icon: React.ReactNode;
  keywords?: string[];
  onSelect: () => void;
}

export interface ICommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (moduleKey: AppModuleKey) => void;
  onSwitchDevRole?: (roleSlug: string) => void;
}

export const CommandPalette: React.FC<ICommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onSwitchDevRole
}) => {
  const [search, setSearch] = React.useState('');
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  // Focus input when opened
  React.useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Global shortcut Cmd+K / Ctrl+K & Escape
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Open trigger can be handled outside or toggled
        }
      }
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const items = React.useMemo<ICommandItem[]>(() => {
    const list: ICommandItem[] = [
      // Navegación
      {
        id: 'nav-dashboard',
        title: 'Dashboard General',
        subtitle: 'Métricas consolidadas, ranking general y KPIs',
        category: 'Navegación',
        icon: <Home size={16} className="text-cyan-400" />,
        keywords: ['inicio', 'home', 'ranking', 'kpi', 'resumen'],
        onSelect: () => {
          onNavigate('dashboard');
          onClose();
        }
      },
      {
        id: 'nav-endtoend',
        title: 'Custodia End-to-End',
        subtitle: 'SLA operativo, fotogramas y gestión de radicaciones',
        category: 'Navegación',
        icon: <Layers size={16} className="text-cyan-400" />,
        keywords: ['radicaciones', 'sla', 'lotes', 'fotografias', 'emisiones', 'cancelaciones'],
        onSelect: () => {
          onNavigate('endToEnd');
          onClose();
        }
      },
      {
        id: 'nav-faltas',
        title: 'Oportunidades y Ausencias',
        subtitle: 'Registro de faltas, retardos y licencias médicas',
        category: 'Navegación',
        icon: <FileSpreadsheet size={16} className="text-amber-400" />,
        keywords: ['faltas', 'ausencias', 'tardanzas', 'permisos', 'licencias'],
        onSelect: () => {
          onNavigate('faltas');
          onClose();
        }
      },
      {
        id: 'nav-productividad',
        title: 'Captura de Productividad',
        subtitle: 'Ingreso diario de transacciones, emisiones y páginas',
        category: 'Navegación',
        icon: <CheckSquare size={16} className="text-emerald-400" />,
        keywords: ['productividad', 'transacciones', 'escaneo', 'movimientos', 'casos'],
        onSelect: () => {
          onNavigate('productividad');
          onClose();
        }
      },
      {
        id: 'nav-kudos',
        title: 'Kudos y Reconocimientos',
        subtitle: 'Entrega de medallas y reconocimientos entre pares',
        category: 'Navegación',
        icon: <Award size={16} className="text-purple-400" />,
        keywords: ['kudos', 'medallas', 'reconocimiento', 'puntos'],
        onSelect: () => {
          onNavigate('kudos');
          onClose();
        }
      },
      {
        id: 'nav-mejoras',
        title: 'Historias de Usuario e Iniciativas',
        subtitle: 'Gestión ágil de oportunidades de mejora y proyectos',
        category: 'Navegación',
        icon: <Lightbulb size={16} className="text-amber-400" />,
        keywords: ['iniciativas', 'mejoras', 'historias', 'user stories', 'agil', 'scrum'],
        onSelect: () => {
          onNavigate('mejoras');
          onClose();
        }
      },
      {
        id: 'nav-ocupacion',
        title: 'Tiempos de Ocupación',
        subtitle: 'Control y registro de llamadas y horas de supervisión',
        category: 'Navegación',
        icon: <Clock size={16} className="text-cyan-400" />,
        keywords: ['ocupacion', 'llamadas', 'tiempo', 'supervisores'],
        onSelect: () => {
          onNavigate('Ocupacion');
          onClose();
        }
      },
      {
        id: 'nav-evaluacion',
        title: 'Evaluación de Rendimiento',
        subtitle: 'Analíticas y desempeño histórico de colaboradores',
        category: 'Navegación',
        icon: <UserCheck size={16} className="text-emerald-400" />,
        keywords: ['evaluacion', 'rendimiento', 'desempeno', 'metricas'],
        onSelect: () => {
          onNavigate('Evaluacion');
          onClose();
        }
      },
      {
        id: 'nav-admin',
        title: 'Panel de Administración',
        subtitle: 'Configuración de pesos, penalidades y gobierno RBAC',
        category: 'Navegación',
        icon: <Settings size={16} className="text-rose-400" />,
        keywords: ['admin', 'administracion', 'roles', 'permisos', 'penalidades', 'usuarios'],
        onSelect: () => {
          onNavigate('admin');
          onClose();
        }
      },
      {
        id: 'nav-ayuda',
        title: 'Centro de Ayuda & Changelog',
        subtitle: 'Guía de uso, catálogo de módulos y notas de versión',
        category: 'Navegación',
        icon: <HelpCircle size={16} className="text-cyan-400" />,
        keywords: ['ayuda', 'changelog', 'versiones', 'acerca de', 'manual', 'documentacion'],
        onSelect: () => {
          onNavigate('ayuda');
          onClose();
        }
      },

      // Acciones rápidas
      {
        id: 'action-new-story',
        title: 'Redactar nueva Historia de Usuario',
        subtitle: 'Crear una solicitud ágil de mejora para la operación',
        category: 'Acciones',
        icon: <Lightbulb size={16} className="text-amber-300" />,
        keywords: ['crear', 'nueva historia', 'redactar', 'mejora', 'iniciativa'],
        onSelect: () => {
          onNavigate('mejoras');
          onClose();
        }
      },
      {
        id: 'action-audit-absences',
        title: 'Planificación Semanal de Ausencias',
        subtitle: 'Consultar matriz de capacidad neta y cobertura diaria',
        category: 'Acciones',
        icon: <Calendar size={16} className="text-cyan-300" />,
        keywords: ['planificacion', 'cobertura', 'capacidad', 'ausencias', 'semanal'],
        onSelect: () => {
          onNavigate('faltas');
          onClose();
        }
      },
      {
        id: 'action-view-changelog',
        title: 'Consultar Historial de Versiones',
        subtitle: 'Ver últimas correcciones, mejoras y arquitectura',
        category: 'Acciones',
        icon: <History size={16} className="text-emerald-300" />,
        keywords: ['versiones', 'historial', 'changelog', 'actualizaciones', 'release notes'],
        onSelect: () => {
          onNavigate('ayuda');
          onClose();
        }
      }
    ];

    // Dev Tools
    if (import.meta.env.DEV || Boolean(onSwitchDevRole)) {
      const devRoles = [
        { slug: 'admin', label: 'Administrador (Acceso Total)' },
        { slug: 'gerente', label: 'Gerente Operativo' },
        { slug: 'supervisor', label: 'Supervisor de Área' },
        { slug: 'asistente', label: 'Asistente Operativo' },
        { slug: 'agente', label: 'Agente / Colaborador' }
      ];

      devRoles.forEach((r) => {
        list.push({
          id: `dev-role-${r.slug}`,
          title: `Dev: Conmutar Rol a ${r.label}`,
          subtitle: `Simular experiencia de usuario con perfil '${r.slug}'`,
          category: 'Desarrollo',
          icon: <Code2 size={16} className="text-purple-400" />,
          keywords: ['dev', 'rol', 'mock', 'switch', r.slug],
          onSelect: () => {
            if (onSwitchDevRole) {
              onSwitchDevRole(r.slug);
            } else {
              localStorage.setItem('ops_dev_mock_role', r.slug);
              window.location.reload();
            }
            onClose();
          }
        });
      });
    }

    return list;
  }, [onClose, onNavigate, onSwitchDevRole]);

  // Filter items
  const filteredItems = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;

    return items.filter((item) => {
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchSub = item.subtitle?.toLowerCase().includes(q);
      const matchKey = item.keywords?.some((k) => k.toLowerCase().includes(q));
      return matchTitle || matchSub || matchKey;
    });
  }, [items, search]);

  // Adjust selection bounds
  React.useEffect(() => {
    if (selectedIndex >= filteredItems.length) {
      setSelectedIndex(Math.max(0, filteredItems.length - 1));
    }
  }, [filteredItems.length, selectedIndex]);

  // Keyboard navigation inside list
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].onSelect();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center bg-slate-950/80 p-4 pt-16 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
      data-testid="command-palette-overlay"
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl shadow-cyan-950/20 transition-all"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Paleta de Comandos - Manager Hub"
      >
        {/* Search Header */}
        <div className="flex items-center border-b border-slate-800 px-4 py-3.5">
          <Search size={18} className="mr-3 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 outline-none"
            placeholder="Escribe un comando o busca en Manager Hub... (ej: radicaciones, métricas, rol)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            data-testid="command-palette-input"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="mr-2 rounded-lg p-1 text-slate-400 hover:text-slate-200"
            >
              <X size={14} />
            </button>
          )}
          <kbd className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-400">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          className="max-h-[380px] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-800"
          data-testid="command-palette-list"
        >
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No se encontraron comandos ni módulos para &ldquo;{search}&rdquo;
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  data-testid={`command-item-${item.id}`}
                  data-selected={isSelected}
                  onClick={item.onSelect}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex cursor-pointer items-center justify-between rounded-xl px-3.5 py-2.5 transition-colors ${
                    isSelected
                      ? 'bg-cyan-500/10 text-cyan-200 border border-cyan-500/30'
                      : 'text-slate-300 hover:bg-slate-800/60 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-950/60">
                      {item.icon}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-200">
                        {item.title}
                      </div>
                      {item.subtitle && (
                        <div className="text-[11px] text-slate-400">
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="rounded-full border border-slate-700/60 bg-slate-800/60 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                    {item.category}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between border-t border-slate-800/80 bg-slate-950/60 px-4 py-2 text-[11px] text-slate-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-slate-700 bg-slate-800 px-1 py-0.5 font-mono">↑</kbd>
              <kbd className="rounded border border-slate-700 bg-slate-800 px-1 py-0.5 font-mono">↓</kbd>
              Navegar
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 font-mono">↵</kbd>
              Ejecutar
            </span>
          </div>
          <span>Atajo global: <kbd className="font-mono text-cyan-400">⌘K</kbd></span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
