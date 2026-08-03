import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..");
const OUTPUT_PATH = path.join(PROJECT_ROOT, "AppDB.xlsx");
const PREVIEW_DIR = path.join(os.tmpdir(), "humano-ops-appdb-preview");
const INSPECTION_ARTIFACT_PATH = path.join(PROJECT_ROOT, "AppDB.xlsx.inspect.ndjson");
process.env.XDG_CACHE_HOME ||= path.join(os.tmpdir(), "humano-ops-appdb-cache");

const TABLE_STYLE = "TableStyleMedium2";
const HEADER_FILL = "#0B5CAD";
const HEADER_TEXT = "#FFFFFF";
const BODY_TEXT = "#1F2937";
const BORDER_COLOR = "#D7E3F1";

const tableDefinitions = [
  {
    sheetName: "Usuarios",
    tableName: "Tabla_Usuarios",
    columns: [
      "ID",
      "Email",
      "PasswordHash",
      "Nombre",
      "Rol",
      "Estado",
      "IsProfileValidatedByPA",
      "FechaRegistro",
      "FechaAprobacion",
    ],
    widths: [16, 30, 28, 30, 20, 26, 26, 22, 22],
    rows: [
      [
        "USR-000001",
        "admin@humano.com.do",
        "",
        "Administrador Maestro",
        "Master_Admin",
        "Active",
        true,
        new Date(),
        new Date(),
      ],
    ],
    dateColumns: [7, 8],
    booleanColumns: [6],
  },
  {
    sheetName: "Headcount",
    tableName: "Tabla_Headcount",
    columns: [
      "ID",
      "EmailEmpleado",
      "NombreEmpleado",
      "Cargo",
      "Departamento",
      "EmailSupervisor",
      "EstadoActivo",
    ],
    widths: [16, 30, 30, 28, 24, 30, 18],
    rows: [],
    dateColumns: [],
    booleanColumns: [6],
  },
  {
    sheetName: "Faltas",
    tableName: "Tabla_Faltas",
    columns: [
      "ID",
      "EmailEmpleado",
      "NombreEmpleado",
      "EmailSupervisor",
      "FechaFalta",
      "TipoFalta",
      "Motivo",
      "EstadoEscalado",
      "RequiereAmonestacion",
      "Sincronizado",
      "FechaCreacion",
      "IdCasoHelpdesk",
      "ProcesoArea",
      "HorasPerdidas",
      "MinutosTardanza",
      "HoraLlegada",
      "OrigenError",
      "SubcategoriaError",
      "ComentariosCapacitacion",
      "IdAuditoria",
    ],
    widths: [
      16, 30, 30, 30, 20, 24, 42, 20, 24, 18, 22,
      24, 26, 22, 22, 18, 24, 30, 42, 24,
    ],
    rows: [],
    dateColumns: [4, 10],
    booleanColumns: [8, 9],
    numberColumns: [13, 14],
  },
  {
    sheetName: "Kudos",
    tableName: "Tabla_Kudos",
    columns: [
      "ID",
      "EmailEmisor",
      "EmailReceptor",
      "NombreReceptor",
      "Atributo",
      "Mensaje",
      "Fecha",
      "Sincronizado",
    ],
    widths: [16, 30, 30, 30, 26, 48, 22, 18],
    rows: [],
    dateColumns: [6],
    booleanColumns: [7],
  },
  {
    sheetName: "Ocupacion",
    tableName: "Tabla_Ocupacion",
    columns: [
      "ID",
      "EmailEmpleado",
      "Fecha",
      "TipoAusencia",
      "CoberturaAsignada",
      "Observaciones",
      "Sincronizado",
    ],
    widths: [16, 30, 22, 28, 30, 48, 18],
    rows: [],
    dateColumns: [2],
    booleanColumns: [6],
  },
  {
    sheetName: "Notificaciones",
    tableName: "Tabla_Notificaciones",
    columns: [
      "ID",
      "Tipo",
      "Destinatario",
      "Mensaje",
      "Fecha",
      "Sincronizado",
    ],
    widths: [24, 28, 34, 64, 22, 18],
    rows: [],
    dateColumns: [4],
    booleanColumns: [5],
  },
];

function columnLetter(index) {
  let value = index + 1;
  let result = "";

  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }

  return result;
}

async function loadArtifactTool() {
  try {
    return await import("@oai/artifact-tool");
  } catch (primaryError) {
    const configuredPath = process.env.CODEX_ARTIFACT_TOOL_PATH;
    const bundledPath = path.join(
      os.homedir(),
      ".cache",
      "codex-runtimes",
      "codex-primary-runtime",
      "dependencies",
      "node",
      "node_modules",
      "@oai",
      "artifact-tool",
      "dist",
      "artifact_tool.mjs",
    );
    const fallbackPath = configuredPath || bundledPath;

    if (!existsSync(fallbackPath)) {
      throw new Error(
        "No se encontró @oai/artifact-tool. Configure CODEX_ARTIFACT_TOOL_PATH con la ruta a artifact_tool.mjs.",
        { cause: primaryError },
      );
    }

    return import(pathToFileURL(fallbackPath).href);
  }
}

function configureSheet(sheet, definition) {
  const lastColumn = columnLetter(definition.columns.length - 1);
  // Excel/Power Automate recognizes an empty structured table reliably when
  // its reference includes one reserved data row. A header-only ref (A1:G1)
  // is valid XML but can be ignored by the Excel Online connector.
  const tableRows = definition.rows.length > 0
    ? definition.rows
    : [definition.columns.map(() => null)];
  const headerRange = sheet.getRange(`A1:${lastColumn}1`);
  headerRange.values = [definition.columns];
  headerRange.format = {
    fill: HEADER_FILL,
    font: { bold: true, color: HEADER_TEXT, size: 11 },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    wrapText: true,
    borders: { preset: "outside", style: "thin", color: BORDER_COLOR },
    rowHeight: 30,
  };

  const lastDataRow = tableRows.length + 1;
  const dataRange = sheet.getRange(`A2:${lastColumn}${lastDataRow}`);
  dataRange.values = tableRows;
  dataRange.format = {
    font: { color: BODY_TEXT, size: 10 },
    verticalAlignment: "center",
    wrapText: false,
    rowHeight: 24,
  };

  for (let index = 0; index < definition.columns.length; index += 1) {
    const letter = columnLetter(index);
    sheet.getRange(`${letter}:${letter}`).format.columnWidth = definition.widths[index];
  }

  if (definition.rows.length > 0) {
    const lastDataRow = definition.rows.length + 1;
    for (const columnIndex of definition.dateColumns) {
      const letter = columnLetter(columnIndex);
      sheet.getRange(`${letter}2:${letter}${lastDataRow}`).format.numberFormat = "yyyy-mm-dd hh:mm";
    }

    for (const columnIndex of definition.booleanColumns) {
      const letter = columnLetter(columnIndex);
      sheet.getRange(`${letter}2:${letter}${lastDataRow}`).format.horizontalAlignment = "center";
    }
  }

  for (const columnIndex of definition.numberColumns || []) {
    const letter = columnLetter(columnIndex);
    sheet.getRange(`${letter}2:${letter}${lastDataRow}`).format.numberFormat = "0.00";
  }

  const lastTableRow = tableRows.length + 1;
  const table = sheet.tables.add(`A1:${lastColumn}${lastTableRow}`, true, definition.tableName);
  table.style = TABLE_STYLE;
  table.showHeaders = true;
  table.showFilterButton = true;
  table.showBandedRows = true;

  sheet.freezePanes.freezeRows(1);
  sheet.showGridLines = false;
}

function validateTableObjects(workbook, sourceLabel) {
  const discoveredNames = [];

  for (const definition of tableDefinitions) {
    const sheet = workbook.worksheets.getItem(definition.sheetName);
    const tableNames = sheet.tables.items.map((table) => table.name);
    if (!tableNames.includes(definition.tableName)) {
      throw new Error(
        `${sourceLabel}: no se encontró ${definition.tableName} en la hoja ${definition.sheetName}.`,
      );
    }
    discoveredNames.push(definition.tableName);
  }

  if (new Set(discoveredNames).size !== tableDefinitions.length) {
    throw new Error(`${sourceLabel}: existen nombres de tabla duplicados.`);
  }
}

async function validateWorkbook(workbook) {
  const inspection = await workbook.inspect({
    kind: "workbook,sheet",
    maxChars: 4000,
  });

  const inspectionText = inspection?.ndjson || JSON.stringify(inspection);
  validateTableObjects(workbook, "Modelo en memoria");

  await fs.rm(PREVIEW_DIR, { recursive: true, force: true });
  await fs.mkdir(PREVIEW_DIR, { recursive: true });

  for (const definition of tableDefinitions) {
    const preview = await workbook.render({
      sheetName: definition.sheetName,
      autoCrop: "all",
      scale: 1,
      format: "png",
    });
    const previewBytes = new Uint8Array(await preview.arrayBuffer());
    await fs.writeFile(path.join(PREVIEW_DIR, `${definition.sheetName}.png`), previewBytes);
  }

  return inspectionText;
}

async function main() {
  await fs.rm(INSPECTION_ARTIFACT_PATH, { force: true });
  const { FileBlob, SpreadsheetFile, Workbook } = await loadArtifactTool();
  const workbook = Workbook.create();

  for (const definition of tableDefinitions) {
    const sheet = workbook.worksheets.add(definition.sheetName);
    configureSheet(sheet, definition);
  }

  const inspectionText = await validateWorkbook(workbook);
  const output = await SpreadsheetFile.exportXlsx(workbook);
  await output.save(OUTPUT_PATH);
  await fs.rm(INSPECTION_ARTIFACT_PATH, { force: true });

  // Reopen the serialized package so validation covers the emitted OpenXML,
  // relationships and table definitions rather than only the live JS model.
  const serializedWorkbook = await SpreadsheetFile.importXlsx(
    await FileBlob.load(OUTPUT_PATH),
  );
  validateTableObjects(serializedWorkbook, "Paquete OpenXML reimportado");

  const outputStats = await fs.stat(OUTPUT_PATH);
  if (outputStats.size === 0) {
    throw new Error("AppDB.xlsx fue generado con tamaño cero.");
  }

  console.log(`AppDB.xlsx generado: ${OUTPUT_PATH}`);
  console.log(`Tamaño: ${outputStats.size} bytes`);
  console.log(`Tablas: ${tableDefinitions.map((item) => item.tableName).join(", ")}`);
  console.log(`Validación OpenXML: OK (${tableDefinitions.length} Excel Tables reimportadas)`);
  console.log(`Previsualizaciones QA: ${PREVIEW_DIR}`);
  console.log(inspectionText);
}

main().catch((error) => {
  console.error("No fue posible generar AppDB.xlsx.");
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
