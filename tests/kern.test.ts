import { describe, expect, it } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import beispiel from '../data/beispiel.objekt.json';
import { neueAufnahme, projektdateiLesen, projektEinspielen } from '../src/projekt';
import { csv, csvDateien, hatUnexportierteAenderungen, zipErstellen, aufnahmeJson } from '../src/export';
import { fotoPraefix, naechsterDateiname } from '../src/fotos';
import type { EinheitAufnahme, FotoMeta } from '../src/model';
import { kurz } from '../src/util';

const projekt = () => projektdateiLesen(structuredClone(beispiel));
const aufnahmen = () => {
  const p = projekt();
  return p.einheiten.map((e) => neueAufnahme(p.projekt_id, e));
};

describe('Projektdatei', () => {
  it('liest das Beispiel', () => {
    const p = projekt();
    expect(p.projekt_id).toBe('beispiel');
    expect(p.einheiten.find((e) => e.einheit_id === 'EH013')!.raeume).toHaveLength(6);
    expect(p.einheiten.find((e) => e.einheit_id === 'HZ')!.art).toBe('heizzentrale');
    expect(p.einheiten.find((e) => e.einheit_id === 'EH013')!.ersatz[0]).toEqual({ eh: 14, bezeichnung: 'Whg. 214', geschoss: '2. OG' });
    expect(p.warnungen).toEqual([]);
  });

  it('meldet fehlende Einheiten verständlich', () => {
    expect(() => projektdateiLesen({ projekt_id: 'x', einheiten: [] })).toThrow(/keine Einheiten/);
    expect(() => projektdateiLesen({ einheiten: [] })).toThrow(/projekt\.id/);
  });

  it('versteht Termin als ISO-Zeit und deutsches Datum', () => {
    const p = projektdateiLesen({
      projekt_id: 'x',
      einheiten: [
        { einheit_id: 'A', termin: '2026-12-05T09:15:00+01:00' },
        { einheit_id: 'B', datum: '4.12.2026', uhrzeit: '8:30' },
      ],
    });
    expect(p.einheiten[0]).toMatchObject({ datum: '2026-12-05', uhrzeit: '09:15' });
    expect(p.einheiten[1]).toMatchObject({ datum: '2026-12-04', uhrzeit: '08:30' });
  });

  it('Heizzentrale bekommt Checkliste, Gewerbe die Zusatzfelder', () => {
    const a = aufnahmen();
    expect(a.find((x) => x.einheit_id === 'HZ')!.heizzentrale!.punkte.length).toBeGreaterThan(5);
    expect(a.find((x) => x.einheit_id === 'EH001')!.gewerbe).not.toBeNull();
  });
});

describe('Neuere Projektdatei einspielen', () => {
  it('behält Aufnahmen, ergänzt neue Räume, markiert entfallene', () => {
    const alt = aufnahmen();
    const eh13 = alt.find((a) => a.einheit_id === 'EH013')!;
    const wohnraum = eh13.raeume.find((r) => r.raum_id === 'EH013-R03')!;
    wohnraum.heizflaechen.push({ hf_id: 'h1' } as never);
    wohnraum.nutzung = 'buero'; // vor Ort geändert
    eh13.raeume.find((r) => r.raum_id === 'EH013-R06')!.erledigt = true;
    eh13.raeume.push({ ...wohnraum, raum_id: 'EH013-V01', nr: 'V01', herkunft: 'vor_ort_angelegt', heizflaechen: [] });
    eh13.geaendert_am = '2026-12-05T10:00:00+01:00';

    const neuRoh = structuredClone(beispiel) as unknown as { einheiten: { id: string; raeume: Record<string, unknown>[] }[] };
    const e13 = neuRoh.einheiten.find((e) => e.id === 'EH013')!;
    e13.raeume = e13.raeume.filter((r) => r.id !== 'EH013-R06' && r.id !== 'EH013-R05');
    e13.raeume.push({ id: 'EH013-R07', nr: '07', name: 'WC', nutzung: 'wc', flaeche_plan_m2: 1.9, soll_temp_c: 20, quelle: 'Beispielplan' });
    e13.raeume[2].flaeche_plan_m2 = 30.0;
    neuRoh.einheiten.push({ id: 'EH099', eh: 99, bezeichnung: 'Neu', art: 'Wohnung', geschoss: null, termin: '2026-12-05T16:00', raeume: [] } as never);

    const erg = projektEinspielen(projektdateiLesen(neuRoh), alt);
    const n13 = erg.aufnahmen.find((a) => a.einheit_id === 'EH013')!;
    const ids = n13.raeume.map((r) => r.raum_id);
    expect(ids).toContain('EH013-R07'); // neu
    expect(ids).toContain('EH013-R06'); // entfallen, aber erledigt → behalten
    expect(ids).not.toContain('EH013-R05'); // entfallen ohne Aufnahmen → entfernt
    expect(ids).toContain('EH013-V01'); // vor Ort angelegt
    expect(n13.raeume.find((r) => r.raum_id === 'EH013-R06')!.im_plan_entfallen).toBe(true);
    const wr = n13.raeume.find((r) => r.raum_id === 'EH013-R03')!;
    expect(wr.heizflaechen).toHaveLength(1);
    expect(wr.nutzung).toBe('buero');
    expect(wr.flaeche_plan_m2).toBe(30);
    expect(erg.neueEinheiten).toBe(1);
    expect(erg.neueRaeume).toBe(1);
  });
});

describe('Dateinamen', () => {
  it('entspricht dem Muster aus der Übergabe', () => {
    const a = aufnahmen().find((x) => x.einheit_id === 'EH013')!;
    a.einheit_id = 'EH010';
    a.aufgenommen_bezeichnung = 'Whg. 212';
    const p = fotoPraefix(a, { art: 'hf', raumNr: '03', raumName: 'Wohnraum', hfNr: 1, rolle: 'Ventil' });
    expect(naechsterDateiname(a, p)).toBe('EH010_Whg212_R03-Wohnraum_HK1_Ventil_01.jpg');
    expect(naechsterDateiname(a, p)).toBe('EH010_Whg212_R03-Wohnraum_HK1_Ventil_02.jpg');
    expect(naechsterDateiname(a, fotoPraefix(a, { art: 'hz_abgang', nr: 2, rolle: 'Pumpe' }))).toBe('HZ_Abgang2_Pumpe_01.jpg');
  });
  it('behält Umlaute, entfernt Sonderzeichen', () => {
    expect(kurz('Küche/Eßplatz (groß)')).toBe('KücheEßplatzgroß');
  });
});

describe('CSV', () => {
  it('BOM, Semikolon, Dezimalkomma, Anführungszeichen', () => {
    const s = csv(['a', 'b', 'c'], [[1.5, 'x;y', true], [null, 'Sag "hallo"', false]]);
    expect(s.startsWith('﻿a;b;c\r\n')).toBe(true);
    expect(s).toContain('1,5;"x;y";ja');
    expect(s).toContain(';"Sag ""hallo""";nein');
  });

  it('geschätzt bleibt je Wert erhalten', () => {
    const p = projekt();
    const a = aufnahmen().find((x) => x.einheit_id === 'EH013')!;
    a.raeume[2].heizflaechen.push({
      hf_id: 'h1', nr: 1, art: 'platte', typ: '22',
      bauhoehe_mm: { wert: 600, status: 'gemessen' }, baulaenge_mm: { wert: 1200, status: 'geschätzt' },
      bautiefe_mm: { wert: null, status: null }, gliederzahl: 7, anschluss: 'unten_mittig_vk',
      ventil: { hersteller_text: 'Heimeier', voreinstellung_ablesbar: true, voreinstellung_wert: '4', thermostatkopf: true },
      lage: 'unter_fenster', nische_mm: { breite: null, hoehe: null, status: 'gemessen' }, notiz: '', fotos: [], geaendert_am: null,
    });
    const c = csvDateien(p, [a])['heizflaechen.csv'];
    expect(c).toContain(';600;gemessen;1200;geschätzt;;;');
    const j = aufnahmeJson(p, [a], 'komplett', 'x', '2026-12-05T16:10:00+01:00');
    const hf = j.einheiten[0].raeume[2].heizflaechen[0];
    expect(hf.baulaenge_mm).toEqual({ wert: 1200, status: 'geschätzt' });
    expect(hf.gliederzahl).toBeNull(); // nur bei Glieder/Röhren
    expect(hf.nische_mm.status).toBeNull(); // ohne Maß kein Status
  });
});

describe('Delta', () => {
  it('erkennt nicht exportierte Änderungen', () => {
    const a = { geaendert_am: null, letzter_export: null } as EinheitAufnahme;
    expect(hatUnexportierteAenderungen(a)).toBe(false);
    a.geaendert_am = '2026-12-05T10:00:00+01:00';
    expect(hatUnexportierteAenderungen(a)).toBe(true);
    a.letzter_export = '2026-12-05T10:05:00+01:00';
    expect(hatUnexportierteAenderungen(a)).toBe(false);
  });
});

describe('ZIP', () => {
  it('enthält JSON, CSVs und Fotos mit UTF-8-Namen', async () => {
    const p = projekt();
    const a = aufnahmen();
    const foto: FotoMeta = {
      foto_id: 'f1', projekt_id: 'beispiel', einheit_id: 'EH013', dateiname: 'EH013_Whg213_R02-Küche_HK1_Front_01.jpg',
      rolle: 'Front', bezug_id: 'h1', groesse: 3, breite: 1, hoehe: 1, erstellt_am: '2026-12-05T10:00:00+01:00', exportiert_am: null,
    };
    const erg = await zipErstellen({
      projekt: p, aufnahmen: a, fotos: [foto], art: 'komplett', umfang: 'alle', umfangKurz: 'alle',
      fotoLaden: async () => new Blob([new Uint8Array([0xff, 0xd8, 0xff])]),
    });
    expect(erg.dateiname).toMatch(/^Aufnahme_beispiel_\d{4}-\d{2}-\d{2}_\d{4}_komplett_alle\.zip$/);
    const roh = new Uint8Array(await erg.datei.arrayBuffer());
    const z = unzipSync(roh);
    expect(Object.keys(z).sort()).toEqual([
      'aufnahme.json', 'einheiten.csv', 'fenster.csv', 'fotos/EH013/EH013_Whg213_R02-Küche_HK1_Front_01.jpg',
      'heizflaechen.csv', 'heizzentrale.csv', 'raeume.csv',
    ]);
    const j = JSON.parse(strFromU8(z['aufnahme.json']));
    expect(j.schema_version).toBe(1);
    expect(j.einheiten).toHaveLength(p.einheiten.length);
    // UTF-8-Flag (Bit 11) im lokalen Header des Fotos gesetzt
    const name = new TextEncoder().encode('fotos/EH013/EH013_Whg213_R02-Küche');
    let i = 0;
    outer: for (; i < roh.length; i++) {
      for (let k = 0; k < name.length; k++) if (roh[i + k] !== name[k]) continue outer;
      break;
    }
    const kopf = i - 30;
    expect(roh[kopf] === 0x50 && roh[kopf + 1] === 0x4b).toBe(true);
    const flags = roh[kopf + 6] | (roh[kopf + 7] << 8);
    expect(flags & 0x800).toBe(0x800);
  });
});
