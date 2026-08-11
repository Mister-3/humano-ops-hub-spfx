import * as React from 'react';
import * as ReactDOM from 'react-dom';

import App from './App';
import { AuthProvider } from './auth/AuthProvider';
import { supabaseConfigurationError } from './services/supabase';
import './styles.css';

const application = supabaseConfigurationError ? (
  <main className="configurationErrorScreen" role="alert">
    <section className="configurationErrorCard">
      <div className="configurationErrorIcon" aria-hidden="true">⚙️</div>
      <p className="configurationErrorEyebrow">Configuración requerida</p>
      <h1>No pudimos conectar Humano Ops Hub</h1>
      <p>{supabaseConfigurationError}</p>
      <p className="configurationErrorHelp">
        Verifica las variables de entorno de Supabase y vuelve a cargar la aplicación.
        Si el problema continúa, contacta al administrador de la plataforma.
      </p>
    </section>
  </main>
) : (
  <AuthProvider>
    <App />
  </AuthProvider>
);

ReactDOM.render(
  <React.StrictMode>
    {application}
  </React.StrictMode>,
  document.getElementById('root')
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
