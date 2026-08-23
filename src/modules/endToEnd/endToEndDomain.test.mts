import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

import {
  addBusinessMinutes,
  analyzeEndToEndRows,
  calculateBusinessMinutes,
  calculateEndToEndSla,
  classifyEndToEndFlow,
  createSantoDomingoDate,
  formatSantoDomingoLocalInput,
  getRetentionCutoff,
  groupEndToEndRows,
  isApiEmissionUser,
  isCriticalEndToEndGroup,
  parseGenerationDateTime,
  parseProcessDateTime,
  parseRadicationDateTime,
  parseSantoDomingoLocalInput,
  resolveRecurrentToday,
  resolveReportedRadications,
  resolveSnapshotStatus
} from './endToEndDomain.ts';
import {
  buildEndToEndClipboardPayload,
  copyEndToEndThenAudit
} from './endToEndClipboard.ts';
import {
  applyEndToEndFilters,
  EMPTY_END_TO_END_FILTERS
} from './endToEndViewModel.ts';
import { hashEndToEndFile, parseEndToEndMatrix } from './endToEndParser.ts';
import type {
  IEndToEndClosure,
  IEndToEndNormalizedRow,
  IEndToEndReportAction
} from '../../types/endToEnd.ts';

const iso = (year: number, month: number, day: number, hour: number, minute = 0): string =>
  createSantoDomingoDate(year, month, day, hour, minute).toISOString();

const baseRow = (
  overrides: Partial<IEndToEndNormalizedRow> = {}
): IEndToEndNormalizedRow => ({
  rowNumber: 12,
  radicacion: '1001',
  radicacionAt: iso(2026, 8, 10, 8),
  usuarioRadicacion: 'OPERADOR',
  tipoLote: 'MOVIMIENTO DE AFILIADOS',
  descripcionNovedad: 'INCLUSION',
  estadoRadicacion: 'RECIBIDA',
  escalado: false,
  estadoDistro: 'N/A',
  canal: 'DIGITAL',
  modalidad: 'Manual',
  cantidadMovimientos: 1,
  cantidadFormularios: 2,
  flow: 'movimiento',
  excludedByRule: false,
  apiEmissionExcluded: false,
  pages: 2,
  duplicateExact: false,
  dataWarnings: [],
  original: { rowNumber: 12, values: { Radicación: '1001' } },
  ...overrides
});

test('normaliza clasificación con precedencia Cancelación > Emisión', () => {
  assert.equal(classifyEndToEndFlow('EMISION', 'CANCELACION DE POLIZA INDIVIDUAL'), 'cancelacion');
  assert.equal(classifyEndToEndFlow('EMISIÓN DE PÓLIZA', ''), 'emision');
  assert.equal(classifyEndToEndFlow('ACTUALIZACION ONBASE', ''), 'movimiento');
  assert.equal(isApiEmissionUser(' API-Emision_USR '), true);
});

test('parsers de fecha respetan convenciones distintas', () => {
  assert.equal(parseRadicationDateTime('10/08/2026', '08:30:00')?.toISOString(), iso(2026, 8, 10, 8, 30));
  assert.equal(parseProcessDateTime('08/10/2026 09:45:00')?.toISOString(), iso(2026, 8, 10, 9, 45));
  assert.equal(parseGenerationDateTime('10/08/2026 20:31')?.toISOString(), iso(2026, 8, 10, 20, 31));
  assert.equal(parseSantoDomingoLocalInput('2026-08-10T20:31')?.toISOString(), iso(2026, 8, 10, 20, 31));
  assert.equal(formatSantoDomingoLocalInput(createSantoDomingoDate(2026, 8, 10, 20, 31)), '2026-08-10T20:31');
});

test('calendario cuenta lunes-viernes, sábado y omite domingo', () => {
  assert.equal(calculateBusinessMinutes(
    createSantoDomingoDate(2026, 8, 10, 8),
    createSantoDomingoDate(2026, 8, 10, 17), []
  ), 540);
  assert.equal(calculateBusinessMinutes(
    createSantoDomingoDate(2026, 8, 15, 9),
    createSantoDomingoDate(2026, 8, 15, 13), []
  ), 240);
  assert.equal(calculateBusinessMinutes(
    createSantoDomingoDate(2026, 8, 16, 8),
    createSantoDomingoDate(2026, 8, 16, 17), []
  ), 0);
});

test('calendario respeta feriados y cierres parciales', () => {
  const closures: IEndToEndClosure[] = [
    { date: '2026-08-10', description: 'Feriado', type: 'nacional', allDay: true, active: true },
    { date: '2026-08-11', description: 'Actividad', type: 'interno', allDay: false, startTime: '10:00', endTime: '12:00', active: true }
  ];
  assert.equal(calculateBusinessMinutes(
    createSantoDomingoDate(2026, 8, 10, 8),
    createSantoDomingoDate(2026, 8, 11, 17), closures
  ), 420);
});

test('inicios fuera de horario pasan a la siguiente apertura', () => {
  assert.equal(
    addBusinessMinutes(createSantoDomingoDate(2026, 8, 10, 19), 60, []).toISOString(),
    iso(2026, 8, 11, 9)
  );
});

test('semáforo aplica límites exactos de 4, 6 y 8 horas', () => {
  const generation = createSantoDomingoDate(2026, 8, 10, 12);
  assert.equal(calculateEndToEndSla(baseRow(), generation, []).severity, 'amarillo');
  assert.equal(calculateEndToEndSla(baseRow(), createSantoDomingoDate(2026, 8, 10, 14), []).severity, 'naranja');
  assert.equal(calculateEndToEndSla(baseRow(), createSantoDomingoDate(2026, 8, 10, 16), []).severity, 'rojo');
});

test('Críticas excluye 5h59 y 8h, e incluye 6h y 7h59', () => {
  const groupAt = (minutes: number) => groupEndToEndRows(analyzeEndToEndRows(
    [baseRow()],
    new Date(createSantoDomingoDate(2026, 8, 10, 8).getTime() + minutes * 60000),
    []
  ))[0];

  const before = groupAt(5 * 60 + 59);
  const lowerBound = groupAt(6 * 60);
  const upperBound = groupAt(7 * 60 + 59);
  const expired = groupAt(8 * 60);

  assert.equal(before.severity, 'amarillo');
  assert.equal(isCriticalEndToEndGroup(before), false);
  assert.equal(lowerBound.severity, 'naranja');
  assert.equal(isCriticalEndToEndGroup(lowerBound), true);
  assert.equal(upperBound.severity, 'naranja');
  assert.equal(isCriticalEndToEndGroup(upperBound), true);
  assert.equal(expired.severity, 'rojo');
  assert.equal(isCriticalEndToEndGroup(expired), false);
});

test('completada exactamente a ocho horas cumple', () => {
  const row = baseRow({
    fechaEscaneo: iso(2026, 8, 10, 9),
    fechaAprobacion: iso(2026, 8, 10, 16),
    fechaSincronizado: iso(2026, 8, 10, 15)
  });
  const result = calculateEndToEndSla(row, createSantoDomingoDate(2026, 8, 10, 20), []);
  assert.equal(result.completed, true);
  assert.equal(result.consumedMinutes, 480);
  assert.equal(result.compliant, true);
  assert.equal(result.severity, 'verde');
});

test('Emisiones espera aprobación y sincronización y usa la fecha mayor', () => {
  const open = calculateEndToEndSla(baseRow({
    fechaEscaneo: iso(2026, 8, 10, 9),
    fechaAprobacion: iso(2026, 8, 10, 10)
  }), createSantoDomingoDate(2026, 8, 10, 11), []);
  assert.equal(open.completed, false);
  assert.equal(open.stage, 'Pendiente de sincronización');

  const closed = calculateEndToEndSla(baseRow({
    fechaEscaneo: iso(2026, 8, 10, 9),
    fechaAprobacion: iso(2026, 8, 10, 10),
    fechaSincronizado: iso(2026, 8, 10, 11)
  }), createSantoDomingoDate(2026, 8, 10, 12), []);
  assert.equal(closed.endAt, iso(2026, 8, 10, 11));
});

test('Cancelación termina por escaneo y escalado no pausa SLA', () => {
  const result = calculateEndToEndSla(baseRow({
    flow: 'cancelacion',
    escalado: true,
    fechaEscaneo: iso(2026, 8, 10, 10)
  }), createSantoDomingoDate(2026, 8, 10, 16), []);
  assert.equal(result.endAt, iso(2026, 8, 10, 10));
  assert.match(result.action, /notificar/i);
});

test('RECIBIDO SIN REVISAR se excluye, pero el estado gestionable usa el inicio original', () => {
  const excluded = baseRow({ excludedByRule: true, estadoRadicacion: 'RECIBIDO SIN REVISAR' });
  assert.equal(calculateEndToEndSla(excluded, createSantoDomingoDate(2026, 8, 10, 12), []).severity, 'gris');
  const transitioned = baseRow({ estadoRadicacion: 'RECIBIDA' });
  assert.equal(calculateEndToEndSla(transitioned, createSantoDomingoDate(2026, 8, 10, 12), []).consumedMinutes, 240);
});

test('estado COMPLETADA sin fechas finales permanece visible para conciliación', () => {
  const report = parseEndToEndMatrix({
    fileName: 'inconsistente.csv', fileHash: 'hash-completada', importedBy: 'user',
    generationOverride: createSantoDomingoDate(2026, 8, 10, 12),
    rows: [[
      'Radicación', 'Fecha Radicación', 'Hora Radicación', 'Usuario Radicación',
      'Tipo de Lote', 'Descripción Novedad', 'Estado Radicación', 'Fecha Escaneo',
      'Fecha Aprobación', 'Fecha Sincronizado', 'Escalado', 'ESTADO DISTRO',
      'Canal', 'Modalidad Solicitud', 'Cantidad Movimientos', 'Cantidad Formularios'
    ], [
      '1001', '10/08/2026', '08:00:00', 'USR', 'MOVIMIENTO DE AFILIADOS', 'ALTA',
      'COMPLETADA', 'N/A', 'N/A', 'N/A', 'NO', 'N/A', 'DIGITAL', 'Manual', '1', '2'
    ]]
  });
  assert.equal(report.rows[0].excludedByRule, false);
  const result = calculateEndToEndSla(
    report.rows[0], createSantoDomingoDate(2026, 8, 10, 12), []
  );
  assert.equal(result.completed, false);
  assert.equal(result.reconciliationRequired, true);
});

test('agrupación suma páginas y toma el peor semáforo', () => {
  const rows = analyzeEndToEndRows([
    baseRow({ rowNumber: 12, pages: 2 }),
    baseRow({ rowNumber: 13, pages: 3, radicacionAt: iso(2026, 8, 7, 8) })
  ], createSantoDomingoDate(2026, 8, 10, 12), []);
  const [group] = groupEndToEndRows(rows);
  assert.equal(group.pages, 5);
  assert.equal(group.severity, 'rojo');
});

test('parser detecta encabezado dinámico, duplicado exacto y CSV equivalente', () => {
  const headers = [
    'Radicación', 'Fecha Radicación', 'Hora Radicación', 'Usuario Radicación',
    'Tipo de Lote', 'Descripción Novedad', 'Estado Radicación', 'Fecha Escaneo',
    'Fecha Aprobación', 'Fecha Sincronizado', 'Escalado', 'ESTADO DISTRO',
    'Canal', 'Modalidad Solicitud', 'Cantidad Movimientos', 'Cantidad Formularios'
  ];
  const row = ['1001', '10/08/2026', '08:00:00', 'USR', 'MOVIMIENTO', 'ALTA', 'RECIBIDA', 'N/A', 'N/A', 'N/A', 'NO', 'N/A', 'DIGITAL', 'Manual', '1', '2'];
  const report = parseEndToEndMatrix({
    fileName: 'fixture.csv', fileHash: 'hash', importedBy: 'user',
    generationOverride: createSantoDomingoDate(2026, 8, 10, 12),
    rows: [['metadato'], headers, row, row]
  });
  assert.equal(report.summary.headerRow, 2);
  assert.equal(report.summary.detectedRows, 2);
  assert.equal(report.summary.duplicateRows, 1);
});

test('fotografías detectan duplicidad temporal, antigüedad y retención', () => {
  assert.equal(resolveSnapshotStatus('2026-08-11T12:00:00Z'), 'active');
  assert.equal(resolveSnapshotStatus('2026-08-11T12:00:00Z', '2026-08-11T12:00:00Z'), 'conflict');
  assert.equal(resolveSnapshotStatus('2026-08-10T12:00:00Z', '2026-08-11T12:00:00Z'), 'older');
  assert.equal(getRetentionCutoff(new Date('2026-08-11T12:00:00Z')), '2026-08-04T12:00:00.000Z');
});

test('hash idéntico permite rechazar una fotografía duplicada', async () => {
  const first = await hashEndToEndFile(new TextEncoder().encode('fotografía completa').buffer);
  const second = await hashEndToEndFile(new TextEncoder().encode('fotografía completa').buffer);
  const different = await hashEndToEndFile(new TextEncoder().encode('otra fotografía').buffer);
  assert.equal(first, second);
  assert.notEqual(first, different);
});

test('marcado, reversión y reincidencia respetan orden y día local', () => {
  const actions: IEndToEndReportAction[] = [
    { snapshotId: 'old', radicaciones: ['1001'], action: 'copy_mark', userEmail: 'u', createdAt: iso(2026, 8, 11, 9) },
    { snapshotId: 'active', radicaciones: ['1002'], action: 'copy_mark', userEmail: 'u', createdAt: iso(2026, 8, 11, 10) },
    { snapshotId: 'active', radicaciones: ['1002'], action: 'undo_reported', userEmail: 'u', createdAt: iso(2026, 8, 11, 11) }
  ];
  assert.deepEqual([...resolveReportedRadications(actions, 'active')], []);
  assert.deepEqual([...resolveRecurrentToday(
    'active', iso(2026, 8, 11, 12), new Set(['1001']),
    new Map([['old', iso(2026, 8, 11, 8)], ['active', iso(2026, 8, 11, 12)]]), actions
  )], ['1001']);
  assert.deepEqual([...resolveRecurrentToday(
    'next-day', iso(2026, 8, 12, 8), new Set(['1001']),
    new Map([['old', iso(2026, 8, 11, 8)], ['next-day', iso(2026, 8, 12, 8)]]), actions
  )], []);
});

test('copiado termina antes de auditar y las columnas sensibles son opt-in', async () => {
  const [group] = groupEndToEndRows(analyzeEndToEndRows([
    baseRow({ poliza: 'PRIVADA-1', director: 'Dirección A' })
  ], createSantoDomingoDate(2026, 8, 10, 12), []));
  const defaultPayload = buildEndToEndClipboardPayload([group], iso(2026, 8, 10, 12));
  assert.doesNotMatch(defaultPayload.text, /PRIVADA-1/);
  const customPayload = buildEndToEndClipboardPayload(
    [group], iso(2026, 8, 10, 12), new Set(['poliza'])
  );
  assert.match(customPayload.text, /PRIVADA-1/);

  const order: string[] = [];
  await copyEndToEndThenAudit(
    defaultPayload,
    async () => { order.push('audit'); },
    async () => { order.push('copy'); }
  );
  assert.deepEqual(order, ['copy', 'audit']);

  let audited = false;
  await assert.rejects(copyEndToEndThenAudit(
    defaultPayload,
    async () => { audited = true; },
    async () => { throw new Error('clipboard denied'); }
  ));
  assert.equal(audited, false);
});

test('tarjetas y gráficos aplican filtros combinados a la tabla', () => {
  const groups = groupEndToEndRows(analyzeEndToEndRows([
    baseRow({ radicacion: '1001', radicacionAt: iso(2026, 8, 10, 10) }),
    baseRow({
      rowNumber: 13,
      radicacion: '1002',
      radicacionAt: iso(2026, 8, 10, 8),
      canal: 'OFICINA VIRTUAL',
      modalidad: 'Automatica'
    })
  ], createSantoDomingoDate(2026, 8, 10, 14), []));

  assert.deepEqual(applyEndToEndFilters(groups, {
    ...EMPTY_END_TO_END_FILTERS,
    severity: 'critica'
  }).map((group) => group.radicacion), ['1002']);
  assert.deepEqual(applyEndToEndFilters(groups, {
    ...EMPTY_END_TO_END_FILTERS,
    priority: 'officeAutomatic'
  }).map((group) => group.radicacion), ['1002']);
});

test('migración incremental aísla datos por auth.uid y permite hash por propietario', async () => {
  const migration = await fs.readFile(new URL(
    '../../../supabase/migrations/202608190001_end_to_end_user_isolation.sql',
    import.meta.url
  ), 'utf8');

  assert.match(migration, /owner_id uuid references auth\.users\(id\)/);
  assert.match(migration, /owner_id = auth\.uid\(\)/);
  assert.match(migration, /e2e_snapshots_owner_hash_unique_idx/);
  assert.match(migration, /on public\.e2e_snapshots \(owner_id, file_hash\)/);
  assert.match(migration, /revoke all on public\.%I from anon/);
  assert.match(migration, /e2e_cancellation_aliases_shared_read/);
  assert.match(migration, /e2e_non_working_periods_shared_read/);
});
