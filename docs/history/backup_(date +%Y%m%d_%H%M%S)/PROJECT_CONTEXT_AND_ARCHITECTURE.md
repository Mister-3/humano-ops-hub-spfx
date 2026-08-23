# Project Context and Technical Architecture: Humano Ops Hub

Este documento constituye la fuente oficial de arquitectura técnica, mapa de componentes, esquema de base de datos y sistema de diseño del portal de operaciones **Humano Ops Hub**. Su propósito es guiar a desarrolladores y agentes de IA para el mantenimiento, extensión y compilación sin pérdida de contexto.

---

## 1. Visión General e Infraestructura

### 1.1 Resumen del Sistema
**Humano Ops Hub** es una plataforma web integral de gestión operativa y analítica diseñada para supervisores, gerentes y analistas de operaciones. El sistema centraliza el control de productividad diaria, registro de faltas/errores operativos, conteo de ocupación (llamadas y correos), reconocimientos corporativos (Kudos y Empleado del Mes), gestión de ausencias/vacaciones, matriz de planificación semanal, solicitudes de mejora mediante Historias de Usuario estructuradas y administración de catálogos jerárquicos.

### 1.2 Stack Tecnológico
- **Frontend Core**: React 17.0.1 (Single Page Application).
- **Lenguaje**: TypeScript 5.8 (~5.8.0) con verificación estricta (`tsconfig.app.json`).
- **Bundler & Dev Server**: Vite 8.2.0 (`vite.config.mts`).
- **Sistema de UI / Componentes**: Fluent UI React (`@fluentui/react` ^8.106.4) + HTML5 semántico estilizado.
- **Estilos & Diseño**: Tailwind CSS (Tailwind v3 configurado en `tailwind.config.js` con `darkMode: 'class'`), Sass (`sass` ^1.102.0) y CSS Modules (`*.module.scss`).
- **Iconografía**: Fluent UI Icons (`initializeIcons`) + Emojis de interfaz unificados.
- **Persistencia de Datos**:
  - **Nube (Producción)**: Supabase / PostgreSQL con `client` oficial `@supabase/supabase-js` (^2.112.0).
  - **Caché Local / Offline**: IndexedDB personalizado (`IndexedDbAdapter.ts`) que sincroniza automáticamente transacciones locales.
- **Librerías Complementarias**:
  - `exceljs` (^4.4.0): Exportación/Importación de reportes analíticos en hojas de cálculo Excel (`AppDB.xlsx`).
  - `jszip` (^3.10.1): Compresión y empaquetado de reportes exportables.

### 1.3 Entorno de Ejecución y Scripts de Construcción
El proyecto se ejecuta en un entorno Linux con **Node.js (>=22.14.0 < 23.0.0)**.

#### Comandos de Construcción y Despliegue:
```fish
# Instalación de dependencias
npm install

# Servidor de desarrollo local (Vite dev server)
npm run dev

# Compilación de producción (TypeScript check + Vite bundle)
npm run build

# Previsualización del bundle compilado
npm run preview

# Scripts de exportación/datos
npm run generate:appdb
```

#### Integración y Despliegue en Vercel (Fish Shell):
```fish
# Construcción y despliegue a entorno de pruebas Vercel
vercel --build

# Despliegue directo a producción en Vercel
vercel --prod --skip-domain-verification
```

---

## 2. Estructura de Directorios y Proyecto

```
/home/edison-ventalm/supervision-app-new
├── index.html                           # Entrypoint HTML de la aplicación
├── package.json                         # Dependencias, scripts y configuración de motor Node
├── tailwind.config.js                   # Configuración de Tailwind CSS con clase dark mode
├── tsconfig.app.json                    # Configuración estricta de compilador TypeScript
├── vite.config.mts                      # Configuración del empaquetador Vite
├── AppDB.xlsx                           # Plantilla de base de datos/matriz Excel
├── dist/                                # Output compilado de producción
├── scripts/                             # Scripts utilitarios (ej: generate-app-db.mjs)
└── src/                                 # Código fuente del proyecto
    ├── App.tsx                          # Componente raíz con Auth state wrapper
    ├── index.tsx                        # Punto de entrada de renderizado React DOM
    ├── styles.css                       # Estilos globales y directivas de Tailwind CSS
    ├── auth/                            # Módulo de Autenticación
    │   ├── AppAuthContext.tsx           # Contexto global de sesión de usuario y rol
    │   ├── ChangePasswordDialog.tsx     # Modal de cambio de contraseña obligatoria
    │   ├── LoginModal.tsx               # Pantalla de inicio de sesión integrada
    │   ├── RBACContext.tsx              # Permisos efectivos y actualización reactiva
    │   └── rbacPolicy.ts                # Evaluador puro deny-by-default
    ├── services/                        # Servicios de Backend y Base de Datos
    │   ├── CloudDbClient.ts             # Cliente principal Supabase PostgreSQL + IndexedDB fallback
    │   ├── IndexedDbAdapter.ts          # Adaptador local IndexedDB (HumanoOpsHubDB v3)
    │   ├── LocalStorageService.ts       # Gestor de caché y preferencias del navegador
    │   └── RBACService.ts               # Lectura y administración RBAC vía Supabase/RPC
    └── webparts/supervisionOperaciones/ # Módulo principal de la aplicación
        ├── components/                  # Componentes visuales por módulo funcional
        │   ├── Admin/                   # Configuración operativa y Administración de Usuarios
        │   │   ├── AdminPanel.tsx       # Configuración: catálogos y parámetros operativos
        │   │   ├── CatalogosAdmin.tsx   # Administración de catálogos jerárquicos
        │   │   └── UserAdminPanel.tsx   # Centro único de cuentas, roles, perfiles y matriz RBAC
        │   ├── Ausencias/               # Módulo de Ausencias y Vacaciones
        │   │   ├── AusenciasForm.tsx    # Registro de ausencias, vacaciones y Día Empleado del Mes
        │   │   └── PlanificacionSemanal.tsx # Matriz de Planificación Semanal
        │   ├── Common/                  # Componentes reutilizables de UI
        │   │   └── ConfirmDialog.tsx    # Modal de confirmación estilizado (Reemplaza window.confirm)
        │   ├── Dashboard/               # Dashboard de métricas e indicadores de rendimiento
        │   │   └── Dashboard.tsx
        │   ├── EvaluacionRendimiento/  # Evaluación consolidada de agentes
        │   │   └── EvaluacionRendimiento.tsx
        │   ├── Faltas/                  # Módulo de Faltas y Errores Operativos
        │   │   └── FaltasForm.tsx
        │   ├── Kudos/                   # Módulo de Reconocimientos y Kudos
        │   │   ├── EmpleadoMesView.tsx  # Histórico y publicación de Empleado del Mes
        │   │   ├── KudosForm.tsx        # Formulario de envío de Kudos
        │   │   └── ReconocimientosView.tsx # Vista consolidada de Reconocimientos
        │   ├── Mejoras/                 # Módulo de Iniciativas & Mejoras (Historias de Usuario)
        │   │   ├── AprobacionMejorasQueue.tsx # Cola de revisión y aprobación de supervisores
        │   │   └── IniciativasMejorasView.tsx # Componente autocontenido: dashboard y editor HU 7/5 con Live Preview
        │   ├── Navigation/              # Navegación del sistema
        │   │   ├── Header.tsx           # Encabezado corporativo, usuario y estado
        │   │   └── SidebarNav.tsx       # Barra lateral de módulos con control de accesos
        │   ├── Ocupacion/               # Módulo de Ocupación y Conteo de Llamadas/Correos
        │   │   └── SupervisorTimeView.tsx
        │   ├── Productividad/           # Módulo de Productividad Operativa
        │   │   ├── ProductividadForm.tsx # Registro diario de productividad con Devoluciones
        │   │   └── ProductividadList.tsx # Listado de registros con eliminación por UUID/audit_id
        │   └── SupervisionOperaciones.tsx # Routing; importa IniciativasMejorasView directamente
        ├── models/                      # Modelos de datos TypeScript (`AppModels.ts`)
        ├── services/                    # Servicios SharePoint / Adaptadores locales (`SharePointService.ts`)
        └── theme/                       # Configuración de tema oscuro Fluent UI (`DarkTheme.ts`)
```

---

## 3. Esquema Completo de Base de Datos (Supabase / PostgreSQL)

La persistencia del sistema está modelada en la base de datos PostgreSQL alojada en Supabase. A continuación se desglosa el esquema de tablas y columnas:

### 3.1 Tabla: `productividad`
Almacena las métricas diarias de producción por colaborador.
- `id`: `uuid` / `bigint` (Primary Key, autogenerado por Supabase).
- `audit_id`: `text` (Identificador único de auditoría formato `PROD-YYYYMMDDHHMMSS-RAND`).
- `agente`: `text` (Nombre completo del colaborador).
- `email_empleado`: `text` (Correo del colaborador).
- `fecha_registro`: `timestamptz` / `date` (Fecha del registro).
- `fecha_inicio`: `timestamptz` (Fecha/Hora inicio del rango registrado).
- `fecha_fin`: `timestamptz` (Fecha/Hora fin del rango registrado).
- `casos_atendidos`: `integer` (Total de casos cerrados/atendidos).
- `casos_a_tiempo`: `integer` (Casos cumplidos dentro del SLA).
- `emisiones_tx`: `integer` (Transacciones de Emisiones).
- `emisiones_pg`: `integer` (Pagos/Procesados de Emisiones).
- `devoluciones_emisiones`: `integer` (Devoluciones en Emisiones - Requerido solo si aplica).
- `movimientos_tx`: `integer` (Transacciones de Movimientos).
- `movimientos_pg`: `integer` (Pagos/Procesados de Movimientos).
- `devoluciones_movimientos`: `integer` (Devoluciones en Movimientos - Requerido solo si aplica).
- `escaneo_tx`: `integer` (Transacciones de Escaneo).
- `escaneo_pg`: `integer` (Pagos/Procesados de Escaneo).
- `devoluciones_escaneo`: `integer` (Devoluciones en Escaneo - Requerido solo si aplica).
- `carnets_tx`: `integer` (Transacciones de Gestión de Carnets).
- `carnets_pg`: `integer` (Pagos/Procesados de Gestión de Carnets).
- `created_at`: `timestamptz` (Fecha de creación en BD).

### 3.2 Tabla: `faltas_errores`
Registra incidencias disciplinarias o errores operativos cometidos.
- `id`: `uuid` / `bigint` (Primary Key).
- `audit_id`: `text` (Identificador único de auditoría).
- `agente_nombre`: `text` (Nombre del colaborador sancionado).
- `agente_email`: `text` (Correo del colaborador).
- `supervisor_email`: `text` (Correo del supervisor que aplica la falta).
- `fecha_falta`: `date` (Fecha de la falta o error).
- `categoria`: `text` (Categoría principal: Falta, ErrorProceso, CodigoEtica).
- `subcategoria`: `text` (Subcategoría específica del catálogo).
- `impacto`: `text` (Bajo, Medio, Alto, Crítico).
- `estado_aprobacion`: `text` (Pendiente, Aprobado, Rechazado).
- `horas_perdidas`: `numeric` (Horas operativas perdidas).
- `minutos_tardanza`: `integer` (Minutos de tardanza acumulados).
- `hora_llegada`: `text` (Hora exacta de llegada).
- `id_caso_helpdesk`: `text` (Número de caso o ticket de referencia).
- `proceso_area`: `text` (Proceso del área afectado).
- `comentarios`: `text` (Justificación / Observaciones).
- `comentarios_capacitacion`: `text` (Plan de acción o capacitación acordada).
- `created_at`: `timestamptz`.

### 3.3 Tabla: `ocupacion_llamadas`
Conteo de atención telefónica y tiempo dedicado por supervisores/agentes.
- `id`: `uuid` / `bigint` (Primary Key).
- `audit_id`: `text` (Identificador de auditoría).
- `supervisor_email`: `text` (Email del usuario registrado).
- `caso_contacto`: `text` (Descripción o número de caso).
- `fecha_hora`: `timestamptz` (Fecha y hora de atención).
- `duracion_minutos`: `numeric` / `integer` (Duración en minutos).
- `comentarios`: `text`.
- `created_at`: `timestamptz`.

### 3.4 Tabla: `kudos`
Módulo de reconocimiento entre pares basado en atributos de cultura.
- `id`: `uuid` / `bigint` (Primary Key).
- `audit_id`: `text`.
- `agente_nombre`: `text` (Nombre del receptor).
- `agente_email`: `text` (Correo del receptor).
- `remitente_nombre`: `text` (Nombre de quien otorga el Kudo).
- `remitente_email`: `text` (Correo de quien otorga).
- `atributo`: `text` (Atributo de valor corporativo).
- `mensaje`: `text` (Mensaje de felicitación).
- `puntos`: `integer` (Puntaje asignado).
- `fecha`: `date` / `timestamptz`.
- `created_at`: `timestamptz`.

### 3.5 Tabla: `empleado_del_mes`
Publicación de reconocimientos mensuales y control del beneficio de Día Libre.
- `id`: `uuid` / `bigint` (Primary Key).
- `email_empleado`: `text` (Correo del colaborador premiado).
- `nombre_empleado`: `text` (Nombre del colaborador premiado).
- `mes`: `integer` (Mes del galardón 1-12).
- `anio`: `integer` (Año del galardón).
- `dedicatoria`: `text` (Motivo de reconocimiento).
- `supervisor_email`: `text` (Correo del supervisor originador).
- `supervisor_nombre`: `text` (Nombre del supervisor originador).
- `dia_libre_reclamado`: `boolean` (Default `false`. `true` cuando se registra la ausencia por este concepto).
- `fecha_publicacion`: `timestamptz`.
- `created_at`: `timestamptz`.

### 3.6 Tabla: `ausencias`
Registro de permisos, incapacidades, vacaciones y días libres otorgados.
- `id`: `uuid` / `bigint` (Primary Key).
- `audit_id`: `text`.
- `agente_nombre`: `text` (Nombre del colaborador).
- `agente_email`: `text` (Correo del colaborador).
- `tipo_ausencia`: `text` (Vacaciones, Día Libre Cumpleaños, Día Libre Empleado del Mes, Licencia / Incapacidad).
- `fecha_inicio`: `date` (Fecha inicio de la ausencia).
- `fecha_fin`: `date` (Fecha fin de la ausencia).
- `periodo_anio`: `integer` (Año del período reclamado para Vacaciones).
- `premio_empleado_mes_id`: `text` / `bigint` (Relación al registro de `empleado_del_mes`).
- `comentarios`: `text`.
- `created_at`: `timestamptz`.

### 3.7 Tabla: `solicitudes_mejora`
Gestión de Historias de Usuario e Iniciativas de mejora continua.
- `id`: `uuid` (Primary Key autogenerado).
- `audit_id`: `text` (Identificador de auditoría `MEJ-YYYYMMDDHHMMSS-RAND`).
- `owner_id`: `uuid` (FK obligatoria para filas nuevas a `auth.users.id`; propietario canónico RLS).
- `autor_nombre`: `text` (Nombre del colaborador solicitante).
- `autor_email`: `text` (Correo del solicitante).
- `aplicativo`: `text` (Nombre del aplicativo seleccionado del catálogo).
- `modulo_afectado`: `text` (Nombre del módulo afectado).
- `pantalla_afectada`: `text` (Nombre de la pantalla/sección específica).
- `titulo`: `text` (Título representativo del Work Item).
- `descripcion`: `text` (Narrativa de Historia de Usuario: "Como [rol], quiero [acción], para [beneficio]").
- `criterios_aceptacion`: `text` (Criterios de aceptación indispensables).
- `criterios_aceptacion_json`: `jsonb` (Checklist/Gherkin ordenado, con marca de verificación).
- `actor`, `necesidad`, `beneficio`: `text` (Bloques estructurados Como/Quiero/Para).
- `modulo_clave`: `text` (Módulo funcional normalizado para filtros y reportes).
- `prioridad`: `text` (`Baja`, `Media`, `Alta`, `Critica`).
- `estado_ciclo`: `text` (`Borrador`, `En Revision`, `Aprobada`, `En Desarrollo`, `Implementada`, `Descartada`).
- `estado`: `text` (Valores: `Pendiente_Aprobacion`, `Aprobada`, `Declinada`).
- `comentario_supervisor`: `text` (Retroalimentación emitida por el supervisor).
- `supervisor_email`: `text` (Correo del supervisor revisor).
- `supervisor_nombre`: `text` (Nombre del supervisor revisor).
- `fecha_revision`: `timestamptz` (Fecha/Hora de aprobación o declinación).
- `created_at`: `timestamptz`.
- `updated_at`: `timestamptz`.
- La migración incremental agrega `updated_at` de forma idempotente con `DEFAULT now()`; mientras el esquema de QA se actualiza, el repositorio reintenta el listado ordenando por `created_at` únicamente cuando PostgreSQL/PostgREST reporta que `updated_at` no existe.
- RLS permite lectura al propietario, Admin y revisores; creación al propio `auth.uid()`; edición/eliminación al propietario o Admin según permiso. La aprobación de terceros se limita al RPC `iniciativas_review()`.
- El catálogo RBAC registra cinco permisos bajo **Iniciativas & Mejoras** (`ver`, `crear`, `editar`, `eliminar`, `aprobar`). El rol canónico `admin` recibe los cinco y actúa como superrol efectivo tanto en React como en `rbac_has_permission()`.

### 3.8 Tabla: `catalogos`
Estructura de catálogos dinámicos jerárquicos (Cascada Aplicativo ➔ Módulo ➔ Pantalla).
- `id`: `bigint` / `uuid` (Primary Key).
- `categoria`: `text` (Categorías: `Falta`, `ErrorProceso`, `CodigoEtica`, `Kudo`, `ProcesoArea`, `aplicativos`, `modulos`, `pantallas`).
- `valor`: `text` (Nombre o descripción del ítem).
- `parent_id`: `text` / `bigint` (Clave foránea opcional que apunta al `id` o `rawId` del elemento padre en la jerarquía).
- `activo`: `boolean` (Default `true`).
- `created_at`: `timestamptz`.

### 3.9 Tabla: `configuraciones_sistema` y `metas`
Parámetros globales de cálculo y ponderación de métricas.
- `id`: `bigint` (Primary Key).
- `clave`: `text` (Nombre de la variable de configuración).
- `valor`: `jsonb` / `text` (Valor o estructura de la regla de cálculo).
- `updated_at`: `timestamptz`.

### 3.10 Tabla: `usuarios`
Cuentas de usuario y asignación de roles.
- `id`: `bigint` / `uuid` (Primary Key).
- `email`: `text` (Correo electrónico único).
- `nombre`: `text` (Nombre completo).
- `rol`: `text` (Slugs canónicos: `admin`, `gerente`, `supervisor`, `asistente`, `agente`).
- `estado`: `text` (Activo, Inactivo, Bloqueado).
- `password_hash`: `text` (Hash de contraseña de acceso).
- `is_profile_validated_pa`: `boolean` (Validación de perfil).
- `created_at`: `timestamptz`.

### 3.11 RBAC nativo de Supabase
- `roles`: catálogo canónico definitivo (`admin`, `gerente`, `supervisor`, `asistente`, `agente`).
- `permissions`: códigos `modulo:<modulo>:<accion>`, agrupación visual y categoría `pantalla`/`accion`.
- `role_permissions`: relación muchos-a-muchos entre roles y permisos.
- `user_roles`: relación muchos-a-muchos entre `auth.users` y roles.
- La sesión obtiene su acceso mediante `rbac_get_my_access()` y aplica denegación por defecto mientras carga o ante error.
- La Administración de Usuarios usa RPCs `security definer` protegidas por `modulo:admin:gestionar_permisos`; RLS permanece activa y `anon` no tiene acceso.
- Los cinco roles operativos base (`admin`, `gerente`, `supervisor`, `asistente`, `agente`) son sistémicos y siempre se muestran como fallback. La matriz RBAC puede ampliarse con roles personalizados (`roles.is_system = false`) creados mediante `rbac_create_role()` y asignados a través de las RPC protegidas.
- `UserAdminPanel.tsx` concentra cuentas y monta `RolesPermissionsAdmin.tsx` como subsección exclusiva para matrices, perfiles y múltiples roles por usuario.
- `AdminPanel.tsx` se presenta como **Configuración** y conserva únicamente parámetros y catálogos operativos.

---

## 4. Sistema de Diseño y Guía de Estilos

El portal **Humano Ops Hub** utiliza un sistema de diseño estricto orientado a **Modo Oscuro (Dark Theme)** basado en paletas Slate y Zink de Tailwind CSS con transparencias glassmorphic.

### 4.1 Reglas Fundamentales de UI/UX
1. **Erradicación de Fondos Blancos (`NO bg-white`)**:
   - Está **estrictamente prohibido** usar clases de fondo claro (`bg-white`, `bg-slate-50`, `bg-gray-100`) o colores de texto oscuros planos (`text-black`, `text-gray-900`) en componentes del portal.

2. **Estilo Unificado para Inputs, Selects y Textareas**:
   ```html
   class="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all font-medium text-sm"
   ```
   - Opciones internas `<option>`:
     ```html
     class="bg-slate-900 text-slate-100 py-2"
     ```

3. **Tarjeta y Contenedores Elevados (Cards)**:
   ```html
   class="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md"
   ```

4. **Botón Principal Registrado (Standard Primary Button)**:
   ```html
   class="w-full md:w-auto bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-semibold py-3 px-8 rounded-xl shadow-lg shadow-blue-600/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
   ```

5. **Modales de Confirmación y Popups**:
   - **Prohibición Total de Diálogos Nativos**: Queda eliminada cualquier llamada a `window.confirm()` o `window.alert()`.
   - **Reemplazo Unificado**: Se utiliza exclusivamente el componente `<ConfirmDialog />` (`ConfirmDialog.tsx`) estilizado con capa oscura y desenfoque (`bg-black/70 backdrop-blur-sm fixed inset-0 z-50 flex items-center justify-center`).

---
*Fin de Documento de Arquitectura.*
