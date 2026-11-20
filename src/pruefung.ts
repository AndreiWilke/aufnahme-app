// Plausibilitätsprüfungen der Aufnahme. Nur Hinweise für die Bedienung: Sie sperren nichts,
// ändern keine Daten und gehen nicht in den Export ein.
import type { EinheitAufnahme, FotoRolle, Heizflaeche, HfTyp, Raum } from './model';

/** Schwerer Mangel einer Heizfläche, der vor „Raum erledigt“ und vor dem Export gemeldet wird. */
export type HfMangel = 'leer' | 'ohne_art';

/** true, wenn keine Bauhöhe, Baulänge und Bautiefe eingetragen ist. */
function ohneMasse(h: Heizflaeche): boolean {
  return h.bauhoehe_mm.wert === null && h.baulaenge_mm.wert === null && h.bautiefe_mm.wert === null;
}

/**
 * Leer: keine Maße und keine Fotos. Eine Fußbodenheizung hat keine Maße, sie gilt daher nicht als leer.
 * Ohne Art: Art nicht gewählt, sonst aber etwas eingetragen.
 */
export function hfMangel(h: Heizflaeche): HfMangel | null {
  if (h.art !== 'fussbodenheizung' && ohneMasse(h) && h.fotos.length === 0) return 'leer';
  if (h.art === null) return 'ohne_art';
  return null;
}

export function hfMangelText(m: HfMangel): string {
  return m === 'leer' ? 'leer (keine Maße, keine Fotos)' : 'Art fehlt';
}

/** Hinweis, wenn eine Heizfläche Fotos hat, aber keines mit der Rolle „Ventil“. Nicht bei Fußbodenheizung. */
export function ventilFotoFehlt(h: Heizflaeche, rollen: readonly FotoRolle[]): boolean {
  if (h.art === 'fussbodenheizung') return false;
  return rollen.length > 0 && !rollen.includes('Ventil');
}

/** Übliche Bautiefe einer Plattenheizung je Typ in mm (Richtwerte). */
export const BAUTIEFE_RICHTWERT: Partial<Record<HfTyp, readonly [number, number]>> = {
  '10': [40, 65],
  '11': [40, 65],
  '20': [60, 80],
  '21': [60, 80],
  '22': [95, 105],
  '33': [150, 160],
};

/** Weicher Hinweis, wenn die Bautiefe nicht zum Typ der Plattenheizung passt. Sonst null. */
export function bautiefeHinweis(h: Heizflaeche): string | null {
  if (h.art !== 'platte' || !h.typ) return null;
  const t = h.bautiefe_mm.wert;
  const b = BAUTIEFE_RICHTWERT[h.typ];
  if (t === null || !b) return null;
  const [min, max] = b;
  if (t >= min && t <= max) return null;
  return `Bautiefe ${t} mm ist für Typ ${h.typ} ungewöhnlich (üblich etwa ${min}–${max} mm). Bitte Typ und Tiefe prüfen.`;
}

export interface HfBefund {
  hf_id: string;
  nr: number;
  mangel: HfMangel;
  text: string;
}

/** Mängel der Heizflächen eines Raums, nach Nummer sortiert. */
export function raumMaengel(r: Raum): HfBefund[] {
  const l: HfBefund[] = [];
  for (const h of r.heizflaechen) {
    const m = hfMangel(h);
    if (m) l.push({ hf_id: h.hf_id, nr: h.nr, mangel: m, text: `HK${h.nr}: ${hfMangelText(m)}` });
  }
  return l.sort((x, y) => x.nr - y.nr);
}

export interface RaumBefund {
  einheit_id: string;
  raum_id: string;
  raum: string;
  erledigt: boolean;
  maengel: HfBefund[];
}

/** Übersicht vor dem Export: alle Räume mit mangelhaften Heizflächen. */
export function exportMaengel(aufnahmen: readonly EinheitAufnahme[]): RaumBefund[] {
  const l: RaumBefund[] = [];
  for (const a of aufnahmen)
    for (const r of a.raeume) {
      const maengel = raumMaengel(r);
      if (maengel.length)
        l.push({ einheit_id: a.einheit_id, raum_id: r.raum_id, raum: `${r.nr} ${r.name}`.trim(), erledigt: r.erledigt, maengel });
    }
  return l;
}
