import { useState } from 'preact/hooks';
import type { EinheitAufnahme, FotoMeta } from '../model';
import { fotoBlobLaden, exportMarkieren } from '../db';
import { fotoNichtExportiert, hatUnexportierteAenderungen, zipErstellen, type ExportArt, type ExportErgebnis } from '../export';
import { fotosDerEinheit, gehe, melden, S } from '../store';
import { formatBytes, formatDatum, formatZeit } from '../util';
import { exportMaengel } from '../pruefung';
import { Feld, Hinweis, Kopf, Tasten } from './common';
import { einheitOeffnen, gruppiertNachTag } from './projekt';

type Umfang = { art: 'einheit'; eid: string } | { art: 'tag'; tag: string } | { art: 'alle' };

const WARN_GROESSE = 300 * 1024 * 1024;

function umfangEinheiten(u: Umfang): EinheitAufnahme[] {
  const p = S.projekt!;
  const ids =
    u.art === 'einheit'
      ? [u.eid]
      : u.art === 'tag'
        ? p.einheiten.filter((e) => (e.datum || '') === u.tag).map((e) => e.einheit_id)
        : p.einheiten.map((e) => e.einheit_id);
  return ids.map((id) => S.aufnahmen.get(id)).filter((a): a is EinheitAufnahme => !!a);
}

function auswahl(u: Umfang, art: ExportArt): { aufnahmen: EinheitAufnahme[]; fotos: FotoMeta[] } {
  const alle = umfangEinheiten(u);
  const aufnahmen =
    art === 'komplett'
      ? alle
      : alle.filter((a) => hatUnexportierteAenderungen(a) || fotosDerEinheit(a.einheit_id).some(fotoNichtExportiert));
  const fotos = aufnahmen.flatMap((a) => fotosDerEinheit(a.einheit_id)).filter((f) => art === 'komplett' || fotoNichtExportiert(f));
  fotos.sort((x, y) => x.einheit_id.localeCompare(y.einheit_id) || x.dateiname.localeCompare(y.dateiname));
  return { aufnahmen, fotos };
}

function umfangText(u: Umfang): { lang: string; kurz: string } {
  if (u.art === 'einheit') {
    const pe = S.projekt!.einheiten.find((e) => e.einheit_id === u.eid);
    return { lang: `Einheit ${u.eid}${pe ? ' – ' + pe.bezeichnung : ''}`, kurz: u.eid };
  }
  if (u.art === 'tag') return { lang: `Begehungstag ${u.tag ? formatDatum(u.tag) : 'ohne Termin'}`, kurz: u.tag || 'ohne-Termin' };
  return { lang: 'Gesamtes Projekt', kurz: 'alle' };
}

async function exportAbschliessen(erg: ExportErgebnis, aufnahmen: EinheitAufnahme[]) {
  for (const a of aufnahmen) a.letzter_export = erg.exportZeit;
  const metas = erg.fotosExportiert.map((m) => ({ ...m, exportiert_am: m.exportiert_am ?? erg.exportZeit }));
  await exportMarkieren(aufnahmen, metas);
  for (const m of metas) S.fotos.set(m.foto_id, m);
  melden();
}

export function ExportSeite(props: { eid?: string }) {
  const p = S.projekt!;
  const [umfang, setUmfang] = useState<Umfang>(props.eid ? { art: 'einheit', eid: props.eid } : { art: 'tag', tag: p.einheiten[0]?.datum ?? '' });
  const [art, setArt] = useState<ExportArt>('delta');
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [fertig, setFertig] = useState<{ erg: ExportErgebnis; aufnahmen: EinheitAufnahme[] } | null>(null);
  const [meldung, setMeldung] = useState<{ text: string; art: 'info' | 'warn' | 'fehler' } | null>(null);

  const { aufnahmen, fotos } = auswahl(umfang, art);
  const groesse = fotos.reduce((s, f) => s + f.groesse, 0);
  const maengel = exportMaengel(aufnahmen);
  const anzahlMaengel = maengel.reduce((s, m) => s + m.maengel.length, 0);
  const tage = gruppiertNachTag(p.einheiten);
  const ut = umfangText(umfang);

  const erstellen = async () => {
    setMeldung(null);
    setFertig(null);
    if (aufnahmen.length === 0) {
      setMeldung({ text: 'Keine neuen Änderungen in diesem Umfang. Nichts zu exportieren.', art: 'info' });
      return;
    }
    setLaeuft('ZIP wird erstellt …');
    try {
      const erg = await zipErstellen({
        projekt: p,
        aufnahmen,
        fotos,
        art,
        umfang: ut.lang,
        umfangKurz: ut.kurz,
        fotoLaden: async (id) => (await fotoBlobLaden(id))?.blob,
        fortschritt: (n, g) => setLaeuft(`ZIP wird erstellt … Foto ${n} von ${g}`),
      });
      setFertig({ erg, aufnahmen });
      if (erg.fehlendeFotos.length)
        setMeldung({ text: `${erg.fehlendeFotos.length} Fotos fehlen im Speicher: ${erg.fehlendeFotos.slice(0, 5).join(', ')}`, art: 'warn' });
    } catch (e) {
      setMeldung({ text: `Export fehlgeschlagen: ${(e as Error).message}`, art: 'fehler' });
    } finally {
      setLaeuft(null);
    }
  };

  const teilen = async () => {
    if (!fertig) return;
    const { erg } = fertig;
    const daten = { files: [erg.datei], title: erg.dateiname };
    if (navigator.canShare && navigator.canShare(daten)) {
      try {
        await navigator.share(daten);
        await exportAbschliessen(erg, fertig.aufnahmen);
        setMeldung({ text: `Exportiert: ${erg.dateiname}`, art: 'info' });
        setFertig(null);
      } catch (e) {
        if ((e as Error).name === 'AbortError') setMeldung({ text: 'Teilen abgebrochen. Der Export ist nicht als erledigt markiert.', art: 'warn' });
        else setMeldung({ text: `Teilen nicht möglich: ${(e as Error).message}. Bitte „Herunterladen“ nutzen.`, art: 'fehler' });
      }
    } else {
      setMeldung({ text: 'Teilen wird von diesem Browser nicht unterstützt. Bitte „Herunterladen“ nutzen.', art: 'warn' });
    }
  };

  const herunterladen = async () => {
    if (!fertig) return;
    const { erg } = fertig;
    const url = URL.createObjectURL(erg.datei);
    const el = document.createElement('a');
    el.href = url;
    el.download = erg.dateiname;
    document.body.appendChild(el);
    el.click();
    el.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    if (confirm('Wurde die Datei gespeichert? Dann wird der Export als erledigt markiert.')) {
      await exportAbschliessen(erg, fertig.aufnahmen);
      setMeldung({ text: `Exportiert: ${erg.dateiname}`, art: 'info' });
      setFertig(null);
    }
  };

  return (
    <div>
      <Kopf titel="Export" unter={p.name} zurueck={() => {
          const pe = props.eid ? p.einheiten.find((e) => e.einheit_id === props.eid) : undefined;
          if (pe) einheitOeffnen(pe);
          else gehe({ name: 'projekt' });
        }} />
      <main class="inhalt">
        <Feld titel="Umfang">
          <div class="tasten">
            {props.eid && (
              <button class={`taste ${umfang.art === 'einheit' ? 'aktiv' : ''}`} onClick={() => setUmfang({ art: 'einheit', eid: props.eid! })}>
                Einheit {props.eid}
              </button>
            )}
            {tage.map(([tag]) => (
              <button key={tag} class={`taste ${umfang.art === 'tag' && umfang.tag === tag ? 'aktiv' : ''}`} onClick={() => setUmfang({ art: 'tag', tag })}>
                {tag ? formatDatum(tag) : 'ohne Termin'}
              </button>
            ))}
            <button class={`taste ${umfang.art === 'alle' ? 'aktiv' : ''}`} onClick={() => setUmfang({ art: 'alle' })}>
              gesamtes Projekt
            </button>
          </div>
        </Feld>
        <Feld titel="Art">
          <Tasten
            werte={['delta', 'komplett'] as ExportArt[]}
            wert={art}
            abwaehlbar={false}
            text={(w) => (w === 'delta' ? 'neu seit letztem Export' : 'komplett')}
            onWahl={(w) => w && setArt(w)}
          />
        </Feld>

        <div class="block">
          <div>
            <strong>{ut.lang}</strong>
          </div>
          <div>
            {aufnahmen.length} Einheiten · {fotos.length} Fotos · ca. {formatBytes(groesse)}
          </div>
          {groesse > WARN_GROESSE && (
            <Hinweis art="warn">Sehr groß für den Arbeitsspeicher des Browsers. Besser je Einheit exportieren.</Hinweis>
          )}
        </div>

        {maengel.length > 0 && (
          <div class="block">
            <h3>Vor dem Export prüfen</h3>
            <Hinweis art="warn">
              {anzahlMaengel === 1 ? 'Eine Heizfläche ist' : `${anzahlMaengel} Heizflächen sind`} unvollständig. Der Export ist trotzdem möglich.
            </Hinweis>
            <div class="tabelle">
              {maengel.map((m) => (
                <button
                  key={m.raum_id}
                  class="tabellenzeile warn pruef-zeile"
                  onClick={() => gehe({ name: 'raum', eid: m.einheit_id, rid: m.raum_id })}
                >
                  <span>
                    {m.einheit_id} · {m.raum}
                    {m.erledigt ? ' (erledigt)' : ''}
                  </span>
                  <span>{m.maengel.map((x) => x.text).join(' · ')}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {meldung && <Hinweis art={meldung.art}>{meldung.text}</Hinweis>}

        {!fertig ? (
          <button class="knopf gross primaer" disabled={!!laeuft} onClick={erstellen}>
            {laeuft ?? 'ZIP erstellen'}
          </button>
        ) : (
          <div class="block">
            <div>
              <strong>{fertig.erg.dateiname}</strong> · {formatBytes(fertig.erg.datei.size)}
            </div>
            <button class="knopf gross primaer" onClick={teilen}>
              Teilen / In Dateien sichern
            </button>
            <button class="knopf gross" onClick={herunterladen}>
              Herunterladen
            </button>
            <div class="feld-hinweis">In der Teilen-Ansicht „In Dateien sichern“ wählen und den OneDrive-Ordner auswählen.</div>
          </div>
        )}

        <h2>Exportstand je Einheit</h2>
        <div class="tabelle">
          {p.einheiten.map((e) => {
            const a = S.aufnahmen.get(e.einheit_id);
            if (!a) return null;
            const offen = fotosDerEinheit(a.einheit_id).filter(fotoNichtExportiert).length;
            const unexp = hatUnexportierteAenderungen(a) || offen > 0;
            return (
              <div key={e.einheit_id} class={`tabellenzeile ${unexp ? 'warn' : ''}`}>
                <span>
                  {e.einheit_id} {e.bezeichnung}
                </span>
                <span>{unexp ? `● offen${offen ? ` (${offen} Fotos)` : ''}` : a.letzter_export ? '✓' : '–'}</span>
                <span>{a.letzter_export ? formatZeit(a.letzter_export) : 'nie exportiert'}</span>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
