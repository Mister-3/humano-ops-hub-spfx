export interface IAppInfo {
  name: string;
  tagline: string;
  version: string;
  environment: string;
  architecture: string;
  supportContact: string;
  adminContact: string;
  description: string;
  keyPillars: Array<{
    title: string;
    description: string;
    icon: string;
  }>;
}

export interface IModuleInfo {
  id: string;
  title: string;
  iconName: string;
  badge: string;
  description: string;
  keyUseCases: string[];
  allowedRoles: string[];
}

export type ReleaseChangeType = 'feature' | 'fix' | 'refactor' | 'security';

export interface IReleaseChange {
  type: ReleaseChangeType;
  description: string;
}

export interface IRelease {
  version: string;
  date: string;
  isCurrent: boolean;
  codename: string;
  summary: string;
  changes: IReleaseChange[];
}

export const APP_INFO: IAppInfo = {
  name: 'Manager Hub',
  tagline: 'Plataforma Corporativa de Gestión Operativa, Rendimiento y Cultura',
  version: 'v2.5.3',
  environment: 'Producción / Cloud & Local-First',
  architecture: 'React 17 + TypeScript + Tailwind CSS Dark Modern + Supabase PostgreSQL (RLS & RPCs) + IndexedDB v3',
  supportContact: 'soporte.operaciones@humano.com.do',
  adminContact: 'admin.ops@humano.com.do',
  description: 'Manager Hub es el ecosistema integral de supervisión operativa diseñado para centralizar el control de productividad diaria, aseguramiento de SLA, control disciplinario, reconocimientos corporativos, gestión de ausencias y captura de iniciativas de mejora continua bajo estándares ágiles.',
  keyPillars: [
    {
      title: 'Arquitectura Local-First & Cloud Sync',
      description: 'Persistencia distribuida en Supabase PostgreSQL con fallback automático en IndexedDB v3 (HumanoOpsHubDB) para garantizar operación ininterrumpida.',
      icon: 'CloudUpload'
    },
    {
      title: 'Seguridad RBAC Granular & Bypass Admin',
      description: 'Control de acceso basado en 5 roles canónicos con soporte para roles dinámicos personalizados y bypass irrestricto inmutable para administradores.',
      icon: 'ShieldAlert'
    },
    {
      title: 'Design System Dark Modern (Slate/Cyan)',
      description: 'Experiencia visual ergonómica con paleta de alto contraste, transparencias glassmorphic y kit de primitivas accesibles (AppDialog, KpiCard, PageHeader, EmptyState, ToastProvider).',
      icon: 'Color'
    },
    {
      title: 'Resiliencia y Trazabilidad en 3 Capas',
      description: 'Triple capa de protección: versionado DDL inmutable en Git, copias continuas PITR en Supabase Postgres e historial de versiones en SharePoint/M365.',
      icon: 'History'
    }
  ]
};

export const MODULES_INFO: IModuleInfo[] = [
  {
    id: 'dashboard',
    title: 'Dashboard General',
    iconName: 'BIDashboard',
    badge: 'Analítica 360°',
    description: 'Tablero consolidado de indicadores clave de rendimiento, cumplimiento de metas diarias y distribución operativa en tiempo real.',
    keyUseCases: [
      'Visualización ejecutiva de metas operativas y comparativa de productividad por equipo.',
      'Monitoreo en tiempo real de ocupación y atención de llamadas/correos.',
      'Alertas tempranas de ausencias operativas del día.'
    ],
    allowedRoles: ['Admin', 'Gerente', 'Supervisor', 'Asistente', 'Agente']
  },
  {
    id: 'endToEnd',
    title: 'Análisis End-to-End',
    iconName: 'Processing',
    badge: 'Radicaciones & SLA',
    description: 'Gestión y trazabilidad del ciclo de vida de radicaciones con cálculo automatizado de SLA, exclusiones y aislamiento de fotografías operativas.',
    keyUseCases: [
      'Importación y validación de snapshots operativas aisladas por analista (User Isolation).',
      'Marcado y reversión de radicaciones reportadas a entes de control.',
      'Gestión de calendarios/feriados y resolución de conflictos de versión.'
    ],
    allowedRoles: ['Admin', 'Gerente', 'Supervisor', 'Asistente']
  },
  {
    id: 'faltas',
    title: 'Registro Operativo & Faltas',
    iconName: 'ComplianceAudit',
    badge: 'Calidad & Disciplina',
    description: 'Registro de incidencias disciplinarias, tardanzas, errores de proceso y violaciones de código de ética con flujo de aprobación jerárquica.',
    keyUseCases: [
      'Tipificación de faltas por impacto (Bajo, Medio, Alto, Crítico) y horas perdidas.',
      'Asignación de planes de acción y acuerdos de capacitación con colaboradores.',
      'Bandeja de aprobación y rechazo con auditoría y estados automáticos por rol.'
    ],
    allowedRoles: ['Admin', 'Gerente', 'Supervisor', 'Asistente', 'Agente']
  },
  {
    id: 'ausencias',
    title: 'Ausencias & Planificación Semanal',
    iconName: 'Calendar',
    badge: 'Capacidad & Turnos',
    description: 'Control integral de vacaciones por período anual, licencias, cumpleaños, canje de días por Empleado del Mes y cálculo de capacidad neta.',
    keyUseCases: [
      'Solicitud de vacaciones con asignación explícita del año del período reclamado.',
      'Canje obligatorio del beneficio de Día Libre ganado por Empleado del Mes.',
      'Matriz de planificación semanal con deducción dinámica de ausencias en Supabase.'
    ],
    allowedRoles: ['Admin', 'Gerente', 'Supervisor', 'Asistente', 'Agente']
  },
  {
    id: 'kudos',
    title: 'Reconocimientos & Kudos',
    iconName: 'Trophy',
    badge: 'Cultura & Mérito',
    description: 'Módulo de reconocimiento entre pares basado en atributos culturales de valor corporativo y publicación del galardón Empleado del Mes.',
    keyUseCases: [
      'Envío de felicitaciones y asignación de puntos por pilares culturales.',
      'Publicación mensual de Empleado del Mes con dedicatoria del supervisor.',
      'Histórico consolidado de reconocimientos y control de beneficios reclamados.'
    ],
    allowedRoles: ['Admin', 'Gerente', 'Supervisor', 'Asistente', 'Agente']
  },
  {
    id: 'mejoras',
    title: 'Iniciativas & Mejoras (User Stories)',
    iconName: 'Lightbulb',
    badge: 'Ágil & DevOps',
    description: 'Asistente estructurado para la captura de mejoras continuas en formato Como/Quiero/Para, criterios Gherkin/Checklist, Live Preview y exportación.',
    keyUseCases: [
      'Redacción estructurada de Historias de Usuario con badges estilo Azure DevOps.',
      'Gestión dinámica de criterios de aceptación (Gherkin Dado/Cuando/Entonces y Checklist).',
      'Live Preview lateral sticky 7/5 y exportación multiformato (Markdown, HTML, TSV).'
    ],
    allowedRoles: ['Admin', 'Gerente', 'Supervisor', 'Asistente', 'Agente']
  },
  {
    id: 'productividad',
    title: 'Productividad & Ocupación',
    iconName: 'LightningBolt',
    badge: 'Producción Diaria',
    description: 'Captura de métricas por línea de proceso (Emisiones, Movimientos, Escaneo, Carnets) con devoluciones condicionales y control de jornada.',
    keyUseCases: [
      'Registro diario con bloqueo estricto de períodos en curso (fecha < hoy).',
      'Campos de devoluciones obligatorios únicamente para Emisiones, Movimientos y Escaneo.',
      'Eliminación de registros con confirmación modal protegida por rol Admin.'
    ],
    allowedRoles: ['Admin', 'Gerente', 'Supervisor', 'Asistente']
  },
  {
    id: 'userAdmin',
    title: 'Administración de Usuarios & RBAC',
    iconName: 'People',
    badge: 'Gobierno & Accesos',
    description: 'Gestión de cuentas corporativas, aprobación de accesos y matriz interactiva de roles y permisos con soporte para roles personalizados.',
    keyUseCases: [
      'Aprobación de cuentas pendientes (Pending_Admin_Approval) y estados de acceso.',
      'Configuración de permisos por rol en la matriz RBAC interactiva.',
      'Creación de roles personalizados y asignación múltiple de roles por usuario.'
    ],
    allowedRoles: ['Admin']
  },
  {
    id: 'admin',
    title: 'Configuración & Catálogos',
    iconName: 'Settings',
    badge: 'Infraestructura',
    description: 'Administración de catálogos jerárquicos estructurados (parent_id), metas operativas y sincronización de Headcount M365.',
    keyUseCases: [
      'Mantenimiento jerárquico de Aplicativos, Módulos y Pantallas con parent_id.',
      'Ajuste de parámetros globales de cálculo y ponderadores de evaluación.',
      'Sincronización del directorio corporativo vía SharePoint / Power Automate.'
    ],
    allowedRoles: ['Admin']
  }
];

export const RELEASES_DATA: IRelease[] = [
  {
    version: 'v2.5.3',
    date: '4 de Septiembre, 2026',
    isCurrent: true,
    codename: 'Deep Linking & URL Routing',
    summary: 'Enrutamiento sincronizado con la URL basado en hash (#/<modulo>), soporte completo para recargas (F5), deep linking con parámetros de desarrollo y navegación nativa con historial del navegador.',
    changes: [
      {
        type: 'feature',
        description: 'Enrutamiento basado en hash (#/<modulo>) para cada una de las 11 vistas operativas sin causar errores 404 ni requerir reescrituras de servidor.'
      },
      {
        type: 'feature',
        description: 'Persistencia resiliente ante F5 y soporte nativo para flechas Atrás/Adelante del navegador mediante listeners reactivos de hashchange.'
      },
      {
        type: 'feature',
        description: 'Compatibilidad plena con query parameters de desarrollo y auditoría (ej: ?mockRole=admin#/ayuda) sin colisiones de estado.'
      },
      {
        type: 'feature',
        description: 'Protección y gobierno RBAC en URLs: redirección automática a Dashboard y notificación toast de advertencia ante accesos no autorizados por URL.'
      }
    ]
  },
  {
    version: 'v2.5.2',
    date: '22 de Agosto, 2026',
    isCurrent: false,
    codename: 'Kudos Limits & Recognition Matrix',
    summary: 'Incorporación del control dinámico de límite mensual de reconocimientos por atributo en Administración, validación reactiva en tiempo real en el formulario de Kudos y modal interactivo de la Matriz de Criterios y Conductas.',
    changes: [
      {
        type: 'feature',
        description: 'Tope Mensual Configurable por Tipo de Kudo (maxKudosPorAtributoMensual) en el módulo de Administración con persistencia híbrida en Supabase e IndexedDB.'
      },
      {
        type: 'feature',
        description: 'Validación reactiva en tiempo real en KudosForm bloqueando envíos excedentes y mostrando banner de advertencia con conteo de reconocimientos del período.'
      },
      {
        type: 'feature',
        description: 'Matriz Interactiva de Criterios y Conductas (KudoMatrixModal) con buscador, filtros y transferencia de conceptos al mensaje en un solo clic.'
      },
      {
        type: 'feature',
        description: 'Gestión de Conceptos de Kudos (ConceptoKudo) en el Panel de Administración de Catálogos vinculados jerárquicamente al Atributo Padre.'
      }
    ]
  },
  {
    version: 'v2.5.1',
    date: '22 de Agosto, 2026',
    isCurrent: false,
    codename: 'Corporate Rebranding & Visual Identity',
    summary: 'Consolidación oficial del rebranding corporativo de la plataforma a Manager Hub, unificando títulos, cabeceras, manifest web, paleta de comandos y documentación técnica.',
    changes: [
      {
        type: 'feature',
        description: 'Rebranding institucional oficial de la plataforma a Manager Hub en toda la interfaz de usuario, headers y shell.'
      },
      {
        type: 'refactor',
        description: 'Actualización integral de metadatos webmanifest, títulos HTML, correos de soporte y badges de navegación.'
      },
      {
        type: 'refactor',
        description: 'Homologación de la paleta de comandos global Command Palette y suite de pruebas al nuevo nombre de marca.'
      }
    ]
  },
  {
    version: 'v2.5.0',
    date: '22 de Agosto, 2026',
    isCurrent: false,
    codename: 'UI/UX Evolution & Game Changers',
    summary: 'Lanzamiento de la suite de aceleradores de productividad: Command Palette (Cmd+K), Sistema de Toasts Flotantes, Selector de Densidad de Datos, Leaderboard Dark Modern con podio animado, Heatmap semántico de capacidad y Aprobaciones Masivas.',
    changes: [
      {
        type: 'feature',
        description: 'Command Palette Global (Cmd+K / Ctrl+K) con buscador fuzzy en tiempo real, navegación instantánea por teclado entre 9 módulos, acciones rápidas y Dev Tools.'
      },
      {
        type: 'feature',
        description: 'Sistema de Notificaciones Flotantes ToastProvider & useToast() desacoplado sin saltos de layout (CLS), auto-cierre con barra regresiva de 4s y variantes semánticas.'
      },
      {
        type: 'feature',
        description: 'Selector de Densidad de Datos DataDensityToggle con modos Cómodo y Compacto (para 500+ registros) con persistencia en localStorage.'
      },
      {
        type: 'feature',
        description: 'Modernización del Leaderboard en Dashboard con tarjetas estilizadas, podio #1 Oro, #2 Plata, #3 Bronce, iniciales de avatar y barras de progreso animadas.'
      },
      {
        type: 'feature',
        description: 'Heatmap Semántico de Cobertura en Planificación Semanal con cálculo automático de capacidad neta diaria y códigos de color por umbral de criticidad.'
      },
      {
        type: 'feature',
        description: 'Aprobaciones Masivas (Batch Actions) en Faltas con selección por fila, selector maestro en encabezado y barra flotante con diálogo de confirmación transaccional.'
      },
      {
        type: 'feature',
        description: 'Componente reutilizable <EmptyState /> estandarizado con halos circulares para íconos Lucide y botones de acción contextuales en todas las tablas del hub.'
      },
      {
        type: 'refactor',
        description: 'Ergonomía de alta precisión con formato numérico tabular-nums font-mono, columnas fijas (sticky columns) en End-to-End y auto-selección en foco para inputs numéricos.'
      }
    ]
  },
  {
    version: 'v2.4.0',
    date: '22 de Agosto, 2026',
    isCurrent: false,
    codename: 'Unified RBAC & Dark Modern Foundation',
    summary: 'Consolidación de la matriz RBAC de 5 roles canónicos, roles dinámicos, kit de primitivas Dark Modern, Dev Auth Bypass para auditorías UX y nuevo módulo de Ayuda & Versiones.',
    changes: [
      {
        type: 'feature',
        description: 'Unificación definitiva a 5 roles canónicos (Admin, Gerente, Supervisor, Asistente, Agente) con bypass irrestricto inmutable para el rol Admin.'
      },
      {
        type: 'feature',
        description: 'Creación dinámica de roles personalizados mediante RPC rbac_create_role() y asignación múltiple acumulativa de roles por usuario.'
      },
      {
        type: 'feature',
        description: 'Kit de Primitivas UI Dark Modern (AppDialog accesible con Focus Trap, PageHeader, KpiCard, StatusBadge, SurfaceCard, PermissionGuard).'
      },
      {
        type: 'feature',
        description: 'Módulo de Iniciativas & Mejoras v2 con editor ágil 7/5, Live Preview sticky, criterios Gherkin y exportación para Azure DevOps / Jira.'
      },
      {
        type: 'feature',
        description: 'Widget flotante DevRoleSwitcher y sistema de Auth Bypass seguro para pruebas y auditorías completas de UI/UX en desarrollo.'
      },
      {
        type: 'feature',
        description: 'Nuevo módulo "Centro de Ayuda & Versiones" con catálogo de módulos y visor interactivo de Changelog histórico.'
      },
      {
        type: 'security',
        description: 'Separación estricta de responsabilidades entre "Configuración" (catálogos y Headcount) y "Administración de Usuarios" (identidades y RBAC).'
      },
      {
        type: 'refactor',
        description: 'Estrategia de resiliencia y recuperación en 3 capas (Git DDL inmutable, Supabase Postgres PITR y SharePoint/M365).'
      }
    ]
  },
  {
    version: 'v2.3.0',
    date: '11 de Agosto, 2026',
    isCurrent: false,
    codename: 'End-to-End Analytics & User Isolation',
    summary: 'Lanzamiento del módulo de análisis operativo End-to-End con segregación de snapshots por usuario y conciliación automática de SLA.',
    changes: [
      {
        type: 'feature',
        description: 'Módulo de análisis End-to-End con motor de cálculo de SLA horario y semáforos de criticidad (Verde, Amarillo, Rojo).'
      },
      {
        type: 'security',
        description: 'Aislamiento estricto de fotografías operativas por analista (User Isolation) en base de datos mediante RLS y owner_id.'
      },
      {
        type: 'feature',
        description: 'Portal integrado CopyColumnsPortal para copiado seguro de subconjuntos de columnas al portapapeles.'
      },
      {
        type: 'feature',
        description: 'Gestión de calendarios laborales, feriados y cierres parciales para cálculo preciso de tiempos hábiles.'
      },
      {
        type: 'refactor',
        description: 'Registro auditable de exclusión de filas críticas y resolución de conflictos para cargas en misma fecha.'
      }
    ]
  },
  {
    version: 'v2.2.0',
    date: '1 de Agosto, 2026',
    isCurrent: false,
    codename: 'Cloud Database Migration & RLS',
    summary: 'Migración del motor de persistencia a Supabase PostgreSQL con políticas Row Level Security y cliente unificado con caché IndexedDB.',
    changes: [
      {
        type: 'refactor',
        description: 'Migración de tablas operativas principales a PostgreSQL en Supabase con tipado estricto TypeScript.'
      },
      {
        type: 'security',
        description: 'Implementación de políticas Row Level Security (RLS) granulares con denegación por defecto para usuarios anónimos.'
      },
      {
        type: 'feature',
        description: 'Adaptador de base de datos local IndexedDB v3 (HumanoOpsHubDB) como fallback de resiliencia ante pérdida de conexión.'
      },
      {
        type: 'fix',
        description: 'Corrección de referencias de fecha y filtros de productividad para días concluidos.'
      }
    ]
  },
  {
    version: 'v2.1.0',
    date: '15 de Julio, 2026',
    isCurrent: false,
    codename: 'M365 Directory Sync & Absence Automation',
    summary: 'Integración del flujo de sincronización de colaboradores corporativos vía Microsoft 365 y control estricto de beneficios de días libres.',
    changes: [
      {
        type: 'feature',
        description: 'Sincronización automatizada del Headcount y Directorio corporativo mediante Power Automate y SharePoint Online.'
      },
      {
        type: 'feature',
        description: 'Vinculación estricta del beneficio de Día Libre ganado por Empleado del Mes en el módulo de Ausencias con flag de canje.'
      },
      {
        type: 'feature',
        description: 'Selector obligatorio del año del período reclamado al registrar solicitudes de Vacaciones.'
      },
      {
        type: 'fix',
        description: 'Deducción dinámica de capacidad operativa neta en la matriz de planificación semanal al detectar ausencias aprobadas.'
      }
    ]
  },
  {
    version: 'v2.0.0',
    date: '1 de Julio, 2026',
    isCurrent: false,
    codename: 'Dark Modern UI Transformation',
    summary: 'Renovación completa de la interfaz de usuario bajo el sistema de diseño Dark Modern (Slate/Cyan) y eliminación de diálogos nativos.',
    changes: [
      {
        type: 'feature',
        description: 'Nueva interfaz Dark Modern basada en Tailwind CSS v3 con paleta Slate-950/Slate-900 y acentos Cyan-500.'
      },
      {
        type: 'refactor',
        description: 'Erradicación total de fondos claros (NO bg-white) y sustitución de llamadas window.confirm() y window.alert().'
      },
      {
        type: 'feature',
        description: 'Dashboard analítico con gráficos interactivos y consolidación de productividad, faltas y ocupación.'
      },
      {
        type: 'feature',
        description: 'Sistema de reconocimientos corporativos Kudos con catálogo de atributos de cultura empresarial.'
      }
    ]
  }
];
