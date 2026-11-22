import { useState } from 'preact/hooks';
import type { EinheitStatus, Raum } from '../model';
import { STATUS_TEXT, ZUSTAND_TEXT } from '../model';
import { aendern, fotosDerEinheit, gehe, planEinheit, S } from '../store';
import { Feld, Hinweis, JaNein, Kopf, Tasten, TextFeld, ZahlFeld } from './common';
import { PlanKnopf } from './plan';
import { fortschritt } from './projekt';
import { raumAnnahmenOffen } from '../annahmen';
import { PruefpunkteListe } from './pruefpunkte';

export function nutzungText(schluessel: string): string {
  return S.projekt?.nutzungsarten.find((n) => n.schluessel === schluessel)?.bezeichnung ?? schluessel;
}

export function sollTempFuer(schluessel: string): number | null {
  return S.projekt?.nutzungsarten.find((n) => n.schluessel === schluessel)?.soll_temp_c ?? null;
}

/** „Fläche lt. Plan: 26,6 m²“ oder „Fläche lt. Plan: –“ (null ist nicht 0). */
export function flaecheText(m2: number | null): string {
  return `Fläche lt. Plan: ${m2 === null ? '–' : String(m2).replace('.', ',') + ' m²'}`;
}

/** „Soll 20 °C“ oder „Soll –“ (z. B. Technikräume ohne Solltemperatur). */
export function sollText(t: number | null): string {
  return `Soll ${t === null ? '–' : String(t).replace('.', ',') + ' °C'}`;
}

/** Watt mit Tausenderpunkt: 1209 → „1.209“. */
export function wattText(w: number): string {
  return String(Math.round(w)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * „Heizlast lt. Vorberechnung: 1.209 W (vorläufig)“; negativ: „kein Wärmebedarf (Innenraum)“; null: nichts.
 * Reine Anzeige aus der Projektdatei, keine eigene Berechnung.
 */
export function heizlastText(w: number | null | undefined): string {
  if (w === null || w === undefined) return '';
  if (w < 0) return 'Heizlast lt. Vorberechnung: kein Wärmebedarf (Innenraum)';
  return `Heizlast lt. Vorberechnung: ${wattText(w)} W (vorläufig)`;
}

/** Summe der Heizlast der vorhandenen Räume (null, wenn kein Raum einen Wert hat). */
export function heizlastSumme(raeume: Raum[]): number | null {
  const werte = raeume.map((r) => r.heizlast_w).filter((w): w is number => typeof w === 'number');
  return werte.length ? werte.reduce((s, w) => s + w, 0) : null;
}

/** Raum mit Wärmebedarf, ohne Heizfläche und ohne „Keine Heizfläche“: wahrscheinlich vergessen. */
export function heizflaecheFehltVermutlich(r: Raum): boolean {
  return r.zustand === 'vorhanden' && (r.heizlast_w ?? 0) > 0 && r.heizflaechen.length === 0 && r.keine_heizflaeche !== true;
}

const STATI: EinheitStatus[] = ['offen', 'in_arbeit', 'fertig', 'nicht_angetroffen'];

export function statusSetzen(eid: string, s: EinheitStatus) {
  aendern(
    eid,
    (a, jetzt) => {
      a.status = s;
      if (s === 'in_arbeit' && !a.zeit_start) a.zeit_start = jetzt;
      if (s === 'fertig' || s === 'nicht_angetroffen') a.zeit_ende = jetzt;
    },
    { statusAutomatisch: false },
  );
}

export function RaumHinzufuegen(props: { eid: string; onFertig?: (rid: string) => void }) {
  const [offen, setOffen] = useState(false);
  const [name, setName] = useState('');
  const [nutzung, setNutzung] = useState<string | null>(null);
  const nutzungen = S.projekt?.nutzungsarten ?? [];
  if (!offen)
    return (
      <button class="knopf gross" onClick={() => setOffen(true)}>
        + Raum hinzufügen
      </button>
    );
  return (
    <div class="block">
      <h3>Raum hinzufügen</h3>
      <Feld titel="Name">
        <TextFeld wert={name} onAendern={setName} platzhalter="z. B. Abstellraum, Treppenhaus 1" />
      </Feld>
      <Feld titel="Nutzung">
        <Tasten
          werte={nutzungen.map((n) => n.schluessel)}
          wert={nutzung}
          text={nutzungText}
          onWahl={(w) => {
            setNutzung(w);
            if (!name.trim() && w) setName(nutzungText(w));
          }}
        />
      </Feld>
      <div class="knopfreihe">
        <button class="knopf" onClick={() => setOffen(false)}>
          Abbrechen
        </button>
        <button
          class="knopf primaer"
          disabled={!name.trim() || !nutzung}
          onClick={() => {
            let rid = '';
            aendern(props.eid, (a, jetzt) => {
              // Eigene Nummernfolge V01, V02 … damit es keine Überschneidung mit Planräumen gibt
              const vorOrt = a.raeume.filter((r) => r.herkunft === 'vor_ort_angelegt').map((r) => parseInt(r.nr.slice(1), 10) || 0);
              const n = (vorOrt.length ? Math.max(...vorOrt) : 0) + 1;
              const nr = `V${String(n).padStart(2, '0')}`;
              rid = `${a.einheit_id}-${nr}`;
              const raum: Raum = {
                raum_id: rid,
                nr,
                name: name.trim(),
                nutzung: nutzung!,
                flaeche_plan_m2: null,
                soll_temp_c: sollTempFuer(nutzung!),
                herkunft: 'vor_ort_angelegt',
                zustand: 'vorhanden',
                erledigt: false,
                notiz: '',
                heizflaechen: [],
                fenster: [],
                keine_heizflaeche: false,
                lichte_hoehe_m: { wert: null, status: null },
                beheizt_vor_ort: null,
                geaendert_am: jetzt,
              };
              a.raeume.push(raum);
            });
            setOffen(false);
            setName('');
            setNutzung(null);
            if (props.onFertig) props.onFertig(rid);
            else gehe({ name: 'raum', eid: props.eid, rid });
          }}
        >
          Raum anlegen
        </button>
      </div>
    </div>
  );
}

function RaumZeile(props: { eid: string; r: Raum }) {
  const { r } = props;
  const offen = raumAnnahmenOffen(r, planEinheit(props.eid)?.raeume.find((x) => x.raum_id === r.raum_id));
  const fotos = fotosDerEinheit(props.eid).filter(
    (f) => r.heizflaechen.some((h) => h.hf_id === f.bezug_id) || r.fenster.some((x) => x.fenster_id === f.bezug_id) || f.bezug_id === r.raum_id,
  ).length;
  const weg = r.zustand !== 'vorhanden';
  return (
    <button class={`raumzeile ${r.erledigt ? 'erledigt' : ''} ${weg ? 'weg' : ''}`} onClick={() => gehe({ name: 'raum', eid: props.eid, rid: r.raum_id })}>
      <span class="raum-haken">{weg ? '–' : r.erledigt ? '✓' : '○'}</span>
      <span class="raum-text">
        <span class="raum-name">
          {r.nr} {r.name}
          {r.herkunft === 'vor_ort_angelegt' && <span class="marke-klein"> vor Ort</span>}
          {r.im_plan_entfallen && <span class="marke-klein warn"> nicht mehr im Plan</span>}
        </span>
        {r.quelle && <span class="raum-quelle">{r.quelle}</span>}
        <span class="raum-info">
          {weg ? ZUSTAND_TEXT[r.zustand] : nutzungText(r.nutzung)} · {flaecheText(r.flaeche_plan_m2)} · {sollText(r.soll_temp_c)}
        </span>
      </span>
      <span class="raum-zahlen">
        {r.heizflaechen.length === 0 && r.keine_heizflaeche ? <span class="keine-hf">keine HF</span> : `${r.heizflaechen.length} HK`} · {fotos} 📷
        {offen > 0 && <span class="annahmen-offen"> · {offen} Annahmen offen</span>}
      </span>
    </button>
  );
}

export function EinheitSeite(props: { eid: string }) {
  const a = S.aufnahmen.get(props.eid)!;
  const pe = planEinheit(props.eid);
  const f = fortschritt(a);
  const fotoAnzahl = fotosDerEinheit(a.einheit_id).length;
  const optionen = pe
    ? [
        { eh: pe.eh, bezeichnung: pe.bezeichnung, geschoss: pe.geschoss, vorgesehen: true },
        ...pe.ersatz.map((e) => ({ eh: e.eh, bezeichnung: e.bezeichnung, geschoss: e.geschoss ?? '', vorgesehen: false })),
      ]
    : [];
  const ersatzGewaehlt = !!pe && a.aufgenommen_bezeichnung !== pe.bezeichnung;
  const vorhanden = a.raeume.filter((r) => r.zustand === 'vorhanden');
  const andere = a.raeume.filter((r) => r.zustand !== 'vorhanden');
  const summe = heizlastSumme(vorhanden);

  return (
    <div>
      <Kopf
        titel={pe?.bezeichnung ?? a.einheit_id}
        unter={`${a.einheit_id}${pe?.geschoss ? ' · ' + pe.geschoss : ''}${pe?.uhrzeit ? ' · ' + pe.uhrzeit + ' Uhr' : ''}`}
        zurueck={() => gehe({ name: 'projekt' })}
        rechts={<PlanKnopf eid={a.einheit_id} />}
      />
      <main class="inhalt">
        {pe?.hinweis && (
          <div class="einheit-hinweis">
            <span class="einheit-hinweis-titel">Hinweis</span>
            {pe.hinweis}
          </div>
        )}

        <PruefpunkteListe a={a} />

        {a.gewerbe && (
          <div class="block gewerbe-kopf">
            <h3>Gewerbe: vor Ort erfragen</h3>
            <Feld titel="Nutzungszeiten">
              <TextFeld
                wert={a.gewerbe.nutzungszeiten}
                platzhalter="z. B. Mo–Fr 8–18 Uhr"
                onAendern={(s) => aendern(a.einheit_id, (x) => (x.gewerbe!.nutzungszeiten = s))}
              />
            </Feld>
            <Feld titel="Gewünschte Raumtemperatur" hinweis="Die Solltemperaturen der Räume unten sind nur vorläufig.">
              <ZahlFeld wert={a.gewerbe.soll_temp_c} einheit="°C" onAendern={(n) => aendern(a.einheit_id, (x) => (x.gewerbe!.soll_temp_c = n))} />
            </Feld>
            <Feld titel="Ansprechpartner vor Ort">
              <TextFeld wert={a.gewerbe.ansprechpartner} onAendern={(s) => aendern(a.einheit_id, (x) => (x.gewerbe!.ansprechpartner = s))} />
            </Feld>
          </div>
        )}

        {pe?.art === 'wohnung' && pe.ersatz.length > 0 && (
          <Feld titel="Welche Wohnung wird aufgenommen?">
            <div class="tasten">
              {optionen.map((o) => (
                <button
                  key={o.bezeichnung}
                  class={`taste ${a.aufgenommen_bezeichnung === o.bezeichnung ? 'aktiv' : ''}`}
                  onClick={() => {
                    if (a.aufgenommen_bezeichnung === o.bezeichnung) return;
                    if (fotoAnzahl > 0 && !confirm('Es gibt schon Fotos. Ihre Dateinamen behalten die bisherige Wohnungsbezeichnung. Trotzdem wechseln?'))
                      return;
                    aendern(a.einheit_id, (x) => {
                      x.aufgenommen_eh = o.eh;
                      x.aufgenommen_bezeichnung = o.bezeichnung;
                    });
                  }}
                >
                  {o.bezeichnung}
                  {o.eh !== null && ` (EH ${o.eh})`}
                  {o.geschoss && ` · ${o.geschoss}`}
                  {o.vorgesehen ? ' · vorgesehen' : ' · Ersatz'}
                </button>
              ))}
            </div>
            {ersatzGewaehlt && (
              <div class="feld-hinweis">
                Ersatzwohnung {a.aufgenommen_bezeichnung} wird aufgenommen. Die Raumliste bleibt gleich, Fotos und Export tragen {a.aufgenommen_bezeichnung}.
              </div>
            )}
          </Feld>
        )}

        <Feld titel="Status">
          <Tasten werte={STATI} wert={a.status} text={(s) => STATUS_TEXT[s]} abwaehlbar={false} onWahl={(s) => s && statusSetzen(a.einheit_id, s)} />
        </Feld>

        <h2>
          Räume <span class="tag-zaehler">{f.erledigt}/{f.gesamt} erledigt · {f.hk} Heizflächen · {fotoAnzahl} Fotos</span>
        </h2>
        {f.anGesamt > 0 && (
          <div class="annahmen-zaehler">
            Annahmen {f.anGeprueft}/{f.anGesamt} geprüft
            <span class="feld-hinweis"> (Prüfpunkte, lichte Höhe, beheizt, Fenster laut Plan)</span>
          </div>
        )}
        {summe !== null && (
          <div class="raum-heizlast">
            Heizlast lt. Vorberechnung, Summe der Räume: {wattText(summe)} W (vorläufig)
          </div>
        )}
        {a.raeume.length === 0 && <Hinweis>Noch keine Räume. Räume vor Ort anlegen.</Hinweis>}
        <div class="liste">
          {vorhanden.map((r) => (
            <RaumZeile key={r.raum_id} eid={a.einheit_id} r={r} />
          ))}
        </div>
        <RaumHinzufuegen eid={a.einheit_id} />
        {andere.length > 0 && (
          <>
            <h3>Nicht vorhanden / zusammengelegt</h3>
            <div class="liste">
              {andere.map((r) => (
                <RaumZeile key={r.raum_id} eid={a.einheit_id} r={r} />
              ))}
            </div>
          </>
        )}

        <div class="block">
          <Feld titel="Abweichung vom Plan" hinweis="Vergleich mit Raumliste und Grundriss (oben „Plan“). Nur antippen, wenn vor Ort etwas anders ist.">
            <JaNein wert={a.abweichung_vom_plan} onWahl={(w) => aendern(a.einheit_id, (x) => (x.abweichung_vom_plan = w === true))} />
          </Feld>
          <Feld titel="Notiz zur Einheit" hinweis="Diktat über das Mikrofon der Tastatur.">
            <TextFeld mehrzeilig wert={a.notiz} onAendern={(s) => aendern(a.einheit_id, (x) => (x.notiz = s))} />
          </Feld>
        </div>

        <div class="knopfreihe">
          <button class="knopf" onClick={() => gehe({ name: 'export', eid: a.einheit_id })}>
            Diese Einheit exportieren
          </button>
          {a.status !== 'fertig' && (
            <button
              class="knopf primaer"
              onClick={() => {
                statusSetzen(a.einheit_id, 'fertig');
                gehe({ name: 'projekt' });
              }}
            >
              Einheit fertig
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
