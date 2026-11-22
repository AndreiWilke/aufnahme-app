// Datenmodell der Aufnahme. Entspricht UEBERGABE.md Abschnitt 5 (aufnahme.json, schema_version 1).
// Feldwerte sind feste Schlüssel; die deutschen Anzeigetexte stehen in den *_TEXT-Tabellen.

export const APP_VERSION = '1.6.0';
export const SCHEMA_VERSION = 1;

/**
 * gemessen / geschätzt: vor Ort ermittelt. bestätigt (seit 1.6.0): Annahme aus der Projektdatei vor Ort mit „passt“
 * bestätigt, der Wert ist die Annahme.
 */
export type MessStatus = 'gemessen' | 'geschätzt' | 'bestätigt';

/** Ein Messwert mit Datenstatus. Ist wert null, ist auch status null. */
export interface Messwert {
  wert: number | null;
  status: MessStatus | null;
}

export type EinheitArt = 'wohnung' | 'gewerbe' | 'heizzentrale' | 'allgemein';
export type EinheitStatus = 'offen' | 'in_arbeit' | 'fertig' | 'nicht_angetroffen';
export type RaumHerkunft = 'plan' | 'vor_ort_angelegt';
export type RaumZustand = 'vorhanden' | 'nicht_vorhanden' | 'zusammengelegt';

export type HfArt =
  | 'platte'
  | 'glieder'
  | 'roehren'
  | 'bad'
  | 'konvektor'
  | 'fussbodenheizung'
  | 'sonstiges';
export type HfTyp = '10' | '11' | '20' | '21' | '22' | '33' | 'unbekannt';
export type Anschluss =
  | 'seitlich_gleich'
  | 'seitlich_wechsel'
  | 'unten_mittig_vk'
  | 'unten_seitlich_vk'
  | 'unbekannt';
export type Lage = 'unter_fenster' | 'aussenwand_ohne_fenster' | 'innenwand';
export type Verglasung = '1-fach' | '2-fach' | '3-fach' | 'unbekannt';
export type Rahmen = 'kunststoff' | 'holz' | 'holz_alu' | 'alu' | 'unbekannt';
/** Antwort zum Antippen (Prüfpunkte, Fenster erneuert, Raum beheizt vor Ort). */
export type Antwort = 'ja' | 'nein' | 'unklar';
export type FensterArt = 'fenster' | 'fenstertuer' | 'ladenfront' | 'dachfenster';

export const ANTWORTEN: Antwort[] = ['ja', 'nein', 'unklar'];

/** Seit 1.6.0: Ergebnis der Prüfung einer Annahme aus der Projektdatei (passt / ändern / unklar). */
export type Bestaetigung = 'bestaetigt' | 'geaendert' | 'unklar';
/** Fenster laut Plan: zusätzlich „nicht vorhanden“. */
export type FensterPlanBestaetigung = Bestaetigung | 'nicht_vorhanden';

export const BESTAETIGUNG_TEXT: Record<FensterPlanBestaetigung, string> = {
  bestaetigt: 'passt',
  geaendert: 'ändern',
  unklar: 'unklar',
  nicht_vorhanden: 'nicht vorhanden',
};

/** Datenstatus einer Annahme laut Projektdatei. */
export const ANNAHME_STATUS_TEXT: Record<string, string> = {
  D: 'aus Dokument',
  A: 'aus Plan/Ansicht',
  S: 'geschätzt',
};

export const FENSTER_ART_TEXT: Record<FensterArt, string> = {
  fenster: 'Fenster',
  fenstertuer: 'Fenstertür',
  ladenfront: 'Ladenfront',
  dachfenster: 'Dachfenster',
};

/** Lichte Raumhöhe in m zum Antippen; jeder andere Wert über „andere“. */
export const LICHTE_HOEHEN = [2.4, 2.5, 2.55, 2.6, 2.8, 3.0];

export const STATUS_TEXT: Record<EinheitStatus, string> = {
  offen: 'offen',
  in_arbeit: 'in Arbeit',
  fertig: 'fertig',
  nicht_angetroffen: 'nicht angetroffen',
};

export const ART_TEXT: Record<HfArt, string> = {
  platte: 'Plattenheizkörper',
  glieder: 'Gliederheizkörper',
  roehren: 'Röhrenradiator',
  bad: 'Badheizkörper',
  konvektor: 'Konvektor/Unterflur',
  fussbodenheizung: 'Fußbodenheizung',
  sonstiges: 'Sonstiges',
};

export const TYPEN: HfTyp[] = ['10', '11', '20', '21', '22', '33', 'unbekannt'];
export const BAUHOEHEN = [300, 400, 500, 600, 900];

/**
 * Standardmaße zum Antippen (mm). Reine Bedienhilfe: Jeder andere Wert bleibt über „andere“ möglich,
 * das Datenmodell und der Export ändern sich dadurch nicht.
 */
const HOEHEN: Partial<Record<HfArt, number[]>> = {
  platte: [200, 300, 400, 500, 600, 900],
  // DIN 4703: Stahl 300/450/600/1000, Guss 280/430/580/680/980
  glieder: [280, 300, 430, 450, 580, 600, 680, 980, 1000],
  roehren: [300, 500, 600, 750, 900, 1000, 1500, 1800, 2000],
  bad: [800, 1200, 1500, 1800],
  konvektor: [70, 90, 110, 140, 210, 280],
};
const TIEFEN: Partial<Record<HfArt, number[]>> = {
  // Platte: Typ 10 etwa 50, Typ 11 etwa 65, Typ 20/21 etwa 70–80, Typ 22 100, Typ 33 155
  platte: [50, 65, 70, 80, 100, 155],
  // DIN 4703: 70 (nur Guss), 110, 160, 220, 250
  glieder: [70, 110, 160, 220, 250],
  // 2- bis 6-Säuler
  roehren: [65, 105, 145, 185, 225],
  bad: [30, 40, 50],
  konvektor: [100, 150, 200, 250, 300],
};
const LAENGEN_STANDARD = [400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1400, 1600, 1800, 2000, 2300, 2600, 3000];
const LAENGEN: Partial<Record<HfArt, number[]>> = {
  bad: [400, 450, 500, 600, 750, 900],
};

export function standardHoehen(art: HfArt | null): number[] {
  return (art && HOEHEN[art]) || BAUHOEHEN;
}
export function standardLaengen(art: HfArt | null): number[] {
  return (art && LAENGEN[art]) || LAENGEN_STANDARD;
}
export function standardTiefen(art: HfArt | null): number[] {
  return (art && TIEFEN[art]) || TIEFEN.platte!;
}
/** Übliche Bautiefe einer Plattenheizung je Typ (mm). Wird beim Wählen des Typs als „geschätzt“ vorbelegt. */
export const TYP_BAUTIEFE: Partial<Record<HfTyp, number>> = { '10': 50, '11': 65, '20': 70, '21': 70, '22': 100, '33': 155 };

/** true, wenn die Bautiefe genau der Vorbelegung aus dem Typ entspricht (geschätzt, nicht nachgemessen). */
export function bautiefeAusTyp(h: Heizflaeche): boolean {
  const v = h.typ ? TYP_BAUTIEFE[h.typ] : undefined;
  return v !== undefined && h.bautiefe_mm.status === 'geschätzt' && h.bautiefe_mm.wert === v;
}

/**
 * Typ setzen und die Bautiefe passend vorbelegen (Status „geschätzt“). Eine selbst eingetragene Tiefe
 * bleibt stehen; ersetzt wird nur eine leere Tiefe oder die Vorbelegung des bisherigen Typs.
 */
export function typSetzen(h: Heizflaeche, typ: HfTyp | null): void {
  const automatisch = h.bautiefe_mm.wert === null || bautiefeAusTyp(h);
  h.typ = typ;
  if (!automatisch) return;
  const neu = typ ? TYP_BAUTIEFE[typ] : undefined;
  h.bautiefe_mm = neu === undefined ? { wert: null, status: null } : { wert: neu, status: 'geschätzt' };
}

export const GLIEDERZAHLEN = [4, 5, 6, 7, 8, 9, 10, 12, 14, 15, 16, 18, 20, 22, 24, 25, 30];
export const VENTIL_HERSTELLER = ['Heimeier', 'Danfoss', 'Oventrop', 'Honeywell/MNG', 'Herz', 'Kermi', 'Buderus', 'nicht lesbar'];
export const VOREINSTELLUNGEN = ['1', '2', '3', '4', '5', '6', '7', '8', 'N'];

export const ANSCHLUSS_TEXT: Record<Anschluss, string> = {
  seitlich_gleich: 'seitlich gleich',
  seitlich_wechsel: 'seitlich wechsel',
  unten_mittig_vk: 'unten mittig (VK)',
  unten_seitlich_vk: 'unten seitlich (VK)',
  unbekannt: 'unbekannt',
};

export const LAGE_TEXT: Record<Lage, string> = {
  unter_fenster: 'unter Fenster',
  aussenwand_ohne_fenster: 'Außenwand ohne Fenster',
  innenwand: 'Innenwand',
};

export const VERGLASUNG_TEXT: Record<Verglasung, string> = {
  '1-fach': '1-fach',
  '2-fach': '2-fach',
  '3-fach': '3-fach',
  unbekannt: 'unbekannt',
};

export const RAHMEN_TEXT: Record<Rahmen, string> = {
  kunststoff: 'Kunststoff',
  holz: 'Holz',
  holz_alu: 'Holz-Alu',
  alu: 'Alu',
  unbekannt: 'unbekannt',
};

export const ZUSTAND_TEXT: Record<RaumZustand, string> = {
  vorhanden: 'vorhanden',
  nicht_vorhanden: 'nicht vorhanden',
  zusammengelegt: 'zusammengelegt',
};

export interface Ventil {
  hersteller_text: string;
  voreinstellung_ablesbar: boolean | null;
  voreinstellung_wert: string;
  thermostatkopf: boolean | null;
}

export interface Heizflaeche {
  hf_id: string;
  nr: number;
  art: HfArt | null;
  typ: HfTyp | null;
  bauhoehe_mm: Messwert;
  baulaenge_mm: Messwert;
  bautiefe_mm: Messwert;
  gliederzahl: number | null;
  anschluss: Anschluss | null;
  ventil: Ventil;
  lage: Lage | null;
  nische_mm: { breite: number | null; hoehe: number | null; status: MessStatus | null };
  /** Nur Bedienung: Nische vorhanden? Ohne Angabe gilt „nein“. Im Export als nische_vorhanden (ja/nein). */
  nische_vorhanden?: boolean;
  notiz: string;
  fotos: string[];
  geaendert_am: string | null;
}

export interface Fenster {
  fenster_id: string;
  anzahl: number | null;
  verglasung: Verglasung | null;
  rahmen: Rahmen | null;
  breite_mm: number | null;
  hoehe_mm: number | null;
  /** Ergänzung zu Abschnitt 5: Datenstatus der Fenstermaße (Breite und Höhe). */
  masse_status: MessStatus | null;
  /** Seit 1.5.0. Fehlt bei älteren Aufnahmen (gilt dann als null). */
  art?: FensterArt | null;
  erneuert?: Antwort | null;
  /** Baujahr, z. B. vom Glasstempel im Scheibenzwischenraum. */
  baujahr?: number | null;
  /** Fotos „Fenster“ und „Glasstempel“ (am Dateinamen zu unterscheiden). */
  fotos: string[];
  /** Seit 1.6.0: Fenster laut Plan, zu dem dieser Datensatz gehört („ändern“). Fehlt bei zusätzlichen Fenstern. */
  fenster_plan_id?: string | null;
  geaendert_am: string | null;
}

/** Seit 1.6.0: Prüfung eines Fensters laut Plan. „passt“ legt keinen Fenster-Datensatz an. */
export interface FensterPlanPruefung {
  /** fenster_plan[].id aus der Projektdatei */
  id: string;
  bestaetigung: FensterPlanBestaetigung | null;
  /** fenster_id des Fenster-Datensatzes bei „ändern“, sonst null */
  fenster_id: string | null;
  /** Stand der Annahme bei der Bestätigung (intern, zum Erkennen geänderter Annahmen beim Einspielen). */
  stand?: string;
  /** Annahme hat sich beim Einspielen geändert, „passt“ wurde zurückgesetzt. */
  annahme_geaendert?: boolean;
  /** Fenster fehlt in einer neueren Projektdatei, die Prüfung bleibt. */
  im_plan_entfallen?: boolean;
  geaendert_am: string | null;
}

export type RaumAnnahmeSchluessel = 'lichte_hoehe_m' | 'beheizt';

export interface Raum {
  raum_id: string;
  nr: string;
  name: string;
  nutzung: string;
  flaeche_plan_m2: number | null;
  soll_temp_c: number | null;
  /** Herkunft der Plandaten laut Projektdatei (nur Anzeige, nicht im Export). */
  quelle?: string;
  /** Norm-Heizlast laut Vorberechnung in W (Projektdatei, nur Anzeige). null bei unbeheizten Räumen, kann negativ sein. */
  heizlast_w?: number | null;
  herkunft: RaumHerkunft;
  zustand: RaumZustand;
  erledigt: boolean;
  notiz: string;
  heizflaechen: Heizflaeche[];
  fenster: Fenster[];
  /** Seit 1.5.0: vor Ort bestätigt, dass der Raum keine Heizfläche hat. Fehlt bei älteren Aufnahmen (= false). */
  keine_heizflaeche?: boolean;
  /** Seit 1.5.0: lichte Raumhöhe in m mit Datenstatus. */
  lichte_hoehe_m?: Messwert;
  /** Seit 1.5.0: Wird der Raum vor Ort beheizt? */
  beheizt_vor_ort?: Antwort | null;
  /** Seit 1.6.0: Prüfung der Raum-Annahmen (lichte Höhe, beheizt). Werte stehen in lichte_hoehe_m und beheizt_vor_ort. */
  annahmen_bestaetigung?: Record<RaumAnnahmeSchluessel, Bestaetigung | null>;
  /** Intern: Stand der Annahme bei der Bestätigung. */
  annahmen_stand?: Partial<Record<RaumAnnahmeSchluessel, string>>;
  /** Intern: Annahme beim Einspielen geändert, „passt“ zurückgesetzt. */
  annahmen_geaendert?: Partial<Record<RaumAnnahmeSchluessel, boolean>>;
  /** Seit 1.6.0: Prüfung der Fenster laut Plan, eine je fenster_plan[].id. */
  fenster_plan_bestaetigung?: FensterPlanPruefung[];
  /** true, wenn der Raum in einer neueren Projektdatei nicht mehr vorkommt, aber Aufnahmen hat. */
  im_plan_entfallen?: boolean;
  /** Nutzung laut Projektdatei, um beim Einspielen eine geänderte Nutzung nicht zu überschreiben. */
  nutzung_plan?: string;
  geaendert_am: string | null;
}

export interface HzPunkt {
  punkt_id: string;
  vorhanden: boolean | null;
  text: string;
  wert: number | null;
  status: MessStatus | null;
  notiz: string;
  fotos: string[];
  geaendert_am: string | null;
}

export interface HzAbgang {
  abgang_id: string;
  nr: number;
  bezeichnung: string;
  pumpe: boolean | null;
  mischer_stellantrieb: boolean | null;
  notiz: string;
  fotos: string[];
  geaendert_am: string | null;
}

export interface Heizzentrale {
  punkte: HzPunkt[];
  abgaenge: HzAbgang[];
  geaendert_am: string | null;
}

/** Antwort zu einem Prüfpunkt der Projektdatei (einheiten[].pruefpunkte[]). Zuordnung über id. */
export interface Pruefpunkt {
  id: string;
  /** Text laut Projektdatei (wird beim Einspielen aktualisiert). */
  text: string;
  antwort: Antwort | null;
  /** Nur bei typ „zahl“ belegt. */
  wert: Messwert;
  notiz: string;
  fotos: string[];
  erledigt: boolean;
  /** true, wenn der Prüfpunkt in einer neueren Projektdatei fehlt, aber Antworten hat. */
  im_plan_entfallen?: boolean;
  /** Seit 1.6.0: Prüfung der Annahme (nur bei Prüfpunkten mit annahme). */
  bestaetigung?: Bestaetigung | null;
  /** Intern: Stand der Annahme bei der Bestätigung. */
  annahme_stand?: string;
  /** Intern: Annahme beim Einspielen geändert, „passt“ zurückgesetzt. */
  annahme_geaendert?: boolean;
  geaendert_am: string | null;
}

export interface Gewerbe {
  nutzungszeiten: string;
  soll_temp_c: number | null;
  ansprechpartner: string;
}

/** Aufnahme einer Einheit (ein Datensatz in IndexedDB). */
export interface EinheitAufnahme {
  projekt_id: string;
  einheit_id: string;
  aufgenommen_eh: number | null;
  aufgenommen_bezeichnung: string;
  status: EinheitStatus;
  abweichung_vom_plan: boolean;
  notiz: string;
  gewerbe: Gewerbe | null;
  zeit_start: string | null;
  zeit_ende: string | null;
  raeume: Raum[];
  heizzentrale: Heizzentrale | null;
  /** Seit 1.5.0. Fehlt bei älteren Aufnahmen (gilt dann als leer). */
  pruefpunkte?: Pruefpunkt[];
  /** Höchster vergebener Fotozähler je Dateinamen-Präfix, damit Namen nie doppelt vergeben werden. */
  foto_zaehler: Record<string, number>;
  /** true, wenn die Einheit in einer neueren Projektdatei fehlt, aber Aufnahmen hat. */
  im_plan_entfallen?: boolean;
  geaendert_am: string | null;
  letzter_export: string | null;
}

// ---------------- Projektdatei (Eingang) ----------------

export interface Nutzungsart {
  schluessel: string;
  bezeichnung: string;
  soll_temp_c: number | null;
}

export interface PlanErsatz {
  eh: number | null;
  bezeichnung: string;
  geschoss?: string;
}

export interface PlanRaum {
  raum_id: string;
  nr: string;
  name: string;
  nutzung: string;
  flaeche_plan_m2: number | null;
  soll_temp_c: number | null;
  quelle?: string;
  heizlast_w?: number | null;
  /** Seit 1.6.0: Annahmen des Rechenmodells für diesen Raum. */
  annahmen?: PlanRaumAnnahmen;
  /** Seit 1.6.0: Fenster laut Plan. */
  fenster_plan?: PlanFenster[];
}

/** Datenstatus laut Projektdatei: D (Dokument), A (aus Plan/Ansicht abgeleitet), S (geschätzt). */
export type AnnahmeStatus = string;

export interface PlanRaumAnnahmen {
  lichte_hoehe_m?: { wert: number; status: AnnahmeStatus; quelle: string };
  beheizt?: { wert: boolean; status: AnnahmeStatus; quelle: string };
}

export interface PlanFenster {
  id: string;
  typ: FensterArt;
  bezeichnung: string;
  orientierung: string;
  breite_m: number | null;
  hoehe_m: number | null;
  anzahl: number | null;
  breite_status: AnnahmeStatus;
  hoehe_status: AnnahmeStatus;
  quelle: string;
  verglasung: string;
  erneuert: Antwort | null;
  baujahr: number | null;
  bestand_status: AnnahmeStatus;
}

/** Annahme an einem Prüfpunkt. */
export interface PlanAnnahme {
  text: string;
  wert: number | null;
  einheit: string | null;
  status: AnnahmeStatus;
  quelle: string;
}

/** Prüfpunkt laut Projektdatei. */
export interface PlanPruefpunkt {
  id: string;
  ort: string;
  text: string;
  typ: 'text' | 'zahl';
  einheit: string | null;
  wirkung: string;
  quelle: string;
  /** Seit 1.6.0: Annahme des Rechenmodells. null: reine Frage. */
  annahme?: PlanAnnahme | null;
}

export interface PlanEinheit {
  einheit_id: string;
  eh: number | null;
  bezeichnung: string;
  art: EinheitArt;
  geschoss: string;
  datum: string; // JJJJ-MM-TT oder ''
  uhrzeit: string; // HH:MM oder ''
  ersatz: PlanErsatz[];
  raeume: PlanRaum[];
  hinweis: string;
  eh_zusatz?: number[];
  wohnungstyp?: number | null;
  dauer_min?: number | null;
  pruefpunkte?: PlanPruefpunkt[];
}

export interface Projekt {
  projekt_id: string;
  name: string;
  nutzungsarten: Nutzungsart[];
  einheiten: PlanEinheit[];
  /** Original der zuletzt eingespielten Projektdatei (für aufnahme.json). */
  objekt_roh: unknown;
  importiert_am: string;
  /** Hinweis zum Projekt aus der Projektdatei (projekt.hinweis). */
  hinweis?: string;
  /** Stand der Projektdatei (projekt.stand). */
  stand?: string;
  /** Auffälligkeiten beim Einlesen. Eine Datei im verbindlichen Format erzeugt keine. */
  warnungen?: string[];
  /** App-Version, mit der die Projektdatei gelesen wurde. Fehlt bis 1.4 (dann wird beim Öffnen neu gelesen). */
  gelesen_mit?: string;
}

// ---------------- Fotos ----------------

export type FotoRolle =
  | 'Front'
  | 'Ventil'
  | 'Seite'
  | 'Weitere'
  | 'Fenster'
  | 'Raum'
  | 'HZ'
  | 'Glasstempel'
  | 'Pruefpunkt';

export interface FotoMeta {
  foto_id: string;
  projekt_id: string;
  einheit_id: string;
  dateiname: string;
  rolle: FotoRolle;
  /** hf_id, fenster_id, raum_id, punkt_id, abgang_id oder Prüfpunkt-id */
  bezug_id: string;
  groesse: number;
  breite: number;
  hoehe: number;
  erstellt_am: string;
  exportiert_am: string | null;
}

export interface FotoBlob {
  foto_id: string;
  blob: Blob;
  thumb: Blob;
}

// ---------------- Heizzentrale-Checkliste ----------------

export interface HzPunktDef {
  punkt_id: string;
  bezeichnung: string;
  /** Kurzname für den Dateinamen (HZ_<kurz>_01.jpg) */
  kurz: string;
  janein?: boolean;
  text?: string; // Beschriftung des Textfelds
  textVorschlaege?: string[];
  zahl?: string; // Beschriftung des Zahlenfelds inkl. Einheit
  zahlMitStatus?: boolean;
  hinweis?: string;
}

export const HZ_PUNKTE: HzPunktDef[] = [
  { punkt_id: 'verteiler', bezeichnung: 'Verteilerbalken gesamt', kurz: 'Verteiler', text: 'Notiz zum Verteiler' },
  { punkt_id: 'pumpen', bezeichnung: 'Pumpen (Typenschild)', kurz: 'Pumpen', text: 'Fabrikat/Typ', hinweis: 'Typenschild jeder Pumpe fotografieren.' },
  { punkt_id: 'regelgeraet', bezeichnung: 'Regelgerät', kurz: 'Regelgeraet', text: 'Fabrikat/Typ' },
  { punkt_id: 'fernwaerme', bezeichnung: 'Fernwärme-Übergabestation (Typenschild)', kurz: 'Fernwaerme', text: 'Fabrikat/Leistung' },
  {
    punkt_id: 'innendurchmesser',
    bezeichnung: 'Innendurchmesser erster Strangabschnitt',
    kurz: 'Innendurchmesser',
    zahl: 'Innendurchmesser in mm',
    zahlMitStatus: true,
  },
  {
    punkt_id: 'rohrmaterial',
    bezeichnung: 'Rohrmaterial',
    kurz: 'Rohrmaterial',
    text: 'Rohrmaterial',
    textVorschlaege: ['Stahl', 'Kupfer', 'Edelstahl', 'Kunststoff', 'Verbundrohr', 'unbekannt'],
  },
  { punkt_id: 'schlammabscheider', bezeichnung: 'Schlammabscheider', kurz: 'Schlammabscheider', janein: true },
  { punkt_id: 'entlueftung', bezeichnung: 'Entlüftung', kurz: 'Entlueftung', janein: true },
  { punkt_id: 'druckhaltung', bezeichnung: 'Druckhaltung', kurz: 'Druckhaltung', janein: true },
  {
    punkt_id: 'strangventile',
    bezeichnung: 'Strangventile/Differenzdruckregler',
    kurz: 'Strangventile',
    janein: true,
    text: 'Fabrikat',
  },
  {
    punkt_id: 'trinkwasser',
    bezeichnung: 'Trinkwassererwärmung',
    kurz: 'Trinkwasser',
    text: 'Art',
    textVorschlaege: ['Speicher', 'Frischwasserstation', 'Durchlauferhitzer dezentral', 'keine zentrale'],
    zahl: 'Speichergröße in Liter',
    zahlMitStatus: true,
  },
];

// ---------------- Standardmaße Fenster (Vorschläge zum Antippen, Breite × Höhe in mm) ----------------

export const FENSTER_STANDARD: readonly (readonly [number, number])[] = [
  [600, 600], [800, 1400], [1000, 1400], [1200, 1400], [1500, 1400], [1800, 1400], [2000, 1400],
  [1000, 1500], [1200, 1500], [1500, 1500], [2000, 1500],
];
export const BALKONTUER_STANDARD: readonly (readonly [number, number])[] = [
  [900, 2100], [1000, 2100], [1800, 2100], [2000, 2100], [2500, 2100],
];
export const FENSTER_BREITEN = [500, 600, 800, 900, 1000, 1200, 1400, 1500, 1600, 1800, 2000, 2200, 2500] as const;
export const FENSTER_HOEHEN = [500, 600, 800, 1000, 1200, 1300, 1400, 1500, 1600, 2000, 2100, 2200] as const;
