import { useRef, useState } from 'preact/hooks';
import { gehe, projektImportieren, projektOeffnen, S } from '../store';
import { projektdateiLesen, ProjektdateiFehler } from '../projekt';
import { Hinweis, Kopf } from './common';
import { formatZeit } from '../util';
import beispiel from '../../data/beispiel.objekt.json';

export async function projektdateiEinlesen(text: string): Promise<string> {
  let roh: unknown;
  try {
    roh = JSON.parse(text);
  } catch {
    throw new ProjektdateiFehler('Die Datei ist kein gültiges JSON.');
  }
  const p = projektdateiLesen(roh);
  const vorhanden = S.projekte.some((x) => x.projekt_id === p.projekt_id);
  if (vorhanden && !confirm(`Projekt „${p.name}“ ist schon vorhanden. Neuere Fassung einspielen? Vorhandene Aufnahmen bleiben erhalten.`))
    return 'Abgebrochen.';
  const erg = await projektImportieren(p);
  const raeume = p.einheiten.reduce((s, e) => s + e.raeume.length, 0);
  const pp = p.einheiten.reduce((s, e) => s + (e.pruefpunkte?.length ?? 0), 0);
  const ppText = pp ? `, ${pp} Prüfpunkte` : '';
  const w = p.warnungen ?? [];
  const warnText = w.length
    ? ` Warnungen (${w.length}): ${w.slice(0, 5).join(' ')}${w.length > 5 ? ' … Alle Warnungen stehen in den Einstellungen.' : ''}`
    : ' Ohne Warnung geladen.';
  if (!erg) return `Projekt „${p.name}“ geladen: ${p.einheiten.length} Einheiten, ${raeume} Räume${ppText}.${warnText}`;
  return (
    `Neue Fassung eingespielt (${p.einheiten.length} Einheiten, ${raeume} Räume${ppText}). Neue Einheiten: ${erg.neueEinheiten}, neue Räume: ${erg.neueRaeume}` +
    (erg.neuePruefpunkte ? `, neue Prüfpunkte: ${erg.neuePruefpunkte}` : '') +
    (erg.entfalleneRaeumeBehalten ? `, entfallene Räume mit Aufnahmen behalten: ${erg.entfalleneRaeumeBehalten}` : '') +
    (erg.entfalleneEinheitenBehalten ? `, entfallene Einheiten mit Aufnahmen behalten: ${erg.entfalleneEinheitenBehalten}` : '') +
    `.${warnText}`
  );
}

export function DateiLaden(props: { text: string; onMeldung: (m: string, fehler: boolean) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button class="knopf gross primaer" onClick={() => input.current?.click()}>
        {props.text}
      </button>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={async (e) => {
          const el = e.target as HTMLInputElement;
          const f = el.files?.[0];
          el.value = '';
          if (!f) return;
          try {
            props.onMeldung(await projektdateiEinlesen(await f.text()), false);
          } catch (err) {
            props.onMeldung((err as Error).message, true);
          }
        }}
      />
    </>
  );
}

export function Start() {
  const [meldung, setMeldung] = useState<{ text: string; fehler: boolean } | null>(null);
  const melde = (text: string, fehler: boolean) => setMeldung({ text, fehler });
  return (
    <div>
      <Kopf titel="Aufnahme Heizkörper" unter="Projekt wählen" rechts={
        <button class="kopf-knopf" onClick={() => gehe({ name: 'einstellungen' })}>⚙︎</button>
      } />
      <main class="inhalt">
        {meldung && <Hinweis art={meldung.fehler ? 'fehler' : 'info'}>{meldung.text}</Hinweis>}
        {S.projekte.length > 0 && <h2>Projekte auf diesem Gerät</h2>}
        <div class="liste">
          {S.projekte.map((p) => (
            <button key={p.projekt_id} class="karte" onClick={() => void projektOeffnen(p.projekt_id)}>
              <div class="karte-titel">{p.name}</div>
              <div class="karte-zeile">
                {p.projekt_id} · {p.einheiten.length} Einheiten · Projektdatei vom {formatZeit(p.importiert_am)}
              </div>
            </button>
          ))}
        </div>
        <h2>Projekt laden</h2>
        <DateiLaden text="Projektdatei (JSON) laden" onMeldung={melde} />
        <button
          class="knopf gross"
          onClick={async () => {
            try {
              melde(await projektdateiEinlesen(JSON.stringify(beispiel)), false);
            } catch (err) {
              melde((err as Error).message, true);
            }
          }}
        >
          Beispielprojekt laden (zum Testen)
        </button>
        <Hinweis>
          Alle Daten bleiben bis zum Export auf diesem iPad. Ohne Netz funktioniert die App, sobald sie einmal online
          geöffnet und über „Teilen → Zum Home-Bildschirm“ installiert wurde.
        </Hinweis>
      </main>
    </div>
  );
}
