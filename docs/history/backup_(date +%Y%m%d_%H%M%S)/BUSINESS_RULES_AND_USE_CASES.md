# Business Rules and Functional Specification: Humano Ops Hub (Cerebro Maestro)

Este documento constituye la especificación funcional completa y fuente única de verdad sobre las reglas de negocio, flujos operativos y políticas de dominio implementadas en el portal **Humano Ops Hub**.

---

## 1. Módulo de Productividad Operativa

### 1.1 Desglose de Procesos y Métricas Integradas
El formulario de productividad (`ProductividadForm.tsx`) captura el desempeño diario por colaborador dividiendo la operación en 5 líneas de proceso principales:
1. **Casos Atendidos / SLA**:
   - Total de Casos Atendidos.
   - Casos Atendidos a Tiempo (SLA).
2. **Emisiones**:
   - Transacciones de Emisiones (`emisiones_tx`).
   - Paginas / Procesados de Emisiones (`emisiones_pg`).
   - Devoluciones de Emisiones (`devoluciones_emisiones`).
3. **Movimientos**:
   - Transacciones de Movimientos (`movimientos_tx`).
   - Paginas / Procesados de Movimientos (`movimientos_pg`).
   - Devoluciones de Movimientos (`devoluciones_movimientos`).
4. **Escaneo**:
   - Transacciones de Escaneo (`escaneo_tx`).
   - Paginas / Procesados de Escaneo (`escaneo_pg`).
   - Devoluciones de Escaneo (`devoluciones_escaneo`).
5. **Gestión de Carnets**:
   - Transacciones de Carnets (`carnets_tx`).
   - Paginas / Procesados de Carnets (`carnets_pg`).

### 1.2 Regla de Devoluciones Condicionales
- El campo numérico de **Devoluciones** es visible y obligatorio **ÚNICAMENTE** para los procesos de **Emisiones**, **Movimientos** y **Escaneo**.
- En cualquier otro tipo de proceso o métrica (Casos Atendidos, Gestión de Carnets), el campo de Devoluciones se oculta por completo del formulario para evitar inconsistencias de captura.

### 1.3 Regla de Control de Fecha y Períodos En Curso (Bloqueo de Día Actual)
- **Restricción Estricta**: No se permite registrar productividad para el día actual en curso (`hoy`) ni para períodos futuros.
- **Lógica de Validación**: El selector de fecha (`FechaRegistro` / `FechaFin`) exige que la fecha ingresada sea estrictamente **anterior a la fecha actual (`fecha < fechaActualSinHora`)**.
- Si el usuario selecciona la fecha del día en curso o posterior, el formulario bloquea el envío y muestra un mensaje de advertencia:
  > *"⚠️ Bloqueo de Período: Solo se puede registrar productividad de días concluidos. El día en curso no ha finalizado."*

### 1.4 Regla de Eliminación de Registros de Productividad
- El botón de eliminación en la tabla/lista de productividad (`ProductividadList.tsx`) está **restringido visual y funcionalmente al rol `admin`**.
- La eliminación exige la confirmación del usuario a través del modal `<ConfirmDialog />` (`DeleteConfirmModal.tsx`), eliminando la llamada a `window.confirm`.
- El manejador pasa el identificador real (`record.id` de tipo UUID o `record.audit_id` de tipo string) devuelto por Supabase, evitando índices numéricos ordinales de tabla.

---

## 2. Módulo de Faltas y Errores Operativos

### 2.1 Clasificación y Tipificación
El módulo de Faltas (`FaltasForm.tsx`) registra incidencias operativas categorizadas en:
- **Falta Disciplinaria**: Tardanzas en minutos, inasistencias, incumplimiento de horario.
- **Error de Proceso**: Errores en captura de datos, reprocesos, omisión de controles.
- **Código de Ética**: Violación de políticas corporativas o confidencialidad.

### 2.2 Atributos Requeridos y Amonestaciones
- **Campos Operativos**: Categoría, Subcategoría, Impacto (Bajo, Medio, Alto, Crítico), Horas Perdidas (`horas_perdidas`), Minutos de Tardanza (`minutos_tardanza`), Hora de Llegada (`hora_llegada`), Número de Ticket/Helpdesk (`id_caso_helpdesk`), Proceso del Área (`proceso_area`), Comentarios y Plan de Capacitación (`comentarios_capacitacion`).
- **Flujo de Aprobación**: Faltas registradas por Asistentes o Agentes ingresan en estado `Pendiente`. Faltas registradas por Supervisores, Gerentes o Admin se aprueban automáticamente (`Aprobado`).

---

## 3. Módulo de Reconocimientos, Kudos y Empleado del Mes

### 3.1 Envío y Asignación de Kudos
- Permite enviar felicitaciones entre colaboradores seleccionando un **Atributo Cultural** (ej: Trabajo en Equipo, Excelencia, Innovación) y asignando un puntaje acumulable.
- Cada Kudo requiere mensaje de felicitación y registra el correo del remitente para auditoría.

### 3.2 Publicación e Histórico de Empleado del Mes
- Al publicar o registrar un nuevo galardón de "Empleado del Mes", se guarda un registro en la tabla `empleado_del_mes` que incluye:
  - Email y Nombre del galardonado.
  - Mes (1-12) y Año del premio.
  - Dedicatoria corporativa.
  - Email y Nombre del supervisor originador (`supervisor_email`, `supervisor_nombre`).
  - **Estado Inicial del Día Libre**: `dia_libre_reclamado = false`.
- La vista de **Histórico de Empleado del Mes** (`EmpleadoMesView.tsx` / `ReconocimientosView.tsx`) muestra la lista histórica de publicaciones consultada desde `getHistorialEmpleadoMes()`.

### 3.3 Gestión de Días Libres no Reclamados (Empleado del Mes)
- **Vinculación Estricta**: Al solicitar una ausencia de tipo *"Día Libre Empleado del Mes"* en `AusenciasForm.tsx`:
  1. El formulario consulta los registros pendientes en Supabase:
     ```ts
     supabase.from('empleado_del_mes').select('*').eq('email_empleado', email).eq('dia_libre_reclamado', false)
     ```
  2. Muestra un selector desplegable obligatorio para que el usuario elija el período específico galardonado que desea canjear.
  3. Al enviar la ausencia, actualiza automáticamente dicho registro en Supabase a `dia_libre_reclamado = true` y almacena `premio_empleado_mes_id`.

---

## 4. Módulo de Ausencias, Vacaciones y Planificación Semanal

### 4.1 Registro de Ausencias y Vacaciones
- Tipos de Ausencia soportados: `Vacaciones`, `Día Libre Cumpleaños`, `Día Libre Empleado del Mes`, `Licencia / Incapacidad`.
- **Regla de Período de Año en Vacaciones**:
  - Al seleccionar el tipo *"Vacaciones"*, el formulario habilita un selector explícito para elegir el **Año del Período Reclamado** (`periodo_anio`, ej: 2024, 2025, 2026), independientemente de la fecha en que se otorga la ausencia.

### 4.2 Matriz de Planificación Semanal de Trabajo
- El componente `PlanificacionSemanal.tsx` genera la matriz de cobertura operativa por día de la semana.
- **Cálculo de Capacidad Neta**: Descuenta automáticamente la capacidad operativa diaria deduciendo los colaboradores que cuentan con ausencias o vacaciones registradas en Supabase (`ausencias`) para el rango semanal seleccionado.

---

## 5. Módulo "Iniciativas & Mejoras" (Historias de Usuario)

### 5.1 Asistente estructurado de Historias de Usuario (`IniciativasMejorasView.tsx`)
El editor se divide en identidad/alcance, narrativa ágil y criterios de aceptación:

#### SECCIÓN 1: Identidad y Metadatos de la Historia
- **Título de la Historia** obligatorio, amplio y destacado.
- Fila responsiva de tres selectores: **Módulo afectado**, **Prioridad** y **Estado**.
- La UI moderna no muestra campos legacy de Tipo de Solicitud, Descripción del Problema, Propuesta de Solución ni Impacto Esperado.
- El módulo funcional seleccionado se persiste en `modulo_clave` y se refleja también como alcance principal para compatibilidad con filas existentes.

#### SECCIÓN 2: Detalle de Historia de Usuario (Estilo Azure DevOps Work Item)
- Encabezado con ícono `GitGraph` y título *"2. Historia de Usuario (Work Item)"*.
- **Título de la Iniciativa**: Input destacado a ancho completo (`text-lg font-semibold bg-slate-900/90 border-slate-800 text-white`).
- **Plantilla Guiada con Badges de Azure DevOps**:
  - 👤 **Como...** (Badge azul: `bg-blue-950/60 text-blue-400 border-blue-800/50`) ➔ Rol del usuario.
  - ✨ **Quiero...** (Badge índigo: `bg-indigo-950/60 text-indigo-400 border-indigo-800/50`) ➔ Funcionalidad/Acción.
  - 🎯 **Para...** (Badge púrpura: `bg-purple-950/60 text-purple-400 border-purple-800/50`) ➔ Valor de negocio.
- **Vista Previa de Work Item**: Genera la narrativa formateada en tiempo real.
- **Layout ergonómico**: En escritorio se usa grid de 12 columnas (`7/5`) con editor a la izquierda y Live Preview sticky a la derecha; en móvil se apilan verticalmente. Como/Quiero/Para se redactan en tres filas amplias, nunca en una fila horizontal comprimida.
- **Criterios de Aceptación Dinámicos**: Permite agregar, reordenar, eliminar y verificar criterios tipo checklist o Dado/Cuando/Entonces.
- El formato de criterios se conmuta mediante pestañas globales Gherkin/Checklist. Cada criterio es una tarjeta independiente: Checklist usa checkbox amplio, campo completo y eliminación alineada; Gherkin apila Dado, Cuando y Entonces al 100% del ancho.
- **Metadatos**: Módulo funcional, prioridad y estado de ciclo de vida.
- **Borradores**: Pueden guardarse incompletos; para enviar a revisión se requieren Como/Quiero/Para y al menos un criterio completo.
- **Live Preview**: La tarjeta lateral refleja narrativa, criterios, prioridad, estado, módulo y propietario en tiempo real.
- **Copiado**: Genera simultáneamente Markdown/texto y HTML limpio para herramientas de trabajo.

### 5.2 Cola de Aprobación de Supervisores (`AprobacionMejorasQueue.tsx`)
- La vista principal vigente no monta una pestaña independiente de aprobación: el módulo expone únicamente Dashboard y Formulario. El componente/RPC se conserva fuera del routing para continuidad técnica del flujo de revisión.
- Permite a los usuarios con `modulo:iniciativas:aprobar` consultar solicitudes en `En Revision` y decidir `Aprobada` o `Descartada`.
- **Modal de Respuesta Obligatorio**:
  - Al presionar *Aprobar* o *Declinar*, se despliega un modal estilizado (`backdrop-blur-sm bg-black/70`).
  - **Regla de Validación de Comentario**: El comentario de retroalimentación exige un mínimo de **10 caracteres obligatorios**. Si el comentario es menor a 10 caracteres, el botón de confirmación se deshabilita.

### 5.3 Dashboard único de iniciativas (`IniciativasMejorasView.tsx`)
`MisSolicitudesMejora.tsx` fue eliminado. `IniciativasMejorasView.tsx` concentra el dashboard y el editor en dos estados internos, con KPIs, búsqueda, filtros por estado y prioridad, tabla operativa y Live Preview.
- Permite seleccionar y copiar listados en Markdown o tabulado.
- El propietario y Admin pueden editar o eliminar según `modulo:iniciativas:editar` y `modulo:iniciativas:eliminar`; la eliminación exige modal oscuro.

### 5.4 Propiedad, RBAC y aislamiento
- Cada fila nueva usa `owner_id = auth.uid()` y el cliente autenticado de Supabase.
- Permisos canónicos: `modulo:iniciativas:ver`, `crear`, `editar`, `eliminar` y `aprobar`.
- La matriz administrativa muestra estos cinco permisos bajo la sección **Iniciativas & Mejoras** y los asigna inicialmente al rol RBAC `admin`.
- Agentes y Asistentes solo leen sus filas salvo permisos explícitos; Admin y revisores autorizados pueden consultar el portafolio necesario para su función.
- La revisión de terceros solo cambia estado y campos de auditoría mediante el RPC restringido `iniciativas_review()`.

---

## 6. Módulos de Configuración y Administración de Usuarios

### 6.1 Control de Accesos y Roles
- La autorización funcional se decide mediante el RBAC de Supabase (`roles`, `permissions`, `role_permissions`, `user_roles`), no por comparaciones rígidas del nombre del rol histórico.
- Catálogo base protegido de cinco roles: `Admin` (`admin`), `Gerente` (`gerente`), `Supervisor` (`supervisor`), `Asistente` (`asistente`) y `Agente` (`agente`). Administración de Usuarios puede crear roles personalizados no sistémicos; un usuario puede acumular permisos mediante varios roles base o personalizados.
- Los códigos `modulo:*:ver` controlan pantallas, navegación y pestañas; los códigos de acción controlan registro, importación, eliminación, publicación y aprobación.
- El rol RBAC canónico `admin` es un superrol efectivo: `hasPermission`, las guardias de navegación y `rbac_has_permission()` le conceden acceso a cualquier pantalla o acción, aunque una asignación explícita del catálogo se encuentre temporalmente rezagada.
- Mientras los permisos cargan, si la consulta falla o si falta el código requerido, la aplicación deniega acceso por defecto.
- Solo `modulo:admin:gestionar_permisos` permite modificar matrices y asignaciones dentro de **Administración de Usuarios**. No se puede retirar al último Admin y Admin conserva todos los permisos.
- `usuarios.rol` se conserva para reglas de alcance operativo y compatibilidad durante la transición; no concede por sí solo permisos de interfaz.

### 6.2 Configuración de Catálogos Jerárquicos con `parent_id` (`CatalogosAdmin.tsx` / `AdminPanel.tsx`)
- Habilita al administrador la creación y mantenimiento de opciones para las categorías: `Falta`, `ErrorProceso`, `CodigoEtica`, `Kudo`, `ProcesoArea`, `aplicativos`, `modulos` y `pantallas`.
- **Vinculación Jerárquica**:
  - Al agregar un **Módulo**, el administrador debe seleccionar obligatoriamente el **Aplicativo Padre** (`parent_id`).
  - Al agregar una **Pantalla**, el administrador debe seleccionar obligatoriamente el **Módulo Padre** (`parent_id`).
  - `parent_id` se persiste en la tabla `catalogos`.

### 6.3 Eliminación Estricta de Mock Data y Datos Ficticios
- Está **estrictamente prohibido** utilizar listas estáticas o fallbacks hardcoded (`DEFAULT_APLICATIVOS`, etc.).
- Si un catálogo no posee opciones en la base de datos, el selector desplegable muestra:
  `"Sin opciones disponibles (Configurar en Configuración)"`.

---
*Fin de Especificación Funcional de Reglas de Negocio.*
