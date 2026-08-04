# Technical Context & Architecture - HumanoOpsHub

## Stack Tecnológico
- **Frontend**: React + TypeScript + Vite + Fluent UI + SCSS
- **Hosting**: Vercel
- **Cloud DB & Auth**: Supabase (`@supabase/supabase-js`)
- **Adaptador de Datos**: `CloudDbClient.ts` (con fallback asíncrono a `IndexedDbAdapter.ts`)
- **Integración Background**: Power Automate + Excel (`.xlsx` / `AppDB.xlsx`) + SharePoint Lists

## Servicios de Datos y Persistencia
1. **Cliente Supabase (`src/services/supabase.ts`)**:
   - Inicializado mediante `@supabase/supabase-js` leyendo `import.meta.env.VITE_SUPABASE_URL` y `import.meta.env.VITE_SUPABASE_ANON_KEY`.
2. **Adaptador Cloud DB (`src/services/CloudDbClient.ts`)**:
   - Implementa funciones asíncronas CRUD sobre Supabase con prioridad Cloud y fallback local a `IndexedDbAdapter`:
     - `getUsuarios()`, `createUsuario()`, `updateUsuarioStatus()`
     - `getFaltas()`, `createFalta()`
     - `getKudos()`, `createKudo()`
3. **Autenticación y Sesión (`src/auth/AuthService.ts`)**:
   - Inicio de sesión con verificación de credencial fija (`HumSupHub8890-`) para las cuentas de Master Admin (`admin@humano.com.do` / `3urek4.ventalm@gmail.com`), permitiendo la generación al vuelo del objeto de perfil si no existe en la base de datos.
   - Autenticación general de usuarios mediante consulta directa a la tabla `usuarios` en Supabase.

## Esquema de Tablas (Supabase)
- **`usuarios`**: `id`, `email`, `nombre`, `rol`, `estado`, `is_profile_validated_pa`, `fecha_registro`, `password_hash`
- **`faltas`**: `id`, `email_empleado`, `motivo`, `id_caso_helpdesk`, `horas_perdidas`, `minutos_tardanza`, `fecha`, `impacto`, `estado`, `estado_aprobacion`
- **`kudos`**: `id`, `email_destino`, `email_origen`, `motivo`, `puntos`, `fecha`

## Sección de Sincronización Administrativa
- **Ubicación**: Restringida dentro del Panel de Administración (`src/webparts/supervisionOperaciones/components/Admin/AdminPanel.tsx`).
- **Motor**: `PowerAutomateSyncService.ts`.
- **Funcionalidad**:
  - **Exportar a Excel / Power Automate**: Genera el paquete delta `AppDB.xlsx` / JSON consultando datos frescos de Supabase vía `CloudDbClient`.
  - **Importar respuesta (.xlsx / .json)**: Procesa la respuesta enviada por Power Automate/OneDrive y actualiza directamente en Supabase el estado del usuario (`IsProfileValidatedByPA`, `Pending_Admin_Approval`, `Active`).

## Directivas de Código y Despliegue
- **Despliegues**: Manuales vía terminal (`git push` + `npx vercel --prod --yes`).
- **Compilación**: Verificación TypeScript mediante `npm run build` (`tsc -p tsconfig.app.json && vite build`).