// Last-Test (Abnahme Punkt 6): Testprojekt mit 300 Testfotos erzeugen.
import { projektdateiLesen } from './projekt';
import { aendern, fotoAufnehmen, projektImportieren, S } from './store';
import { fotoPraefix } from './fotos';
import { heizflaecheAnlegenOhneNavigation } from './ui/raum';

export const LASTTEST_ID = 'lasttest';

function testbild(text: string, farbe: number): Promise<File> {
  const c = document.createElement('canvas');
  c.width = 4032;
  c.height = 3024;
  const g = c.getContext('2d')!;
  g.fillStyle = `hsl(${farbe % 360} 50% 40%)`;
  g.fillRect(0, 0, c.width, c.height);
  // Rauschen, damit die JPEG-Größe realistisch ist
  for (let i = 0; i < 400; i++) {
    g.fillStyle = `hsl(${(farbe + i) % 360} 60% ${30 + (i % 50)}%)`;
    g.fillRect(Math.random() * c.width, Math.random() * c.height, 40 + Math.random() * 400, 40 + Math.random() * 400);
  }
  g.fillStyle = '#fff';
  g.font = 'bold 220px sans-serif';
  g.fillText(text, 200, 1600);
  return new Promise((res, rej) =>
    c.toBlob(
      (b) => {
        c.width = 0;
        c.height = 0;
        if (b) res(new File([b], `${text}.jpg`, { type: 'image/jpeg' }));
        else rej(new Error('Testbild fehlgeschlagen'));
      },
      'image/jpeg',
      0.9,
    ),
  );
}

export async function lasttestErzeugen(anzahl: number, fortschritt: (n: number) => void): Promise<void> {
  const einheiten = [];
  for (let e = 1; e <= 10; e++) {
    einheiten.push({
      id: `T${String(e).padStart(3, '0')}`,
      eh: e,
      bezeichnung: `Test ${e}`,
      art: 'Wohnung',
      termin: `${e <= 5 ? '2026-12-04' : '2026-12-05'}T${String(8 + e).padStart(2, '0')}:00`,
      raeume: [1, 2, 3].map((r) => ({
        id: `T${String(e).padStart(3, '0')}-R0${r}`,
        nr: `0${r}`,
        name: `Raum ${r}`,
        nutzung: 'wohnen',
        flaeche_plan_m2: 15 + r,
        soll_temp_c: 20,
      })),
    });
  }
  const p = projektdateiLesen({
    schema_version: 1,
    projekt: { id: LASTTEST_ID, name: 'Last-Test (300 Fotos)' },
    nutzungsarten: [{ key: 'wohnen', name: 'Wohnen', soll_temp_c: 20 }],
    einheiten,
  });
  await projektImportieren(p, false);
  let n = 0;
  const proHf = 2;
  outer: for (const pe of p.einheiten) {
    for (const pr of pe.raeume) {
      for (let h = 0; h < 5; h++) {
        const hf = heizflaecheAnlegenOhneNavigation(pe.einheit_id, pr.raum_id);
        aendern(pe.einheit_id, (a) => {
          const x = a.raeume.find((r) => r.raum_id === pr.raum_id)!.heizflaechen.find((q) => q.hf_id === hf.hf_id)!;
          x.art = 'platte';
          x.typ = '22';
          x.bauhoehe_mm = { wert: 600, status: 'gemessen' };
          x.baulaenge_mm = { wert: 1000 + h * 200, status: h % 2 ? 'geschätzt' : 'gemessen' };
        });
        for (let k = 0; k < proHf; k++) {
          if (n >= anzahl) break outer;
          const rolle = k === 0 ? 'Front' : 'Ventil';
          const a = S.aufnahmen.get(pe.einheit_id)!;
          const datei = await testbild(`${pe.einheit_id} R${pr.nr} HK${hf.nr} ${rolle}`, n * 7);
          await fotoAufnehmen(datei, {
            eid: pe.einheit_id,
            praefix: fotoPraefix(a, { art: 'hf', raumNr: pr.nr, raumName: pr.name, hfNr: hf.nr, rolle }),
            rolle,
            bezug_id: hf.hf_id,
            eintragen: (au, name, jetzt) => {
              const x = au.raeume.find((r) => r.raum_id === pr.raum_id)!.heizflaechen.find((q) => q.hf_id === hf.hf_id)!;
              x.fotos.push(name);
              x.geaendert_am = jetzt;
            },
          });
          n++;
          fortschritt(n);
        }
      }
    }
  }
}
