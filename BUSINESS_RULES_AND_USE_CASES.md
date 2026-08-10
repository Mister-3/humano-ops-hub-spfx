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
- El botón de eliminación en la tabla/lista de productividad (`ProductividadList.tsx`) está **restringido visual y funcionalmente al rol `admin` / `Master_Admin`**.
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
- **Flujo de Aprobación**: Faltas registradas por usuarios de nivel Analista o Asistente ingresan en estado `Pendiente`. Faltas registradas por Supervisores o Administradores se aprueban automáticamente (`Aprobado`).

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

### 5.1 Estructura del Formulario en 2 Secciones Distintas (`SolicitudMejoraForm.tsx`)
El registro de propuestas se divide estrictamente en dos secciones visuales:

#### SECCIÓN 1: Ubicación y Alcance del Sistema
- Encabezado con ícono `Layers` y título *"1. Ubicación de la Mejora"*.
- Layout en Grid de 3 columnas responsivo (`grid grid-cols-1 md:grid-cols-3 gap-4`).
- **Desplegables Jerárquicos en Cascada (Dinámicos sin Mocks)**:
  1. **Aplicativo** (`*` Obligatorio): Carga ítems activos de `catalogos` donde `categoria === 'aplicativos'`.
  2. **Módulo** (`*` Obligatorio): Se habilita tras seleccionar Aplicativo. Filtra ítems donde `categoria === 'modulos'` y `parent_id === aplicativoSeleccionado`.
  3. **Pantalla / Sección** (`*` **OBLIGATORIO**): Se habilita tras seleccionar Módulo. Filtra ítems donde `categoria === 'pantallas'` y `parent_id === moduloSeleccionado`.
- **REGLA DE VALIDACIÓN**: La selección de **Pantalla** es obligatoria. El botón de registro permanece deshabilitado hasta contar con una Pantalla seleccionada.

#### SECCIÓN 2: Detalle de Historia de Usuario (Estilo Azure DevOps Work Item)
- Encabezado con ícono `GitGraph` y título *"2. Historia de Usuario (Work Item)"*.
- **Título de la Iniciativa**: Input destacado a ancho completo (`text-lg font-semibold bg-slate-900/90 border-slate-800 text-white`).
- **Plantilla Guiada con Badges de Azure DevOps**:
  - 👤 **Como...** (Badge azul: `bg-blue-950/60 text-blue-400 border-blue-800/50`) ➔ Rol del usuario.
  - ✨ **Quiero...** (Badge índigo: `bg-indigo-950/60 text-indigo-400 border-indigo-800/50`) ➔ Funcionalidad/Acción.
  - 🎯 **Para...** (Badge púrpura: `bg-purple-950/60 text-purple-400 border-purple-800/50`) ➔ Valor de negocio.
- **Vista Previa de Work Item**: Genera la narrativa formateada en tiempo real.
- **Criterios de Aceptación**: Textarea amplio a ancho completo con borde destacado en azul tenue (`border-blue-900/40`).

### 5.2 Cola de Aprobación de Supervisores (`AprobacionMejorasQueue.tsx`)
- Permite a los supervisores consultar las solicitudes en estado `Pendiente_Aprobacion`.
- **Modal de Respuesta Obligatorio**:
  - Al presionar *Aprobar* o *Declinar*, se despliega un modal estilizado (`backdrop-blur-sm bg-black/70`).
  - **Regla de Validación de Comentario**: El comentario de retroalimentación exige un mínimo de **10 caracteres obligatorios**. Si el comentario es menor a 10 caracteres, el botón de confirmación se deshabilita.

### 5.3 Vista "Mis Solicitudes" (`MisSolicitudesMejora.tsx`)
- Muestra al colaborador el listado de sus iniciativas registradas con los distintivos de estado (`Pendiente`, `Aprobada`, `Declinada`), etiquetas de aplicativo/módulo/pantalla y la retroalimentación emitida por el supervisor.

---

## 6. Módulo de Administración y Catálogos

### 6.1 Control de Accesos y Roles
- Definición de jerarquía de roles: `Master_Admin` > `Admin` > `Gerente` > `Supervisor` > `Analista` > `Asistente` > `Oficial`.
- `Master_Admin` y `Admin` poseen acceso total al panel de administración (`UserAdminPanel.tsx` y `AdminPanel.tsx`), modificación de configuraciones del sistema y eliminación de registros.

### 6.2 Gestión de Catálogos Jerárquicos con `parent_id` (`CatalogosAdmin.tsx` / `AdminPanel.tsx`)
- Habilita al administrador la creación y mantenimiento de opciones para las categorías: `Falta`, `ErrorProceso`, `CodigoEtica`, `Kudo`, `ProcesoArea`, `aplicativos`, `modulos` y `pantallas`.
- **Vinculación Jerárquica**:
  - Al agregar un **Módulo**, el administrador debe seleccionar obligatoriamente el **Aplicativo Padre** (`parent_id`).
  - Al agregar una **Pantalla**, el administrador debe seleccionar obligatoriamente el **Módulo Padre** (`parent_id`).
  - `parent_id` se persiste en la tabla `catalogos`.

### 6.3 Eliminación Estricta de Mock Data y Datos Ficticios
- Está **estrictamente prohibido** utilizar listas estáticas o fallbacks hardcoded (`DEFAULT_APLICATIVOS`, etc.).
- Si un catálogo no posee opciones en la base de datos, el selector desplegable muestra:
  `"Sin opciones disponibles (Configurar en Admin)"`.

---
*Fin de Especificación Funcional de Reglas de Negocio.*
