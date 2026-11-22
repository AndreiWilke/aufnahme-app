// Prüfpunkte je Einheit (einheiten[].pruefpunkte[] aus der Projektdatei). Inhalt kommt nur aus der Projektdatei.
import { useState } from 'preact/hooks';
import type { Bestaetigung, EinheitAufnahme, PlanPruefpunkt, Pruefpunkt } from '../model';
import { ANTWORTEN, BESTAETIGUNG_TEXT } from '../model';
import { aendern, fotosVon, planEinheit } from '../store';
import { fotoPraefix } from '../fotos';
import { nachVorbefuellung, ppAnnahmenFortschritt, ppPruefen } from '../annahmen';
import { AnnahmeKnoepfe, AnnahmeZeile, Feld, FotoLeiste, MessFeld, Tasten, TextFeld } from './common';

const PRUEFUNGEN: Bestaetigung[] = ['bestaetigt', 'geaendert', 'unklar'];

/** Zähler „erledigt/gesamt“ der Prüfpunkte einer Einheit. */
export function pruefpunkteFortschritt(a: EinheitAufnahme): { erledigt: number; gesamt: number } {
  const l = a.pruefpunkte ?? [];
  return { erledigt: l.filter((q) => q.erledigt).length, gesamt: l.length };
}

function PunktBlock(props: { a: EinheitAufnahme; q: Pruefpunkt; d: PlanPruefpunkt | undefined }) {
  const { a, q, d } = props;
  const [offen, setOffen] = useState(!q.erledigt);
  const set = (fn: (x: Pruefpunkt) => void) =>
    aendern(a.einheit_id, (au, jetzt) => {
      const x = au.pruefpunkte!.find((p) => p.id === q.id)!;
      fn(x);
      x.geaendert_am = jetzt;
    });
  const zahl = d?.typ === 'zahl';
  const fotos = fotosVon(a.einheit_id, q.id);
  const ann = d?.annahme ?? null;
  const b = q.bestaetigung ?? null;
  // Mit Annahme: Eingaben nur bei „ändern“ (alle) und „unklar“ (Notiz, Foto). Ohne Annahme wie in 1.5.0.
  const eingaben = !ann || b === 'geaendert';
  const nurNotiz = !!ann && b === 'unklar';
  return (
    <div class={`block pruefpunkt ${q.erledigt ? 'erfasst' : ''}`}>
      <div class="pp-kopf">
        <button
          class={`pp-haken ${q.erledigt ? 'aktiv' : ''}`}
          aria-label={q.erledigt ? 'erledigt, antippen zum Öffnen' : 'als erledigt markieren'}
          onClick={() => {
            const neu = !q.erledigt;
            set((x) => (x.erledigt = neu));
            setOffen(!neu);
          }}
        >
          {q.erledigt ? '✓' : ''}
        </button>
        <button class="pp-text" onClick={() => setOffen(!offen)}>
          <span class="pp-titel">{q.text}</span>
          {(d?.ort || d?.wirkung) && (
            <span class="pp-unter">
              {d?.ort}
              {d?.ort && d?.wirkung ? ' · ' : ''}
              {d?.wirkung && `Wirkung: ${d.wirkung}`}
            </span>
          )}
          {q.im_plan_entfallen && <span class="marke-klein warn">nicht mehr in der Projektdatei</span>}
          {!offen && (b || q.antwort || q.wert.wert !== null || fotos.length > 0) && (
            <span class="pp-unter">
              {[
                b ? BESTAETIGUNG_TEXT[b] : '',
                q.antwort,
                q.wert.wert !== null ? `${String(q.wert.wert).replace('.', ',')}${d?.einheit ? ' ' + d.einheit : ''} (${q.wert.status ?? 'gemessen'})` : '',
                fotos.length ? `${fotos.length} 📷` : '',
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          )}
        </button>
      </div>
      {ann && (
        <>
          <AnnahmeZeile text={ann.text} status={ann.status} quelle={ann.quelle} markiert={q.annahme_geaendert} />
          <AnnahmeKnoepfe
            werte={PRUEFUNGEN}
            wert={b}
            text={(w) => BESTAETIGUNG_TEXT[w]}
            onWahl={(w) => {
              set((x) => ppPruefen(x, d!, w));
              setOffen(w !== 'bestaetigt');
            }}
          />
        </>
      )}
      {offen && (eingaben || nurNotiz) && (
        <>
          {eingaben && (
            <Feld titel="Antwort">
              <Tasten werte={ANTWORTEN} wert={q.antwort} onWahl={(w) => set((x) => (x.antwort = w))} />
            </Feld>
          )}
          {eingaben && zahl && (
            <Feld titel={`Wert${d?.einheit ? ' in ' + d.einheit : ''}`} hinweis={ann ? 'Vorbefüllt mit der Annahme. Neuer Wert gilt als gemessen.' : undefined}>
              <MessFeld
                ganzzahl={false}
                wert={q.wert}
                einheit={d?.einheit ?? undefined}
                onAendern={(m) => set((x) => (x.wert = nachVorbefuellung(x.wert, m, ann?.wert)))}
              />
            </Feld>
          )}
          <Feld titel="Notiz" hinweis={nurNotiz ? 'Optional: warum nicht prüfbar. Diktat über das Mikrofon der Tastatur.' : 'Diktat über das Mikrofon der Tastatur.'}>
            <TextFeld mehrzeilig wert={q.notiz} onAendern={(s) => set((x) => (x.notiz = s))} />
          </Feld>
          <FotoLeiste
            titel="Foto"
            fotos={fotos}
            ziel={{
              eid: a.einheit_id,
              praefix: fotoPraefix(a, { art: 'pruefpunkt', id: q.id }),
              rolle: 'Pruefpunkt',
              bezug_id: q.id,
              eintragen: (au, name, jetzt) => {
                const x = au.pruefpunkte!.find((p) => p.id === q.id)!;
                x.fotos.push(name);
                x.geaendert_am = jetzt;
              },
            }}
          />
          <button
            class={`knopf ${q.erledigt ? '' : 'primaer'}`}
            onClick={() => {
              const neu = !q.erledigt;
              set((x) => (x.erledigt = neu));
              setOffen(!neu);
            }}
          >
            {q.erledigt ? '✓ erledigt – zuklappen' : 'Prüfpunkt erledigt'}
          </button>
        </>
      )}
    </div>
  );
}

/** Einklappbare Liste mit Zähler „Prüfpunkte 2/4“. Ohne Prüfpunkte nichts. */
export function PruefpunkteListe(props: { a: EinheitAufnahme }) {
  const { a } = props;
  const liste = a.pruefpunkte ?? [];
  const f = pruefpunkteFortschritt(a);
  const [offen, setOffen] = useState(f.erledigt < f.gesamt);
  if (liste.length === 0) return null;
  const pe = planEinheit(a.einheit_id);
  const plan = new Map((pe?.pruefpunkte ?? []).map((d) => [d.id, d]));
  const an = ppAnnahmenFortschritt(a, pe);
  return (
    <section class="pruefpunkte">
      <button class="pp-liste-kopf" onClick={() => setOffen(!offen)} aria-expanded={offen}>
        <span class="pp-pfeil">{offen ? '▾' : '▸'}</span>
        <span class="pp-liste-titel">
          Prüfpunkte {f.erledigt}/{f.gesamt}
          {an.gesamt > 0 && <span class="pp-annahmen"> · Annahmen {an.geprueft}/{an.gesamt} geprüft</span>}
        </span>
        {!offen && <span class="tag-zaehler">antippen zum Öffnen</span>}
      </button>
      {offen && liste.map((q) => <PunktBlock key={q.id} a={a} q={q} d={plan.get(q.id)} />)}
    </section>
  );
}
