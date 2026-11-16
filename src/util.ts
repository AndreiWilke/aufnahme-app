import type { Messwert, MessStatus } from './model';

export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  // Fallback für ältere Umgebungen
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const zwei = (n: number) => String(n).padStart(2, '0');

/** ISO-Zeit mit lokalem Offset, z. B. 2026-12-05T16:10:00+01:00 */
export function isoJetzt(d: Date = new Date()): string {
  const off = -d.getTimezoneOffset();
  const vz = off >= 0 ? '+' : '-';
  const oa = Math.abs(off);
  return (
    `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}` +
    `T${zwei(d.getHours())}:${zwei(d.getMinutes())}:${zwei(d.getSeconds())}` +
    `${vz}${zwei(Math.floor(oa / 60))}:${zwei(oa % 60)}`
  );
}

/** Zeitstempel für Dateinamen: JJJJ-MM-TT_HHMM */
export function dateiZeit(d: Date = new Date()): string {
  return `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}_${zwei(d.getHours())}${zwei(d.getMinutes())}`;
}

export function zeitVergleich(a: string | null, b: string | null): number {
  const ta = a ? Date.parse(a) : 0;
  const tb = b ? Date.parse(b) : 0;
  return ta - tb;
}

export function leerMesswert(): Messwert {
  return { wert: null, status: null };
}

/** Setzt einen Messwert; Standardstatus ist „gemessen“. Ohne Wert kein Status. */
export function setzeMesswert(alt: Messwert, wert: number | null, status?: MessStatus): Messwert {
  if (wert === null || Number.isNaN(wert)) return { wert: null, status: null };
  return { wert, status: status ?? alt.status ?? 'gemessen' };
}

/** Kurzform für Dateinamen: Umlaute bleiben erhalten, Leerzeichen/Punkte/Sonderzeichen entfallen. */
export function kurz(text: string, max = 24): string {
  const t = text
    .normalize('NFC')
    .replace(/[\\/:*?"<>|#%&{}$!'@+`=]/g, '')
    .replace(/[.\s,;()[\]]+/g, '')
    .replace(/_/g, '-');
  return t.slice(0, max);
}

export function formatDatum(iso: string): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const tage = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  return `${tage[d.getDay()]} ${m[3]}.${m[2]}.${m[1]}`;
}

export function formatZeit(iso: string | null): string {
  if (!iso) return '–';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${zwei(d.getDate())}.${zwei(d.getMonth() + 1)}. ${zwei(d.getHours())}:${zwei(d.getMinutes())}`;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2).replace('.', ',')} GB`;
}

export function zahlOderNull(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
