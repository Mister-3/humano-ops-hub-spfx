# Business & Operational Context - HumanoOpsHub

## Propósito del Sistema
Plataforma interna para la gestión operativa, control de incidencias (faltas/tardanzas), reconocimientos (kudos) y seguimiento de métricas de personal en el sector asegurador/salud.

## Modelo de Arquitectura Operativa
- **Online-First (Cloud DB)**: La aplicación opera prioritariamente conectada a Supabase en la nube para la persistencia en tiempo real de usuarios, faltas y kudos, manteniendo resiliencia y caché local mediante IndexedDB.
- **Acceso Directo Master Admin**: Las credenciales de administración están configuradas con acceso directo mediante clave fija (`HumSupHub8890-`) para las cuentas de Master Admin (`admin@humano.com.do` y `3urek4.ventalm@gmail.com`).

## Roles y Permisos
- **Master Admin (`admin@humano.com.do` / `3urek4.ventalm@gmail.com`)**: Control total del sistema, aprobación final de accesos, recuperación de cuentas y herramientas avanzadas de sincronización.
- **Admin**: Gestión de usuarios, asignación de roles, validaciones corporativas y sincronización masiva mediante el Panel de Administración.
- **Supervisor**: Registro de faltas, asignación de kudos, registro de jornada y consulta de reportes de equipo.
- **Agente**: Consulta de perfil personal, historial de incidencias y reconocimientos.

## Reglas de Negocio Clave
1. **Registro de Incidencias**: Toda falta debe incluir ID Caso Helpdesk, motivo, horas/minutos perdidos y correo del colaborador.
2. **Sincronización Administrativa Centralizada**: La barra de herramientas de sincronización (exportación/importación `.xlsx` y `.json` para Power Automate, SharePoint y EntraID) está restringida exclusivamente dentro del Panel de Administración (`AdminPanel.tsx`), habiéndose eliminado de la vista general de supervisores y agentes.