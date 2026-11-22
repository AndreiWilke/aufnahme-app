// Ergänzungen 1.6.0 (Übergabe 4): Annahmen bestätigen (passt / ändern / unklar), „Raum wie angenommen“,
// Fenster laut Plan, Export und Einspielen mit geänderter Annahme.
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import beispiel from '../data/beispiel.objekt.json';
import { neueAufnahme, projektdateiLesen, projektEinspielen } from '../src/projekt';
import {
  annahmenFortschritt,
  fensterDatensatzEntfernt,
  fensterPlanPruefen,
  fensterPlanPruefung,
  nachVorbefuellung,
  ppAnnahmenFortschritt,
  ppPruefen,
  raumAnnahmePruefen,
  raumAnnahmenOffen,
  raumWieAngenommen,
} from '../src/annahmen';
import { aufnahmeJson, csvDateien } from '../src/export';
import type { EinheitAufnahme, Projekt } from '../src/model';
import { APP_VERSION } from '../src/model';
import * as DB from '../src/db';
import { neuLesenNoetig, projektOeffnen, S } from '../src/store';

const ZEIT = '2026-12-05T10:00:00+01:00';
const projekt = () => projektdateiLesen(structuredClone(beispiel));
function stand(p: Projekt = projekt()) {
  const aufn = p.einheiten.map((e) => neueAufnahme(p.projekt_id, e));
  const a = (id: string) => aufn.find((x) => x.einheit_id === id)!;
  const pe = (id: string) => p.einheiten.find((e) => e.einheit_id === id)!;
  return { p, aufn, a, pe };
}
const kueche = (s: ReturnType<typeof stand>) => ({ r: s.a('EH013').raeume[1], pr: s.pe('EH013').raeume[1] });
const wohnraum = (s: ReturnType<typeof stand>) => ({ r: s.a('EH013').raeume[2], pr: s.pe('EH013').raeume[2] });

describe('Projektdatei: annahme, annahmen, fenster_plan', () => {
  it('liest alle drei Felder ohne Warnung, Aufnahme hat leere Prüfungen', () => {
    const s = stand();
    expect(s.p.warnungen).toEqual([]);
    expect(s.pe('ALLG').pruefpunkte![0].annahme).toEqual({ text: 'lichte Höhe ca. 2,60 m', wert: 2.6, einheit: 'm', status: 'A', quelle: 'Beispielansicht' });
    expect(s.pe('ALLG').pruefpunkte![1].annahme).toBeNull();
    const { r, pr } = wohnraum(s);
    expect(pr.annahmen).toEqual({
      lichte_hoehe_m: { wert: 2.6, status: 'S', quelle: 'Beispielansicht' },
      beheizt: { wert: true, status: 'A', quelle: 'Beispielmodell' },
    });
    expect(pr.fenster_plan!.map((f) => [f.id, f.typ, f.breite_m, f.hoehe_m, f.erneuert, f.baujahr])).toEqual([
      ['EH013-R03-F01', 'fenster', 1.59, 1.75, 'nein', 1975],
      ['EH013-R03-F02', 'fenstertuer', 0.9, 2.1, 'nein', 1975],
    ]);
    expect(r.annahmen_bestaetigung).toEqual({ lichte_hoehe_m: null, beheizt: null });
    expect(r.fenster_plan_bestaetigung).toEqual([
      { id: 'EH013-R03-F01', bestaetigung: null, fenster_id: null, geaendert_am: null },
      { id: 'EH013-R03-F02', bestaetigung: null, fenster_id: null, geaendert_am: null },
    ]);
    expect(s.a('ALLG').pruefpunkte![0].bestaetigung).toBeNull();
  });

  it('fehlerhafte Einträge ergeben Warnungen, kein Abbruch', () => {
    const p = projektdateiLesen({
      projekt: { id: 'x' },
      nutzungsarten: [{ key: 'wohnen', name: 'Wohnraum', soll_temp_c: 20 }],
      einheiten: [
        {
          id: 'A', art: 'Wohnung', termin: '2026-12-05T10:00',
          raeume: [
            {
              id: 'A-R01', nr: '01', name: 'Wohnen', nutzung: 'wohnen', soll_temp_c: 20,
              annahmen: { lichte_hoehe_m: { wert: null }, beheizt: { wert: 'ja' } },
              fenster_plan: [{ id: 'F1', typ: 'oberlicht' }, { id: 'F1' }, { typ: 'fenster' }],
            },
          ],
        },
      ],
    });
    expect(p.einheiten[0].raeume[0].annahmen).toBeUndefined();
    expect(p.einheiten[0].raeume[0].fenster_plan!.map((f) => [f.id, f.typ])).toEqual([['F1', 'fenster']]);
    expect(p.warnungen).toHaveLength(5);
  });
});

describe('Prüfpunkte mit Annahme', () => {
  it('passt: bestätigt und erledigt, Zahl = Annahme mit Status „bestätigt“', () => {
    const s = stand();
    const q = s.a('ALLG').pruefpunkte![0];
    ppPruefen(q, s.pe('ALLG').pruefpunkte![0], 'bestaetigt');
    expect(q).toMatchObject({ bestaetigung: 'bestaetigt', erledigt: true, wert: { wert: 2.6, status: 'bestätigt' } });
    // Text-Prüfpunkt: kein Wert, auch wenn die Annahme eine Zahl hat
    const t = s.a('EH013').pruefpunkte![0];
    ppPruefen(t, s.pe('EH013').pruefpunkte![0], 'bestaetigt');
    expect(t).toMatchObject({ bestaetigung: 'bestaetigt', erledigt: true, wert: { wert: null, status: null } });
  });

  it('ändern: Zahl mit der Annahme vorbefüllt (geschätzt), neuer Wert gilt als gemessen', () => {
    const s = stand();
    const d = s.pe('ALLG').pruefpunkte![0];
    const q = s.a('ALLG').pruefpunkte![0];
    ppPruefen(q, d, 'bestaetigt');
    ppPruefen(q, d, 'geaendert');
    expect(q).toMatchObject({ bestaetigung: 'geaendert', erledigt: false, wert: { wert: 2.6, status: 'geschätzt' } });
    q.wert = nachVorbefuellung(q.wert, { wert: 2.75, status: 'geschätzt' }, d.annahme!.wert);
    expect(q.wert).toEqual({ wert: 2.75, status: 'gemessen' });
    // ausdrücklich „geschätzt“ angetippt bleibt geschätzt
    expect(nachVorbefuellung({ wert: 2.75, status: 'gemessen' }, { wert: 2.75, status: 'geschätzt' }, 2.6)).toEqual({ wert: 2.75, status: 'geschätzt' });
    // ein eingegebener Wert bleibt beim erneuten „ändern“
    ppPruefen(q, d, 'geaendert');
    expect(q.wert).toEqual({ wert: 2.75, status: 'gemessen' });
  });

  it('unklar: bestätigter Wert wird geleert; gleicher Knopf noch einmal nimmt die Prüfung zurück', () => {
    const s = stand();
    const d = s.pe('ALLG').pruefpunkte![0];
    const q = s.a('ALLG').pruefpunkte![0];
    ppPruefen(q, d, 'bestaetigt');
    ppPruefen(q, d, 'unklar');
    expect(q).toMatchObject({ bestaetigung: 'unklar', erledigt: true, wert: { wert: null, status: null } });
    ppPruefen(q, d, null);
    expect(q).toMatchObject({ bestaetigung: null, erledigt: false });
  });

  it('Zähler „Annahmen x/y geprüft“ getrennt von den Prüfpunkten', () => {
    const s = stand();
    expect(ppAnnahmenFortschritt(s.a('ALLG'), s.pe('ALLG'))).toEqual({ geprueft: 0, gesamt: 1 });
    ppPruefen(s.a('ALLG').pruefpunkte![0], s.pe('ALLG').pruefpunkte![0], 'unklar');
    expect(ppAnnahmenFortschritt(s.a('ALLG'), s.pe('ALLG'))).toEqual({ geprueft: 1, gesamt: 1 });
    // Einheit: 1 Prüfpunkt + Küche (2 + 1 Fenster) + Wohnraum (2 + 2 Fenster)
    expect(annahmenFortschritt(s.a('EH013'), s.pe('EH013'))).toEqual({ geprueft: 0, gesamt: 8 });
    // ALLG: 1 Prüfpunkt + beheizt im Treppenhaus
    expect(annahmenFortschritt(s.a('ALLG'), s.pe('ALLG'))).toEqual({ geprueft: 1, gesamt: 2 });
  });
});

describe('Raum-Annahmen', () => {
  it('passt übernimmt die Annahme in lichte_hoehe_m (bestätigt) und beheizt_vor_ort (ja/nein)', () => {
    const s = stand();
    const { r, pr } = wohnraum(s);
    raumAnnahmePruefen(r, pr, 'lichte_hoehe_m', 'bestaetigt');
    raumAnnahmePruefen(r, pr, 'beheizt', 'bestaetigt');
    expect(r.lichte_hoehe_m).toEqual({ wert: 2.6, status: 'bestätigt' });
    expect(r.beheizt_vor_ort).toBe('ja');
    expect(r.annahmen_bestaetigung).toEqual({ lichte_hoehe_m: 'bestaetigt', beheizt: 'bestaetigt' });
    const allg = s.a('ALLG').raeume[0];
    raumAnnahmePruefen(allg, s.pe('ALLG').raeume[0], 'beheizt', 'bestaetigt');
    expect(allg.beheizt_vor_ort).toBe('nein');
  });

  it('ändern nutzt die Felder aus 1.5.0, unklar und Zurücknehmen leeren übernommene Werte', () => {
    const s = stand();
    const { r, pr } = wohnraum(s);
    raumAnnahmePruefen(r, pr, 'lichte_hoehe_m', 'geaendert');
    expect(r.lichte_hoehe_m).toEqual({ wert: 2.6, status: 'geschätzt' });
    r.lichte_hoehe_m = nachVorbefuellung(r.lichte_hoehe_m!, { wert: 2.55, status: 'geschätzt' }, 2.6);
    expect(r.lichte_hoehe_m).toEqual({ wert: 2.55, status: 'gemessen' });
    raumAnnahmePruefen(r, pr, 'beheizt', 'bestaetigt');
    raumAnnahmePruefen(r, pr, 'beheizt', 'geaendert');
    expect(r.beheizt_vor_ort).toBe('nein'); // Gegenteil der Annahme
    raumAnnahmePruefen(r, pr, 'beheizt', 'unklar');
    expect(r.beheizt_vor_ort).toBe('unklar');
    raumAnnahmePruefen(r, pr, 'beheizt', null);
    expect(r.beheizt_vor_ort).toBeNull();
    raumAnnahmePruefen(r, pr, 'lichte_hoehe_m', 'bestaetigt');
    raumAnnahmePruefen(r, pr, 'lichte_hoehe_m', 'unklar');
    expect(r.lichte_hoehe_m).toEqual({ wert: null, status: null });
  });
});

describe('Fenster laut Plan', () => {
  it('passt legt keinen Datensatz an; ändern legt einen vorbefüllten mit fenster_plan_id an', () => {
    const s = stand();
    const { r, pr } = kueche(s);
    fensterPlanPruefen(r, pr.fenster_plan![0], 'bestaetigt', ZEIT);
    expect(r.fenster).toEqual([]);
    expect(fensterPlanPruefung(r, 'EH013-R02-F01')).toMatchObject({ bestaetigung: 'bestaetigt', fenster_id: null, geaendert_am: ZEIT });
    fensterPlanPruefen(r, pr.fenster_plan![0], 'geaendert', ZEIT);
    expect(r.fenster).toHaveLength(1);
    expect(r.fenster[0]).toMatchObject({
      anzahl: 1, verglasung: '2-fach', rahmen: null, breite_mm: 1070, hoehe_mm: 1750, masse_status: 'geschätzt',
      art: 'fenster', erneuert: 'nein', baujahr: 1975, fenster_plan_id: 'EH013-R02-F01',
    });
    expect(fensterPlanPruefung(r, 'EH013-R02-F01')).toMatchObject({ bestaetigung: 'geaendert', fenster_id: r.fenster[0].fenster_id });
  });

  it('nicht vorhanden entfernt einen geänderten Datensatz; Löschen des Datensatzes nimmt die Prüfung zurück', () => {
    const s = stand();
    const { r, pr } = kueche(s);
    fensterPlanPruefen(r, pr.fenster_plan![0], 'geaendert', ZEIT);
    const id = r.fenster[0].fenster_id;
    expect(fensterPlanPruefen(r, pr.fenster_plan![0], 'nicht_vorhanden', ZEIT)).toBe(id);
    expect(r.fenster).toEqual([]);
    expect(fensterPlanPruefung(r, 'EH013-R02-F01')).toMatchObject({ bestaetigung: 'nicht_vorhanden', fenster_id: null });
    fensterPlanPruefen(r, pr.fenster_plan![0], 'geaendert', ZEIT);
    const f = r.fenster[0];
    r.fenster = [];
    fensterDatensatzEntfernt(r, f, ZEIT);
    expect(fensterPlanPruefung(r, 'EH013-R02-F01')).toMatchObject({ bestaetigung: null, fenster_id: null });
  });
});

describe('„Raum wie angenommen“', () => {
  it('bestätigt lichte Höhe, beheizt und alle Fenster laut Plan, Heizflächen unberührt', () => {
    const s = stand();
    const { r, pr } = wohnraum(s);
    expect(raumAnnahmenOffen(r, pr)).toBe(4);
    expect(raumWieAngenommen(r, pr, ZEIT)).toBe(4);
    expect(raumAnnahmenOffen(r, pr)).toBe(0);
    expect(r).toMatchObject({
      lichte_hoehe_m: { wert: 2.6, status: 'bestätigt' },
      beheizt_vor_ort: 'ja',
      annahmen_bestaetigung: { lichte_hoehe_m: 'bestaetigt', beheizt: 'bestaetigt' },
      heizflaechen: [],
      fenster: [],
      erledigt: false,
      keine_heizflaeche: false,
    });
    expect(r.fenster_plan_bestaetigung!.map((e) => e.bestaetigung)).toEqual(['bestaetigt', 'bestaetigt']);
  });

  it('überschreibt keine bereits geprüften Annahmen', () => {
    const s = stand();
    const { r, pr } = wohnraum(s);
    raumAnnahmePruefen(r, pr, 'lichte_hoehe_m', 'geaendert');
    r.lichte_hoehe_m = { wert: 2.5, status: 'gemessen' };
    fensterPlanPruefen(r, pr.fenster_plan![1], 'nicht_vorhanden', ZEIT);
    expect(raumWieAngenommen(r, pr, ZEIT)).toBe(2);
    expect(r.lichte_hoehe_m).toEqual({ wert: 2.5, status: 'gemessen' });
    expect(r.annahmen_bestaetigung).toEqual({ lichte_hoehe_m: 'geaendert', beheizt: 'bestaetigt' });
    expect(r.fenster_plan_bestaetigung!.map((e) => e.bestaetigung)).toEqual(['bestaetigt', 'nicht_vorhanden']);
  });
});

function gepruefteAufnahmen(): { p: Projekt; aufn: EinheitAufnahme[] } {
  const s = stand();
  ppPruefen(s.a('ALLG').pruefpunkte![0], s.pe('ALLG').pruefpunkte![0], 'bestaetigt');
  ppPruefen(s.a('EH013').pruefpunkte![0], s.pe('EH013').pruefpunkte![0], 'unklar');
  const w = wohnraum(s);
  raumWieAngenommen(w.r, w.pr, ZEIT);
  const k = kueche(s);
  raumAnnahmePruefen(k.r, k.pr, 'lichte_hoehe_m', 'geaendert');
  k.r.lichte_hoehe_m = { wert: 2.5, status: 'gemessen' };
  fensterPlanPruefen(k.r, k.pr.fenster_plan![0], 'geaendert', ZEIT);
  k.r.fenster[0].hoehe_mm = 1500;
  k.r.fenster[0].masse_status = 'gemessen';
  k.r.fenster[0].fenster_id = 'fk1';
  k.r.fenster_plan_bestaetigung![0].fenster_id = 'fk1';
  return { p: s.p, aufn: s.aufn };
}

describe('Export 1.6.0: nur ergänzt', () => {
  it('aufnahme.json: bestaetigung, annahmen_bestaetigung, fenster_plan_bestaetigung, fenster_plan_id', () => {
    const { p, aufn } = gepruefteAufnahmen();
    const j = aufnahmeJson(p, aufn, 'komplett', 'alle', ZEIT);
    const allg = j.einheiten.find((e) => e.einheit_id === 'ALLG')!;
    expect(allg.pruefpunkte[0]).toMatchObject({ id: 'ALLG-P01', bestaetigung: 'bestaetigt', erledigt: true, wert: { wert: 2.6, status: 'bestätigt' } });
    expect(allg.pruefpunkte[1].bestaetigung).toBeNull();
    const eh13 = j.einheiten.find((e) => e.einheit_id === 'EH013')!;
    expect(eh13.pruefpunkte[0].bestaetigung).toBe('unklar');
    const [diele, kue, wohn] = eh13.raeume;
    expect(diele.annahmen_bestaetigung).toEqual({ lichte_hoehe_m: null, beheizt: null });
    expect(diele.fenster_plan_bestaetigung).toEqual([]);
    expect(wohn.annahmen_bestaetigung).toEqual({ lichte_hoehe_m: 'bestaetigt', beheizt: 'bestaetigt' });
    expect(wohn.fenster_plan_bestaetigung).toEqual([
      { id: 'EH013-R03-F01', bestaetigung: 'bestaetigt', fenster_id: null, geaendert_am: ZEIT },
      { id: 'EH013-R03-F02', bestaetigung: 'bestaetigt', fenster_id: null, geaendert_am: ZEIT },
    ]);
    expect(Object.keys(wohn.fenster_plan_bestaetigung[0])).toEqual(['id', 'bestaetigung', 'fenster_id', 'geaendert_am']);
    expect(kue.annahmen_bestaetigung).toEqual({ lichte_hoehe_m: 'geaendert', beheizt: null });
    expect(kue.lichte_hoehe_m).toEqual({ wert: 2.5, status: 'gemessen' });
    expect(kue.fenster_plan_bestaetigung).toEqual([{ id: 'EH013-R02-F01', bestaetigung: 'geaendert', fenster_id: 'fk1', geaendert_am: ZEIT }]);
    expect(kue.fenster[0]).toMatchObject({ fenster_id: 'fk1', fenster_plan_id: 'EH013-R02-F01', breite_mm: 1070, hoehe_mm: 1500 });
    // interne Felder (Stand der Annahme) stehen nicht im Export
    expect(JSON.stringify(j)).not.toMatch(/"stand"|annahme_stand|annahmen_stand|annahme_geaendert/);
  });

  it('CSV: neue Spalten am Ende, neue Datei fenster_plan.csv', () => {
    const { p, aufn } = gepruefteAufnahmen();
    const c = csvDateien(p, aufn);
    const zeilen = (n: string) => c[n].slice(1).split('\r\n');
    expect(zeilen('pruefpunkte.csv')[0]).toMatch(/;geaendert_am;bestaetigung;annahme_text;annahme_wert;annahme_status$/);
    expect(zeilen('pruefpunkte.csv')[1]).toMatch(/^ALLG;ALLG-P01;.*;zahl;;2,6;m;bestätigt;;ja;;;bestaetigt;lichte Höhe ca\. 2,60 m;2,6;A$/);
    expect(zeilen('pruefpunkte.csv')[3]).toMatch(/^EH013;EH013-P01;.*;unklar;Bestand 1975, 2-fach, nicht erneuert;2,7;S$/);
    expect(zeilen('raeume.csv')[0]).toMatch(/;beheizt_vor_ort;lichte_hoehe_bestaetigung;beheizt_bestaetigung$/);
    expect(c['raeume.csv']).toContain(';2,6;bestätigt;ja;bestaetigt;bestaetigt\r\n');
    expect(c['raeume.csv']).toContain(';2,5;gemessen;;geaendert;\r\n');
    expect(zeilen('fenster.csv')[0]).toMatch(/;baujahr;fenster_plan_id$/);
    expect(c['fenster.csv']).toContain(';fk1;1;2-fach;;1070;1500;gemessen;;' + ZEIT + ';fenster;nein;1975;EH013-R02-F01\r\n');
    expect(zeilen('fenster_plan.csv')).toEqual([
      'einheit_id;raum_id;fenster_plan_id;bezeichnung;orientierung;breite_m;hoehe_m;anzahl;bestaetigung;fenster_id;geaendert_am',
      `EH013;EH013-R02;EH013-R02-F01;Fenster Küche;Hof SO;1,07;1,75;1;geaendert;fk1;${ZEIT}`,
      `EH013;EH013-R03;EH013-R03-F01;Fenster;Straße NW;1,59;1,75;1;bestaetigt;;${ZEIT}`,
      `EH013;EH013-R03;EH013-R03-F02;Balkontür;Straße NW;0,9;2,1;1;bestaetigt;;${ZEIT}`,
      '',
    ]);
  });
});

describe('Einspielen mit geänderter Annahme', () => {
  type Roh = {
    einheiten: {
      id: string;
      pruefpunkte?: { id: string; annahme?: { text: string; wert: number | null; status: string } | null }[];
      raeume: { id: string; annahmen?: { lichte_hoehe_m?: { wert: number; status: string } }; fenster_plan?: { id: string; hoehe_m: number; breite_status: string }[] }[];
    }[];
  };

  it('„passt“ wird zurückgesetzt und markiert, „ändern“ behält den Wert, nur Status geändert bleibt bestätigt', () => {
    const { aufn } = gepruefteAufnahmen();
    const roh = structuredClone(beispiel) as unknown as Roh;
    const allg = roh.einheiten.find((e) => e.id === 'ALLG')!;
    allg.pruefpunkte![0].annahme!.wert = 2.8; // ALLG-P01 bestätigt → zurücksetzen
    allg.pruefpunkte![0].annahme!.text = 'lichte Höhe ca. 2,80 m';
    const eh13 = roh.einheiten.find((e) => e.id === 'EH013')!;
    eh13.pruefpunkte![0].annahme!.text = 'Bestand 1980'; // unklar → bleibt
    const [, kue, wohn] = eh13.raeume;
    kue.annahmen!.lichte_hoehe_m!.wert = 2.7; // geändert → Wert bleibt
    wohn.annahmen!.lichte_hoehe_m!.wert = 2.7; // bestätigt → zurücksetzen
    wohn.annahmen!.lichte_hoehe_m!.status = 'D';
    wohn.fenster_plan![0].hoehe_m = 1.5; // bestätigt → zurücksetzen
    wohn.fenster_plan![1].breite_status = 'D'; // nur Status → bleibt bestätigt
    kue.fenster_plan!.push({ ...kue.fenster_plan![0], id: 'EH013-R02-F02' }); // neues Plan-Fenster

    const erg = projektEinspielen(projektdateiLesen(roh), aufn);
    expect(erg.annahmenZurueckgesetzt).toBe(3);
    const a = erg.aufnahmen.find((x) => x.einheit_id === 'ALLG')!;
    expect(a.pruefpunkte![0]).toMatchObject({ bestaetigung: null, erledigt: false, wert: { wert: null, status: null }, annahme_geaendert: true });
    const e = erg.aufnahmen.find((x) => x.einheit_id === 'EH013')!;
    expect(e.pruefpunkte![0].bestaetigung).toBe('unklar');
    const [, k, w] = e.raeume;
    expect(k.annahmen_bestaetigung!.lichte_hoehe_m).toBe('geaendert');
    expect(k.lichte_hoehe_m).toEqual({ wert: 2.5, status: 'gemessen' });
    expect(k.fenster_plan_bestaetigung!.map((x) => [x.id, x.bestaetigung, x.fenster_id])).toEqual([
      ['EH013-R02-F01', 'geaendert', 'fk1'],
      ['EH013-R02-F02', null, null],
    ]);
    expect(k.fenster[0].hoehe_mm).toBe(1500);
    expect(w.annahmen_bestaetigung).toEqual({ lichte_hoehe_m: null, beheizt: 'bestaetigt' });
    expect(w.annahmen_geaendert).toEqual({ lichte_hoehe_m: true });
    expect(w.lichte_hoehe_m).toEqual({ wert: null, status: null });
    expect(w.beheizt_vor_ort).toBe('ja');
    expect(w.fenster_plan_bestaetigung!.map((x) => [x.bestaetigung, x.annahme_geaendert ?? false])).toEqual([
      [null, true],
      ['bestaetigt', false],
    ]);
  });

  it('gleiche Projektdatei noch einmal einspielen ändert nichts', () => {
    const { p, aufn } = gepruefteAufnahmen();
    const erg = projektEinspielen(projektdateiLesen(structuredClone(beispiel)), aufn);
    expect(erg.annahmenZurueckgesetzt).toBe(0);
    expect(aufnahmeJson(p, erg.aufnahmen, 'komplett', 'alle', ZEIT).einheiten).toEqual(aufnahmeJson(p, aufn, 'komplett', 'alle', ZEIT).einheiten);
  });

  it('entfallenes Plan-Fenster: geprüftes bleibt markiert, ungeprüftes entfällt', () => {
    const { aufn } = gepruefteAufnahmen();
    const roh = structuredClone(beispiel) as unknown as Roh;
    const eh13 = roh.einheiten.find((e) => e.id === 'EH013')!;
    eh13.raeume[1].fenster_plan = [];
    eh13.raeume[2].fenster_plan = [];
    const s = aufn.find((x) => x.einheit_id === 'EH013')!;
    s.raeume[2].fenster_plan_bestaetigung![1].bestaetigung = null;
    const e = projektEinspielen(projektdateiLesen(roh), aufn).aufnahmen.find((x) => x.einheit_id === 'EH013')!;
    expect(e.raeume[2].fenster_plan_bestaetigung).toEqual([expect.objectContaining({ id: 'EH013-R03-F01', bestaetigung: 'bestaetigt', im_plan_entfallen: true })]);
    expect(e.raeume[1].fenster_plan_bestaetigung).toEqual([expect.objectContaining({ id: 'EH013-R02-F01', bestaetigung: 'geaendert' })]);
  });
});

describe('Projekt aus 1.5 öffnen', () => {
  it('neu lesen, wenn mit einer Version vor 1.6.0 gelesen', () => {
    expect(neuLesenNoetig(undefined)).toBe(true);
    expect(neuLesenNoetig('1.5.0')).toBe(true);
    expect(neuLesenNoetig('1.6.0')).toBe(false);
    expect(neuLesenNoetig('1.10.0')).toBe(false);
    expect(neuLesenNoetig('2.0.0')).toBe(false);
  });

  it('Annahmen und Fenster laut Plan erscheinen, Aufnahmen bleiben', async () => {
    const p = projekt();
    const alt15 = structuredClone(p);
    alt15.projekt_id = 'beispiel15';
    (alt15.objekt_roh as { projekt: { id: string } }).projekt.id = 'beispiel15';
    alt15.gelesen_mit = '1.5.0';
    for (const e of alt15.einheiten) {
      for (const q of e.pruefpunkte ?? []) delete q.annahme;
      for (const r of e.raeume) {
        delete r.annahmen;
        delete r.fenster_plan;
      }
    }
    const aufn = alt15.einheiten.map((e) => neueAufnahme(alt15.projekt_id, e));
    for (const a of aufn) for (const r of a.raeume) {
      delete r.annahmen_bestaetigung;
      delete r.fenster_plan_bestaetigung;
    }
    aufn.find((a) => a.einheit_id === 'EH013')!.raeume[2].notiz = 'bleibt';
    await DB.projektMitAufnahmenSpeichern(alt15, aufn);
    S.projekte = await DB.projekteLaden();
    await projektOeffnen('beispiel15', false);
    expect(S.projekt!.gelesen_mit).toBe(APP_VERSION);
    const r = S.aufnahmen.get('EH013')!.raeume[2];
    expect(r.notiz).toBe('bleibt');
    expect(r.fenster_plan_bestaetigung!.map((e) => e.id)).toEqual(['EH013-R03-F01', 'EH013-R03-F02']);
    expect(r.annahmen_bestaetigung).toEqual({ lichte_hoehe_m: null, beheizt: null });
    expect(S.projekt!.einheiten.find((e) => e.einheit_id === 'ALLG')!.pruefpunkte![0].annahme?.wert).toBe(2.6);
  });
});
