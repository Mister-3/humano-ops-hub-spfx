import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');

  if (command === 'serve') {
    if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
      console.error(
        '[Vite] Faltan variables de entorno QA en .env.local. La aplicación mostrará una pantalla de configuración.'
      );
    } else if (!env.VITE_SUPABASE_URL.includes('xoevilnaffroexyhfhze')) {
      throw new Error(
        'Entorno local bloqueado: VITE_SUPABASE_URL debe apuntar exclusivamente a QA (xoevilnaffroexyhfhze).'
      );
    } else {
      console.info(`[Vite] Supabase QA URL: ${env.VITE_SUPABASE_URL}`);
    }
  }

  return {
    envPrefix: 'VITE_',
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      target: 'es2020',
      chunkSizeWarningLimit: 1100
    },
    server: {
      host: true,
      port: 5173
    }
  };
});
