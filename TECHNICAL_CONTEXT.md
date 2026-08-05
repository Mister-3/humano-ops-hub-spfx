# Technical Context & Architecture - HumanoOpsHub

## 1. Stack Tecnológico
- **Frontend Framework**: React 18 + TypeScript + Vite
- **UI Components & Styling**: Fluent UI (`@fluentui/react`) + SCSS Modules
- **Cloud Database & Auth**: Supabase (`@supabase/supabase-js`)
- **Local Persistence & Cache**: IndexedDB (vía `IndexedDbAdapter.ts`)
- **Data Integration & Excel**: ExcelJS + JSZip (vía `PowerAutomateSyncService.ts`)
- **Hosting & Deployment**: Vercel (`npx vercel --prod --yes`)

---

## 2. Arquitectura de Datos y Estrategia Híbrida (Online-First)

El sistema opera bajo un patrón **Online-First con Resiliencia Local**:
- **Almacenamiento Primario**: Supabase en la nube es la fuente principal de verdad para `usuarios`, `faltas` y `kudos`.
- **Adaptador Unificado (`CloudDbClient.ts`)**: Encapsula las operaciones de lectura y escritura.
- **Inserción Síncrona Segura**: Al registrar nuevos usuarios o crear entidades, las peticiones se envían de forma síncrona primero a Supabase. Si la nube retorna un error (e.g., violación de políticas RLS o esquemas), la transacción se aborta arrojando una excepción clara (`[CRITICAL SUPABASE INSERT ERROR]`).
- **Resiliencia & Fallback (`IndexedDbAdapter.ts`)**: Si no hay conexión o si Supabase está desconfigurado, el adaptador conmuta hacia `IndexedDB` (`LOCAL_STORES.users`, `LOCAL_STORES.faltas`, `LOCAL_STORES.kudos`) garantizando disponibilidad.
- **Prevención de Duplicados & Lecturas Limpias**: En la lectura de datos (`getKudos`, `getFaltas`), si Supabase responde exitosamente, se priorizan y utilizan exclusivamente sus registros, aplicando desduplicación por `id`, `audit_id` o firma compuesta.

---

## 3. Esquemas de Base de Datos y Tipos TypeScript

### 3.1. Enums y Tipos Principales (`AuthModels.ts` & `AppModels.ts`)
```typescript
export type AppUserRole =
  | 'Master_Admin'
  | 'Admin'
  | 'Gerente'
  | 'Supervisor'
  | 'Analista'
  | 'Asistente'
  | 'Agente'
  | 'Oficial';

export type AppUserStatus =
  | 'Pending_Validation'
  | 'Pending_Admin_Approval'
  | 'Active'
  | 'Disabled'
  | 'Rejected';
```

### 3.2. Estructura de Tablas en Supabase & Modelos TypeScript

#### Tabla `usuarios` (`ISupabaseUserRow` / `IAppUserRecord`)
| Campo | Tipo SQL | Descripción |
| :--- | :--- | :--- |
| `id` | `bigint / serial` (PK) | Identificador numérico único auto-incremental. |
| `email` | `text` (Unique) | Correo corporativo del colaborador. |
| `nombre` | `text` | Nombre completo del usuario. |
| `rol` | `text` | Rol asignado (`'Agente'`, `'Supervisor'`, `'Admin'`, `'Master_Admin'`). |
| `estado` | `text` | Estado de aprobación (`'Active'`, `'Pending_Admin_Approval'`, `'Disabled'`). |
| `is_profile_validated_pa`| `boolean` | Indica si el perfil fue validado vía Power Automate / Entra ID. |
| `fecha_registro` | `timestamptz` | Fecha de creación del registro. |
| `password_hash` | `text` | Hash de la contraseña local. |

#### Tabla `faltas` (`ISupabaseFaltaRow` / `IFalta`)
| Campo | Tipo SQL | Descripción |
| :--- | :--- | :--- |
| `id` | `bigint` (PK) | Identificador principal de la falta. |
| `audit_id` | `text` | Código de auditoría único (`ALT-XXXXXXXX`). |
| `email_empleado` | `text` | Correo del colaborador infractor. |
| `motivo` | `text` | Descripción o categoría de la incidencia. |
| `id_caso_helpdesk` | `text` | Ticket de soporte asociado. |
| `horas_perdidas` | `integer` | Horas no laboradas. |
| `minutos_tardanza` | `integer` | Minutos de tardanza acumulados. |
| `fecha` | `timestamptz` | Fecha de la falta. |
| `impacto` | `text` | Nivel de impacto (`Bajo`, `Medio`, `Alto`). |
| `estado_aprobacion` | `text` | Estado del trámite (`Pendiente`, `Aprobado`, `Rechazado`). |
| `synced_to_sharepoint` | `boolean` | Bandera de sincronización masiva a SharePoint. |

#### Tabla `kudos` (`ISupabaseKudoRow` / `IKudo`)
| Campo | Tipo SQL | Descripción |
| :--- | :--- | :--- |
| `id` | `bigint` (PK) | Identificador único del reconocimiento. |
| `audit_id` | `text` | Código de auditoría único. |
| `email_destino` | `text` | Correo del colaborador reconocido. |
| `email_origen` | `text` | Correo de quien otorga el Kudo. |
| `motivo` | `text` | Razón o mensaje del reconocimiento. |
| `puntos` | `integer` | Puntuación asignada. |
| `fecha` | `timestamptz` | Marca de tiempo del otorgamiento. |

---

## 4. Capa de Autenticación (`AuthService.ts`)

- **Bypass de Master Admin**:
  - Correos autorizados: `admin@humano.com.do` y `3urek4.ventalm@gmail.com`.
  - Contraseña fija de contingencia: `HumSupHub8890-`.
  - Cuando un Master Admin inicia sesión con la contraseña fija, el sistema verifica su existencia en la tabla `usuarios`. Si no existe fila previa en Supabase, genera al vuelo el registro con `Rol: 'Master_Admin'` y `Estado: 'Active'`.
- **Normalización de Roles**:
  - Para evitar discrepancias entre strings como `'Master Admin'` (con espacio) y `'Master_Admin'` (con guion bajo), la función auxiliar `isMasterAdminRole()` limpia y normaliza el rol a minúsculas antes de evaluar los permisos en vistas de UI (`UserAdminPanel.tsx`, `App.tsx`).
- **Control de Sesiones**:
  - Almacena el token y correo activo en `sessionStorage` y valida la firma mediante hashes digestivos.

---

## 5. Estructura de Componentes y Vistas Principales

```
src/
├── App.tsx                                 # Enrutador principal, verificación de sesión y renderizado del Sidebar filtrado por rol.
├── auth/
│   ├── AuthService.ts                      # Servicio centralizado de Autenticación, Registro y Sesiones.
│   ├── AuthProvider.tsx                    # Context React de Autenticación.
│   └── AuthView.tsx                        # Formularios de Login y Registro Corporativo.
├── services/
│   ├── supabase.ts                         # Inicialización del cliente Supabase JS.
│   ├── CloudDbClient.ts                    # Adaptador Nube/Local CRUD con desduplicación.
│   ├── IndexedDbAdapter.ts                 # Motor de base de datos local IndexedDB.
│   └── PowerAutomateSyncService.ts         # Generación y procesamiento de paquetes AppDB.xlsx / JSON.
└── webparts/supervisionOperaciones/
    ├── components/
    │   ├── Admin/
    │   │   ├── AdminPanel.tsx              # Contenedor del Panel de Administración.
    │   │   ├── UserAdminPanel.tsx          # Gestión de Usuarios, Aprobación de Pendientes y Cambio de Roles.
    │   │   └── AdminSyncSection.tsx        # Sección exclusiva de Sincronización Entra ID & SharePoint.
    │   ├── Faltas/FaltasModule.tsx         # Gestión operativa de incidencias.
    │   └── Kudos/KudosModule.tsx           # Reconocimientos, historial y métricas.
    └── models/AppModels.ts                 # Interfaces de dominio y tipos compartidos.
```

---

## 6. Servicios de Integración

### 6.1. `CloudDbClient.ts`
- Implementa la interfaz unificada de acceso a datos.
- **Evita registros duplicados**: Filtra por combinación única de campos en `getKudos()` y `getFaltas()`.
- **Actualización de Roles y Estados**: Proporciona `updateUsuarioStatus()` y `updateUsuarioRole()` para actualizar registros síncronamente en Supabase e IndexedDB.

### 6.2. `PowerAutomateSyncService.ts`
- Encargado de la interoperabilidad corporativa.
- **Exportación**: Construye hojas de cálculo `AppDB.xlsx` con la pestaña de deltas conteniendo cuentas pendientes de aprobación y perfiles no validados.
- **Importación**: Analiza archivos de retorno en formato `.xlsx` o `.json` enviados por Power Automate y aplica los cambios en Supabase masivamente.

---

## 7. Instrucciones de Compilación y Validación
Para verificar la integridad del código TypeScript sin errores de compilación:
```bash
npm run build
```
Genera los bundles estáticos en `dist/` usando `tsc -p tsconfig.app.json && vite build`.