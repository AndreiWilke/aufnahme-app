// Einlesen der Projektdatei (data/*.objekt.json) und Einspielen neuerer Fassungen.
import type {
  EinheitArt,
  EinheitAufnahme,
  Heizzentrale,
  Nutzungsart,
  PlanEinheit,
  PlanErsatz,
  PlanRaum,
  Projekt,
  Raum,
} from './model';
import { HZ_PUNKTE } from './model';
import { isoJetzt } from './util';

export class ProjektdateiFehler extends Error {}

type Obj = Record<string, unknown>;
const istObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

function str(o: Obj, ...keys: string[]): string {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'string') return v.trim();
    if (typeof v === 'number') return String(v);
  }
  return '';
}

function num(o: Obj, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '') {
      const n = Number(v.replace(',', '.'));
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function arr(o: Obj, ...keys: string[]): unknown[] {
  for (const k of keys) {
    const v = o[k];
    if (Array.isArray(v)) return v;
  }
  return [];
}

const ART_FEST: Record<string, EinheitArt> = {
  wohnung: 'wohnung',
  gewerbe: 'gewerbe',
  allgemein: 'allgemein',
  heizzentrale: 'heizzentrale',
};

/** Verbindlich: „Wohnung“, „Gewerbe“, „Allgemein“, „Heizzentrale“. Alles andere wird geraten (mit Warnung). */
function artVon(roh: string, id: string): { art: EinheitArt; sicher: boolean } {
  const fest = ART_FEST[roh.trim().toLowerCase()];
  if (fest) return { art: fest, sicher: true };
  return { art: artRaten(roh, id), sicher: false };
}

function artRaten(roh: string, id: string): EinheitArt {
  const t = `${roh} ${id}`.toLowerCase();
  if (/heizzentrale|heizraum|\bhz\b/.test(t)) return 'heizzentrale';
  if (/allgemein/.test(t)) return 'allgemein';
  if (/gewerbe|laden|büro|praxis|\bge\b/.test(t)) return 'gewerbe';
  return 'wohnung';
}

function nutzungsartenLesen(roh: unknown): Nutzungsart[] {
  const liste: Nutzungsart[] = [];
  if (Array.isArray(roh)) {
    for (const n of roh) {
      if (!istObj(n)) continue;
      const schluessel = str(n, 'key', 'schluessel', 'nutzung', 'id');
      if (!schluessel) continue;
      liste.push({
        schluessel,
        bezeichnung: str(n, 'name', 'bezeichnung', 'label', 'text') || schluessel,
        soll_temp_c: num(n, 'soll_temp_c', 'solltemperatur', 'temp_c', 'theta_int'),
      });
    }
  } else if (istObj(roh)) {
    for (const [schluessel, n] of Object.entries(roh)) {
      if (typeof n === 'number') {
        liste.push({ schluessel, bezeichnung: schluessel, soll_temp_c: n });
      } else if (istObj(n)) {
        liste.push({
          schluessel,
          bezeichnung: str(n, 'name', 'bezeichnung', 'label', 'text') || schluessel,
          soll_temp_c: num(n, 'soll_temp_c', 'solltemperatur', 'temp_c', 'theta_int'),
        });
      }
    }
  }
  return liste;
}

function zeitTeile(o: Obj): { datum: string; uhrzeit: string } {
  let datum = str(o, 'datum', 'begehungstag', 'tag', 'begehung_datum');
  let uhrzeit = str(o, 'uhrzeit', 'zeit', 'termin_uhrzeit');
  const termin = str(o, 'termin', 'termin_start', 'start');
  const m = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?/.exec(termin);
  if (m) {
    if (!datum) datum = m[1];
    if (!uhrzeit && m[2]) uhrzeit = m[2];
  } else if (!uhrzeit && /^\d{1,2}:\d{2}/.test(termin)) {
    uhrzeit = termin.slice(0, 5);
  }
  const dm = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(datum);
  if (dm) datum = `${dm[3]}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}`;
  if (/^\d:\d{2}/.test(uhrzeit)) uhrzeit = '0' + uhrzeit;
  return { datum, uhrzeit: uhrzeit.slice(0, 5) };
}

function raumLesen(r: Obj, einheit_id: string, index: number, nutzungen: Nutzungsart[], warnungen: string[]): PlanRaum {
  const nrRoh = str(r, 'nr', 'raum_nr', 'nummer');
  const nr = nrRoh ? nrRoh.padStart(2, '0') : String(index + 1).padStart(2, '0');
  const raum_id = str(r, 'id', 'raum_id') || `${einheit_id}-R${nr}`;
  let nutzung = str(r, 'nutzung', 'nutzungsart');
  if (!nutzung) {
    nutzung = nutzungen.find((n) => n.schluessel.startsWith('sonstig'))?.schluessel ?? 'sonstig';
    warnungen.push(`Raum ${raum_id}: Nutzung fehlt, „${nutzung}“ angenommen.`);
  } else if (nutzungen.length > 0 && !nutzungen.some((n) => n.schluessel === nutzung)) {
    warnungen.push(`Raum ${raum_id}: Nutzung „${nutzung}“ steht nicht in „nutzungsarten“.`);
  }
  // Steht soll_temp_c in der Datei (auch als null, z. B. Technik), gilt dieser Wert. Fehlt das Feld, gilt die Nutzungsart.
  const sollInDatei = 'soll_temp_c' in r || 'solltemperatur' in r;
  const soll = sollInDatei
    ? num(r, 'soll_temp_c', 'solltemperatur')
    : (nutzungen.find((n) => n.schluessel === nutzung)?.soll_temp_c ?? null);
  const quelle = str(r, 'quelle');
  return {
    raum_id,
    nr,
    name: str(r, 'name', 'bezeichnung', 'raum') || `Raum ${nr}`,
    nutzung,
    flaeche_plan_m2: num(r, 'flaeche_plan_m2', 'flaeche_m2', 'flaeche'),
    soll_temp_c: soll,
    ...(quelle ? { quelle } : {}),
  };
}

function ersatzLesen(e: unknown): PlanErsatz | null {
  if (typeof e === 'string') return { eh: null, bezeichnung: e };
  if (typeof e === 'number') return { eh: e, bezeichnung: `EH ${e}` };
  if (!istObj(e)) return null;
  const eh = num(e, 'eh', 'einheit_nr', 'nr');
  const bezeichnung = str(e, 'bezeichnung', 'wohnung', 'name', 'whg') || (eh !== null ? `EH ${eh}` : '');
  if (!bezeichnung) return null;
  const geschoss = str(e, 'geschoss', 'etage');
  return { eh, bezeichnung, ...(geschoss ? { geschoss } : {}) };
}

/**
 * Liest eine Projektdatei ein. Verbindlich ist das Format aus docs/projektdatei.md
 * (projekt.id, nutzungsarten[].key/name, einheiten[].id/termin, raeume[].id/quelle).
 * Ältere Schreibvarianten der Feldnamen werden weiter verstanden.
 * Auffälligkeiten stehen in „warnungen“; eine Datei im verbindlichen Format erzeugt keine.
 */
export function projektdateiLesen(roh: unknown): Projekt {
  if (!istObj(roh)) throw new ProjektdateiFehler('Die Datei enthält kein JSON-Objekt.');
  const meta: Obj = istObj(roh['projekt']) ? roh['projekt'] : {};
  const warnungen: string[] = [];
  const projekt_id = str(meta, 'id', 'projekt_id') || str(roh, 'projekt_id', 'id', 'projekt');
  if (!projekt_id) throw new ProjektdateiFehler('Feld „projekt.id“ fehlt.');
  if (!/^[A-Za-z0-9_-]+$/.test(projekt_id))
    throw new ProjektdateiFehler('„projekt.id“ darf nur Buchstaben, Ziffern, - und _ enthalten.');
  if (roh['schema_version'] !== undefined && roh['schema_version'] !== 1)
    warnungen.push(`Unbekannte schema_version „${String(roh['schema_version'])}“ (erwartet: 1).`);
  const nutzungsarten = nutzungsartenLesen(roh['nutzungsarten'] ?? roh['nutzungen']);
  const einheitenRoh = arr(roh, 'einheiten', 'units');
  if (einheitenRoh.length === 0) throw new ProjektdateiFehler('Die Projektdatei enthält keine Einheiten.');

  const ids = new Set<string>();
  const raumIds = new Set<string>();
  const einheiten: PlanEinheit[] = einheitenRoh.map((e, i) => {
    if (!istObj(e)) throw new ProjektdateiFehler(`Einheit Nr. ${i + 1} ist kein Objekt.`);
    const einheit_id = str(e, 'id', 'einheit_id');
    if (!einheit_id) throw new ProjektdateiFehler(`Einheit Nr. ${i + 1}: „id“ fehlt.`);
    if (ids.has(einheit_id)) throw new ProjektdateiFehler(`Einheit „${einheit_id}“ kommt doppelt vor.`);
    ids.add(einheit_id);
    const artRoh = str(e, 'art', 'typ', 'kategorie', 'nutzung');
    const { art, sicher } = artVon(artRoh, einheit_id);
    if (!sicher) warnungen.push(`Einheit ${einheit_id}: Art „${artRoh}“ unbekannt, als „${art}“ behandelt.`);
    const { datum, uhrzeit } = zeitTeile(e);
    if (!datum) warnungen.push(`Einheit ${einheit_id}: kein Termin.`);
    const raeume = arr(e, 'raeume', 'räume', 'rooms')
      .filter(istObj)
      .map((r, j) => {
        const pr = raumLesen(r, einheit_id, j, nutzungsarten, warnungen);
        // Raum-IDs müssen im ganzen Projekt eindeutig sein (Schlüssel für das Einspielen und den Export).
        if (raumIds.has(pr.raum_id))
          throw new ProjektdateiFehler(`Einheit „${einheit_id}“: Raum „${pr.raum_id}“ kommt doppelt vor.`);
        raumIds.add(pr.raum_id);
        return pr;
      });
    if (art === 'heizzentrale' && raeume.length > 0)
      warnungen.push(`Einheit ${einheit_id}: Räume der Heizzentrale werden nicht verwendet (dort gilt die Checkliste).`);
    const zusatz = arr(e, 'eh_zusatz').filter((x): x is number => typeof x === 'number');
    return {
      einheit_id,
      eh: num(e, 'eh', 'einheit_nr'),
      bezeichnung: str(e, 'bezeichnung', 'name', 'wohnung') || einheit_id,
      art,
      geschoss: str(e, 'geschoss', 'etage', 'og'),
      datum,
      uhrzeit,
      ersatz: arr(e, 'ersatz', 'ersatzwohnungen')
        .map(ersatzLesen)
        .filter((x): x is PlanErsatz => x !== null),
      raeume,
      hinweis: str(e, 'hinweis', 'notiz', 'bemerkung'),
      eh_zusatz: zusatz,
      wohnungstyp: num(e, 'wohnungstyp'),
      dauer_min: num(e, 'dauer_min'),
    };
  });

  return {
    projekt_id,
    name: str(meta, 'name') || str(roh, 'projekt_name', 'name', 'bezeichnung', 'objekt') || projekt_id,
    nutzungsarten,
    einheiten,
    objekt_roh: roh,
    importiert_am: isoJetzt(),
    hinweis: str(meta, 'hinweis') || str(roh, 'hinweis'),
    stand: str(meta, 'stand'),
    warnungen,
  };
}

export function neueHeizzentrale(): Heizzentrale {
  return {
    punkte: HZ_PUNKTE.map((p) => ({
      punkt_id: p.punkt_id,
      vorhanden: null,
      text: '',
      wert: null,
      status: null,
      notiz: '',
      fotos: [],
      geaendert_am: null,
    })),
    abgaenge: [],
    geaendert_am: null,
  };
}

function raumAusPlan(p: PlanRaum): Raum {
  return {
    raum_id: p.raum_id,
    nr: p.nr,
    name: p.name,
    nutzung: p.nutzung,
    nutzung_plan: p.nutzung,
    flaeche_plan_m2: p.flaeche_plan_m2,
    soll_temp_c: p.soll_temp_c,
    ...(p.quelle ? { quelle: p.quelle } : {}),
    herkunft: 'plan',
    zustand: 'vorhanden',
    erledigt: false,
    notiz: '',
    heizflaechen: [],
    fenster: [],
    geaendert_am: null,
  };
}

export function neueAufnahme(projekt_id: string, p: PlanEinheit): EinheitAufnahme {
  return {
    projekt_id,
    einheit_id: p.einheit_id,
    aufgenommen_eh: p.eh,
    aufgenommen_bezeichnung: p.bezeichnung,
    status: 'offen',
    abweichung_vom_plan: false,
    notiz: '',
    gewerbe: p.art === 'gewerbe' ? { nutzungszeiten: '', soll_temp_c: null, ansprechpartner: '' } : null,
    zeit_start: null,
    zeit_ende: null,
    raeume: p.art === 'heizzentrale' ? [] : p.raeume.map(raumAusPlan),
    heizzentrale: p.art === 'heizzentrale' ? neueHeizzentrale() : null,
    foto_zaehler: {},
    geaendert_am: null,
    letzter_export: null,
  };
}

export function raumHatAufnahmen(r: Raum): boolean {
  return (
    r.heizflaechen.length > 0 ||
    r.fenster.length > 0 ||
    r.erledigt ||
    r.notiz.trim() !== '' ||
    r.zustand !== 'vorhanden' ||
    r.geaendert_am !== null
  );
}

export function einheitHatAufnahmen(a: EinheitAufnahme): boolean {
  return a.geaendert_am !== null || a.raeume.some(raumHatAufnahmen);
}

export interface EinspielErgebnis {
  aufnahmen: EinheitAufnahme[];
  neueEinheiten: number;
  neueRaeume: number;
  entfalleneRaeumeBehalten: number;
  entfalleneEinheitenBehalten: number;
}

/**
 * Spielt eine neuere Projektdatei ein, ohne vorhandene Aufnahmen zu verlieren.
 * Zuordnung über einheit_id und raum_id. Neue Räume werden ergänzt, entfallene Räume mit
 * Aufnahmen bleiben erhalten und werden markiert. Eine vor Ort geänderte Nutzung bleibt bestehen.
 */
export function projektEinspielen(neu: Projekt, vorhandene: EinheitAufnahme[]): EinspielErgebnis {
  const altMap = new Map(vorhandene.map((a) => [a.einheit_id, a]));
  const ergebnis: EinheitAufnahme[] = [];
  let neueEinheiten = 0;
  let neueRaeume = 0;
  let entfalleneRaeumeBehalten = 0;
  let entfalleneEinheitenBehalten = 0;

  for (const pe of neu.einheiten) {
    const alt = altMap.get(pe.einheit_id);
    altMap.delete(pe.einheit_id);
    if (!alt) {
      ergebnis.push(neueAufnahme(neu.projekt_id, pe));
      neueEinheiten++;
      continue;
    }
    const a: EinheitAufnahme = structuredClone(alt);
    delete a.im_plan_entfallen;
    // Noch nicht angefasste Einheiten übernehmen die neue Planbezeichnung.
    if (a.geaendert_am === null) {
      a.aufgenommen_eh = pe.eh;
      a.aufgenommen_bezeichnung = pe.bezeichnung;
    }
    if (pe.art === 'gewerbe' && !a.gewerbe) a.gewerbe = { nutzungszeiten: '', soll_temp_c: null, ansprechpartner: '' };
    if (pe.art === 'heizzentrale' && !a.heizzentrale) a.heizzentrale = neueHeizzentrale();

    if (pe.art !== 'heizzentrale') {
      const raumAlt = new Map(a.raeume.map((r) => [r.raum_id, r]));
      const raeume: Raum[] = [];
      for (const pr of pe.raeume) {
        const r = raumAlt.get(pr.raum_id);
        raumAlt.delete(pr.raum_id);
        if (!r) {
          raeume.push(raumAusPlan(pr));
          neueRaeume++;
          continue;
        }
        const nutzungVorOrtGeaendert = r.nutzung_plan !== undefined && r.nutzung !== r.nutzung_plan;
        r.nr = pr.nr;
        r.name = pr.name;
        r.flaeche_plan_m2 = pr.flaeche_plan_m2;
        if (pr.quelle) r.quelle = pr.quelle;
        else delete r.quelle;
        if (!nutzungVorOrtGeaendert) {
          r.nutzung = pr.nutzung;
          r.soll_temp_c = pr.soll_temp_c;
        }
        r.nutzung_plan = pr.nutzung;
        r.herkunft = 'plan';
        delete r.im_plan_entfallen;
        raeume.push(r);
      }
      // Übrige Räume: vor Ort angelegte immer behalten, entfallene Planräume nur mit Aufnahmen.
      for (const r of raumAlt.values()) {
        if (r.herkunft === 'vor_ort_angelegt') {
          raeume.push(r);
        } else if (raumHatAufnahmen(r)) {
          r.im_plan_entfallen = true;
          raeume.push(r);
          entfalleneRaeumeBehalten++;
        }
      }
      a.raeume = raeume;
    }
    ergebnis.push(a);
  }

  for (const a of altMap.values()) {
    if (einheitHatAufnahmen(a)) {
      const k = structuredClone(a);
      k.im_plan_entfallen = true;
      ergebnis.push(k);
      entfalleneEinheitenBehalten++;
    }
  }

  return { aufnahmen: ergebnis, neueEinheiten, neueRaeume, entfalleneRaeumeBehalten, entfalleneEinheitenBehalten };
}
