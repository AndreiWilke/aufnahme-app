import type { Anschluss, FotoRolle, HfArt, Heizflaeche, Lage } from '../model';
import {
  ANSCHLUSS_TEXT,
  ART_TEXT,
  GLIEDERZAHLEN,
  LAGE_TEXT,
  TYPEN,
  VENTIL_HERSTELLER,
  VOREINSTELLUNGEN,
  standardHoehen,
  standardLaengen,
  standardTiefen,
} from '../model';
import { aendern, fotosEntfernen, fotosVon, gehe, planEinheit, S } from '../store';
import { fotoPraefix } from '../fotos';
import { Feld, FotoLeiste, Hinweis, JaNein, Kopf, StatusSchalter, Tasten, TextFeld, WahlMess, WahlText, WahlZahl, ZahlFeld } from './common';
import { HilfeKnopf } from './hilfe';
import { fensterAufnehmen, heizflaecheAnlegen, raumFertig } from './raum';

const ARTEN = Object.keys(ART_TEXT) as HfArt[];
const ANSCHLUESSE = Object.keys(ANSCHLUSS_TEXT) as Anschluss[];
const LAGEN = Object.keys(LAGE_TEXT) as Lage[];

export function HfSeite(props: { eid: string; rid: string; hfid: string }) {
  const a = S.aufnahmen.get(props.eid)!;
  const r = a.raeume.find((x) => x.raum_id === props.rid)!;
  const h = r.heizflaechen.find((x) => x.hf_id === props.hfid)!;
  const pe = planEinheit(props.eid);

  const set = (fn: (x: Heizflaeche) => void) =>
    aendern(a.einheit_id, (au, jetzt) => {
      const rr = au.raeume.find((q) => q.raum_id === r.raum_id)!;
      const x = rr.heizflaechen.find((q) => q.hf_id === h.hf_id)!;
      fn(x);
      x.geaendert_am = jetzt;
      rr.geaendert_am = jetzt;
    });

  const fotoZiel = (rolle: FotoRolle) => ({
    eid: a.einheit_id,
    praefix: fotoPraefix(a, { art: 'hf', raumNr: r.nr, raumName: r.name, hfNr: h.nr, rolle }),
    rolle,
    bezug_id: h.hf_id,
    eintragen: (au: typeof a, name: string, jetzt: string) => {
      const x = au.raeume.find((q) => q.raum_id === r.raum_id)!.heizflaechen.find((q) => q.hf_id === h.hf_id)!;
      x.fotos.push(name);
      x.geaendert_am = jetzt;
    },
  });

  const fbh = h.art === 'fussbodenheizung';
  const glieder = h.art === 'glieder' || h.art === 'roehren';
  const nische = h.nische_vorhanden ?? (h.nische_mm.breite !== null || h.nische_mm.hoehe !== null);

  return (
    <div>
      <Kopf
        titel={`HK${h.nr} · ${r.nr} ${r.name}`}
        unter={`${pe?.bezeichnung ?? a.einheit_id}${a.aufgenommen_bezeichnung !== pe?.bezeichnung ? ' → ' + a.aufgenommen_bezeichnung : ''}`}
        zurueck={() => gehe({ name: 'raum', eid: a.einheit_id, rid: r.raum_id })}
        rechts={<HilfeKnopf />}
      />
      <main class="inhalt">
        <Hinweis>Keine Personen fotografieren. Fotos landen nicht in der Fotomediathek – Sicherung ist der Export.</Hinweis>
        <FotoLeiste titel="Foto Front" fotos={fotosVon(a.einheit_id, h.hf_id, 'Front')} ziel={fotoZiel('Front')} />
        {!fbh && (
          <FotoLeiste
            titel="Foto Ventil"
            hinweis="Thermostatkopf abnehmen, Ventilunterteil mit Prägung und Voreinstellung formatfüllend fotografieren."
            fotos={fotosVon(a.einheit_id, h.hf_id, 'Ventil')}
            ziel={fotoZiel('Ventil')}
          />
        )}
        <FotoLeiste titel="Foto Seite/Typ" fotos={fotosVon(a.einheit_id, h.hf_id, 'Seite')} ziel={fotoZiel('Seite')} />
        <FotoLeiste titel="Weitere Fotos" fotos={fotosVon(a.einheit_id, h.hf_id, 'Weitere')} ziel={fotoZiel('Weitere')} />

        <Feld titel="Art">
          <Tasten werte={ARTEN} wert={h.art} text={(w) => ART_TEXT[w]} onWahl={(w) => set((x) => (x.art = w))} />
        </Feld>

        {h.art === 'platte' && (
          <Feld titel="Typ">
            <Tasten werte={TYPEN} wert={h.typ} onWahl={(w) => set((x) => (x.typ = w))} />
          </Feld>
        )}

        {!fbh && (
          <>
            <Feld titel="Bauhöhe (mm)">
              <WahlMess wert={h.bauhoehe_mm} werte={standardHoehen(h.art)} einheit="mm" onAendern={(m) => set((x) => (x.bauhoehe_mm = m))} />
            </Feld>
            <Feld titel="Baulänge (mm)">
              <WahlMess wert={h.baulaenge_mm} werte={standardLaengen(h.art)} einheit="mm" onAendern={(m) => set((x) => (x.baulaenge_mm = m))} />
            </Feld>
            <Feld titel="Bautiefe (mm)">
              <WahlMess wert={h.bautiefe_mm} werte={standardTiefen(h.art)} einheit="mm" onAendern={(m) => set((x) => (x.bautiefe_mm = m))} />
            </Feld>
            {glieder && (
              <Feld titel="Gliederzahl">
                <WahlZahl wert={h.gliederzahl} werte={GLIEDERZAHLEN} onAendern={(n) => set((x) => (x.gliederzahl = n))} />
              </Feld>
            )}
            <Feld titel="Anschluss">
              <Tasten werte={ANSCHLUESSE} wert={h.anschluss} text={(w) => ANSCHLUSS_TEXT[w]} onWahl={(w) => set((x) => (x.anschluss = w))} />
            </Feld>
          </>
        )}

        <div class="block">
          <h3>Ventil</h3>
          <Feld titel="Hersteller/Prägung">
            <WahlText wert={h.ventil.hersteller_text} werte={VENTIL_HERSTELLER} platzhalter="z. B. Heimeier V-exakt" onAendern={(s) => set((x) => (x.ventil.hersteller_text = s))} />
          </Feld>
          <Feld titel="Voreinstellung ablesbar">
            <JaNein wert={h.ventil.voreinstellung_ablesbar} onWahl={(w) => set((x) => (x.ventil.voreinstellung_ablesbar = w))} />
          </Feld>
          {h.ventil.voreinstellung_ablesbar === true && (
            <Feld titel="Abgelesener Wert">
              <WahlText wert={h.ventil.voreinstellung_wert} werte={VOREINSTELLUNGEN} platzhalter="z. B. 4,5" onAendern={(s) => set((x) => (x.ventil.voreinstellung_wert = s))} />
            </Feld>
          )}
          <Feld titel="Thermostatkopf vorhanden">
            <JaNein wert={h.ventil.thermostatkopf} onWahl={(w) => set((x) => (x.ventil.thermostatkopf = w))} />
          </Feld>
        </div>

        <Feld titel="Lage">
          <Tasten werte={LAGEN} wert={h.lage} text={(w) => LAGE_TEXT[w]} onWahl={(w) => set((x) => (x.lage = w))} />
        </Feld>

        {!fbh && (
          <Feld titel="Nische vorhanden">
            <div class="tasten">
              <button
                class={`taste ${nische ? 'aktiv' : ''}`}
                onClick={() => set((x) => (x.nische_vorhanden = true))}
              >
                ja
              </button>
              <button
                class={`taste ${nische ? '' : 'aktiv'}`}
                onClick={() =>
                  set((x) => {
                    x.nische_vorhanden = false;
                    x.nische_mm = { breite: null, hoehe: null, status: null };
                  })
                }
              >
                nein
              </button>
            </div>
          </Feld>
        )}

        {!fbh && nische && (
          <Feld titel="Nische Breite × Höhe">
            <div class="reihe">
              <ZahlFeld
                wert={h.nische_mm.breite}
                ganzzahl
                einheit="mm"
                platzhalter="Breite"
                onAendern={(n) =>
                  set((x) => {
                    x.nische_mm.breite = n;
                    x.nische_mm.status = x.nische_mm.breite === null && x.nische_mm.hoehe === null ? null : (x.nische_mm.status ?? 'gemessen');
                  })
                }
              />
              <span class="mal">×</span>
              <ZahlFeld
                wert={h.nische_mm.hoehe}
                ganzzahl
                einheit="mm"
                platzhalter="Höhe"
                onAendern={(n) =>
                  set((x) => {
                    x.nische_mm.hoehe = n;
                    x.nische_mm.status = x.nische_mm.breite === null && x.nische_mm.hoehe === null ? null : (x.nische_mm.status ?? 'gemessen');
                  })
                }
              />
            </div>
            <StatusSchalter
              status={h.nische_mm.status}
              aktiv={h.nische_mm.breite !== null || h.nische_mm.hoehe !== null}
              onWahl={(s) => set((x) => (x.nische_mm.status = s))}
            />
          </Feld>
        )}

        <Feld titel="Notiz" hinweis="Diktat über das Mikrofon der Tastatur.">
          <TextFeld mehrzeilig wert={h.notiz} onAendern={(s) => set((x) => (x.notiz = s))} />
        </Feld>

        <div class="knopfspalte">
          <button class="knopf gross" onClick={() => heizflaecheAnlegen(a.einheit_id, r.raum_id, h)}>
            Gleicher Heizkörper nochmal
          </button>
          <button class="knopf gross" onClick={() => heizflaecheAnlegen(a.einheit_id, r.raum_id)}>
            Nächste Heizfläche
          </button>
          <button class="knopf gross primaer" onClick={() => fensterAufnehmen(a.einheit_id, r.raum_id)}>
            Weiter zu den Fenstern
          </button>
          <button class="knopf gross" onClick={() => raumFertig(a.einheit_id, r.raum_id)}>
            Raum fertig → nächster Raum
          </button>
        </div>

        <button
          class="knopf gefahr"
          onClick={async () => {
            const fotos = fotosVon(a.einheit_id, h.hf_id);
            if (!confirm(`HK${h.nr} mit ${fotos.length} Fotos löschen?`)) return;
            await fotosEntfernen(a.einheit_id, fotos.map((f) => f.foto_id));
            aendern(a.einheit_id, (au, jetzt) => {
              const rr = au.raeume.find((q) => q.raum_id === r.raum_id)!;
              rr.heizflaechen = rr.heizflaechen.filter((q) => q.hf_id !== h.hf_id);
              rr.geaendert_am = jetzt;
            });
            gehe({ name: 'raum', eid: a.einheit_id, rid: r.raum_id });
          }}
        >
          Heizfläche löschen
        </button>
      </main>
    </div>
  );
}
