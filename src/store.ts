// Zentraler Zustand. Jede Änderung wird sofort in IndexedDB gespeichert (Autosave).
import { useEffect, useState } from 'preact/hooks';
import * as DB from './db';
import type { EinheitAufnahme, FotoMeta, FotoRolle, PlanEinheit, Projekt } from './model';
import { fotoVerarbeiten, naechsterDateiname } from './fotos';
import { neueAufnahme, projektdateiLesen, projektEinspielen, type EinspielErgebnis } from './projekt';
import { isoJetzt, uuid } from './util';
import { fotoNichtExportiert, hatUnexportierteAenderungen } from './export';

export type Route =
  | { name: 'start' }
  | { name: 'projekt' }
  | { name: 'einheit'; eid: string }
  | { name: 'raum'; eid: string; rid: string }
  | { name: 'hf'; eid: string; rid: string; hfid: string }
  | { name: 'hz'; eid: string }
  | { name: 'export'; eid?: string }
  | { name: 'einstellungen' };

interface Zustand {
  bereit: boolean;
  projekte: Projekt[];
  projekt: Projekt | null;
  aufnahmen: Map<string, EinheitAufnahme>;
  fotos: Map<string, FotoMeta>;
  route: Route;
  persistiert: boolean | null;
  speicherFehler: string | null;
}

export const S: Zustand = {
  bereit: false,
  projekte: [],
  projekt: null,
  aufnahmen: new Map(),
  fotos: new Map(),
  route: { name: 'start' },
  persistiert: null,
  speicherFehler: null,
};

let version = 0;
const hoerer = new Set<() => void>();
export function melden(): void {
  version++;
  for (const h of hoerer) h();
}

/** Hook: Komponente neu zeichnen, wenn sich der Zustand ändert. */
export function useStore(): number {
  const [, setV] = useState(version);
  useEffect(() => {
    const h = () => setV(version);
    hoerer.add(h);
    // Änderungen zwischen erstem Zeichnen und dieser Anmeldung nachholen. Sonst bleibt die App bei „Lädt …“
    // stehen, wenn der Speicher schneller geöffnet ist, als der Browser diesen Effekt ausführt.
    h();
    return () => {
      hoerer.delete(h);
    };
  }, []);
  return version;
}

// ---------------- Navigation ----------------

const ROUTE_KEY = 'aufnahme.route';

export function gehe(r: Route): void {
  S.route = r;
  try {
    localStorage.setItem(ROUTE_KEY, JSON.stringify(r));
  } catch {
    /* ohne Speicher weiter */
  }
  window.scrollTo(0, 0);
  melden();
}

function routeGueltig(r: Route): boolean {
  if (r.name === 'start' || r.name === 'einstellungen') return true;
  if (!S.projekt) return false;
  if (r.name === 'projekt' || (r.name === 'export' && !r.eid)) return true;
  if (!('eid' in r) || !r.eid) return false;
  const a = S.aufnahmen.get(r.eid);
  if (!a) return false;
  if (r.name === 'raum' || r.name === 'hf') {
    const raum = a.raeume.find((x) => x.raum_id === r.rid);
    if (!raum) return false;
    if (r.name === 'hf') return raum.heizflaechen.some((h) => h.hf_id === r.hfid);
  }
  return true;
}

// ---------------- Laden ----------------

export async function starten(): Promise<void> {
  try {
    S.projekte = await DB.projekteLaden();
    const aktiv = await DB.einstellungLesen<string>('aktives_projekt');
    if (aktiv && S.projekte.some((p) => p.projekt_id === aktiv)) await projektOeffnen(aktiv, false);
    // Beim ersten Start dauerhaften Speicher anfordern
    // Nicht darauf warten: Manche Browser beantworten die Anfrage erst nach einer Rückfrage oder gar nicht.
    // Der Start der App darf daran nicht hängen.
    if (navigator.storage?.persisted) {
      void (async () => {
        try {
          S.persistiert = await navigator.storage.persisted();
          if (!S.persistiert && navigator.storage.persist) S.persistiert = await navigator.storage.persist();
          melden();
        } catch {
          /* Anzeige bleibt „unbekannt“ */
        }
      })();
    }
    try {
      const r = JSON.parse(localStorage.getItem(ROUTE_KEY) ?? 'null') as Route | null;
      if (r && routeGueltig(r)) S.route = r;
      else if (S.projekt) S.route = { name: 'projekt' };
    } catch {
      if (S.projekt) S.route = { name: 'projekt' };
    }
  } catch (e) {
    S.speicherFehler = `Speicher konnte nicht geöffnet werden: ${(e as Error).message}`;
  }
  S.bereit = true;
  melden();
}

/** Ab dieser Version liest die App Felder der Projektdatei, die ältere Versionen übergangen haben. */
const LESEN_SEIT = [1, 6, 0];

/** true, wenn die Projektdatei mit einer älteren App-Version gelesen wurde, als LESEN_SEIT angibt. */
export function neuLesenNoetig(gelesen_mit: string | undefined): boolean {
  if (!gelesen_mit) return true;
  const v = gelesen_mit.split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((v[i] ?? 0) !== LESEN_SEIT[i]) return (v[i] ?? 0) < LESEN_SEIT[i];
  }
  return false;
}

export async function projektOeffnen(projekt_id: string, navigieren = true): Promise<void> {
  const p = S.projekte.find((x) => x.projekt_id === projekt_id);
  if (!p) return;
  // Bis 1.4 gelesene Projektdateien kannten heizlast_w und pruefpunkte nicht, bis 1.5 keine Annahmen und keine
  // Fenster laut Plan: einmal mit dieser Version neu lesen und wie eine neuere Fassung einspielen
  // (Aufnahmen und Bestätigungen bleiben erhalten).
  if (neuLesenNoetig(p.gelesen_mit) && p.objekt_roh) {
    let neu: Projekt | null = null;
    try {
      neu = projektdateiLesen(p.objekt_roh);
    } catch {
      neu = null;
    }
    if (neu && neu.projekt_id === p.projekt_id) {
      neu.importiert_am = p.importiert_am;
      await projektImportieren(neu, navigieren);
      return;
    }
  }
  const [aufnahmen, fotos] = await Promise.all([DB.aufnahmenLaden(projekt_id), DB.fotoMetaLaden(projekt_id)]);
  S.projekt = p;
  S.aufnahmen = new Map(aufnahmen.map((a) => [a.einheit_id, a]));
  // Einheiten ohne Aufnahme-Datensatz anlegen (Sicherheitsnetz)
  for (const pe of p.einheiten) {
    if (!S.aufnahmen.has(pe.einheit_id)) {
      const a = neueAufnahme(p.projekt_id, pe);
      S.aufnahmen.set(pe.einheit_id, a);
      await DB.aufnahmeSpeichern(a);
    }
  }
  S.fotos = new Map(fotos.map((f) => [f.foto_id, f]));
  await DB.einstellungSchreiben('aktives_projekt', projekt_id);
  if (navigieren) gehe({ name: 'projekt' });
  else melden();
}

export function projektSchliessen(): void {
  S.projekt = null;
  S.aufnahmen = new Map();
  S.fotos = new Map();
  void DB.einstellungSchreiben('aktives_projekt', null);
  gehe({ name: 'start' });
}

/** Neues Projekt anlegen oder neuere Fassung einspielen. */
export async function projektImportieren(neu: Projekt, navigieren = true): Promise<EinspielErgebnis | null> {
  const vorhanden = S.projekte.find((p) => p.projekt_id === neu.projekt_id);
  if (!vorhanden) {
    const aufnahmen = neu.einheiten.map((pe) => neueAufnahme(neu.projekt_id, pe));
    await DB.projektMitAufnahmenSpeichern(neu, aufnahmen);
    S.projekte = await DB.projekteLaden();
    await projektOeffnen(neu.projekt_id, navigieren);
    return null;
  }
  const alte = await DB.aufnahmenLaden(neu.projekt_id);
  const erg = projektEinspielen(neu, alte);
  // Entfallene Einheiten mit Aufnahmen: Plandaten aus der alten Fassung behalten
  const neuIds = new Set(neu.einheiten.map((e) => e.einheit_id));
  const behalten: PlanEinheit[] = vorhanden.einheiten
    .filter((e) => !neuIds.has(e.einheit_id) && erg.aufnahmen.some((a) => a.einheit_id === e.einheit_id))
    .map((e) => ({ ...e, hinweis: `${e.hinweis ? e.hinweis + ' · ' : ''}in neuer Projektdatei nicht mehr enthalten` }));
  const p: Projekt = { ...neu, einheiten: [...neu.einheiten, ...behalten] };
  await DB.projektMitAufnahmenSpeichern(p, erg.aufnahmen);
  S.projekte = await DB.projekteLaden();
  await projektOeffnen(neu.projekt_id, navigieren);
  return erg;
}

export async function projektEntfernen(projekt_id: string): Promise<void> {
  await DB.projektLoeschen(projekt_id);
  S.projekte = await DB.projekteLaden();
  if (S.projekt?.projekt_id === projekt_id) projektSchliessen();
  else melden();
}

// ---------------- Ändern (Autosave) ----------------

function speichern(a: EinheitAufnahme): void {
  DB.aufnahmeSpeichern(a).then(
    () => {
      if (S.speicherFehler) {
        S.speicherFehler = null;
        melden();
      }
    },
    (e: Error) => {
      S.speicherFehler = `Speichern fehlgeschlagen: ${e.message}`;
      melden();
    },
  );
}

/**
 * Ändert eine Einheit. fn bekommt die Aufnahme und einen Zeitstempel und setzt selbst
 * geaendert_am an den geänderten Unterobjekten. Die Einheit selbst wird immer markiert.
 */
export function aendern(
  eid: string,
  fn: (a: EinheitAufnahme, jetzt: string) => void,
  optionen: { statusAutomatisch?: boolean } = {},
): void {
  const a = S.aufnahmen.get(eid);
  if (!a) return;
  const jetzt = isoJetzt();
  fn(a, jetzt);
  a.geaendert_am = jetzt;
  if (optionen.statusAutomatisch !== false) {
    if (!a.zeit_start) a.zeit_start = jetzt;
    if (a.status === 'offen') a.status = 'in_arbeit';
  }
  speichern(a);
  melden();
}

export function planEinheit(eid: string): PlanEinheit | undefined {
  return S.projekt?.einheiten.find((e) => e.einheit_id === eid);
}

// ---------------- Fotos ----------------

export interface FotoZiel {
  eid: string;
  praefix: string;
  rolle: FotoRolle;
  bezug_id: string;
  /** Trägt den Dateinamen in die Aufnahme ein (z. B. hf.fotos.push) und setzt geaendert_am. */
  eintragen: (a: EinheitAufnahme, dateiname: string, jetzt: string) => void;
}

export async function fotoAufnehmen(datei: File, ziel: FotoZiel): Promise<FotoMeta> {
  const a = S.aufnahmen.get(ziel.eid);
  if (!a || !S.projekt) throw new Error('Einheit nicht gefunden');
  const v = await fotoVerarbeiten(datei);
  const jetzt = isoJetzt();
  const dateiname = naechsterDateiname(a, ziel.praefix);
  const meta: FotoMeta = {
    foto_id: uuid(),
    projekt_id: S.projekt.projekt_id,
    einheit_id: ziel.eid,
    dateiname,
    rolle: ziel.rolle,
    bezug_id: ziel.bezug_id,
    groesse: v.blob.size,
    breite: v.breite,
    hoehe: v.hoehe,
    erstellt_am: jetzt,
    exportiert_am: null,
  };
  ziel.eintragen(a, dateiname, jetzt);
  a.geaendert_am = jetzt;
  if (!a.zeit_start) a.zeit_start = jetzt;
  if (a.status === 'offen') a.status = 'in_arbeit';
  await DB.fotoSpeichern(meta, { foto_id: meta.foto_id, blob: v.blob, thumb: v.thumb }, a);
  S.fotos.set(meta.foto_id, meta);
  melden();
  return meta;
}

export function fotosVon(eid: string, bezug_id: string, rolle?: FotoRolle): FotoMeta[] {
  const l: FotoMeta[] = [];
  for (const f of S.fotos.values())
    if (f.einheit_id === eid && f.bezug_id === bezug_id && (!rolle || f.rolle === rolle)) l.push(f);
  return l.sort((x, y) => x.dateiname.localeCompare(y.dateiname));
}

export function fotosDerEinheit(eid: string): FotoMeta[] {
  const l: FotoMeta[] = [];
  for (const f of S.fotos.values()) if (f.einheit_id === eid) l.push(f);
  return l;
}

/** Löscht Fotos und entfernt die Dateinamen aus allen Listen der Einheit. */
export async function fotosEntfernen(eid: string, ids: string[], mitAenderung = true): Promise<void> {
  const a = S.aufnahmen.get(eid);
  if (!a) return;
  const namen = new Set(ids.map((id) => S.fotos.get(id)?.dateiname).filter(Boolean) as string[]);
  const jetzt = isoJetzt();
  const filtern = (o: { fotos: string[]; geaendert_am: string | null }) => {
    const vorher = o.fotos.length;
    o.fotos = o.fotos.filter((n) => !namen.has(n));
    if (o.fotos.length !== vorher) o.geaendert_am = jetzt;
  };
  for (const r of a.raeume) {
    r.heizflaechen.forEach(filtern);
    r.fenster.forEach(filtern);
  }
  (a.pruefpunkte ?? []).forEach(filtern);
  if (a.heizzentrale) {
    a.heizzentrale.punkte.forEach(filtern);
    a.heizzentrale.abgaenge.forEach(filtern);
  }
  if (mitAenderung) a.geaendert_am = jetzt;
  await DB.fotosLoeschen(ids, a);
  for (const id of ids) {
    S.fotos.delete(id);
    thumbFreigeben(id);
  }
  melden();
}

const thumbCache = new Map<string, string>();
export async function thumbUrl(foto_id: string): Promise<string | null> {
  const c = thumbCache.get(foto_id);
  if (c) return c;
  const b = await DB.fotoBlobLaden(foto_id);
  if (!b) return null;
  const u = URL.createObjectURL(b.thumb);
  thumbCache.set(foto_id, u);
  return u;
}

function thumbFreigeben(foto_id: string) {
  const u = thumbCache.get(foto_id);
  if (u) URL.revokeObjectURL(u);
  thumbCache.delete(foto_id);
}

// ---------------- Kennzahlen ----------------

export function unexportierteFotos(eid?: string): number {
  let n = 0;
  for (const f of S.fotos.values()) if ((!eid || f.einheit_id === eid) && fotoNichtExportiert(f)) n++;
  return n;
}

export function unexportierteEinheiten(): number {
  let n = 0;
  for (const a of S.aufnahmen.values()) if (hatUnexportierteAenderungen(a)) n++;
  return n;
}
