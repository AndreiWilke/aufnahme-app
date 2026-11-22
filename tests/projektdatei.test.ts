// Tests für das verbindliche Format der Projektdatei (docs/projektdatei.md, Übergabe 2).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import beispiel from '../data/beispiel.objekt.json';
import { neueAufnahme, projektdateiLesen, projektEinspielen } from '../src/projekt';
import { aufnahmeJson, csvDateien } from '../src/export';
import { fotoPraefix, naechsterDateiname } from '../src/fotos';
import { gruppiertNachTag } from '../src/ui/projekt';

interface RohRaum { id: string; nr: string; nutzung: string; soll_temp_c: number | null; flaeche_plan_m2: number | null; heizlast_w?: number | null }
interface RohPruefpunkt { id: string; typ: string; einheit: string | null }
interface RohEinheit { id: string; art: string; termin: string; ersatz: { eh: number }[]; raeume: RohRaum[]; pruefpunkte?: RohPruefpunkt[] }
interface RohDatei { nutzungsarten: { key: string; soll_temp_c: number | null }[]; einheiten: RohEinheit[] }

/** Prüfungen, die für jede Projektdatei im verbindlichen Format gelten. */
function pruefeFormat(roh: RohDatei) {
  const p = projektdateiLesen(structuredClone(roh));
  expect(p.warnungen).toEqual([]);
  expect(p.einheiten).toHaveLength(roh.einheiten.length);

  const raeume = roh.einheiten.flatMap((e) => e.raeume.map((r) => ({ e, r })));
  const ids = raeume.map((x) => x.r.id);
  expect(new Set(ids).size).toBe(ids.length); // keine doppelte Raum-ID
  // Seit Fassung 2 sind Raum-IDs die IDs des Rechenmodells (z. B. ALLG-E01, ALLG-R01 in ALLG-1OG).
  // Verbindlich ist nur: im Projekt eindeutig, Zeichen A-Z a-z 0-9 -.
  for (const id of ids) expect(id, `Raum-ID ${id}`).toMatch(/^[A-Za-z0-9-]+$/);

  const keys = new Map(roh.nutzungsarten.map((n) => [n.key, n.soll_temp_c]));
  for (const { r } of raeume) {
    expect(keys.has(r.nutzung), `Nutzung ${r.nutzung} (${r.id})`).toBe(true);
    expect(r.soll_temp_c, `soll_temp_c ${r.id}`).toBe(keys.get(r.nutzung));
  }

  // Die App übernimmt alles unverändert.
  const gelesen = p.einheiten.flatMap((e) => e.raeume);
  expect(gelesen.map((r) => r.raum_id)).toEqual(ids);
  expect(gelesen.map((r) => r.flaeche_plan_m2)).toEqual(raeume.map((x) => x.r.flaeche_plan_m2));
  expect(gelesen.map((r) => r.soll_temp_c)).toEqual(raeume.map((x) => x.r.soll_temp_c));
  expect(gelesen.map((r) => r.heizlast_w ?? null)).toEqual(raeume.map((x) => x.r.heizlast_w ?? null));

  // Prüfpunkte: IDs eindeutig mit erlaubten Zeichen, Typ text oder zahl, alle übernommen.
  const pp = roh.einheiten.flatMap((e) => e.pruefpunkte ?? []);
  const ppIds = pp.map((q) => q.id);
  expect(new Set(ppIds).size).toBe(ppIds.length);
  for (const q of pp) {
    expect(q.id, `Prüfpunkt-ID ${q.id}`).toMatch(/^[A-Za-z0-9-]+$/);
    expect(['text', 'zahl']).toContain(q.typ);
  }
  expect(p.einheiten.flatMap((e) => (e.pruefpunkte ?? []).map((q) => q.id))).toEqual(ppIds);
  expect(p.nutzungsarten.map((n) => n.schluessel)).toEqual(roh.nutzungsarten.map((n) => n.key));
  expect(p.einheiten.map((e) => `${e.datum}T${e.uhrzeit}`)).toEqual(roh.einheiten.map((e) => e.termin));
  expect(p.einheiten.map((e) => e.art)).toEqual(roh.einheiten.map((e) => e.art.toLowerCase()));

  // Heizzentrale ohne Räume, Fortschritt (Räume gesamt) stimmt mit der Datei überein.
  const hz = roh.einheiten.find((e) => e.id === 'HZ')!;
  expect(hz.raeume).toHaveLength(0);
  const aufnahmen = p.einheiten.map((e) => neueAufnahme(p.projekt_id, e));
  expect(aufnahmen.find((a) => a.einheit_id === 'HZ')!.heizzentrale).not.toBeNull();
  expect(aufnahmen.reduce((s, a) => s + a.raeume.length, 0)).toBe(ids.length);
  expect(aufnahmen.reduce((s, a) => s + (a.pruefpunkte?.length ?? 0), 0)).toBe(pp.length);
  return { p, aufnahmen, anzahlRaeume: ids.length, anzahlPruefpunkte: pp.length };
}

describe('Projektdatei im verbindlichen Format', () => {
  it('Beispieldatei lädt vollständig und ohne Warnung', () => {
    const { p } = pruefeFormat(beispiel as unknown as RohDatei);
    expect(p.projekt_id).toBe('beispiel');
    expect(p.name).toBe('Beispielprojekt Musterstraße 1 (Testdaten)');
    expect(p.hinweis).toMatch(/Fiktive Testdaten/);
  });

  it('übernimmt hinweis, quelle, eh_zusatz, wohnungstyp und dauer_min', () => {
    const p = projektdateiLesen(structuredClone(beispiel));
    const e13 = p.einheiten.find((e) => e.einheit_id === 'EH013')!;
    expect(e13.hinweis).toMatch(/Ersatzwohnungen/);
    expect(e13.wohnungstyp).toBe(1);
    expect(e13.dauer_min).toBe(15);
    expect(e13.raeume[0].quelle).toBe('Beispielplan');
    expect(p.einheiten.find((e) => e.einheit_id === 'EH002')!.eh_zusatz).toEqual([102]);
    const a = neueAufnahme(p.projekt_id, e13);
    expect(a.raeume[0].quelle).toBe('Beispielplan');
  });

  it('null bleibt null: Fläche ohne Planwert und Technik ohne Solltemperatur', () => {
    const p = projektdateiLesen(structuredClone(beispiel));
    const technik = p.einheiten.find((e) => e.einheit_id === 'EH002')!.raeume.find((r) => r.nutzung === 'technik')!;
    expect(technik.flaeche_plan_m2).toBeNull();
    expect(technik.soll_temp_c).toBeNull();
    expect(p.nutzungsarten.find((n) => n.schluessel === 'technik')!.soll_temp_c).toBeNull();
    // Im Export leer, nicht 0.
    const aufnahmen = p.einheiten.map((e) => neueAufnahme(p.projekt_id, e));
    const zeile = csvDateien(p, aufnahmen)['raeume.csv'].split('\r\n').find((z) => z.includes('EH002-R03'))!;
    // 1.5.0: neue Spalten am Ende (keine_heizflaeche, lichte_hoehe_m, lichte_hoehe_status, beheizt_vor_ort)
    expect(zeile).toBe('EH002;EH002-R03;03;Lüftungszentrale;technik;;;plan;vorhanden;nein;0;0;nein;;;nein;;;');
    const json = aufnahmeJson(p, aufnahmen, 'komplett', 'alle', '2026-12-04T10:00:00+01:00');
    const r = json.einheiten.find((e) => e.einheit_id === 'EH002')!.raeume.find((x) => x.raum_id === 'EH002-R03')!;
    expect(r.soll_temp_c).toBeNull();
    expect(r.flaeche_plan_m2).toBeNull();
  });

  it('Nutzungsarten kommen aus der Projektdatei, auch neue', () => {
    const p = projektdateiLesen(structuredClone(beispiel));
    const k = p.nutzungsarten.map((n) => n.schluessel);
    for (const neu of ['behandlung', 'warte', 'gastraum', 'gruppenraum', 'technik']) expect(k).toContain(neu);
    expect(p.nutzungsarten.find((n) => n.schluessel === 'behandlung')).toEqual({ schluessel: 'behandlung', bezeichnung: 'Behandlung/Untersuchung', soll_temp_c: 24 });
  });

  it('warnt bei unbekannter Nutzung, unbekannter Art und fehlendem Termin', () => {
    const p = projektdateiLesen({
      schema_version: 1,
      projekt: { id: 'x', name: 'X' },
      nutzungsarten: [{ key: 'wohnen', name: 'Wohnraum', soll_temp_c: 20 }],
      einheiten: [{ id: 'A', art: 'Hotel', raeume: [{ id: 'A-R01', nr: '01', name: 'Zimmer', nutzung: 'zimmer' }] }],
    });
    expect(p.warnungen).toHaveLength(3);
    expect(p.warnungen!.join(' ')).toMatch(/Art „Hotel“.*kein Termin.*Nutzung „zimmer“/);
  });

  it('doppelte Raum-ID über Einheiten hinweg ist ein Fehler', () => {
    expect(() =>
      projektdateiLesen({
        projekt: { id: 'x' },
        einheiten: [
          { id: 'A', art: 'Wohnung', termin: '2026-12-05T10:00', raeume: [{ id: 'A-R01', nr: '01', name: 'a', nutzung: 'wohnen' }] },
          { id: 'B', art: 'Wohnung', termin: '2026-12-05T10:15', raeume: [{ id: 'A-R01', nr: '01', name: 'b', nutzung: 'wohnen' }] },
        ],
      }),
    ).toThrow(/doppelt/);
  });

  it('gruppiert nach Tag, sortiert nach Termin, gleiche Uhrzeit in Dateireihenfolge', () => {
    const p = projektdateiLesen(structuredClone(beispiel));
    const tage = gruppiertNachTag(p.einheiten);
    expect(tage.map(([t]) => t)).toEqual(['2026-12-04', '2026-12-05']);
    expect(tage[0][1].map((e) => e.einheit_id)).toEqual(['HZ', 'ALLG', 'EH001', 'EH002']);
    expect(tage[1][1].map((e) => e.einheit_id)).toEqual(['EH013', 'EH020']);
  });
});

describe('Ersatzwohnung', () => {
  it('Raumliste bleibt gleich, nur aufgenommen_eh und aufgenommen_bezeichnung ändern sich', () => {
    const p = projektdateiLesen(structuredClone(beispiel));
    const pe = p.einheiten.find((e) => e.einheit_id === 'EH013')!;
    const a = neueAufnahme(p.projekt_id, pe);
    const vorher = structuredClone(a.raeume);
    expect(a.aufgenommen_eh).toBe(13);
    a.aufgenommen_eh = pe.ersatz[0].eh;
    a.aufgenommen_bezeichnung = pe.ersatz[0].bezeichnung;
    expect(a.raeume).toEqual(vorher);
    expect(a.einheit_id).toBe('EH013');
    // Dateiname trägt die tatsächlich begangene Wohnung.
    const name = naechsterDateiname(a, fotoPraefix(a, { art: 'hf', raumNr: '03', raumName: 'Wohnraum', hfNr: 1, rolle: 'Ventil' }));
    expect(name).toBe('EH013_Whg214_R03-Wohnraum_HK1_Ventil_01.jpg');
    const json = aufnahmeJson(p, [a], 'komplett', 'EH013', '2026-12-05T10:10:00+01:00');
    expect(json.einheiten[0]).toMatchObject({ einheit_id: 'EH013', aufgenommen_eh: 14, aufgenommen_bezeichnung: 'Whg. 214' });
  });

  it('gewählte Ersatzwohnung übersteht das Einspielen einer neueren Projektdatei', () => {
    const p = projektdateiLesen(structuredClone(beispiel));
    const aufnahmen = p.einheiten.map((e) => neueAufnahme(p.projekt_id, e));
    const a = aufnahmen.find((x) => x.einheit_id === 'EH013')!;
    a.aufgenommen_eh = 14;
    a.aufgenommen_bezeichnung = 'Whg. 214';
    a.geaendert_am = '2026-12-05T10:05:00+01:00';
    const erg = projektEinspielen(projektdateiLesen(structuredClone(beispiel)), aufnahmen);
    expect(erg.aufnahmen.find((x) => x.einheit_id === 'EH013')).toMatchObject({ aufgenommen_eh: 14, aufgenommen_bezeichnung: 'Whg. 214' });
    expect(erg.neueRaeume).toBe(0);
  });
});

describe('Export bleibt unverändert', () => {
  it('neue Planfelder erscheinen nicht in aufnahme.json', () => {
    const p = projektdateiLesen(structuredClone(beispiel));
    const aufnahmen = p.einheiten.map((e) => neueAufnahme(p.projekt_id, e));
    const text = JSON.stringify(aufnahmeJson(p, aufnahmen, 'komplett', 'alle', '2026-12-04T10:00:00+01:00'));
    for (const feld of ['quelle', 'eh_zusatz', 'wohnungstyp', 'dauer_min', 'warnungen']) expect(text).not.toContain(`"${feld}"`);
    const pe = JSON.parse(text).projekt.einheiten[0];
    expect(Object.keys(pe)).toEqual(['einheit_id', 'eh', 'bezeichnung', 'art', 'geschoss', 'datum', 'uhrzeit', 'ersatz', 'raeume', 'hinweis']);
  });
});

// Echte Projektdateien liegen nur lokal (data/*.objekt.json steht in .gitignore).
// Auf GitHub fehlen sie; dann läuft nur die Beispieldatei.
// Nur Dateien direkt in data/; ältere Fassungen unter data/alt/ werden nicht geprüft.
const DATA = join(__dirname, '..', 'data');
const echte = existsSync(DATA) ? readdirSync(DATA).filter((f) => f.endsWith('.objekt.json') && f !== 'beispiel.objekt.json') : [];

describe.skipIf(echte.length === 0)('Echte Projektdateien (nur lokal)', () => {
  for (const datei of echte) {
    it(`${datei} lädt vollständig und ohne Warnung`, () => {
      const text = readFileSync(join(DATA, datei), 'utf-8');
      expect(text).not.toMatch(/�|Ã.|Â./); // Umlaute korrekt
      pruefeFormat(JSON.parse(text));
    });
  }

  const ism = join(DATA, 'ismaninger136.objekt.json');
  it.skipIf(!existsSync(ism))('ismaninger136 Fassung 2: 47 Einheiten, 295 Räume, Termine und Ersatzwohnungen stimmig', () => {
    const roh = JSON.parse(readFileSync(ism, 'utf-8')) as RohDatei;
    const { p, anzahlRaeume, anzahlPruefpunkte } = pruefeFormat(roh);
    expect(p.einheiten).toHaveLength(47);
    expect(anzahlRaeume).toBe(295);
    expect(anzahlPruefpunkte).toBe(168);
    expect(roh.einheiten.find((e) => e.id === 'HZ')!.raeume).toHaveLength(0);
    // Freitag: Heizzentrale, ALLG und Gewerbe. Samstag: Wohnungen und die Allgemeinflächen je Geschoss (ALLG-1OG …).
    for (const e of roh.einheiten) {
      const samstag = e.art === 'Wohnung' || (e.art === 'Allgemein' && e.id !== 'ALLG');
      expect(e.termin.slice(0, 10), e.id).toBe(samstag ? '2026-12-05' : '2026-12-04');
    }
    const tage = gruppiertNachTag(p.einheiten);
    expect(tage.map(([t, l]) => [t, l.length])).toEqual([['2026-12-04', 23], ['2026-12-05', 24]]);
    expect(tage[0][1].slice(0, 2).map((e) => e.einheit_id)).toEqual(['HZ', 'ALLG']);
    for (const id of ['ALLG-1OG', 'ALLG-2OG', 'ALLG-3OG', 'ALLG-4OG'])
      expect(p.einheiten.find((e) => e.einheit_id === id)?.art, id).toBe('allgemein');
    const allg = p.einheiten.find((e) => e.einheit_id === 'ALLG')!;
    expect(allg.raeume).toHaveLength(13);
    expect(allg.pruefpunkte).toHaveLength(12);
    const ersatz = roh.einheiten.flatMap((e) => e.ersatz.map((x) => x.eh));
    expect(new Set(ersatz).size).toBe(ersatz.length);
  });
});
