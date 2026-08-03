# Contrato AppDB.xlsx / Power Automate v2

Humano Ops Hub trabaja en modo local-first. Cada operación se guarda en IndexedDB (`HumanoOpsHubDB`) y la barra superior genera o importa un paquete diferencial JSON para que Power Automate actualice `AppDB.xlsx` en OneDrive.

## Tablas oficiales

- `Tabla_Usuarios`
- `Tabla_Headcount`
- `Tabla_Faltas`
- `Tabla_Kudos`
- `Tabla_Ocupacion`

Los nombres y encabezados del paquete coinciden con el libro generado mediante `npm run generate:appdb`.

## Flujo recomendado

1. El usuario pulsa **Sincronizar a OneDrive / Excel** y descarga `AppDB-Delta-YYYYMMDD.json`.
2. Power Automate analiza el JSON con `AppDB-package.example.json` como muestra.
3. Para cada arreglo de `tables`, Power Automate inserta o actualiza la fila en la tabla homónima usando `ID` como clave funcional.
4. Power Automate valida los correos de `Tabla_Usuarios`. Cuando la identidad exista en el directorio corporativo, establece `IsProfileValidatedByPA=true` y `Estado=Pending_Admin_Approval`.
5. Power Automate devuelve un paquete con el mismo contrato. La opción **Importar respuesta** fusiona las filas en IndexedDB; no elimina datos creados desde otro dispositivo.
6. El Master Admin autoriza al usuario y asigna `Supervisor`, `Asistente` o `Admin`.

## Identidad y alcance

`Tabla_Headcount` usa los encabezados `ID`, `EmailEmpleado`, `NombreEmpleado`, `Cargo`, `Departamento`, `EmailSupervisor` y `EstadoActivo`.

Para un Supervisor, la SPA incluye únicamente filas activas cuyo `EmailSupervisor` coincide con el correo autenticado. Ese alcance se propaga a Faltas, Kudos, Ocupación, Dashboard e historiales.

## Cuenta maestra

- Correo: `admin@humano.com.do`
- Rol: `Master_Admin`
- Estado: `Active`
- Credencial de arranque: entregada fuera del repositorio.

El bundle contiene únicamente un hash PBKDF2 con salt. Power Automate puede reemplazar `PasswordHash` mediante el paquete de retorno para rotar la credencial.
