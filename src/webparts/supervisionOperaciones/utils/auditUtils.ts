const DEFAULT_AUDIT_PREFIX = 'OPS';
const AUDIT_RANDOM_LENGTH = 4;
const AUDIT_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

const padTwoDigits = (value: number): string =>
  value < 10 ? `0${value}` : String(value);

const getRandomIndex = (): number => {
  if (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.getRandomValues === 'function'
  ) {
    const randomValue = new Uint32Array(1);
    globalThis.crypto.getRandomValues(randomValue);
    return randomValue[0] % AUDIT_ALPHABET.length;
  }

  return Math.floor(Math.random() * AUDIT_ALPHABET.length);
};

const normalizePrefix = (prefix: string): string => {
  const normalizedPrefix = prefix
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  return normalizedPrefix || DEFAULT_AUDIT_PREFIX;
};

/**
 * Genera el identificador legible usado para rastrear operaciones entre la UI,
 * SharePoint y los procesos de auditoría. El sufijo criptográfico se limita a
 * cuatro caracteres para preservar el formato OPS-YYYYMMDD-XXXX.
 */
export const generateAuditID = (prefix = DEFAULT_AUDIT_PREFIX): string => {
  const now = new Date();
  const dateSegment =
    `${now.getFullYear()}` +
    `${padTwoDigits(now.getMonth() + 1)}` +
    `${padTwoDigits(now.getDate())}`;
  let randomSegment = '';

  for (let index = 0; index < AUDIT_RANDOM_LENGTH; index += 1) {
    randomSegment += AUDIT_ALPHABET[getRandomIndex()];
  }

  return `${normalizePrefix(prefix)}-${dateSegment}-${randomSegment}`;
};
