import { useEffect } from 'preact/hooks';
import type { EinheitAufnahme, Fenster, Heizflaeche, Raum, RaumZustand } from '../model';
import { ART_TEXT, RAHMEN_TEXT, VERGLASUNG_TEXT, ZUSTAND_TEXT } from '../model';
import { aendern, fotosVon, gehe, planEinheit, S } from '../store';
import { PlanKnopf } from './plan';
import { fotoPraefix } from '../fotos';
import { isoJetzt, leerMesswert, uuid } from '../util';
import { Feld, FotoLeiste, Hinweis, Kopf, StatusSchalter, Tasten, TextFeld, Thumb, ZahlFeld, fotoZeigen } from './common';
import { flaecheText, nutzungText, sollTempFuer, sollText } from './einheit';

export function neueHeizflaeche(r: Raum, jetzt: string, vorlage?: Heizflaeche): Heizflaeche {
  const nr = r.heizflaechen.reduce((m, h) => Math.max(m, h.nr), 0) + 1;
  if (vorlage) {
    const k: Heizflaeche = structuredClone(vorlage);
    k.hf_id = uuid();
    k.nr = nr;
    k.fotos = [];
    k.geaendert_am = jetzt;
    return k;
  }
  return {
    hf_id: uuid(),
    nr,
    art: null,
    typ: null,
    bauhoehe_mm: leerMesswert(),
    baulaenge_mm: leerMesswert(),
    bautiefe_mm: leerMesswert(),
    gliederzahl: null,
    anschluss: null,
    ventil: { hersteller_text: '', voreinstellung_ablesbar: null, voreinstellung_wert: '', thermostatkopf: null },
    lage: null,
    nische_mm: { breite: null, hoehe: null, status: null },
    notiz: '',
    fotos: [],
    geaendert_am: jetzt,
  };
}

export function heizflaecheAnlegenOhneNavigation(eid: string, rid: string, vorlage?: Heizflaeche): Heizflaeche {
  let h!: Heizflaeche;
  aendern(eid, (a, jetzt) => {
    const r = a.raeume.find((x) => x.raum_id === rid)!;
    h = neueHeizflaeche(r, jetzt, vorlage);
    r.heizflaechen.push(h);
    r.erledigt = false;
    r.geaendert_am = jetzt;
  });
  return h;
}

/** Legt eine Heizfläche an und öffnet sie. */
export function heizflaecheAnlegen(eid: string, rid: string, vorlage?: Heizflaeche) {
  const h = heizflaecheAnlegenOhneNavigation(eid, rid, vorlage);
  gehe({ name: 'hf', eid, rid, hfid: h.hf_id });
}

/** Nächster offener, vorhandener Raum nach dem aktuellen (in Listenreihenfolge, dann von vorn). */
export function naechsterRaum(a: EinheitAufnahme, rid: string): Raum | null {
  const l = a.raeume;
  const i = l.findIndex((r) => r.raum_id === rid);
  for (let k = 1; k <= l.length; k++) {
    const r = l[(i + k) % l.length];
    if (r.raum_id !== rid && r.zustand === 'vorhanden' && !r.erledigt) return r;
  }
  return null;
}

function leeresFenster(jetzt: string): Fenster {
  return { fenster_id: uuid(), anzahl: 1, verglasung: null, rahmen: null, breite_mm: null, hoehe_mm: null, masse_status: null, fotos: [], geaendert_am: jetzt };
}

let zuFenstern = false;

/** Von der Heizfläche weiter zu den Fenstern des Raums. Legt das erste Fenster gleich an. */
export function fensterAufnehmen(eid: string, rid: string) {
  const r = S.aufnahmen.get(eid)!.raeume.find((x) => x.raum_id === rid)!;
  if (r.fenster.length === 0)
    aendern(eid, (a, jetzt) => {
      const x = a.raeume.find((q) => q.raum_id === rid)!;
      x.fenster.push(leeresFenster(jetzt));
      x.geaendert_am = jetzt;
    });
  zuFenstern = true;
  gehe({ name: 'raum', eid, rid });
}

export function raumFertig(eid: string, rid: string) {
  aendern(eid, (a, jetzt) => {
    const r = a.raeume.find((x) => x.raum_id === rid)!;
    r.erledigt = true;
    r.geaendert_am = jetzt;
  });
  const a = S.aufnahmen.get(eid)!;
  const n = naechsterRaum(a, rid);
  if (n) gehe({ name: 'raum', eid, rid: n.raum_id });
  else {
    alert('Alle Räume dieser Einheit sind erledigt.');
    gehe({ name: 'einheit', eid });
  }
}

export function hfKurztext(h: Heizflaeche): string {
  const teile: string[] = [];
  teile.push(h.art ? ART_TEXT[h.art] : 'Heizfläche');
  if (h.art === 'platte' && h.typ) teile.push(`Typ ${h.typ}`);
  const m = (w: { wert: number | null; status: string | null }) =>
    w.wert === null ? '?' : `${w.wert}${w.status === 'geschätzt' ? '~' : ''}`;
  if (h.art !== 'fussbodenheizung') teile.push(`${m(h.bauhoehe_mm)} × ${m(h.baulaenge_mm)} mm`);
  if ((h.art === 'glieder' || h.art === 'roehren') && h.gliederzahl) teile.push(`${h.gliederzahl} Gl.`);
  return teile.join(' · ');
}

function FensterBlock(props: { a: EinheitAufnahme; r: Raum; f: Fenster; index: number }) {
  const { a, r, f } = props;
  const set = (fn: (x: Fenster) => void) =>
    aendern(a.einheit_id, (au, jetzt) => {
      const x = au.raeume.find((q) => q.raum_id === r.raum_id)!.fenster.find((q) => q.fenster_id === f.fenster_id)!;
      fn(x);
      x.geaendert_am = jetzt;
    });
  const masse = f.breite_mm !== null || f.hoehe_mm !== null;
  return (
    <div class="block fenster">
      <div class="block-kopf">
        <h3>Fenster {props.index + 1}</h3>
        <button
          class="knopf klein gefahr"
          onClick={() => {
            if (!confirm('Diese Fensterangabe löschen?')) return;
            aendern(a.einheit_id, (au, jetzt) => {
              const rr = au.raeume.find((q) => q.raum_id === r.raum_id)!;
              rr.fenster = rr.fenster.filter((q) => q.fenster_id !== f.fenster_id);
              rr.geaendert_am = jetzt;
            });
          }}
        >
          Entfernen
        </button>
      </div>
      <Feld titel="Anzahl">
        <div class="reihe">
          <Tasten werte={[1, 2, 3, 4]} wert={f.anzahl} onWahl={(w) => set((x) => (x.anzahl = w))} />
          <ZahlFeld wert={f.anzahl} ganzzahl onAendern={(n) => set((x) => (x.anzahl = n))} />
        </div>
      </Feld>
      <Feld titel="Verglasung">
        <Tasten werte={Object.keys(VERGLASUNG_TEXT) as (keyof typeof VERGLASUNG_TEXT)[]} wert={f.verglasung} text={(w) => VERGLASUNG_TEXT[w]} onWahl={(w) => set((x) => (x.verglasung = w))} />
      </Feld>
      <Feld titel="Rahmen">
        <Tasten werte={Object.keys(RAHMEN_TEXT) as (keyof typeof RAHMEN_TEXT)[]} wert={f.rahmen} text={(w) => RAHMEN_TEXT[w]} onWahl={(w) => set((x) => (x.rahmen = w))} />
      </Feld>
      <Feld titel="Breite × Höhe">
        <div class="reihe">
          <ZahlFeld wert={f.breite_mm} ganzzahl einheit="mm" platzhalter="Breite" onAendern={(n) => set((x) => { x.breite_mm = n; if (!x.masse_status) x.masse_status = 'gemessen'; if (x.breite_mm === null && x.hoehe_mm === null) x.masse_status = null; })} />
          <span class="mal">×</span>
          <ZahlFeld wert={f.hoehe_mm} ganzzahl einheit="mm" platzhalter="Höhe" onAendern={(n) => set((x) => { x.hoehe_mm = n; if (!x.masse_status) x.masse_status = 'gemessen'; if (x.breite_mm === null && x.hoehe_mm === null) x.masse_status = null; })} />
        </div>
        <StatusSchalter status={f.masse_status} aktiv={masse} onWahl={(s) => set((x) => (x.masse_status = s))} />
      </Feld>
      <FotoLeiste
        titel="Foto Fenster"
        fotos={fotosVon(a.einheit_id, f.fenster_id)}
        ziel={{
          eid: a.einheit_id,
          praefix: fotoPraefix(a, { art: 'fenster', raumNr: r.nr, raumName: r.name }),
          rolle: 'Fenster',
          bezug_id: f.fenster_id,
          eintragen: (au, name, jetzt) => {
            const x = au.raeume.find((q) => q.raum_id === r.raum_id)!.fenster.find((q) => q.fenster_id === f.fenster_id)!;
            x.fotos.push(name);
            x.geaendert_am = jetzt;
          },
        }}
      />
    </div>
  );
}

const ZUSTAENDE: RaumZustand[] = ['vorhanden', 'nicht_vorhanden', 'zusammengelegt'];

export function RaumSeite(props: { eid: string; rid: string }) {
  const a = S.aufnahmen.get(props.eid)!;
  const r = a.raeume.find((x) => x.raum_id === props.rid)!;
  const pe = planEinheit(props.eid);
  const setRaum = (fn: (x: Raum) => void) =>
    aendern(a.einheit_id, (au, jetzt) => {
      const x = au.raeume.find((q) => q.raum_id === r.raum_id)!;
      fn(x);
      x.geaendert_am = jetzt;
    });
  const nutzungen = S.projekt?.nutzungsarten ?? [];
  useEffect(() => {
    if (!zuFenstern) return;
    zuFenstern = false;
    requestAnimationFrame(() => document.getElementById('fenster')?.scrollIntoView({ block: 'start' }));
  }, [props.rid]);

  return (
    <div>
      <Kopf
        titel={`${r.nr} ${r.name}`}
        unter={`${pe?.bezeichnung ?? a.einheit_id}${a.aufgenommen_bezeichnung !== pe?.bezeichnung ? ' → ' + a.aufgenommen_bezeichnung : ''} · ${nutzungText(r.nutzung)} · ${sollText(r.soll_temp_c)}`}
        zurueck={() => gehe({ name: 'einheit', eid: a.einheit_id })}
        rechts={<PlanKnopf eid={a.einheit_id} />}
      />
      <main class="inhalt">
        <div class="raum-plan">
          {flaecheText(r.flaeche_plan_m2)} · {sollText(r.soll_temp_c)}
          {r.quelle && <div class="raum-quelle">{r.quelle}</div>}
        </div>
        {r.im_plan_entfallen && <Hinweis art="warn">Dieser Raum ist in der aktuellen Projektdatei nicht mehr enthalten. Die Aufnahmen bleiben erhalten.</Hinweis>}
        {r.zustand !== 'vorhanden' && <Hinweis art="warn">Raum ist als „{ZUSTAND_TEXT[r.zustand]}“ markiert.</Hinweis>}

        <h2>Heizflächen</h2>
        <div class="liste">
          {r.heizflaechen.map((h) => {
            const fotos = fotosVon(a.einheit_id, h.hf_id);
            return (
              <div key={h.hf_id} class="karte hf">
                <button class="karte-klick" onClick={() => gehe({ name: 'hf', eid: a.einheit_id, rid: r.raum_id, hfid: h.hf_id })}>
                  <div class="karte-titel">
                    HK{h.nr} · {hfKurztext(h)}
                  </div>
                </button>
                {fotos.length > 0 && (
                  <div class="fotoreihe">
                    {fotos.map((f) => (
                      <Thumb key={f.foto_id} foto={f} onClick={() => fotoZeigen(f)} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <button class="knopf gross primaer" onClick={() => heizflaecheAnlegen(a.einheit_id, r.raum_id)}>
          + Heizfläche
        </button>

        <h2 id="fenster">Fenster</h2>
        {r.fenster.map((f, i) => (
          <FensterBlock key={f.fenster_id} a={a} r={r} f={f} index={i} />
        ))}
        <button
          class="knopf gross"
          onClick={() =>
            setRaum((x) =>
              x.fenster.push(leeresFenster(isoJetzt())),
            )
          }
        >
          + Fenster
        </button>

        <div class="block">
          <h3>Raum</h3>
          <Feld titel="Nutzung" hinweis={r.nutzung_plan && r.nutzung !== r.nutzung_plan ? `laut Plan: ${nutzungText(r.nutzung_plan)}` : undefined}>
            <Tasten
              werte={nutzungen.map((n) => n.schluessel)}
              wert={r.nutzung}
              text={nutzungText}
              abwaehlbar={false}
              onWahl={(w) =>
                w &&
                setRaum((x) => {
                  x.nutzung = w;
                  // Auch null übernehmen (z. B. Technik ohne Solltemperatur), sonst bliebe der alte Wert stehen.
                  x.soll_temp_c = sollTempFuer(w);
                })
              }
            />
          </Feld>
          <Feld titel="Zustand">
            <Tasten werte={ZUSTAENDE} wert={r.zustand} text={(z) => ZUSTAND_TEXT[z]} abwaehlbar={false} onWahl={(z) => z && setRaum((x) => (x.zustand = z))} />
          </Feld>
          <Feld titel="Notiz zum Raum" hinweis={r.zustand === 'zusammengelegt' ? 'Bitte notieren, mit welchem Raum zusammengelegt.' : undefined}>
            <TextFeld mehrzeilig wert={r.notiz} onAendern={(s) => setRaum((x) => (x.notiz = s))} />
          </Feld>
        </div>

        <div class="knopfreihe">
          {r.erledigt ? (
            <button class="knopf" onClick={() => setRaum((x) => (x.erledigt = false))}>
              ✓ erledigt – wieder öffnen
            </button>
          ) : null}
          <button class="knopf gross primaer" onClick={() => raumFertig(a.einheit_id, r.raum_id)}>
            Raum fertig → nächster Raum
          </button>
        </div>
      </main>
    </div>
  );
}
