// Export: aufnahme.json, CSV-Dateien (Excel DE) und Fotos als ZIP (fflate, Streaming).
import { Zip, ZipDeflate, ZipPassThrough, strToU8 } from 'fflate';
import type {
  EinheitAufnahme,
  FotoMeta,
  Heizflaeche,
  MessStatus,
  PlanEinheit,
  Projekt,
  Pruefpunkt,
  Raum,
} from './model';
import { APP_VERSION, HZ_PUNKTE, SCHEMA_VERSION } from './model';
import { dateiZeit, isoJetzt, zeitVergleich } from './util';

export type ExportArt = 'komplett' | 'delta';

// ---------------- Delta-Logik ----------------

/** Einheit hat Änderungen, die noch nicht exportiert wurden. */
export function hatUnexportierteAenderungen(a: EinheitAufnahme): boolean {
  if (!a.geaendert_am) return false;
  if (!a.letzter_export) return true;
  return zeitVergleich(a.geaendert_am, a.letzter_export) > 0;
}

export function fotoNichtExportiert(f: FotoMeta): boolean {
  return f.exportiert_am === null;
}

// ---------------- aufnahme.json ----------------

function messwertExport(m: { wert: number | null; status: MessStatus | null }) {
  return { wert: m.wert, status: m.wert === null ? null : (m.status ?? 'gemessen') };
}

function hfExport(h: Heizflaeche) {
  return {
    hf_id: h.hf_id,
    nr: h.nr,
    art: h.art,
    typ: h.art === 'platte' ? h.typ : null,
    bauhoehe_mm: messwertExport(h.bauhoehe_mm),
    baulaenge_mm: messwertExport(h.baulaenge_mm),
    bautiefe_mm: messwertExport(h.bautiefe_mm),
    gliederzahl: h.art === 'glieder' || h.art === 'roehren' ? h.gliederzahl : null,
    anschluss: h.anschluss,
    ventil: { ...h.ventil },
    lage: h.lage,
    // Ohne Angabe gilt „nein“; ältere Aufnahmen mit Maßen gelten als „ja“. Fußbodenheizung: null.
    nische_vorhanden:
      h.art === 'fussbodenheizung' ? null : (h.nische_vorhanden ?? (h.nische_mm.breite !== null || h.nische_mm.hoehe !== null)),
    nische_mm: {
      breite: h.nische_mm.breite,
      hoehe: h.nische_mm.hoehe,
      status: h.nische_mm.breite === null && h.nische_mm.hoehe === null ? null : (h.nische_mm.status ?? 'gemessen'),
    },
    notiz: h.notiz,
    fotos: [...h.fotos],
    geaendert_am: h.geaendert_am,
  };
}

// Ergänzungen 1.5.0: ältere Aufnahmen haben diese Felder noch nicht.
export function raumZusatz(r: Raum) {
  return {
    keine_heizflaeche: r.keine_heizflaeche ?? false,
    lichte_hoehe_m: messwertExport(r.lichte_hoehe_m ?? { wert: null, status: null }),
    beheizt_vor_ort: r.beheizt_vor_ort ?? null,
  };
}

export function pruefpunktExport(q: Pruefpunkt) {
  return {
    id: q.id,
    text: q.text,
    antwort: q.antwort,
    wert: messwertExport(q.wert),
    notiz: q.notiz,
    fotos: [...q.fotos],
    erledigt: q.erledigt,
    geaendert_am: q.geaendert_am,
  };
}

export function einheitExport(a: EinheitAufnahme) {
  return {
    einheit_id: a.einheit_id,
    aufgenommen_eh: a.aufgenommen_eh,
    aufgenommen_bezeichnung: a.aufgenommen_bezeichnung,
    status: a.status,
    abweichung_vom_plan: a.abweichung_vom_plan,
    notiz: a.notiz,
    gewerbe: a.gewerbe ? { ...a.gewerbe } : { nutzungszeiten: '', soll_temp_c: null, ansprechpartner: '' },
    zeit_start: a.zeit_start,
    zeit_ende: a.zeit_ende,
    raeume: a.raeume.map((r) => ({
      raum_id: r.raum_id,
      nr: r.nr,
      name: r.name,
      nutzung: r.nutzung,
      flaeche_plan_m2: r.flaeche_plan_m2,
      soll_temp_c: r.soll_temp_c,
      herkunft: r.herkunft,
      zustand: r.zustand,
      erledigt: r.erledigt,
      notiz: r.notiz,
      im_plan_entfallen: r.im_plan_entfallen ?? false,
      heizflaechen: r.heizflaechen.map(hfExport),
      fenster: r.fenster.map((f) => ({
        fenster_id: f.fenster_id,
        anzahl: f.anzahl,
        verglasung: f.verglasung,
        rahmen: f.rahmen,
        breite_mm: f.breite_mm,
        hoehe_mm: f.hoehe_mm,
        masse_status: f.breite_mm === null && f.hoehe_mm === null ? null : (f.masse_status ?? 'gemessen'),
        fotos: [...f.fotos],
        art: f.art ?? null,
        erneuert: f.erneuert ?? null,
        baujahr: f.baujahr ?? null,
        geaendert_am: f.geaendert_am,
      })),
      ...raumZusatz(r),
      geaendert_am: r.geaendert_am,
    })),
    heizzentrale: a.heizzentrale
      ? {
          punkte: a.heizzentrale.punkte.map((p) => ({
            ...p,
            status: p.wert === null ? null : (p.status ?? 'gemessen'),
            fotos: [...p.fotos],
          })),
          abgaenge: a.heizzentrale.abgaenge.map((g) => ({ ...g, fotos: [...g.fotos] })),
          geaendert_am: a.heizzentrale.geaendert_am,
        }
      : null,
    pruefpunkte: (a.pruefpunkte ?? []).map(pruefpunktExport),
    im_plan_entfallen: a.im_plan_entfallen ?? false,
    geaendert_am: a.geaendert_am,
  };
}

export function aufnahmeJson(
  projekt: Projekt,
  aufnahmen: EinheitAufnahme[],
  art: ExportArt,
  umfang: string,
  exportZeit: string,
) {
  return {
    schema_version: SCHEMA_VERSION,
    projekt_id: projekt.projekt_id,
    export_zeit: exportZeit,
    app_version: APP_VERSION,
    export_art: art,
    export_umfang: umfang,
    projekt: {
      name: projekt.name,
      importiert_am: projekt.importiert_am,
      nutzungsarten: projekt.nutzungsarten,
      // Feste Feldliste: neue Planfelder (quelle, eh_zusatz, wohnungstyp, dauer_min) ändern den Export nicht.
      einheiten: projekt.einheiten.map((e) => ({
        einheit_id: e.einheit_id,
        eh: e.eh,
        bezeichnung: e.bezeichnung,
        art: e.art,
        geschoss: e.geschoss,
        datum: e.datum,
        uhrzeit: e.uhrzeit,
        ersatz: e.ersatz.map((x) => ({ eh: x.eh, bezeichnung: x.bezeichnung })),
        raeume: e.raeume.map((r) => ({
          raum_id: r.raum_id,
          nr: r.nr,
          name: r.name,
          nutzung: r.nutzung,
          flaeche_plan_m2: r.flaeche_plan_m2,
          soll_temp_c: r.soll_temp_c,
        })),
        hinweis: e.hinweis,
      })),
    },
    einheiten: aufnahmen.map(einheitExport),
  };
}

// ---------------- CSV (UTF-8 mit BOM, Semikolon, Dezimalkomma) ----------------

type Zelle = string | number | boolean | null | undefined;

function zelle(v: Zelle): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'ja' : 'nein';
  if (typeof v === 'number') return String(v).replace('.', ',');
  const s = String(v);
  if (/[;"\r\n]/.test(s) || /^\s|\s$/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function csv(kopf: string[], zeilen: Zelle[][]): string {
  const z = [kopf.map(zelle).join(';'), ...zeilen.map((r) => r.map(zelle).join(';'))];
  return '﻿' + z.join('\r\n') + '\r\n';
}

export function csvDateien(projekt: Projekt, aufnahmen: EinheitAufnahme[]): Record<string, string> {
  const plan = new Map<string, PlanEinheit>(projekt.einheiten.map((e) => [e.einheit_id, e]));

  const einheiten = aufnahmen.map((a) => {
    const p = plan.get(a.einheit_id);
    const vorhanden = a.raeume.filter((r) => r.zustand === 'vorhanden');
    return [
      projekt.projekt_id, a.einheit_id, p?.art, p?.eh, p?.bezeichnung, p?.geschoss, p?.datum, p?.uhrzeit,
      a.aufgenommen_eh, a.aufgenommen_bezeichnung, a.status, a.abweichung_vom_plan, a.notiz,
      a.gewerbe?.nutzungszeiten, a.gewerbe?.soll_temp_c, a.gewerbe?.ansprechpartner,
      a.zeit_start, a.zeit_ende, vorhanden.length, vorhanden.filter((r) => r.erledigt).length,
      a.raeume.reduce((s, r) => s + r.heizflaechen.length, 0), a.im_plan_entfallen ?? false, a.geaendert_am,
    ] as Zelle[];
  });

  const raeume: Zelle[][] = [];
  const hf: Zelle[][] = [];
  const fenster: Zelle[][] = [];
  const hz: Zelle[][] = [];
  const pp: Zelle[][] = [];

  for (const a of aufnahmen) {
    const ppPlan = new Map((plan.get(a.einheit_id)?.pruefpunkte ?? []).map((d) => [d.id, d]));
    for (const q0 of a.pruefpunkte ?? []) {
      const q = pruefpunktExport(q0);
      const d = ppPlan.get(q.id);
      pp.push([
        a.einheit_id, q.id, d?.ort, q.text, d?.typ, q.antwort, q.wert.wert, d?.einheit, q.wert.status,
        q.notiz, q.erledigt, q.fotos.join(', '), q.geaendert_am,
      ]);
    }
    for (const r of a.raeume) {
      const z = raumZusatz(r);
      raeume.push([
        a.einheit_id, r.raum_id, r.nr, r.name, r.nutzung, r.flaeche_plan_m2, r.soll_temp_c, r.herkunft,
        r.zustand, r.erledigt, r.heizflaechen.length, r.fenster.reduce((s, f) => s + (f.anzahl ?? 0), 0),
        r.im_plan_entfallen ?? false, r.notiz, r.geaendert_am,
        z.keine_heizflaeche, z.lichte_hoehe_m.wert, z.lichte_hoehe_m.status, z.beheizt_vor_ort,
      ]);
      for (const h0 of r.heizflaechen) {
        const h = hfExport(h0);
        hf.push([
          a.einheit_id, r.raum_id, r.name, h.hf_id, h.nr, h.art, h.typ,
          h.bauhoehe_mm.wert, h.bauhoehe_mm.status, h.baulaenge_mm.wert, h.baulaenge_mm.status,
          h.bautiefe_mm.wert, h.bautiefe_mm.status, h.gliederzahl, h.anschluss,
          h.ventil.hersteller_text, h.ventil.voreinstellung_ablesbar, h.ventil.voreinstellung_wert, h.ventil.thermostatkopf,
          h.lage, h.nische_vorhanden, h.nische_mm.breite, h.nische_mm.hoehe, h.nische_mm.status, h.notiz, h.fotos.join(', '), h.geaendert_am,
        ]);
      }
      for (const f of r.fenster) {
        fenster.push([
          a.einheit_id, r.raum_id, r.name, f.fenster_id, f.anzahl, f.verglasung, f.rahmen, f.breite_mm, f.hoehe_mm,
          f.breite_mm === null && f.hoehe_mm === null ? null : (f.masse_status ?? 'gemessen'), f.fotos.join(', '), f.geaendert_am,
          f.art ?? null, f.erneuert ?? null, f.baujahr ?? null,
        ]);
      }
    }
    if (a.heizzentrale) {
      for (const p of a.heizzentrale.punkte) {
        const def = HZ_PUNKTE.find((d) => d.punkt_id === p.punkt_id);
        hz.push([
          a.einheit_id, 'punkt', p.punkt_id, def?.bezeichnung ?? p.punkt_id, p.vorhanden, p.text, p.wert,
          p.wert === null ? null : (p.status ?? 'gemessen'), null, null, p.notiz, p.fotos.join(', '), p.geaendert_am,
        ]);
      }
      for (const g of a.heizzentrale.abgaenge) {
        hz.push([
          a.einheit_id, 'abgang', g.abgang_id, `Abgang ${g.nr}: ${g.bezeichnung}`, null, g.bezeichnung, null, null,
          g.pumpe, g.mischer_stellantrieb, g.notiz, g.fotos.join(', '), g.geaendert_am,
        ]);
      }
    }
  }

  return {
    'einheiten.csv': csv(
      ['projekt_id', 'einheit_id', 'art', 'eh_plan', 'bezeichnung_plan', 'geschoss', 'datum', 'uhrzeit',
        'aufgenommen_eh', 'aufgenommen_bezeichnung', 'status', 'abweichung_vom_plan', 'notiz',
        'gewerbe_nutzungszeiten', 'gewerbe_soll_temp_c', 'gewerbe_ansprechpartner', 'zeit_start', 'zeit_ende',
        'raeume_vorhanden', 'raeume_erledigt', 'anzahl_heizflaechen', 'im_plan_entfallen', 'geaendert_am'],
      einheiten,
    ),
    'raeume.csv': csv(
      ['einheit_id', 'raum_id', 'nr', 'name', 'nutzung', 'flaeche_plan_m2', 'soll_temp_c', 'herkunft', 'zustand',
        'erledigt', 'anzahl_heizflaechen', 'anzahl_fenster', 'im_plan_entfallen', 'notiz', 'geaendert_am',
        'keine_heizflaeche', 'lichte_hoehe_m', 'lichte_hoehe_status', 'beheizt_vor_ort'],
      raeume,
    ),
    'heizflaechen.csv': csv(
      ['einheit_id', 'raum_id', 'raum_name', 'hf_id', 'nr', 'art', 'typ', 'bauhoehe_mm', 'bauhoehe_status',
        'baulaenge_mm', 'baulaenge_status', 'bautiefe_mm', 'bautiefe_status', 'gliederzahl', 'anschluss',
        'ventil_hersteller_text', 'ventil_voreinstellung_ablesbar', 'ventil_voreinstellung_wert', 'ventil_thermostatkopf',
        'lage', 'nische_vorhanden', 'nische_breite_mm', 'nische_hoehe_mm', 'nische_status', 'notiz', 'fotos', 'geaendert_am'],
      hf,
    ),
    'fenster.csv': csv(
      ['einheit_id', 'raum_id', 'raum_name', 'fenster_id', 'anzahl', 'verglasung', 'rahmen', 'breite_mm', 'hoehe_mm',
        'masse_status', 'fotos', 'geaendert_am', 'art', 'erneuert', 'baujahr'],
      fenster,
    ),
    'heizzentrale.csv': csv(
      ['einheit_id', 'bereich', 'id', 'bezeichnung', 'vorhanden', 'text', 'wert', 'status', 'pumpe',
        'mischer_stellantrieb', 'notiz', 'fotos', 'geaendert_am'],
      hz,
    ),
    'pruefpunkte.csv': csv(
      ['einheit_id', 'pruefpunkt_id', 'ort', 'text', 'typ', 'antwort', 'wert', 'wert_einheit', 'status', 'notiz',
        'erledigt', 'fotos', 'geaendert_am'],
      pp,
    ),
  };
}

// ---------------- ZIP ----------------

export function exportDateiname(projekt_id: string, art: ExportArt, umfangKurz: string, d = new Date()): string {
  return `Aufnahme_${projekt_id}_${dateiZeit(d)}_${art}_${umfangKurz}.zip`;
}

export interface ExportEingabe {
  projekt: Projekt;
  aufnahmen: EinheitAufnahme[];
  fotos: FotoMeta[];
  art: ExportArt;
  umfang: string;
  umfangKurz: string;
  fotoLaden: (foto_id: string) => Promise<Blob | undefined>;
  fortschritt?: (fertig: number, gesamt: number) => void;
}

export interface ExportErgebnis {
  datei: File;
  dateiname: string;
  exportZeit: string;
  fotosExportiert: FotoMeta[];
  fehlendeFotos: string[];
}

export async function zipErstellen(e: ExportEingabe): Promise<ExportErgebnis> {
  const jetzt = new Date();
  const exportZeit = isoJetzt(jetzt);
  const dateiname = exportDateiname(e.projekt.projekt_id, e.art, e.umfangKurz, jetzt);
  const teile: Uint8Array[] = [];
  let fehler: Error | null = null;
  let fertig!: () => void;
  const ende = new Promise<void>((r) => (fertig = r));

  const zip = new Zip((err, daten, final) => {
    if (err) {
      fehler = err;
      fertig();
      return;
    }
    teile.push(daten);
    if (final) fertig();
  });

  const textDatei = (name: string, inhalt: string) => {
    const f = new ZipDeflate(name, { level: 6 });
    f.mtime = jetzt;
    zip.add(f);
    f.push(strToU8(inhalt), true);
  };

  textDatei(
    'aufnahme.json',
    JSON.stringify(aufnahmeJson(e.projekt, e.aufnahmen, e.art, e.umfang, exportZeit), null, 2),
  );
  for (const [name, inhalt] of Object.entries(csvDateien(e.projekt, e.aufnahmen))) textDatei(name, inhalt);

  const fehlendeFotos: string[] = [];
  const exportiert: FotoMeta[] = [];
  let i = 0;
  for (const m of e.fotos) {
    const blob = await e.fotoLaden(m.foto_id);
    i++;
    e.fortschritt?.(i, e.fotos.length);
    if (!blob) {
      fehlendeFotos.push(m.dateiname);
      continue;
    }
    const daten = new Uint8Array(await blob.arrayBuffer());
    // JPEG ist bereits komprimiert: ohne erneute Kompression speichern (schneller, weniger Speicher)
    const f = new ZipPassThrough(`fotos/${m.einheit_id}/${m.dateiname}`);
    f.mtime = new Date(m.erstellt_am);
    zip.add(f);
    f.push(daten, true);
    exportiert.push(m);
    if (fehler) break;
  }
  zip.end();
  await ende;
  if (fehler) throw fehler;

  const datei = new File(teile as BlobPart[], dateiname, { type: 'application/zip' });
  return { datei, dateiname, exportZeit, fotosExportiert: exportiert, fehlendeFotos };
}
