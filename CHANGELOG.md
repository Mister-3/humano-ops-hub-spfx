# Changelog

Todos los cambios notables en **Humano Ops Hub** se documentan en este archivo.
El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/) y este proyecto se adhiere a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

