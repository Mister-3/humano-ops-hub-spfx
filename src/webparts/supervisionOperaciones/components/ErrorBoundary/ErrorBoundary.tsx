import * as React from 'react';

import styles from './ErrorBoundary.module.scss';

interface IErrorBoundaryProps {
  children?: React.ReactNode;
}

interface IErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  componentStack: string;
  retryKey: number;
}

const initialState: IErrorBoundaryState = {
  hasError: false,
  error: undefined,
  componentStack: '',
  retryKey: 0
};

export class ErrorBoundary extends React.Component<
  IErrorBoundaryProps,
  IErrorBoundaryState
> {
  public state: IErrorBoundaryState = initialState;

  public static getDerivedStateFromError(
    error: Error
  ): Partial<IErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  public componentDidCatch(
    error: Error,
    errorInfo: React.ErrorInfo
  ): void {
    this.setState({
      error,
      componentStack: errorInfo.componentStack || ''
    });
  }

  private readonly handleRetry = (): void => {
    this.setState((currentState: IErrorBoundaryState) => ({
      ...initialState,
      retryKey: currentState.retryKey + 1
    }));
  };

  public render(): React.ReactNode {
    const { children } = this.props;
    const {
      componentStack,
      error,
      hasError,
      retryKey
    } = this.state;

    if (!hasError) {
      return (
        <React.Fragment key={retryKey}>
          {children}
        </React.Fragment>
      );
    }

    const errorSummary = error
      ? `${error.name}: ${error.message}`
      : 'No se recibió información adicional del error.';
    const technicalDetails = componentStack
      ? `${errorSummary}\n\nÁrbol de componentes:${componentStack}`
      : errorSummary;

    return (
      <section
        className={styles.errorBoundary}
        role="alert"
        aria-live="assertive"
      >
        <div className={styles.errorCard}>
          <div className={styles.statusIcon} aria-hidden="true">
            !
          </div>

          <p className={styles.eyebrow}>Manager Hub</p>
          <h2 className={styles.title}>No pudimos mostrar esta vista</h2>
          <p className={styles.description}>
            Ocurrió un inconveniente inesperado. Puedes intentar cargar el
            módulo nuevamente sin salir del portal.
          </p>

          <button
            type="button"
            className={styles.retryButton}
            onClick={this.handleRetry}
          >
            Reintentar
          </button>

          <details className={styles.technicalDetails}>
            <summary>Ver detalle técnico</summary>
            <pre>{technicalDetails}</pre>
          </details>
        </div>
      </section>
    );
  }
}
