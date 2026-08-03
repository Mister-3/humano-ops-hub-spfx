# Contrato AppDB.xlsx / Power Automate

La SPA no llama SharePoint REST ni Microsoft Graph. Cada operación se guarda primero en IndexedDB (`HumanoOpsHubDB`) y la barra superior permite descargar/importar un paquete JSON para el flujo de Power Automate.

## Tablas Excel requeridas

El libro de OneDrive debe llamarse `AppDB.xlsx` y contener estas tablas con encabezados equivalentes a las propiedades del paquete:

- `Tabla_Faltas`
- `Tabla_Kudos`
- `Tabla_Headcount`
- `Tabla_Ocupacion`

`Tabla_Ocupacion` discrimina sus filas con `TipoRegistro`: `LlamadaFlota` o `Correo`.

## Flujo recomendado

1. Disparador manual o **Cuando se crea un archivo** en la carpeta de intercambio de OneDrive.
2. Acción **Obtener contenido del archivo**.
3. Acción **Analizar JSON** usando `AppDB-package.example.json` como muestra.
4. Para cada arreglo bajo `tables`, use **Aplicar a cada uno**.
5. Inserte o actualice la fila en la tabla homónima usando `AuditID` como clave funcional; `Id` queda como identificador local.
6. Para devolver datos maestros a la SPA, genere el mismo sobre JSON y use **Importar AppDB**.

Los adjuntos binarios permanecen en IndexedDB. El paquete solo exporta sus nombres en la propiedad `Evidencias`, porque una celda de Excel no puede almacenar el contenido binario.

## Headcount e identidad local

`Tabla_Headcount` controla la identidad y el alcance RBAC sin Entra ID:

- `AgenteObjectID`
- `Nombre`
- `Email`
- `Rol`
- `Departamento`
- `SupervisorEmail`
- `Activo`

Puede definir el usuario inicial con `VITE_DEFAULT_USER_EMAIL`. Si no existe, la aplicación utiliza el primer Admin activo o la primera fila disponible.
