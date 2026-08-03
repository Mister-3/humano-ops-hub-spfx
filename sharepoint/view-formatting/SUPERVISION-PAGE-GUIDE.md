# Página `SitePages/Supervision.aspx`

Esta propuesta usa exclusivamente componentes modernos nativos de SharePoint y formatos JSON de vista. El formato modifica la presentación de las listas, no sus datos.

## Archivos entregados

- `registro-faltas-row-formatting.json`: tarjetas operativas oscuras con nivel de escalamiento y acceso a evidencias.
- `registro-reconocimientos-kudos-row-formatting.json`: tarjetas de felicitación con atributo, mensaje y puntos.

## Nombres internos requeridos

Antes de aplicar los formatos, agregue a cada vista las columnas que el JSON referencia, aunque después queden visualmente reemplazadas por la tarjeta.

### Registro_Faltas

`ID`, `Title`, `AuditID`, `FechaFalta`, `Categoria`, `Subcategoria`, `Impacto`, `CasoRef`, `Comentarios`, `RolOriginador`, `EstadoAprobacion`, `Estado_Escalado` y `Attachments`.

`Estado_Escalado` admite números `1`, `2`, `3` o los textos `1era falta`, `2da falta (Alerta)` y `3ra falta / Amonestación`. Los valores no reconocidos se muestran como primera falta.

El botón **Ver evidencias** usa la acción nativa `defaultClick`. Abre el panel del elemento, donde SharePoint muestra sus archivos adjuntos, y evita depender de la URL física de la lista.

### Registro_Reconocimientos / Registro_Kudos

`Title`, `Atributo`, `Mensaje`, `Puntos`, `FechaKudo` y `Remitente`.

El código actual de Humano Ops Hub aprovisiona la lista como `Registro_Kudos`. El mismo JSON puede aplicarse a una lista llamada `Registro_Reconocimientos` siempre que conserve esos nombres internos.

## Aplicación de cada formato

1. Abra la lista y cree una vista pública específica, por ejemplo `Portal - Faltas` o `Portal - Kudos`.
2. Incluya en la vista todos los campos internos enumerados arriba.
3. Seleccione **Opciones de vista > Formato de la vista actual**.
4. Elija el diseño **Lista** y luego **Modo avanzado**.
5. Pegue el contenido completo del JSON correspondiente, seleccione **Vista previa** y después **Guardar**.
6. En la página `Supervision.aspx`, agregue el web part nativo **Lista** y seleccione esa vista pública.

## Maquetación recomendada

### Sección 1 — Cabecera y KPIs

Use una sección vertical de ancho completo.

- **Web part Imagen o Hero:** logo de Humano Ops Hub, título `Portal de Supervisión` y una línea descriptiva corta.
- **Web part Texto:** fecha de actualización y alcance del tablero.
- **Web part Vínculos rápidos:** `Registrar falta`, `Enviar reconocimiento`, `Carga de productividad` y `Planificación semanal`.
- Para KPIs sin código, agregue una vista compacta de una lista de indicadores o varios web parts **Texto** con valores administrados. Mantenga entre tres y cuatro indicadores: pendientes de aprobación, faltas del mes, Kudos del mes y capacidad operativa.

### Sección 2 — Operación y cultura

Use una sección de dos columnas, preferiblemente **dos tercios / un tercio**.

- **Columna izquierda (2/3):** web part **Lista** conectado a `Registro_Faltas`, vista `Portal - Faltas`. Configure un máximo visual razonable y permita `Ver todo`.
- **Columna derecha (1/3):** web part **Lista** conectado a `Registro_Kudos` o `Registro_Reconocimientos`, vista `Portal - Kudos`.
- Coloque un web part **Texto** encima de cada lista como encabezado (`Seguimiento Operativo` y `Reconocimientos Recientes`).

### Sección 3 — Personas y planificación

Use una sección de tres columnas.

- **Cumpleaños:** web part **Personas** para celebraciones del mes o una lista `Cumpleanos` con vista filtrada por mes.
- **Ausencias próximas:** web part **Lista** conectado a `Registro_Ausencias`, filtrado por fechas vigentes/próximas.
- **Plan semanal:** web part **Vínculos rápidos** hacia la vista de planificación y los formularios operativos.

### Sección 4 — Recursos y gobierno

Use una sección contraíble o de una columna al final.

- Documentos de políticas y Código de Ética mediante el web part **Biblioteca de documentos**.
- Contactos de escalamiento mediante **Personas**.
- Texto discreto con propietario funcional, frecuencia de actualización y canal de soporte.

## Recomendaciones operativas

- Publique la página solo después de probar ambas vistas con registros que representen los tres niveles de escalamiento.
- Use audiencias del web part para limitar vistas administrativas; el formato JSON no reemplaza los permisos de SharePoint.
- Mantenga filtros por mes en las vistas del portal para reducir carga y ruido visual.
- Compruebe la experiencia móvil; si las columnas quedan demasiado estrechas, apile los web parts en secciones de una columna.

## Referencias oficiales

- [Formato de vistas de SharePoint](https://learn.microsoft.com/en-us/sharepoint/dev/declarative-customization/view-formatting)
- [Referencia de sintaxis de formato](https://learn.microsoft.com/en-us/sharepoint/dev/declarative-customization/formatting-syntax-reference)
