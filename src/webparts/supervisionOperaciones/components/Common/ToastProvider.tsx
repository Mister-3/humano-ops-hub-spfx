import * as React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface IToastItem {
  id: string;
  title?: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
}

export interface IToastContext {
  showToast: (options: Omit<IToastItem, 'id'>) => string;
  success: (message: string, title?: string) => string;
  error: (message: string, title?: string) => string;
  warning: (message: string, title?: string) => string;
  info: (message: string, title?: string) => string;
  dismissToast: (id: string) => void;
}

const ToastContext = React.createContext<IToastContext | undefined>(undefined);

const VARIANT_CONFIG: Record<ToastVariant, { icon: React.ReactNode; border: string; bg: string; bar: string }> = {
  success: {
    icon: <CheckCircle2 className="shrink-0 text-emerald-400" size={18} />,
    border: 'border-emerald-500/40',
    bg: 'bg-emerald-950/20',
    bar: 'bg-emerald-400'
  },
  error: {
    icon: <AlertCircle className="shrink-0 text-rose-400" size={18} />,
    border: 'border-rose-500/40',
    bg: 'bg-rose-950/20',
    bar: 'bg-rose-400'
  },
  warning: {
    icon: <AlertTriangle className="shrink-0 text-amber-400" size={18} />,
    border: 'border-amber-500/40',
    bg: 'bg-amber-950/20',
    bar: 'bg-amber-400'
  },
  info: {
    icon: <Info className="shrink-0 text-cyan-400" size={18} />,
    border: 'border-cyan-500/40',
    bg: 'bg-cyan-950/20',
    bar: 'bg-cyan-400'
  }
};

const ToastCard: React.FC<{ toast: IToastItem; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  const duration = toast.duration ?? 4000;
  const config = VARIANT_CONFIG[toast.variant] || VARIANT_CONFIG.info;

  React.useEffect(() => {
    if (duration <= 0) return;
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onDismiss, toast.id]);

  return (
    <div
      data-testid="toast-item"
      data-variant={toast.variant}
      className={`pointer-events-auto relative flex min-w-[320px] max-w-md items-start gap-3 overflow-hidden rounded-xl border ${config.border} bg-slate-900/95 p-3.5 shadow-2xl backdrop-blur-md transition-all duration-200 animate-fadeIn`}
    >
      <div className="mt-0.5">{config.icon}</div>
      <div className="flex-1 pr-2">
        {toast.title && (
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            {toast.title}
          </h4>
        )}
        <p className="text-xs leading-5 text-slate-300">{toast.message}</p>
      </div>
      <button
        type="button"
        aria-label="Cerrar notificación"
        className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
        onClick={() => onDismiss(toast.id)}
      >
        <X size={14} />
      </button>
      {duration > 0 && (
        <div className="absolute bottom-0 left-0 h-0.5 w-full bg-slate-800">
          <div
            className={`h-full ${config.bar} transition-all`}
            style={{
              animation: `shrinkWidth ${duration}ms linear forwards`
            }}
          />
        </div>
      )}
    </div>
  );
};

export interface IToastProviderProps {
  children: React.ReactNode;
}

export const ToastProvider: React.FC<IToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = React.useState<IToastItem[]>([]);

  const dismissToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = React.useCallback(
    (options: Omit<IToastItem, 'id'>): string => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newToast: IToastItem = { ...options, id };
      setToasts((prev) => [...prev, newToast]);
      return id;
    },
    []
  );

  const success = React.useCallback(
    (message: string, title?: string): string =>
      showToast({ message, title, variant: 'success' }),
    [showToast]
  );

  const error = React.useCallback(
    (message: string, title?: string): string =>
      showToast({ message, title, variant: 'error' }),
    [showToast]
  );

  const warning = React.useCallback(
    (message: string, title?: string): string =>
      showToast({ message, title, variant: 'warning' }),
    [showToast]
  );

  const info = React.useCallback(
    (message: string, title?: string): string =>
      showToast({ message, title, variant: 'info' }),
    [showToast]
  );

  const value = React.useMemo<IToastContext>(
    () => ({
      showToast,
      success,
      error,
      warning,
      info,
      dismissToast
    }),
    [showToast, success, error, warning, info, dismissToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        data-testid="toast-container"
        className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): IToastContext => {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast debe ser utilizado dentro de un ToastProvider');
  }
  return context;
};

export default ToastProvider;
