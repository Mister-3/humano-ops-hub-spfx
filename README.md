# Humano Ops Hub

SPA React + TypeScript local-first para supervisión operativa. La aplicación persiste datos en IndexedDB, funciona en móvil/laptop y sincroniza diferencias con `AppDB.xlsx` mediante paquetes JSON procesados por Power Automate.

## Módulos principales

- Autenticación corporativa restringida a `@humano.com.do`.
- Flujo `Pending_Validation` → `Pending_Admin_Approval` → `Active`.
- Administración de usuarios exclusiva para `Master_Admin`.
- Faltas, Kudos, Productividad, Ausencias y Ocupación.
- Dashboard y Evaluación de Rendimiento con RBAC.
- Sincronización manual de `Tabla_Usuarios`, `Tabla_Headcount`, `Tabla_Faltas`, `Tabla_Kudos` y `Tabla_Ocupacion`.
- Soporte PWA/offline después de la primera carga.

## Desarrollo

```bash
npm install
npm run dev
npm run build
npm run generate:appdb
```

## Cuenta inicial

- Correo: `admin@humano.com.do`
- Rol: `Master_Admin`
- Credencial de arranque: se entrega al responsable fuera del repositorio.

El código cliente contiene únicamente un hash PBKDF2 con salt. La contraseña no se almacena en Git ni en el bundle de Vercel.

El contrato de Power Automate se documenta en `docs/power-automate/README.md`.
