# Changelog

Todos los cambios notables en **Manager Hub** se documentan en este archivo.
El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/) y este proyecto se adhiere a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v2.5.3] - 2026-09-04

### Resumen de la Versión
Lanzamiento enfocado en **Persistencia de Navegación, Deep Linking & Hash Routing**, garantizando la conservación de la vista activa tras recargas (F5), enlaces directos compartibles e integración nativa con el historial del navegador.

### Hitos Principales de la Versión:
- **Enrutamiento Sincronizado por Hash (`routeUtils.ts`)**: Mapeo bidireccional entre las 11 vistas operativas de la plataforma y slugs canónicos de URL (`#/<modulo>`), sin colisiones con query parameters (`?mockRole=admin#/ayuda`).
- **Persistencia Resiliente ante Recargas (F5)**: Inicialización reactiva de la vista activa a partir del hash de la URL al montar la aplicación en `SupervisionOperaciones.tsx`.
- **Navegación Nativa del Navegador**: Listener global del evento `hashchange` para sincronizar el estado ante clics en los botones Atrás / Adelante del historial.
- **Protección RBAC en Rutas Directas**: Verificación estricta de permisos ante ingresos manuales por hash, con redirección automática a Dashboard y notificación toast de advertencia.
- **Suite de Pruebas Automatizadas**: 14 pruebas unitarias en `routeUtils.test.tsx` validando análisis de hash, limpieza de parámetros y tolerancia a fallos.

---

## [v2.5.2] - 2026-08-22

### Resumen de la Versión
Lanzamiento enfocado en la **Gobernanza de Reconocimientos & Matriz de Criterios**, implementando topes configurables mensuales por atributo, validación reactiva en tiempo real y modal accesible para consulta y transferencia de conductas orientativas.

### Hitos Principales de la Versión:
- **Tope Mensual Configurable por Atributo (`maxKudosPorAtributoMensual`)**: Campo numérico en el panel de Administración (`AdminPanel.tsx` -> Publicación y Reconocimientos) con valor por defecto de 3, persistido en Supabase e IndexedDB.
- **Control Reactivo en Formulario de Kudos (`KudosForm.tsx`)**: Consulta y conteo reactivo de reconocimientos previos del colaborador en el mes evaluado, bloqueo de envíos al superar el límite y banner de advertencia visual (`amber-500/10`) con soporte de notificaciones flotantes `useToast()`.
- **Matriz de Criterios y Conductas (`KudoMatrixModal.tsx` & `kudoCriteriaMatrix.ts`)**: Modal accesible `AppDialog` con buscador interactivo, pestañas por atributo y botón *"Usar criterio"* para prellenar la redacción del Kudo en 1-clic.
- **Gestión de Conceptos de Kudos (`ConceptoKudo`)**: Integración en el panel de catálogos con vinculación jerárquica obligatoria al Atributo Padre y sincronización con la matriz de reconocimientos.
- **Suites de Pruebas Automatizadas**: Incorporación de pruebas unitarias para la matriz y el modal (`KudoMatrixModal.test.tsx`).

---

## [v2.5.1] - 2026-08-22

### Resumen de la Versión
Lanzamiento oficial de **Rebranding Corporativo & Identidad Visual**, consolidando la transición definitiva de la marca a **Manager Hub** en todo el ecosistema de usuario, metadatos, comandos y documentación.

### Hitos Principales de la Versión:
- **Rebranding Oficial a Manager Hub**: Actualización integral del nombre de producto a **Manager Hub** en títulos HTML (`index.html`), manifiesto PWA (`manifest.webmanifest`), pantalla de autenticación (`AuthView`), encabezados del shell (`SupervisionOperaciones`), barra lateral (`SidebarNav`), pantalla de error (`ErrorBoundary`) y Centro de Ayuda (`ayudaData.ts`, `AyudaView`).
- **Homologación de la Paleta de Comandos (`CommandPalette`)**: Adaptación de placeholders, etiquetas y metadatos de búsqueda al entorno Manager Hub.
- **Sincronización de Suites de Testing y Documentación**: Actualización de pruebas unitarias (`AyudaView.test.tsx`, `improvementsDomain.test.mts`) y documentos maestros de arquitectura y negocio (`PROJECT_CONTEXT_AND_ARCHITECTURE.md`, `BUSINESS_RULES_AND_USE_CASES.md`, `AGENTS.md`, `README.md`).

---

## [v2.5.0] - 2026-08-22

### Resumen de la Versión
Lanzamiento mayor de **Evolución UI/UX & Game Changers**, enfocado en la ergonomía de alta precisión, aceleradores de navegación global, modernización visual de tableros analíticos, herramientas de aprobación masiva y capacidades de escalabilidad para manejo intensivo de datos tabulares.

### Hitos Principales de la Versión:
- **Command Palette Global (`Cmd+K` / `Ctrl+K`)**: Interfaz unificada de comandos accesible mediante atajo global (`Cmd+K`/`Ctrl+K`) con buscador reactivo en tiempo real, navegación por teclado completa (`Arriba`/`Abajo`, `Enter`, `Escape`), salto directo a 9 módulos, atajos de acciones operativas y conmutación de identidades de desarrollo (`DevRoleSwitcher`).
- **Sistema de Notificaciones Flotantes Apilables (`ToastProvider` & `useToast`)**: Contexto y hook desacoplado para emitir notificaciones flotantes en esquina superior derecha (`fixed top-5 right-5 z-[9999]`) con cero desplazamiento de layout (CLS), auto-cierre con barra de progreso regresiva de 4 segundos, botón de descarte manual y variantes semánticas (`success`, `error`, `warning`, `info`).
- **Selector de Densidad de Datos Tabulares (`DataDensityToggle`)**: Componente selector tipo píldora conmutando entre vista **Cómoda** (`py-3 text-sm`) y vista **Compacta** (`py-1.5 text-xs`) para tablas de alta densidad como End-to-End, optimizando la visibilidad de lotes de 500+ registros y persistiendo la preferencia en `localStorage('ops_table_density')`.
- **Leaderboard Dark Modern en Dashboard**: Rediseño integral del ranking de productividad en `Dashboard.tsx` sustituyendo tablas Fluent legacy por una tabla Dark Modern estilizada con tarjetas de podio (#1 Oro, #2 Plata, #3 Bronce), iniciales de avatar y barras de progreso animadas.
- **Heatmap Semántico de Cobertura en Planificación Semanal**: Incorporación de cálculo automático de capacidad neta operativa en el pie de tabla (`<tfoot>`) de `PlanificacionSemanal.tsx` con escala cromática de alerta temprana (Verde Esmeralda ≥90%, Amarillo Ámbar 75-89%, Rojo Rosa <75%).
- **Aprobaciones Masivas en Faltas (*Batch Approvals*)**: Implementación de casillas de selección individual por fila y selector maestro en encabezado en `AprobacionesView.tsx`, activando una barra flotante inferior (`fixed bottom-6 right-8`) con diálogo modal accesible `AppDialog` para procesar aprobaciones concurrentes en 1-clic.
- **Componente Reutilizable `<EmptyState />`**: Estandarización de estados vacíos en `components/Common/EmptyState.tsx` con halos circulares para íconos Lucide, títulos concisos, descripciones y slots de acción (CTA), desplegado transversalmente en End-to-End, Aprobaciones, Iniciativas y Planificación Semanal.
- **Ergonomía de Alta Precisión y Columnas Fijas (*Sticky Columns*)**: Formateo numérico estricto con `tabular-nums font-mono` para alineación vertical perfecta en KPIs y tablas masivas, columnas fijas bidireccionales en End-to-End (`sticky left-0`, `left-[42px]`, `right-0`) y auto-selección en foco para inputs numéricos operativos (`onFocus={(e) => e.target.select()}`).

---

## [v2.4.0] - 2026-08-22

### Resumen de la Versión
Lanzamiento mayor enfocado en la unificación integral de la arquitectura de seguridad RBAC, renovación estética bajo el Design System Dark Modern (Slate/Cyan), rediseño ágil del módulo de Iniciativas & Mejoras (Historias de Usuario estilo Azure DevOps) y establecimiento del protocolo formal de desarrollo colaborativo entre agentes de IA.

### Hitos Principales de la Versión:
- **Unificación a 5 Roles y Matriz RBAC Centralizada**: Consolidación definitiva del catálogo de roles en 5 entidades canónicas (`Admin`, `Gerente`, `Supervisor`, `Asistente`, `Agente`) con soporte para roles dinámicos personalizados (`rbac_create_role`), asignación múltiple de roles por usuario, protección del último administrador y bypass irrestricto inmutable para el rol `Admin`.
- **Módulo de Iniciativas y Mejoras v2.4 (Historias de Usuario & Live Preview)**: Rediseño completo del asistente de captura ágil con estructura obligatoria *Como / Quiero / Para*, badges de color Azure DevOps, gestión dinámica de criterios de aceptación (Gherkin Dado/Cuando/Entonces y Checklist interactivo), layout ergonómico 7/5 con *Live Preview* lateral sticky y exportación multiformato (Markdown, HTML limpio, TSV).
- **Kit de Primitivas UI Dark Modern**: Implementación del paquete de componentes reutilizables en `components/Common/` (`AppDialog` con Focus Trap y ARIA accesible, `PageHeader`, `KpiCard` con variantes semánticas, `StatusBadge`, `SurfaceCard` y `PermissionGuard`) con erradicación total de fondos claros (`NO bg-white`) y diálogos nativos (`window.confirm`/`window.alert`).
- **Homologación de Vistas Operativas**: Actualización de los módulos de Productividad (validación de devoluciones condicionales y bloqueo de día actual), Faltas/Errores (aprobación jerárquica automática), Kudos/Empleado del Mes (control estricto de canje de días libres en Ausencias) y Ausencias/Planificación Semanal (selector de período de vacaciones y deducción dinámica de capacidad neta).
- **Módulo Operativo End-to-End con Aislamiento de Usuario**: Implementación del aislamiento de fotografías operativas por analista (*User Isolation*), conciliación automática de SLA, gestión de calendarios/feriados, exclusión auditada de radicaciones y portal de copiado de columnas (`CopyColumnsPortal`).
- **Nuevo Módulo "Centro de Ayuda & Versiones" (`AyudaView.tsx`)**: Experiencia de usuario interactiva y accesible de forma universal para todos los roles con dos pestañas principales: *Acerca de* (presentación del ecosistema, pilares arquitectónicos, catálogo descriptivo de 9 módulos y directorio de soporte) y *Versiones y Correcciones* (métricas de despliegue con `KpiCard`, barra de filtros dinámicos por tipo de cambio y línea de tiempo vertical Dark Modern con notas de release históricas).
- **Sistema de Dev Auth Bypass y Widget Flotante `DevRoleSwitcher`**: Herramienta de auditoría y pruebas UX en entorno local con perfiles mock para los 5 roles canónicos, cambio reactivo de roles y permisos en caliente sin requerir credenciales activas ni conexión a Supabase, totalmente inocuo y neutralizado en compilaciones de producción (`PROD`).
- **Separación de "Configuración" vs "Administración de Usuarios"**: Desacoplamiento funcional donde "Configuración" gestiona parámetros operativos, catálogos jerárquicos (`parent_id`) y sincronización M365 Headcount, mientras "Administración de Usuarios" centraliza la activación de cuentas y la matriz de roles y permisos.
- **Estrategia de Resiliencia y Backups de 3 Capas**: Documentación y formalización de las capas de resiliencia del hub: Capa 1 (versionado DDL en Git `supabase/migrations/`), Capa 2 (backups diarios y PITR a segundo exacto en Supabase Postgres) y Capa 3 (historial de versiones y papelera de dos etapas en SharePoint/OneDrive).
- **Protocolo de Desarrollo Full-Stack Flexible (Codex & Antigravity)**: Definición del modelo operativo generalista con capacidades completas de frontend, backend, calidad y arquitectura para ambos agentes, convención de ramas (`feature/*`, `fix/*`, `refactor/*`, `docs/*`), formato de commits firmados y protocolo de protección de base de datos en `AGENTS.md`.

