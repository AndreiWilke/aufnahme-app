// Ergänzungen 1.5.0 (Übergabe 3): Prüfpunkte, Heizlast, Keine Heizfläche, lichte Höhe, beheizt vor Ort, Fenster.
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import beispiel from '../data/beispiel.objekt.json';
import { neueAufnahme, projektdateiLesen, projektEinspielen } from '../src/projekt';
import { aufnahmeJson, csvDateien } from '../src/export';
import { fotoPraefix, naechsterDateiname, pruefpunktKurz } from '../src/fotos';
import type { EinheitAufnahme, Fenster, Raum } from '../src/model';
import { heizflaecheFehltVermutlich, heizlastSumme, heizlastText } from '../src/ui/einheit';
import * as DB from '../src/db';
import { projektOeffnen, S } from '../src/store';

const projekt = () => projektdateiLesen(structuredClone(beispiel));
const aufnahmen = () => {
  const p = projekt();
  return p.einheiten.map((e) => neueAufnahme(p.projekt_id, e));
};
const ZEIT = '2026-12-05T10:00:00+01:00';

describe('Projektdatei: heizlast_w und pruefpunkte', () => {
  it('liest heizlast_w (Zahl, negativ, null) und Prüfpunkte ohne Warnung', () => {
    const p = projekt();
    expect(p.warnungen).toEqual([]);
    expect(p.gelesen_mit).toBe('1.5.0');
    const eh13 = p.einheiten.find((e) => e.einheit_id === 'EH013')!;
    expect(eh13.raeume.map((r) => r.heizlast_w ?? null)).toEqual([-42, 512, 1209, null, null, null]);
    const allg = p.einheiten.find((e) => e.einheit_id === 'ALLG')!;
    expect(allg.raeume[0].heizlast_w).toBeNull();
    expect(allg.pruefpunkte).toEqual([
      { id: 'ALLG-P01', ort: 'Treppenhaus 1', text: 'Lichte Raumhöhe im Treppenhaus messen', typ: 'zahl', einheit: 'm', wirkung: 'Raumvolumen, Lüftungswärmeverlust', quelle: 'Beispiel' },
      expect.objectContaining({ id: 'ALLG-P02', typ: 'text', einheit: null }),
    ]);
    const a = neueAufnahme(p.projekt_id, allg);
    expect(a.pruefpunkte).toHaveLength(2);
    expect(a.pruefpunkte![0]).toEqual({
      id: 'ALLG-P01', text: 'Lichte Raumhöhe im Treppenhaus messen', antwort: null, wert: { wert: null, status: null },
      notiz: '', fotos: [], erledigt: false, geaendert_am: null,
    });
    expect(neueAufnahme(p.projekt_id, eh13).raeume[2].heizlast_w).toBe(1209);
  });

  it('doppelte Prüfpunkt-ID und unbekannter Typ ergeben Warnungen, kein Abbruch', () => {
    const p = projektdateiLesen({
      projekt: { id: 'x' },
      nutzungsarten: [{ key: 'wohnen', name: 'Wohnraum', soll_temp_c: 20 }],
      einheiten: [
        { id: 'A', art: 'Wohnung', termin: '2026-12-05T10:00', raeume: [], pruefpunkte: [{ id: 'A-P01', text: 'a', typ: 'liste' }, { id: 'A-P01', text: 'b' }] },
      ],
    });
    expect(p.einheiten[0].pruefpunkte).toHaveLength(1);
    expect(p.einheiten[0].pruefpunkte![0].typ).toBe('text');
    expect(p.warnungen).toHaveLength(2);
  });
});

describe('Anzeige Heizlast', () => {
  it('formatiert wie in der Übergabe', () => {
    expect(heizlastText(1209)).toBe('Heizlast lt. Vorberechnung: 1.209 W (vorläufig)');
    expect(heizlastText(12345.6)).toBe('Heizlast lt. Vorberechnung: 12.346 W (vorläufig)');
    expect(heizlastText(-42)).toBe('Heizlast lt. Vorberechnung: kein Wärmebedarf (Innenraum)');
    expect(heizlastText(null)).toBe('');
    expect(heizlastText(undefined)).toBe('');
  });

  it('Summe der Raumliste, null ohne Werte', () => {
    const a = aufnahmen().find((x) => x.einheit_id === 'EH013')!;
    expect(heizlastSumme(a.raeume)).toBe(-42 + 512 + 1209);
    expect(heizlastSumme(aufnahmen().find((x) => x.einheit_id === 'ALLG')!.raeume)).toBeNull();
  });

  it('fragt nur bei Wärmebedarf ohne Heizfläche und ohne „Keine Heizfläche“ nach', () => {
    const r = aufnahmen().find((x) => x.einheit_id === 'EH013')!.raeume;
    const wohnraum = r[2];
    expect(heizflaecheFehltVermutlich(wohnraum)).toBe(true);
    expect(heizflaecheFehltVermutlich({ ...wohnraum, keine_heizflaeche: true })).toBe(false);
    expect(heizflaecheFehltVermutlich({ ...wohnraum, heizflaechen: [{} as never] })).toBe(false);
    expect(heizflaecheFehltVermutlich({ ...wohnraum, zustand: 'nicht_vorhanden' })).toBe(false);
    expect(heizflaecheFehltVermutlich(r[0])).toBe(false); // negativ
    expect(heizflaecheFehltVermutlich(r[3])).toBe(false); // null
  });
});

describe('Fotos: Dateinamen', () => {
  it('Prüfpunkt: <Einheit-ID>_<Prüfpunkt-ID ohne Einheit>_01.jpg', () => {
    const a = aufnahmen().find((x) => x.einheit_id === 'ALLG')!;
    expect(naechsterDateiname(a, fotoPraefix(a, { art: 'pruefpunkt', id: 'ALLG-P03' }))).toBe('ALLG_P03_01.jpg');
    expect(naechsterDateiname(a, fotoPraefix(a, { art: 'pruefpunkt', id: 'ALLG-P03' }))).toBe('ALLG_P03_02.jpg');
    expect(pruefpunktKurz('ALLG-1OG', 'ALLG-1OG-P02')).toBe('P02');
    expect(pruefpunktKurz('EH051', 'EH051-P01')).toBe('P01');
    expect(pruefpunktKurz('EH051', 'X-P01')).toBe('X-P01');
  });

  it('Glasstempel am Fenster', () => {
    const a = aufnahmen().find((x) => x.einheit_id === 'EH013')!;
    expect(naechsterDateiname(a, fotoPraefix(a, { art: 'glasstempel', raumNr: '03', raumName: 'Wohnraum' }))).toBe(
      'EH013_Whg213_R03-Wohnraum_Fenster_Glasstempel_01.jpg',
    );
  });
});

function befuellt(): EinheitAufnahme[] {
  const l = aufnahmen();
  const allg = l.find((x) => x.einheit_id === 'ALLG')!;
  const q = allg.pruefpunkte![0];
  q.antwort = 'ja';
  q.wert = { wert: 2.55, status: 'gemessen' };
  q.notiz = 'Treppenhaus 1 gemessen';
  q.fotos = ['ALLG_P01_01.jpg'];
  q.erledigt = true;
  q.geaendert_am = ZEIT;
  const th = allg.raeume[0];
  th.beheizt_vor_ort = 'ja';
  th.lichte_hoehe_m = { wert: 2.55, status: 'geschätzt' };
  th.geaendert_am = ZEIT;
  allg.geaendert_am = ZEIT;
  const eh13 = l.find((x) => x.einheit_id === 'EH013')!;
  const diele = eh13.raeume[0];
  diele.keine_heizflaeche = true;
  diele.erledigt = true;
  const f: Fenster = {
    fenster_id: 'f1', anzahl: 1, verglasung: '2-fach', rahmen: 'holz', breite_mm: 1200, hoehe_mm: 1400, masse_status: 'geschätzt',
    art: 'fenster', erneuert: 'nein', baujahr: 1975, fotos: ['EH013_Whg213_R03-Wohnraum_Fenster_Glasstempel_01.jpg'], geaendert_am: ZEIT,
  };
  eh13.raeume[2].fenster.push(f);
  return l;
}

describe('Export: nur ergänzt, nichts umbenannt', () => {
  it('aufnahme.json: Prüfpunkte je Einheit mit den Feldern aus der Übergabe', () => {
    const j = aufnahmeJson(projekt(), befuellt(), 'komplett', 'alle', ZEIT);
    const allg = j.einheiten.find((e) => e.einheit_id === 'ALLG')!;
    expect(allg.pruefpunkte[0]).toEqual({
      id: 'ALLG-P01', text: 'Lichte Raumhöhe im Treppenhaus messen', antwort: 'ja', wert: { wert: 2.55, status: 'gemessen' },
      notiz: 'Treppenhaus 1 gemessen', fotos: ['ALLG_P01_01.jpg'], erledigt: true, geaendert_am: ZEIT,
    });
    expect(Object.keys(allg.pruefpunkte[1])).toEqual(['id', 'text', 'antwort', 'wert', 'notiz', 'fotos', 'erledigt', 'geaendert_am']);
    expect(allg.pruefpunkte[1].wert).toEqual({ wert: null, status: null });
    // Bisherige Schlüssel der Einheit unverändert und in gleicher Reihenfolge, pruefpunkte ergänzt.
    expect(Object.keys(allg)).toEqual([
      'einheit_id', 'aufgenommen_eh', 'aufgenommen_bezeichnung', 'status', 'abweichung_vom_plan', 'notiz', 'gewerbe',
      'zeit_start', 'zeit_ende', 'raeume', 'heizzentrale', 'pruefpunkte', 'im_plan_entfallen', 'geaendert_am',
    ]);
  });

  it('aufnahme.json: Raum und Fenster mit neuen Feldern, alte Schlüssel unverändert', () => {
    const j = aufnahmeJson(projekt(), befuellt(), 'komplett', 'alle', ZEIT);
    const th = j.einheiten.find((e) => e.einheit_id === 'ALLG')!.raeume[0];
    expect(Object.keys(th)).toEqual([
      'raum_id', 'nr', 'name', 'nutzung', 'flaeche_plan_m2', 'soll_temp_c', 'herkunft', 'zustand', 'erledigt', 'notiz',
      'im_plan_entfallen', 'heizflaechen', 'fenster', 'keine_heizflaeche', 'lichte_hoehe_m', 'beheizt_vor_ort', 'geaendert_am',
    ]);
    expect(th).toMatchObject({ keine_heizflaeche: false, lichte_hoehe_m: { wert: 2.55, status: 'geschätzt' }, beheizt_vor_ort: 'ja' });
    const eh13 = j.einheiten.find((e) => e.einheit_id === 'EH013')!;
    expect(eh13.raeume[0]).toMatchObject({ keine_heizflaeche: true, erledigt: true, lichte_hoehe_m: { wert: null, status: null }, beheizt_vor_ort: null });
    const f = eh13.raeume[2].fenster[0];
    expect(Object.keys(f)).toEqual([
      'fenster_id', 'anzahl', 'verglasung', 'rahmen', 'breite_mm', 'hoehe_mm', 'masse_status', 'fotos', 'art', 'erneuert', 'baujahr', 'geaendert_am',
    ]);
    expect(f).toMatchObject({ art: 'fenster', erneuert: 'nein', baujahr: 1975 });
    // heizlast_w steht nur in der Projektdatei, nicht im Export.
    expect(JSON.stringify(j)).not.toContain('heizlast_w');
  });

  it('ältere Aufnahmen ohne die neuen Felder exportieren leere Werte', () => {
    const l = aufnahmen();
    const a = l.find((x) => x.einheit_id === 'EH013')!;
    delete a.pruefpunkte;
    const r = a.raeume[0] as Partial<Raum>;
    delete r.keine_heizflaeche;
    delete r.lichte_hoehe_m;
    delete r.beheizt_vor_ort;
    a.raeume[0].fenster.push({ fenster_id: 'alt', anzahl: 1, verglasung: null, rahmen: null, breite_mm: null, hoehe_mm: null, masse_status: null, fotos: [], geaendert_am: null });
    const e = aufnahmeJson(projekt(), [a], 'komplett', 'EH013', ZEIT).einheiten[0];
    expect(e.pruefpunkte).toEqual([]);
    expect(e.raeume[0]).toMatchObject({ keine_heizflaeche: false, lichte_hoehe_m: { wert: null, status: null }, beheizt_vor_ort: null });
    expect(e.raeume[0].fenster[0]).toMatchObject({ art: null, erneuert: null, baujahr: null });
    const csv = csvDateien(projekt(), [a]);
    expect(csv['pruefpunkte.csv']).toBe('﻿einheit_id;pruefpunkt_id;ort;text;typ;antwort;wert;wert_einheit;status;notiz;erledigt;fotos;geaendert_am\r\n');
  });

  it('CSV: neue Spalten am Ende, bisherige Spalten unverändert, pruefpunkte.csv', () => {
    const c = csvDateien(projekt(), befuellt());
    const kopf = (n: string) => c[n].slice(1).split('\r\n')[0];
    expect(kopf('raeume.csv')).toBe(
      'einheit_id;raum_id;nr;name;nutzung;flaeche_plan_m2;soll_temp_c;herkunft;zustand;erledigt;anzahl_heizflaechen;anzahl_fenster;im_plan_entfallen;notiz;geaendert_am;' +
        'keine_heizflaeche;lichte_hoehe_m;lichte_hoehe_status;beheizt_vor_ort',
    );
    expect(kopf('fenster.csv')).toBe(
      'einheit_id;raum_id;raum_name;fenster_id;anzahl;verglasung;rahmen;breite_mm;hoehe_mm;masse_status;fotos;geaendert_am;art;erneuert;baujahr',
    );
    expect(c['raeume.csv']).toContain('ALLG;ALLG-R01;01;Treppenhaus 1;treppenhaus;;10;plan;vorhanden;nein;0;0;nein;;' + ZEIT + ';nein;2,55;geschätzt;ja\r\n');
    expect(c['raeume.csv']).toContain('EH013;EH013-R01;01;Diele;diele;7,9;20;plan;vorhanden;ja;0;0;nein;;;ja;;;\r\n');
    expect(c['fenster.csv']).toContain(';1200;1400;geschätzt;EH013_Whg213_R03-Wohnraum_Fenster_Glasstempel_01.jpg;' + ZEIT + ';fenster;nein;1975\r\n');
    const pp = c['pruefpunkte.csv'].slice(1).split('\r\n');
    expect(pp[1]).toBe(
      'ALLG;ALLG-P01;Treppenhaus 1;Lichte Raumhöhe im Treppenhaus messen;zahl;ja;2,55;m;gemessen;Treppenhaus 1 gemessen;ja;ALLG_P01_01.jpg;' + ZEIT,
    );
    expect(pp[2]).toBe('ALLG;ALLG-P02;Keller;Sind die Kellerräume beheizt? Heizkörper oder offene Leitungen?;text;;;;;;nein;;');
    expect(pp[3]).toMatch(/^EH013;EH013-P01;Wohnraum;/);
  });
});

describe('Neuere Projektdatei einspielen: Prüfpunkte und Heizlast', () => {
  it('Antworten bleiben über die id erhalten, neue kommen dazu, entfallene mit Antwort bleiben markiert', () => {
    const alt = befuellt();
    const roh = structuredClone(beispiel) as unknown as { einheiten: { id: string; pruefpunkte?: { id: string; text: string }[]; raeume: { id: string; heizlast_w?: number | null }[] }[] };
    const allgRoh = roh.einheiten.find((e) => e.id === 'ALLG')!;
    allgRoh.pruefpunkte![0].text = 'Lichte Raumhöhe messen (neu formuliert)';
    allgRoh.pruefpunkte!.splice(1, 1); // P02 ohne Antwort entfällt
    allgRoh.pruefpunkte!.push({ id: 'ALLG-P09', text: 'neu' } as never);
    allgRoh.raeume[0].heizlast_w = 850;
    const eh13Roh = roh.einheiten.find((e) => e.id === 'EH013')!;
    eh13Roh.pruefpunkte = []; // P01 entfällt
    const eh13Alt = alt.find((x) => x.einheit_id === 'EH013')!;
    eh13Alt.pruefpunkte![0].antwort = 'unklar';
    eh13Alt.pruefpunkte![0].geaendert_am = ZEIT;

    const erg = projektEinspielen(projektdateiLesen(roh), alt);
    expect(erg.neuePruefpunkte).toBe(1);
    const allg = erg.aufnahmen.find((x) => x.einheit_id === 'ALLG')!;
    expect(allg.pruefpunkte!.map((q) => q.id)).toEqual(['ALLG-P01', 'ALLG-P09']);
    expect(allg.pruefpunkte![0]).toMatchObject({ text: 'Lichte Raumhöhe messen (neu formuliert)', antwort: 'ja', wert: { wert: 2.55, status: 'gemessen' }, erledigt: true });
    expect(allg.raeume[0]).toMatchObject({ heizlast_w: 850, beheizt_vor_ort: 'ja', lichte_hoehe_m: { wert: 2.55, status: 'geschätzt' } });
    const eh13 = erg.aufnahmen.find((x) => x.einheit_id === 'EH013')!;
    expect(eh13.pruefpunkte).toEqual([expect.objectContaining({ id: 'EH013-P01', antwort: 'unklar', im_plan_entfallen: true })]);
    expect(eh13.raeume[0].keine_heizflaeche).toBe(true);
  });

  it('Aufnahmen aus 1.4 (ohne Prüfpunkte) bekommen die Prüfpunkte beim Einspielen', () => {
    const alt = aufnahmen();
    for (const a of alt) delete a.pruefpunkte;
    const erg = projektEinspielen(projekt(), alt);
    expect(erg.aufnahmen.find((x) => x.einheit_id === 'ALLG')!.pruefpunkte).toHaveLength(2);
    expect(erg.neuePruefpunkte).toBe(3);
  });
});

describe('Projekt aus 1.4 öffnen', () => {
  it('liest die gespeicherte Projektdatei einmal neu: Prüfpunkte und Heizlast da, Aufnahmen bleiben', async () => {
    const p = projekt();
    // So hat 1.4 gespeichert: ohne gelesen_mit, ohne pruefpunkte/heizlast_w in den gelesenen Daten.
    const alt14 = structuredClone(p);
    delete alt14.gelesen_mit;
    for (const e of alt14.einheiten) {
      delete e.pruefpunkte;
      for (const r of e.raeume) delete r.heizlast_w;
    }
    const aufn = alt14.einheiten.map((e) => neueAufnahme(alt14.projekt_id, e));
    for (const a of aufn) {
      delete a.pruefpunkte;
      for (const r of a.raeume) delete r.heizlast_w;
    }
    aufn.find((a) => a.einheit_id === 'EH013')!.notiz = 'bleibt';
    await DB.projektMitAufnahmenSpeichern(alt14, aufn);
    S.projekte = await DB.projekteLaden();
    await projektOeffnen('beispiel', false);
    expect(S.projekt!.gelesen_mit).toBe('1.5.0');
    expect(S.aufnahmen.get('ALLG')!.pruefpunkte).toHaveLength(2);
    expect(S.aufnahmen.get('EH013')!.raeume[2].heizlast_w).toBe(1209);
    expect(S.aufnahmen.get('EH013')!.notiz).toBe('bleibt');
    expect(S.projekt!.einheiten.find((e) => e.einheit_id === 'ALLG')!.pruefpunkte).toHaveLength(2);
  });
});
