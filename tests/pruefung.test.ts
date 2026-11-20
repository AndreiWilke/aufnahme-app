import { describe, expect, it } from 'vitest';
import type { EinheitAufnahme, Heizflaeche, MessStatus, Raum } from '../src/model';
import { bautiefeHinweis, exportMaengel, hfMangel, raumMaengel, ventilFotoFehlt } from '../src/pruefung';

const mw = (wert: number | null, status: MessStatus | null = wert === null ? null : 'gemessen') => ({ wert, status });

function hf(nr: number, teil: Partial<Heizflaeche> = {}): Heizflaeche {
  return {
    hf_id: `h${nr}`,
    nr,
    art: null,
    typ: null,
    bauhoehe_mm: mw(null),
    baulaenge_mm: mw(null),
    bautiefe_mm: mw(null),
    gliederzahl: null,
    anschluss: null,
    ventil: { hersteller_text: '', voreinstellung_ablesbar: null, voreinstellung_wert: '', thermostatkopf: null },
    lage: null,
    nische_mm: { breite: null, hoehe: null, status: null },
    notiz: '',
    fotos: [],
    geaendert_am: null,
    ...teil,
  };
}

function raum(heizflaechen: Heizflaeche[], erledigt = false): Raum {
  return {
    raum_id: 'R01',
    nr: '01',
    name: 'Wohnen',
    nutzung: 'wohnen',
    flaeche_plan_m2: null,
    soll_temp_c: null,
    herkunft: 'plan',
    zustand: 'vorhanden',
    erledigt,
    notiz: '',
    heizflaechen,
    fenster: [],
    geaendert_am: null,
  };
}

const vollstaendig = () =>
  hf(1, { art: 'platte', typ: '22', bauhoehe_mm: mw(600), baulaenge_mm: mw(1200), bautiefe_mm: mw(100), fotos: ['a_Front_01.jpg'] });

describe('Heizfläche unvollständig', () => {
  it('neu angelegte Heizfläche ist leer', () => {
    expect(hfMangel(hf(1))).toBe('leer');
  });

  it('nur Art und Typ, aber keine Maße und keine Fotos gilt als leer', () => {
    expect(hfMangel(hf(1, { art: 'platte', typ: '22' }))).toBe('leer');
  });

  it('Maße und Ventil, aber ohne Art und Foto: Art fehlt', () => {
    const h = hf(4, {
      bauhoehe_mm: mw(600),
      baulaenge_mm: mw(1000, 'geschätzt'),
      ventil: { hersteller_text: 'Heimeier', voreinstellung_ablesbar: true, voreinstellung_wert: '4', thermostatkopf: true },
    });
    expect(hfMangel(h)).toBe('ohne_art');
  });

  it('nur ein Foto ohne Art: Art fehlt', () => {
    expect(hfMangel(hf(1, { fotos: ['x.jpg'] }))).toBe('ohne_art');
  });

  it('vollständige Heizfläche hat keinen Mangel', () => {
    expect(hfMangel(vollstaendig())).toBeNull();
  });

  it('Fußbodenheizung ohne Maße ist nicht leer', () => {
    expect(hfMangel(hf(1, { art: 'fussbodenheizung' }))).toBeNull();
  });

  it('raumMaengel listet nur mangelhafte Heizflächen nach Nummer', () => {
    const r = raum([hf(3), vollstaendig(), hf(2, { bauhoehe_mm: mw(500) })]);
    expect(raumMaengel(r).map((m) => m.text)).toEqual(['HK2: Art fehlt', 'HK3: leer (keine Maße, keine Fotos)']);
    expect(raumMaengel(raum([vollstaendig()]))).toEqual([]);
  });

  it('exportMaengel fasst Räume aller Einheiten zusammen', () => {
    const a = {
      einheit_id: 'EH010',
      raeume: [raum([hf(1)], true), { ...raum([vollstaendig()]), raum_id: 'R02' }],
    } as unknown as EinheitAufnahme;
    const l = exportMaengel([a]);
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ einheit_id: 'EH010', raum_id: 'R01', raum: '01 Wohnen', erledigt: true });
    expect(l[0].maengel).toHaveLength(1);
  });

  it('prüft nur und verändert die Heizfläche nicht', () => {
    const h = hf(4, { bauhoehe_mm: mw(600, 'geschätzt') });
    const vorher = structuredClone(h);
    hfMangel(h);
    bautiefeHinweis(h);
    ventilFotoFehlt(h, ['Front']);
    expect(h).toEqual(vorher);
  });
});

describe('Ventilfoto', () => {
  it('Hinweis bei Fotos ohne Rolle Ventil', () => {
    expect(ventilFotoFehlt(vollstaendig(), ['Front', 'Seite'])).toBe(true);
  });
  it('kein Hinweis mit Ventilfoto oder ganz ohne Fotos', () => {
    expect(ventilFotoFehlt(vollstaendig(), ['Front', 'Ventil'])).toBe(false);
    expect(ventilFotoFehlt(hf(1), [])).toBe(false);
  });
  it('kein Hinweis bei Fußbodenheizung', () => {
    expect(ventilFotoFehlt(hf(1, { art: 'fussbodenheizung' }), ['Front'])).toBe(false);
  });
});

describe('Bautiefe zum Typ', () => {
  const platte = (typ: Heizflaeche['typ'], tiefe: number | null) => hf(1, { art: 'platte', typ, bautiefe_mm: mw(tiefe) });

  it('Typ 22 mit 50 mm ist auffällig', () => {
    expect(bautiefeHinweis(platte('22', 50))).toBe(
      'Bautiefe 50 mm ist für Typ 22 ungewöhnlich (üblich etwa 95–105 mm). Bitte Typ und Tiefe prüfen.',
    );
  });

  it('Typ 21 mit 50 mm ist auffällig', () => {
    expect(bautiefeHinweis(platte('21', 50))).toMatch(/Typ 21.*60–80 mm/);
  });

  it('passende Tiefen und Grenzwerte ergeben keinen Hinweis', () => {
    for (const [typ, tiefe] of [
      ['10', 40],
      ['11', 65],
      ['20', 60],
      ['21', 80],
      ['22', 100],
      ['33', 155],
    ] as const)
      expect(bautiefeHinweis(platte(typ, tiefe))).toBeNull();
  });

  it('Typ 33 mit 100 mm und Typ 11 mit 100 mm sind auffällig', () => {
    expect(bautiefeHinweis(platte('33', 100))).not.toBeNull();
    expect(bautiefeHinweis(platte('11', 100))).not.toBeNull();
  });

  it('kein Hinweis ohne Tiefe, ohne Typ, bei Typ unbekannt oder anderer Art', () => {
    expect(bautiefeHinweis(platte('22', null))).toBeNull();
    expect(bautiefeHinweis(platte(null, 50))).toBeNull();
    expect(bautiefeHinweis(platte('unbekannt', 50))).toBeNull();
    expect(bautiefeHinweis(hf(1, { art: 'glieder', typ: '22', bautiefe_mm: mw(50) }))).toBeNull();
  });

  it('geschätzte Tiefe wird ebenso geprüft', () => {
    expect(bautiefeHinweis(hf(1, { art: 'platte', typ: '22', bautiefe_mm: mw(50, 'geschätzt') }))).not.toBeNull();
  });
});
