import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_QA_PROJECT_ID = 'xoevilnaffroexyhfhze';
export const SUPABASE_PRODUCTION_PROJECT_ID = 'hjvzinpdzexkgmmlpwwr';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const supabaseConfigurationError: string | null =
  !supabaseUrl || !supabaseAnonKey
    ? import.meta.env.PROD
      ? 'Faltan las variables VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en la configuración de Vercel.'
      : 'Faltan variables de entorno QA en .env.local.'
    : import.meta.env.DEV && !supabaseUrl.includes(SUPABASE_QA_PROJECT_ID)
      ? `Entorno local bloqueado: VITE_SUPABASE_URL debe apuntar exclusivamente a QA (${SUPABASE_QA_PROJECT_ID}).`
      : null;

export const supabaseEnvironment: 'qa' | 'production' | 'unknown' =
  supabaseUrl?.includes(SUPABASE_QA_PROJECT_ID)
    ? 'qa'
    : supabaseUrl?.includes(SUPABASE_PRODUCTION_PROJECT_ID)
      ? 'production'
      : 'unknown';

if (supabaseConfigurationError) {
  console.error(`[Supabase] ${supabaseConfigurationError}`);
} else {
  console.info(`[Supabase] Conectado a: ${supabaseUrl}`);
}

export const isSupabaseConfigured = (): boolean => {
  return supabaseConfigurationError === null;
};

const unavailableSupabaseClient = new Proxy({} as SupabaseClient, {
  get: () => () => {
    throw new Error(
      supabaseConfigurationError || 'El cliente de Supabase no está disponible.'
    );
  }
});

export const supabase: SupabaseClient = supabaseConfigurationError
  ? unavailableSupabaseClient
  : createClient(supabaseUrl as string, supabaseAnonKey as string);

export default supabase;
