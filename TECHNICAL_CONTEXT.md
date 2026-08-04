# Technical Context & Architecture - HumanoOpsHub

## Stack Tecnológico
- Frontend: React + TypeScript + Vite + Tailwind CSS
- Hosting: Vercel
- Cloud DB & Auth: Supabase (PostgreSQL + Supabase Auth)
- Integración Background: Power Automate + Excel (.xlsx) + SharePoint Lists

## Esquema de Tablas (Supabase)
- `usuarios`: id, email, nombre, rol, estado, is_profile_validated_pa, fecha_registro
- `faltas`: id, email_empleado, motivo, id_caso_helpdesk, horas_perdidas, minutos_tardanza, fecha
- `kudos`: id, email_destino, email_origen, motivo, fecha

## Directivas de Código
- Despliegues: Manuales vía terminal (`git push` + `npx vercel --prod --yes`).
- Mapeo Admin: La barra de sincronización se limita al panel administrativo.