# Business & Operational Context - HumanoOpsHub

## 1. Propósito del Sistema
**HumanoOpsHub** es la plataforma centralizada de gestión de operaciones, productividad, control de incidencias (faltas y tardanzas) y reconocimientos (Kudos) diseñada para optimizar los procesos operativos y la gestión del talento humano dentro del sector asegurador y de salud.

La plataforma conecta a los colaboradores, supervisores y administradores en un flujo de trabajo transparente, asegurando la trazabilidad de los eventos operativos, la medición del desempeño y la integración continua con la infraestructura corporativa de Microsoft (Entra ID, SharePoint y Power Automate).

---

## 2. Modelo de Roles y Permisos

El sistema implementa una matriz de control de acceso basada en roles (RBAC) con visibilidad y funcionalidades estrictamente delimitadas:

| Rol | Alcance de Permisos | Vistas y Funcionalidades Accesibles |
| :--- | :--- | :--- |
| **`Agente`** | Personal | • Consulta de su historial de reconocimientos (Kudos) y métricas individuales.<br>• Visualización de incidencias propias y estado de su perfil.<br>• Acceso restringido únicamente a su información personal. |
| **`Supervisor`** | Equipo / Operativo | • Registro y gestión de faltas/incidencias de los miembros de su equipo.<br>• Asignación y otorgamiento de Kudos a colaboradores.<br>• Consulta de reportes y métricas grupales de rendimiento operativo.<br>• Registro de jornada laboral del equipo. |
| **`Admin`** | Global / Administrativo | • Acceso total a la gestión de usuarios y modificación de roles.<br>• Aprobación o deshabilitación manual de cuentas pendientes.<br>• Módulo exclusivo de **Sincronización EntraID / SharePoint / Power Automate** en el Panel Admin.<br>• Consolidación masiva de incidencias y datos operativos. |
| **`Master Admin`** | Superusuario / Sistema | • Todas las funciones de `Admin`.<br>• Acceso mediante bypass con credencial fija corporativa (`HumSupHub8890-`) para correos autorizados (`admin@humano.com.do` y `3urek4.ventalm@gmail.com`).<br>• Capacidad de sobreescribir y autorizar cambios de perfil o rol de cualquier usuario del sistema. |

---

## 3. Ciclos de Vida y Casos de Uso

### 3.1. Registro y Alta de Usuario
1. **Inicio de Registro:** El colaborador completa el formulario de registro corporativo en la interfaz pública.
2. **Inserción Cloud Síncrona:** Se intenta insertar el nuevo usuario en Supabase con el estado inicial `Pending_Admin_Approval`, rol `'Agente'` y validación de perfil en `false`. Si Supabase rechaza la petición, se cancela la creación y se alerta al usuario.
3. **Aprobación de Cuenta:**
   - **Vía Manual:** Un `Admin` o `Master Admin` ingresa a la vista de *Administración de Usuarios* en `AdminPanel.tsx` y aprueba la cuenta cambiando su estado a `Active` y asignándole el rol correspondiente (`Agente`, `Supervisor`, `Admin`, etc.).
   - **Vía Masiva / Power Automate:** El Administrador ejecuta una sincronización corporativa para validar automáticamente las cuentas contra Microsoft Entra ID.

### 3.2. Gestión de Kudos e Incidencias (Faltas)
1. **Creación en Tiempo Real:** El `Supervisor` crea un registro de falta o Kudo en la aplicación.
2. **Persistencia Online-First:** El registro se guarda en la base de datos de Supabase con el identificador único `id`, código de auditoría `audit_id` y la bandera `synced_to_sharepoint = false`.
3. **Resiliencia Local:** Se almacena una copia en `IndexedDB` como respaldo.
4. **Consolidación Masiva:** El `Admin` exporta e integra periódicamente los datos operativos hacia SharePoint Lists a través del flujo de sincronización.

### 3.3. Flujo de Sincronización Corporativa (Power Automate & Entra ID)
Para mantener alineada la base de datos de Supabase con el directorio activo de la empresa (Microsoft Entra ID) y SharePoint:
1. **Exportación Delta:** El Administrador hace clic en "Exportar a Excel / Power Automate" dentro de `AdminSyncSection.tsx` en el Panel de Administración. Se genera el archivo comprimido `AppDB.xlsx` (o `.json`) con usuarios y deltas de sincronización.
2. **Procesamiento Background:** El flujo en Power Automate toma el archivo de OneDrive/SharePoint, valida los correos contra Microsoft Entra ID y comprueba los perfiles corporativos.
3. **Reimportación de Respuestas:** El Administrador importa el archivo de respuesta (`.xlsx` o `.json`) en el Panel de Administración.
4. **Actualización Masiva:** El sistema procesa la respuesta e incrementa el estado de los usuarios a `Active` y establece `is_profile_validated_pa = true` en Supabase.

---

## 4. Reglas de Negocio Clave
1. **Dominio Corporativo Obligatorio:** Solamente se permiten registros con cuentas pertenecientes al dominio `@humano.com.do` (salvo la cuenta Master Admin autorizada `3urek4.ventalm@gmail.com`).
2. **Seguridad y Restricción de Sincronización:** La barra de herramientas de importación/exportación de datos (`SyncToolbar` / `AdminSyncSection`) está restringida de forma exclusiva dentro del Panel de Administración, estando completamente oculta para roles de `Agente` y `Supervisor`.
3. **Integridad de Datos en Registro de Incidencias:** Cada falta debe registrarse con un motivo válido, ID de caso Helpdesk, tiempo perdido (horas y minutos), fecha exacta y correo del colaborador afectado.