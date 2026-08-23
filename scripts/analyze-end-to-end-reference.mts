import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ExcelJS from 'exceljs';

import { parseEndToEndMatrix } from '../src/modules/endToEnd/endToEndParser.ts';
import {
  analyzeEndToEndRows,
  groupEndToEndRows,
  isCriticalEndToEndGroup
} from '../src/modules/endToEnd/endToEndDomain.ts';

const filePath = new URL('../Reportes_EndToEnd_20260811.xlsx', import.meta.url);
const buffer = await fs.readFile(filePath);
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.load(buffer);
const worksheet = workbook.getWorksheet('Reportes') || workbook.worksheets[0];
const rows: unknown[][] = [];
worksheet.eachRow({ includeEmpty: true }, (row) => {
  const values: unknown[] = [];
  for (let column = 1; column <= worksheet.columnCount; column += 1) {
    values.push(row.getCell(column).value);
  }
  rows.push(values);
});

const report = parseEndToEndMatrix({
  fileName: 'Reportes_EndToEnd_20260811.xlsx',
  fileHash: 'reference-analysis',
  importedBy: 'integration-test@humano.com.do',
  rows,
  sourceSheet: worksheet.name
});

const emissionsBeforeApi = report.rows.filter((row) => row.flow === 'emision');
const apiRows = emissionsBeforeApi.filter((row) => row.apiEmissionExcluded);
const manageableEmissionRadications = new Set(
  emissionsBeforeApi
    .filter((row) => !row.apiEmissionExcluded && !row.excludedByRule)
    .map((row) => row.radicacion)
);
const emissionsAfterApiRadications = new Set(
  emissionsBeforeApi
    .filter((row) => !row.apiEmissionExcluded)
    .map((row) => row.radicacion)
);
const nonEmissions = report.rows.filter((row) => row.flow !== 'emision');
const escalatedRows = report.rows.filter((row) => row.escalado);
const analyzedGroups = groupEndToEndRows(analyzeEndToEndRows(
  report.rows,
  new Date(report.summary.generationAt as string),
  []
)).filter((group) => group.rows.some((row) => row.sla.severity !== 'gris'));

const metrics = {
  rows: report.summary.detectedRows,
  uniqueRadications: report.summary.uniqueRadicaciones,
  declaredTotal: report.summary.declaredTotal,
  repeatedRadications: report.summary.repeatedRadicaciones,
  duplicateRows: report.summary.duplicateRows,
  emissionsBeforeApi: emissionsBeforeApi.length,
  apiEmissionRows: apiRows.length,
  emissionsAfterApiRadications: emissionsAfterApiRadications.size,
  manageableEmissionRadications: manageableEmissionRadications.size,
  nonEmissionRows: nonEmissions.length,
  nonEmissionRadications: new Set(nonEmissions.map((row) => row.radicacion)).size,
  escalatedRows: escalatedRows.length,
  escalatedRadications: new Set(escalatedRows.map((row) => row.radicacion)).size,
  expiredSlaRadications: analyzedGroups.filter((group) => group.severity === 'rojo').length,
  criticalRadications: analyzedGroups.filter(isCriticalEndToEndGroup).length,
  criticalIssues: report.summary.issues.filter((issue) => issue.level === 'critical').length,
  warnings: report.summary.issues.filter((issue) => issue.level === 'warning').length
};

assert.equal(metrics.expiredSlaRadications, 86, 'El Excel debe producir 86 SLA vencidas.');
assert.equal(metrics.criticalRadications, 32, 'El Excel debe producir 32 radicaciones críticas.');
console.log(JSON.stringify(metrics, null, 2));
