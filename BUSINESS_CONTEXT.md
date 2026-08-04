# Business & Operational Context - HumanoOpsHub

## Propósito del Sistema
Plataforma interna para la gestión operativa, control de incidencias (faltas/tardanzas), reconocimientos (kudos) y seguimiento de métricas de personal en el sector asegurador/salud.

## Roles y Permisos
- Master Admin (3urek4.ventalm@gmail.com): Control total del sistema, aprobación final de accesos y recuperaciones.
- Admin: Gestión de usuarios, validaciones y sincronización masiva con EntraID.
- Supervisor: Registro de faltas, asignación de kudos y consulta de reportes de equipo.
- Agente: Consulta de perfil personal e historial.

## Reglas de Negocio Clave
1. Registro de Incidencias: Toda falta debe incluir ID Caso Helpdesk, motivo, horas/minutos perdidos y correo del colaborador.
2. Aprobación Híbrida: La app opera online para el día a día. La validación de empleados corporativos se realiza mediante exportación/importación en lote hacia Excel/Power Automate para contrastar con EntraID y actualizar SharePoint.