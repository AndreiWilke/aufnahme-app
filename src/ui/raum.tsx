import { useEffect, useState } from 'preact/hooks';
import type {
  Bestaetigung,
  EinheitAufnahme,
  Fenster,
  FensterPlanBestaetigung,
  Heizflaeche,
  PlanFenster,
  PlanRaum,
  Raum,
  RaumAnnahmeSchluessel,
  RaumZustand,
} from '../model';
import {
  ANTWORTEN,
  ART_TEXT,
  BESTAETIGUNG_TEXT,
  BALKONTUER_STANDARD,
  FENSTER_ART_TEXT,
  FENSTER_BREITEN,
  FENSTER_HOEHEN,
  FENSTER_STANDARD,
  LICHTE_HOEHEN,
  RAHMEN_TEXT,
  VERGLASUNG_TEXT,
  ZUSTAND_TEXT,
} from '../model';
import { aendern, fotosEntfernen, fotosVon, gehe, planEinheit, S } from '../store';
import {
  fensterDatensatzEntfernt,
  fensterPlanPruefen,
  fensterPlanPruefung,
  nachVorbefuellung,
  raumAnnahmePruefen,
  raumAnnahmenOffen,
  raumBestaetigung,
  raumWieAngenommen,
} from '../annahmen';
import { PlanKnopf } from './plan';
import { fotoPraefix } from '../fotos';
import { isoJetzt, leerMesswert, uuid } from '../util';
import {
  AnnahmeKnoepfe,
  AnnahmeZeile,
  Feld,
  FotoLeiste,
  Hinweis,
  Kopf,
  StatusSchalter,
  Tasten,
  TextFeld,
  Thumb,
  WahlMess,
  WahlZahl,
  ZahlFeld,
  fotoZeigen,
} from './common';
import { hfMangel, hfMangelText, raumMaengel } from '../pruefung';
import { flaecheText, heizflaecheFehltVermutlich, heizlastText, nutzungText, sollTempFuer, sollText } from './einheit';

/** 2.55 → „2,55“ */
const meterText = (n: number) => n.toFixed(2).replace('.', ',');

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
    r.keine_heizflaeche = false;
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

/** Neues Fenster. Verglasung und Rahmen kommen vom zuletzt aufgenommenen Fenster der Einheit (meist überall gleich). */
function leeresFenster(jetzt: string, a?: EinheitAufnahme): Fenster {
  const letztes = a?.raeume
    .flatMap((r) => r.fenster)
    .filter((f) => f.verglasung || f.rahmen)
    .sort((x, y) => (x.geaendert_am ?? '').localeCompare(y.geaendert_am ?? ''))
    .pop();
  return { fenster_id: uuid(), anzahl: 1, verglasung: letztes?.verglasung ?? null, rahmen: letztes?.rahmen ?? null, breite_mm: null, hoehe_mm: null, masse_status: null, art: null, erneuert: null, baujahr: null, fotos: [], geaendert_am: jetzt };
}

let zuFenstern = false;

/** Von der Heizfläche weiter zu den Fenstern des Raums. Legt das erste Fenster gleich an. */
export function fensterAufnehmen(eid: string, rid: string) {
  const r = S.aufnahmen.get(eid)!.raeume.find((x) => x.raum_id === rid)!;
  const plan = planEinheit(eid)?.raeume.find((x) => x.raum_id === rid)?.fenster_plan ?? [];
  // Mit Fenstern laut Plan nichts anlegen: dort genügt „passt“.
  if (r.fenster.length === 0 && plan.length === 0)
    aendern(eid, (a, jetzt) => {
      const x = a.raeume.find((q) => q.raum_id === rid)!;
      x.fenster.push(leeresFenster(jetzt, a));
      x.geaendert_am = jetzt;
    });
  zuFenstern = true;
  gehe({ name: 'raum', eid, rid });
}

export function raumFertig(eid: string, rid: string) {
  const raum = S.aufnahmen.get(eid)!.raeume.find((x) => x.raum_id === rid)!;
  const maengel = raumMaengel(raum);
  if (
    maengel.length &&
    !confirm(
      `In ${raum.nr} ${raum.name} sind Heizflächen unvollständig:\n\n${maengel.map((m) => '• ' + m.text).join('\n')}\n\nTrotzdem als erledigt markieren?`,
    )
  ) {
    gehe({ name: 'raum', eid, rid });
    return;
  }
  let keine = false;
  if (heizflaecheFehltVermutlich(raum)) {
    if (!confirm(`Keine Heizfläche erfasst. ${heizlastText(raum.heizlast_w)}.

OK: als „Keine Heizfläche“ abschließen
Abbrechen: im Raum bleiben`))
      return;
    keine = true;
  }
  aendern(eid, (a, jetzt) => {
    const r = a.raeume.find((x) => x.raum_id === rid)!;
    r.erledigt = true;
    if (keine) r.keine_heizflaeche = true;
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

function FensterBlock(props: { a: EinheitAufnahme; r: Raum; f: Fenster; titel: string }) {
  const { a, r, f } = props;
  const set = (fn: (x: Fenster) => void) =>
    aendern(a.einheit_id, (au, jetzt) => {
      const x = au.raeume.find((q) => q.raum_id === r.raum_id)!.fenster.find((q) => q.fenster_id === f.fenster_id)!;
      fn(x);
      x.geaendert_am = jetzt;
    });
  const masse = f.breite_mm !== null || f.hoehe_mm !== null;
  const [fotoOffen, setFotoOffen] = useState(false);
  const fotos = fotosVon(a.einheit_id, f.fenster_id, 'Fenster');
  const stempel = fotosVon(a.einheit_id, f.fenster_id, 'Glasstempel');
  const [stempelOffen, setStempelOffen] = useState(false);
  /** Maß ändern: Status bleibt erhalten, ohne Maße kein Status. */
  const mass = (fn: (x: Fenster) => void) =>
    set((x) => {
      fn(x);
      if (x.breite_mm === null && x.hoehe_mm === null) x.masse_status = null;
      else if (!x.masse_status) x.masse_status = 'gemessen';
    });
  /** Standardmaß antippen: beide Maße setzen (geschätzt), nochmal antippen leert sie. */
  const standard = (b: number, h: number) =>
    set((x) => {
      if (x.breite_mm === b && x.hoehe_mm === h) {
        x.breite_mm = null;
        x.hoehe_mm = null;
        x.masse_status = null;
      } else {
        x.breite_mm = b;
        x.hoehe_mm = h;
        x.masse_status = 'geschätzt';
      }
    });
  return (
    <div class="block fenster">
      <div class="block-kopf">
        <h3>{props.titel}</h3>
        <button
          class="knopf klein gefahr"
          onClick={() => {
            if (!confirm(f.fenster_plan_id ? 'Diese Abweichung löschen? Das Fenster laut Plan ist dann wieder ungeprüft.' : 'Diese Fensterangabe löschen?')) return;
            aendern(a.einheit_id, (au, jetzt) => {
              const rr = au.raeume.find((q) => q.raum_id === r.raum_id)!;
              rr.fenster = rr.fenster.filter((q) => q.fenster_id !== f.fenster_id);
              fensterDatensatzEntfernt(rr, f, jetzt);
              rr.geaendert_am = jetzt;
            });
          }}
        >
          Entfernen
        </button>
      </div>
      <Feld titel="Art">
        <Tasten werte={Object.keys(FENSTER_ART_TEXT) as (keyof typeof FENSTER_ART_TEXT)[]} wert={f.art ?? null} text={(w) => FENSTER_ART_TEXT[w]} onWahl={(w) => set((x) => (x.art = w))} />
      </Feld>
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
      <Feld titel="Erneuert">
        <Tasten werte={ANTWORTEN} wert={f.erneuert ?? null} onWahl={(w) => set((x) => (x.erneuert = w))} />
      </Feld>
      <Feld titel="Baujahr" hinweis="z. B. vom Glasstempel im Scheibenzwischenraum">
        <ZahlFeld wert={f.baujahr ?? null} ganzzahl platzhalter="z. B. 1975" onAendern={(n) => set((x) => (x.baujahr = n))} />
        {stempel.length > 0 || stempelOffen ? (
          <FotoLeiste
            titel="Foto Glasstempel"
            fotos={stempel}
            ziel={{
              eid: a.einheit_id,
              praefix: fotoPraefix(a, { art: 'glasstempel', raumNr: r.nr, raumName: r.name }),
              rolle: 'Glasstempel',
              bezug_id: f.fenster_id,
              eintragen: (au, name, jetzt) => {
                const x = au.raeume.find((q) => q.raum_id === r.raum_id)!.fenster.find((q) => q.fenster_id === f.fenster_id)!;
                x.fotos.push(name);
                x.geaendert_am = jetzt;
              },
            }}
          />
        ) : (
          <button class="knopf klein" onClick={() => setStempelOffen(true)}>
            Foto Glasstempel
          </button>
        )}
      </Feld>
      {f.fenster_plan_id && (
        <div class="feld-hinweis">Vorbefüllt aus dem Plan (Maße geschätzt). Nur ändern, was abweicht; nach dem Nachmessen unten auf „gemessen“ stellen.</div>
      )}
      <Feld titel="Standardmaß Breite × Höhe" hinweis="Antippen trägt beide Maße als „geschätzt“ ein. Nach dem Nachmessen unten auf „gemessen“ stellen.">
        <div class="feld-titel klein">Fenster</div>
        <div class="tasten">
          {FENSTER_STANDARD.map(([b, h]) => (
            <button key={`${b}x${h}`} class={`taste ${f.breite_mm === b && f.hoehe_mm === h ? 'aktiv' : ''}`} onClick={() => standard(b, h)}>
              {b} × {h}
            </button>
          ))}
        </div>
        <div class="feld-titel klein">Balkontür / Fenstertür</div>
        <div class="tasten">
          {BALKONTUER_STANDARD.map(([b, h]) => (
            <button key={`${b}x${h}`} class={`taste ${f.breite_mm === b && f.hoehe_mm === h ? 'aktiv' : ''}`} onClick={() => standard(b, h)}>
              {b} × {h}
            </button>
          ))}
        </div>
      </Feld>
      <Feld titel="Breite (mm)">
        <WahlZahl werte={FENSTER_BREITEN} wert={f.breite_mm} einheit="mm" onAendern={(n) => mass((x) => (x.breite_mm = n))} />
      </Feld>
      <Feld titel="Höhe (mm)">
        <WahlZahl werte={FENSTER_HOEHEN} wert={f.hoehe_mm} einheit="mm" onAendern={(n) => mass((x) => (x.hoehe_mm = n))} />
        <StatusSchalter status={f.masse_status} aktiv={masse} onWahl={(s) => set((x) => (x.masse_status = s))} />
      </Feld>
      {fotos.length > 0 || fotoOffen ? (
        <FotoLeiste
          titel="Foto Fenster"
          fotos={fotos}
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
      ) : (
        <button class="knopf klein" onClick={() => setFotoOffen(true)}>
          Foto hinzufügen
        </button>
      )}
    </div>
  );
}

const ZUSTAENDE: RaumZustand[] = ['vorhanden', 'nicht_vorhanden', 'zusammengelegt'];

const PRUEFUNGEN: Bestaetigung[] = ['bestaetigt', 'geaendert', 'unklar'];
const FENSTER_PRUEFUNGEN: FensterPlanBestaetigung[] = ['bestaetigt', 'geaendert', 'nicht_vorhanden', 'unklar'];

/** 1.59 → „1,59“, 0.9 → „0,90“ (Meter) */
const mText = (n: number | null) => (n === null ? '?' : meterText(n));

/** „2-fach, 1975, nicht erneuert“ */
function bestandText(pf: PlanFenster): string {
  const erneuert = pf.erneuert === 'nein' ? 'nicht erneuert' : pf.erneuert === 'ja' ? 'erneuert' : pf.erneuert === 'unklar' ? 'erneuert unklar' : '';
  return [pf.verglasung, pf.baujahr !== null ? String(pf.baujahr) : '', erneuert].filter(Boolean).join(', ');
}

/** Lichte Höhe und beheizt laut Rechenmodell mit passt / ändern / unklar. */
function RaumAnnahmeZeilen(props: { a: EinheitAufnahme; r: Raum; pr: PlanRaum }) {
  const { a, r, pr } = props;
  const best = raumBestaetigung(r);
  const pruefen = (k: RaumAnnahmeSchluessel, b: Bestaetigung | null) =>
    aendern(a.einheit_id, (au, jetzt) => {
      const x = au.raeume.find((q) => q.raum_id === r.raum_id)!;
      raumAnnahmePruefen(x, pr, k, b);
      x.geaendert_am = jetzt;
    });
  const setRaum = (fn: (x: Raum) => void) =>
    aendern(a.einheit_id, (au, jetzt) => {
      const x = au.raeume.find((q) => q.raum_id === r.raum_id)!;
      fn(x);
      x.geaendert_am = jetzt;
    });
  const h = pr.annahmen?.lichte_hoehe_m;
  const bh = pr.annahmen?.beheizt;
  return (
    <>
      {h && (
        <div class={`block annahme ${best.lichte_hoehe_m ? 'erfasst' : ''}`}>
          <div class="annahme-name">Lichte Raumhöhe</div>
          <AnnahmeZeile text={`${mText(h.wert)} m`} status={h.status} quelle={h.quelle} markiert={r.annahmen_geaendert?.lichte_hoehe_m} />
          <AnnahmeKnoepfe werte={PRUEFUNGEN} wert={best.lichte_hoehe_m} text={(w) => BESTAETIGUNG_TEXT[w]} onWahl={(w) => pruefen('lichte_hoehe_m', w)} />
          {best.lichte_hoehe_m === 'geaendert' && (
            <Feld titel="Lichte Raumhöhe vor Ort (m)" hinweis="Vorbefüllt mit der Annahme. Ein anderer Wert gilt als gemessen.">
              <WahlMess
                werte={LICHTE_HOEHEN}
                ganzzahl={false}
                text={meterText}
                einheit="m"
                wert={r.lichte_hoehe_m ?? { wert: null, status: null }}
                onAendern={(m) => setRaum((x) => (x.lichte_hoehe_m = nachVorbefuellung(x.lichte_hoehe_m ?? { wert: null, status: null }, m, h.wert)))}
              />
            </Feld>
          )}
        </div>
      )}
      {bh && (
        <div class={`block annahme ${best.beheizt ? 'erfasst' : ''}`}>
          <div class="annahme-name">Beheizt</div>
          <AnnahmeZeile text={bh.wert ? 'ja, beheizt' : 'nein, unbeheizt'} status={bh.status} quelle={bh.quelle} markiert={r.annahmen_geaendert?.beheizt} />
          <AnnahmeKnoepfe werte={PRUEFUNGEN} wert={best.beheizt} text={(w) => BESTAETIGUNG_TEXT[w]} onWahl={(w) => pruefen('beheizt', w)} />
          {best.beheizt === 'geaendert' && (
            <Feld titel="Beheizt vor Ort">
              <Tasten werte={ANTWORTEN} wert={r.beheizt_vor_ort ?? null} onWahl={(w) => setRaum((x) => (x.beheizt_vor_ort = w))} />
            </Feld>
          )}
        </div>
      )}
    </>
  );
}

/** Ein Fenster laut Plan mit passt / ändern / nicht vorhanden / unklar; bei „ändern“ der vorbefüllte Datensatz. */
function PlanFensterBlock(props: { a: EinheitAufnahme; r: Raum; pf: PlanFenster }) {
  const { a, r, pf } = props;
  const e = fensterPlanPruefung(r, pf.id);
  const b = e?.bestaetigung ?? null;
  const datensatz = r.fenster.find((f) => f.fenster_plan_id === pf.id);
  const pruefen = (w: FensterPlanBestaetigung | null) => {
    if (datensatz && w !== 'geaendert') {
      const fotos = fotosVon(a.einheit_id, datensatz.fenster_id);
      if (!confirm(`Die geänderten Angaben zu diesem Fenster${fotos.length ? ` und ${fotos.length} Fotos` : ''} werden gelöscht. Weiter?`)) return;
    }
    let entfernt: string | null = null;
    aendern(a.einheit_id, (au, jetzt) => {
      const x = au.raeume.find((q) => q.raum_id === r.raum_id)!;
      entfernt = fensterPlanPruefen(x, pf, w, jetzt);
      x.geaendert_am = jetzt;
    });
    if (entfernt) {
      const ids = fotosVon(a.einheit_id, entfernt).map((f) => f.foto_id);
      if (ids.length) void fotosEntfernen(a.einheit_id, ids);
    }
  };
  const status = [pf.breite_status && `Breite ${pf.breite_status}`, pf.hoehe_status && `Höhe ${pf.hoehe_status}`, pf.bestand_status && `Bestand ${pf.bestand_status}`]
    .filter(Boolean)
    .join(' · ');
  return (
    <div class={`block plan-fenster ${b ? 'erfasst' : ''}`}>
      <div class="plan-fenster-kopf">
        <span class="annahme-name">{pf.bezeichnung}</span>
        {pf.orientierung && <span class="plan-fenster-ort"> · {pf.orientierung}</span>}
        {pf.typ !== 'fenster' && <span class="plan-fenster-ort"> · {FENSTER_ART_TEXT[pf.typ]}</span>}
      </div>
      <div class="plan-fenster-mass">
        {mText(pf.breite_m)} × {mText(pf.hoehe_m)} m{pf.anzahl !== null && pf.anzahl !== 1 ? ` · ${pf.anzahl} Stück` : ''}
      </div>
      {bestandText(pf) && <div class="plan-fenster-bestand">{bestandText(pf)}</div>}
      <div class="annahme-quelle">
        {status}
        {pf.quelle && ` · ${pf.quelle}`}
      </div>
      {e?.annahme_geaendert && <span class="marke-klein warn">Annahme geändert, neu prüfen</span>}
      {e?.im_plan_entfallen && <span class="marke-klein warn">nicht mehr in der Projektdatei</span>}
      <AnnahmeKnoepfe werte={FENSTER_PRUEFUNGEN} wert={b} text={(w) => BESTAETIGUNG_TEXT[w]} onWahl={pruefen} />
      {datensatz && <FensterBlock a={a} r={r} f={datensatz} titel="Abweichung vom Plan" />}
    </div>
  );
}

export function RaumSeite(props: { eid: string; rid: string }) {
  const a = S.aufnahmen.get(props.eid)!;
  const r = a.raeume.find((x) => x.raum_id === props.rid)!;
  const pe = planEinheit(props.eid);
  const pr = pe?.raeume.find((x) => x.raum_id === r.raum_id);
  const hatAnnahmen = !!pr && (!!pr.annahmen || (pr.fenster_plan?.length ?? 0) > 0);
  const offeneAnnahmen = raumAnnahmenOffen(r, pr);
  const planFenster = pr?.fenster_plan ?? [];
  const weitereFenster = r.fenster.filter((f) => !f.fenster_plan_id || !planFenster.some((pf) => pf.id === f.fenster_plan_id));
  const setRaum = (fn: (x: Raum) => void) =>
    aendern(a.einheit_id, (au, jetzt) => {
      const x = au.raeume.find((q) => q.raum_id === r.raum_id)!;
      fn(x);
      x.geaendert_am = jetzt;
    });
  const nutzungen = S.projekt?.nutzungsarten ?? [];
  const maengel = raumMaengel(r);
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
        zurueck={() => {
          if (
            heizflaecheFehltVermutlich(r) &&
            !confirm(`Noch keine Heizfläche erfasst. ${heizlastText(r.heizlast_w)}.

OK: Raum trotzdem verlassen
Abbrechen: im Raum bleiben (Heizfläche erfassen oder „Keine Heizfläche“ antippen)`)
          )
            return;
          gehe({ name: 'einheit', eid: a.einheit_id });
        }}
        rechts={<PlanKnopf eid={a.einheit_id} />}
      />
      <main class="inhalt">
        <div class="raum-plan">
          {flaecheText(r.flaeche_plan_m2)} · {sollText(r.soll_temp_c)}
          {heizlastText(r.heizlast_w) && <span class="raum-heizlast">{heizlastText(r.heizlast_w)}</span>}
          {r.quelle && <div class="raum-quelle">{r.quelle}</div>}
        </div>
        {r.im_plan_entfallen && <Hinweis art="warn">Dieser Raum ist in der aktuellen Projektdatei nicht mehr enthalten. Die Aufnahmen bleiben erhalten.</Hinweis>}
        {r.zustand !== 'vorhanden' && <Hinweis art="warn">Raum ist als „{ZUSTAND_TEXT[r.zustand]}“ markiert.</Hinweis>}

        {hatAnnahmen && (
          <>
            <h2>
              Annahmen laut Rechenmodell{' '}
              {offeneAnnahmen === 0 && <span class="tag-zaehler">alle geprüft</span>}
            </h2>
            {offeneAnnahmen > 0 && (
              <button
                class="knopf gross primaer wie-angenommen"
                onClick={() =>
                  aendern(a.einheit_id, (au, jetzt) => {
                    const x = au.raeume.find((q) => q.raum_id === r.raum_id)!;
                    raumWieAngenommen(x, pr!, jetzt);
                    x.geaendert_am = jetzt;
                  })
                }
              >
                Raum wie angenommen ({offeneAnnahmen} offen)
              </button>
            )}
            {offeneAnnahmen > 0 && (
              <div class="feld-hinweis">Bestätigt lichte Höhe, beheizt und alle Fenster laut Plan, die noch offen sind. Heizflächen sind davon nicht betroffen.</div>
            )}
            <RaumAnnahmeZeilen a={a} r={r} pr={pr!} />
          </>
        )}

        <h2>Heizflächen</h2>
        {r.erledigt && maengel.length > 0 && (
          <Hinweis art="warn">
            Raum ist als erledigt markiert, aber {maengel.length === 1 ? 'eine Heizfläche ist' : `${maengel.length} Heizflächen sind`} unvollständig:{' '}
            {maengel.map((m) => m.text).join(' · ')}
          </Hinweis>
        )}
        <div class="liste">
          {r.heizflaechen.map((h) => {
            const fotos = fotosVon(a.einheit_id, h.hf_id);
            const mangel = hfMangel(h);
            return (
              <div key={h.hf_id} class="karte hf">
                <button class="karte-klick" onClick={() => gehe({ name: 'hf', eid: a.einheit_id, rid: r.raum_id, hfid: h.hf_id })}>
                  <div class="karte-titel">
                    HK{h.nr} · {hfKurztext(h)}
                  </div>
                  {mangel && <div class="karte-warnung">⚠ {hfMangelText(mangel)}</div>}
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
        <div class="knopfreihe">
          <button class="knopf gross primaer" onClick={() => heizflaecheAnlegen(a.einheit_id, r.raum_id)}>
            + Heizfläche
          </button>
          {r.heizflaechen.length === 0 && (
            <button
              class={`knopf gross ${r.keine_heizflaeche ? 'aktiv-gruen' : ''}`}
              aria-pressed={r.keine_heizflaeche === true}
              onClick={() => setRaum((x) => (x.keine_heizflaeche = !x.keine_heizflaeche))}
            >
              {r.keine_heizflaeche ? '✓ Keine Heizfläche' : 'Keine Heizfläche'}
            </button>
          )}
        </div>
        {!pr?.annahmen?.beheizt && (
          <Feld titel="Beheizt vor Ort">
            <Tasten werte={ANTWORTEN} wert={r.beheizt_vor_ort ?? null} onWahl={(w) => setRaum((x) => (x.beheizt_vor_ort = w))} />
          </Feld>
        )}

        <h2 id="fenster">Fenster</h2>
        {planFenster.length > 0 && (
          <>
            <h3>Laut Plan</h3>
            {planFenster.map((pf) => (
              <PlanFensterBlock key={pf.id} a={a} r={r} pf={pf} />
            ))}
            {(weitereFenster.length > 0 || planFenster.length > 0) && <h3>Weitere Fenster (nicht im Plan)</h3>}
          </>
        )}
        {weitereFenster.map((f, i) => (
          <FensterBlock key={f.fenster_id} a={a} r={r} f={f} titel={`Fenster ${i + 1}`} />
        ))}
        <button
          class="knopf gross"
          onClick={() =>
            setRaum((x) =>
              x.fenster.push(leeresFenster(isoJetzt(), S.aufnahmen.get(a.einheit_id))),
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
          {!pr?.annahmen?.lichte_hoehe_m && (
            <Feld titel="Lichte Raumhöhe (m)">
              <WahlMess
                werte={LICHTE_HOEHEN}
                ganzzahl={false}
                text={meterText}
                einheit="m"
                wert={r.lichte_hoehe_m ?? { wert: null, status: null }}
                onAendern={(m) => setRaum((x) => (x.lichte_hoehe_m = m))}
              />
            </Feld>
          )}
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
