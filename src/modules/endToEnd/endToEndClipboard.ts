import type { IEndToEndGroup } from '../../types';
import { formatSantoDomingoDateTime } from './endToEndDomain.ts';

export type EndToEndOptionalCopyColumn =
  | 'poliza'
  | 'intermediario'
  | 'director'
  | 'gerente';

export interface IEndToEndClipboardPayload {
  html: string;
  text: string;
}

const SEVERITY_LABELS: Record<IEndToEndGroup['severity'], string> = {
  verde: 'Cumple / < 4 h',
  amarillo: 'Atención · 4–6 h',
  naranja: 'Prioridad · 6–8 h',
  rojo: 'Vencida / incumplida',
  gris: 'Excluida',
  error: 'Error de datos'
};

const formatMinutes = (minutes?: number): string => {
  if (minutes === undefined) return 'No calculable';
  const sign = minutes < 0 ? 'Vencida por ' : '';
  const absolute = Math.abs(minutes);
  return `${sign}${Math.floor(absolute / 60)} h ${absolute % 60} min`;
};

const escapeHtml = (value: string): string => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

export const buildEndToEndClipboardPayload = (
  groups: ReadonlyArray<IEndToEndGroup>,
  generationAt: string,
  optionalColumns: ReadonlySet<EndToEndOptionalCopyColumn> = new Set()
): IEndToEndClipboardPayload => {
  const headers: string[] = [
    'Semáforo', 'Radicación', 'Páginas', 'Tipo de lote', 'Novedades',
    'Fecha y hora de radicación', 'Tiempo consumido', 'Tiempo restante', 'Etapa',
    'Canal', 'Modalidad', 'Estado Distro', 'Acción recomendada', 'Reincidente hoy'
  ];
  const optionalDefinitions = [
    { key: 'poliza' as const, label: 'Póliza' },
    { key: 'intermediario' as const, label: 'Intermediario' },
    { key: 'director' as const, label: 'Director' },
    { key: 'gerente' as const, label: 'Gerente' }
  ].filter((column) => optionalColumns.has(column.key));
  headers.push(...optionalDefinitions.map((column) => column.label));

  const rows = groups.map((group) => [
    SEVERITY_LABELS[group.severity], group.radicacion, String(group.pages), group.tipoLote,
    group.novedades.join(' | '), formatSantoDomingoDateTime(group.radicacionAt),
    formatMinutes(group.consumedMinutes), formatMinutes(group.remainingMinutes), group.stage,
    group.canal, group.modalidad, group.estadoDistro, group.action,
    group.reincidenteHoy ? 'Sí' : 'No',
    ...optionalDefinitions.map((column) => group[column.key] || '')
  ]);
  const title = `Reporte End-to-End · Generado: ${formatSantoDomingoDateTime(generationAt)}`;
  const text = [title, headers.join('\t'), ...rows.map((row) => row.join('\t'))].join('\n');
  const html = `<h3>${escapeHtml(title)}</h3><table border="1" cellspacing="0" cellpadding="5"><thead><tr>${
    headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')
  }</tr></thead><tbody>${rows.map((row) => `<tr>${
    row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')
  }</tr>`).join('')}</tbody></table>`;
  return { html, text };
};

export const copyEndToEndPayload = async (
  payload: IEndToEndClipboardPayload
): Promise<void> => {
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
    await navigator.clipboard.write([new ClipboardItem({
      'text/plain': new Blob([payload.text], { type: 'text/plain' }),
      'text/html': new Blob([payload.html], { type: 'text/html' })
    })]);
    return;
  }
  await navigator.clipboard.writeText(payload.text);
};

export const copyEndToEndThenAudit = async (
  payload: IEndToEndClipboardPayload,
  audit: () => Promise<void>,
  copy: (value: IEndToEndClipboardPayload) => Promise<void> = copyEndToEndPayload
): Promise<void> => {
  await copy(payload);
  await audit();
};
