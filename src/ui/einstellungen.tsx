import { useEffect, useState } from 'preact/hooks';
import { APP_VERSION } from '../model';
import { gehe, projektEntfernen, S, unexportierteEinheiten, unexportierteFotos } from '../store';
import { formatBytes, formatZeit } from '../util';
import { Hinweis, Kopf } from './common';
import { DateiLaden } from './start';
import { lasttestErzeugen, LASTTEST_ID } from '../lasttest';

export function EinstellungenSeite() {
  const [speicher, setSpeicher] = useState<{ belegt: number; frei: number } | null>(null);
  const [persist, setPersist] = useState<boolean | null>(S.persistiert);
  const [meldung, setMeldung] = useState<{ text: string; fehler: boolean } | null>(null);
  const [last, setLast] = useState<string | null>(null);

  const messen = async () => {
    if (navigator.storage?.estimate) {
      const e = await navigator.storage.estimate();
      setSpeicher({ belegt: e.usage ?? 0, frei: e.quota ?? 0 });
    }
    if (navigator.storage?.persisted) setPersist(await navigator.storage.persisted());
  };
  useEffect(() => {
    void messen();
  }, []);

  const p = S.projekt;
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

  return (
    <div>
      <Kopf titel="Einstellungen" zurueck={() => gehe(p ? { name: 'projekt' } : { name: 'start' })} />
      <main class="inhalt">
        {meldung && <Hinweis art={meldung.fehler ? 'fehler' : 'info'}>{meldung.text}</Hinweis>}

        <div class="block">
          <h3>Speicher</h3>
          <div>Belegt: {speicher ? formatBytes(speicher.belegt) : '…'}</div>
          <div>Verfügbar für die App: {speicher ? formatBytes(speicher.frei) : '…'}</div>
          <div>
            Dauerhafter Speicher:{' '}
            {persist === null ? 'unbekannt' : persist ? <strong class="ok-text">gewährt</strong> : <strong class="warn-text">nicht gewährt</strong>}
          </div>
          <div>Als Home-Bildschirm-App gestartet: {standalone ? 'ja' : <strong class="warn-text">nein</strong>}</div>
          {!persist && (
            <button
              class="knopf"
              onClick={async () => {
                if (navigator.storage?.persist) S.persistiert = await navigator.storage.persist();
                await messen();
              }}
            >
              Dauerhaften Speicher anfordern
            </button>
          )}
          <Hinweis>
            Safari kann Daten von Web-Apps löschen, die lange nicht genutzt wurden. Als Home-Bildschirm-App mit dauerhaftem Speicher ist
            das Risiko gering. Die Sicherung ist trotzdem immer der Export.
          </Hinweis>
        </div>

        {p && (
          <div class="block">
            <h3>Projekt {p.name}</h3>
            <div>
              {p.projekt_id} · Projektdatei vom {formatZeit(p.importiert_am)}
            </div>
            <div>
              {S.fotos.size} Fotos · {unexportierteFotos()} nicht exportiert · {unexportierteEinheiten()} Einheiten mit nicht exportierten
              Änderungen
            </div>
            <DateiLaden text="Neuere Projektdatei einspielen" onMeldung={(text, fehler) => setMeldung({ text, fehler })} />
            <div class="feld-hinweis">Vorhandene Aufnahmen bleiben erhalten. Zuordnung über Einheiten- und Raum-ID.</div>
            <button
              class="knopf gefahr"
              onClick={async () => {
                const f = unexportierteFotos();
                const e = unexportierteEinheiten();
                const warnung = f + e > 0 ? `\n\nACHTUNG: ${f} Fotos und ${e} Einheiten sind NICHT exportiert und gehen verloren.` : '';
                if (!confirm(`Projekt „${p.name}“ mit allen Aufnahmen und ${S.fotos.size} Fotos von diesem Gerät löschen?${warnung}`)) return;
                const eingabe = prompt(`Zur Bestätigung die Projekt-ID „${p.projekt_id}“ eintippen:`);
                if (eingabe !== p.projekt_id) {
                  setMeldung({ text: 'Nicht gelöscht.', fehler: false });
                  return;
                }
                await projektEntfernen(p.projekt_id);
              }}
            >
              Projekt von diesem Gerät löschen
            </button>
          </div>
        )}

        <div class="block">
          <h3>Last-Test</h3>
          <div class="feld-hinweis">
            Legt ein eigenes Testprojekt „{LASTTEST_ID}“ mit 10 Einheiten und 300 Testfotos an. Dauert einige Minuten. Danach Export je Einheit
            prüfen und das Testprojekt wieder löschen.
          </div>
          <button
            class="knopf"
            disabled={!!last}
            onClick={async () => {
              if (S.projekte.some((x) => x.projekt_id === LASTTEST_ID)) {
                setMeldung({ text: 'Testprojekt existiert schon. Bitte zuerst löschen.', fehler: true });
                return;
              }
              const t0 = Date.now();
              try {
                await lasttestErzeugen(300, (n) => setLast(`${n} / 300 Fotos`));
                setMeldung({ text: `300 Testfotos in ${Math.round((Date.now() - t0) / 1000)} s erzeugt.`, fehler: false });
              } catch (e) {
                setMeldung({ text: `Last-Test abgebrochen: ${(e as Error).message}`, fehler: true });
              } finally {
                setLast(null);
                void messen();
              }
            }}
          >
            {last ?? '300 Testfotos erzeugen'}
          </button>
        </div>

        <div class="block">
          <h3>App</h3>
          <div>Version {APP_VERSION}</div>
          <button class="knopf" onClick={() => location.reload()}>
            Neu laden (Update holen)
          </button>
        </div>
      </main>
    </div>
  );
}
