import type { EinheitAufnahme, HzAbgang, HzPunkt, HzPunktDef } from '../model';
import { HZ_PUNKTE, STATUS_TEXT, type EinheitStatus } from '../model';
import { aendern, fotosEntfernen, fotosVon, gehe, planEinheit, S } from '../store';
import { fotoPraefix } from '../fotos';
import { uuid } from '../util';
import { Feld, FotoLeiste, Hinweis, JaNein, Kopf, MessFeld, Tasten, TextFeld } from './common';
import { statusSetzen } from './einheit';
import { neueHeizzentrale } from '../projekt';

function PunktBlock(props: { a: EinheitAufnahme; def: HzPunktDef; p: HzPunkt }) {
  const { a, def, p } = props;
  const set = (fn: (x: HzPunkt) => void) =>
    aendern(a.einheit_id, (au, jetzt) => {
      const x = au.heizzentrale!.punkte.find((q) => q.punkt_id === p.punkt_id)!;
      fn(x);
      x.geaendert_am = jetzt;
      au.heizzentrale!.geaendert_am = jetzt;
    });
  return (
    <div class={`block ${p.geaendert_am ? 'erfasst' : ''}`}>
      <h3>
        {p.geaendert_am ? '✓ ' : ''}
        {def.bezeichnung}
      </h3>
      {def.hinweis && <div class="feld-hinweis">{def.hinweis}</div>}
      {def.janein && (
        <Feld titel="vorhanden">
          <JaNein wert={p.vorhanden} onWahl={(w) => set((x) => (x.vorhanden = w))} />
        </Feld>
      )}
      {def.text && (
        <Feld titel={def.text}>
          {def.textVorschlaege && (
            <Tasten klein werte={def.textVorschlaege} wert={def.textVorschlaege.includes(p.text) ? p.text : null} onWahl={(w) => set((x) => (x.text = w ?? ''))} />
          )}
          <TextFeld wert={p.text} onAendern={(s) => set((x) => (x.text = s))} />
        </Feld>
      )}
      {def.zahl && (
        <Feld titel={def.zahl}>
          <MessFeld
            wert={{ wert: p.wert, status: p.status }}
            onAendern={(m) =>
              set((x) => {
                x.wert = m.wert;
                x.status = m.status;
              })
            }
          />
        </Feld>
      )}
      <FotoLeiste
        titel="Foto"
        fotos={fotosVon(a.einheit_id, p.punkt_id)}
        ziel={{
          eid: a.einheit_id,
          praefix: fotoPraefix(a, { art: 'hz_punkt', kurz: def.kurz }),
          rolle: 'HZ',
          bezug_id: p.punkt_id,
          eintragen: (au, name, jetzt) => {
            const x = au.heizzentrale!.punkte.find((q) => q.punkt_id === p.punkt_id)!;
            x.fotos.push(name);
            x.geaendert_am = jetzt;
            au.heizzentrale!.geaendert_am = jetzt;
          },
        }}
      />
      <Feld titel="Notiz">
        <TextFeld wert={p.notiz} onAendern={(s) => set((x) => (x.notiz = s))} />
      </Feld>
    </div>
  );
}

function AbgangBlock(props: { a: EinheitAufnahme; g: HzAbgang }) {
  const { a, g } = props;
  const set = (fn: (x: HzAbgang) => void) =>
    aendern(a.einheit_id, (au, jetzt) => {
      const x = au.heizzentrale!.abgaenge.find((q) => q.abgang_id === g.abgang_id)!;
      fn(x);
      x.geaendert_am = jetzt;
      au.heizzentrale!.geaendert_am = jetzt;
    });
  const ziel = (rolle: 'Abgang' | 'Pumpe' | 'Mischer') => ({
    eid: a.einheit_id,
    praefix: fotoPraefix(a, { art: 'hz_abgang', nr: g.nr, rolle }),
    rolle: 'HZ' as const,
    bezug_id: g.abgang_id,
    eintragen: (au: EinheitAufnahme, name: string, jetzt: string) => {
      const x = au.heizzentrale!.abgaenge.find((q) => q.abgang_id === g.abgang_id)!;
      x.fotos.push(name);
      x.geaendert_am = jetzt;
      au.heizzentrale!.geaendert_am = jetzt;
    },
  });
  const fotos = fotosVon(a.einheit_id, g.abgang_id);
  const nachTeil = (t: string) => fotos.filter((f) => new RegExp(`^HZ_Abgang${g.nr}${t}_\\d+\\.jpg$`).test(f.dateiname));
  return (
    <div class="block">
      <div class="block-kopf">
        <h3>Abgang {g.nr}</h3>
        <button
          class="knopf klein gefahr"
          onClick={async () => {
            if (!confirm(`Abgang ${g.nr} mit ${fotos.length} Fotos löschen?`)) return;
            await fotosEntfernen(a.einheit_id, fotos.map((f) => f.foto_id));
            aendern(a.einheit_id, (au, jetzt) => {
              au.heizzentrale!.abgaenge = au.heizzentrale!.abgaenge.filter((q) => q.abgang_id !== g.abgang_id);
              au.heizzentrale!.geaendert_am = jetzt;
            });
          }}
        >
          Entfernen
        </button>
      </div>
      <Feld titel="Bezeichnung">
        <TextFeld wert={g.bezeichnung} platzhalter="z. B. Heizkreis Nord, Lüftung" onAendern={(s) => set((x) => (x.bezeichnung = s))} />
      </Feld>
      <Feld titel="Pumpe">
        <JaNein wert={g.pumpe} onWahl={(w) => set((x) => (x.pumpe = w))} />
      </Feld>
      <Feld titel="Mischer mit Stellantrieb">
        <JaNein wert={g.mischer_stellantrieb} onWahl={(w) => set((x) => (x.mischer_stellantrieb = w))} />
      </Feld>
      <FotoLeiste titel="Foto Abgang" fotos={nachTeil('')} ziel={ziel('Abgang')} />
      {g.pumpe && <FotoLeiste titel="Foto Pumpe (Typenschild)" fotos={nachTeil('_Pumpe')} ziel={ziel('Pumpe')} />}
      {g.mischer_stellantrieb && <FotoLeiste titel="Foto Mischer/Stellantrieb" fotos={nachTeil('_Mischer')} ziel={ziel('Mischer')} />}
      <Feld titel="Notiz">
        <TextFeld wert={g.notiz} onAendern={(s) => set((x) => (x.notiz = s))} />
      </Feld>
    </div>
  );
}

const STATI: EinheitStatus[] = ['offen', 'in_arbeit', 'fertig', 'nicht_angetroffen'];

export function HzSeite(props: { eid: string }) {
  const a = S.aufnahmen.get(props.eid)!;
  const pe = planEinheit(props.eid);
  if (!a.heizzentrale) {
    return (
      <main class="inhalt">
        <button class="knopf gross primaer" onClick={() => aendern(a.einheit_id, (au) => (au.heizzentrale = neueHeizzentrale()), { statusAutomatisch: false })}>
          Checkliste Heizzentrale anlegen
        </button>
      </main>
    );
  }
  const hz = a.heizzentrale;
  const erfasst = hz.punkte.filter((p) => p.geaendert_am).length;
  return (
    <div>
      <Kopf titel={pe?.bezeichnung ?? 'Heizzentrale'} unter={`${a.einheit_id} · Checkliste ${erfasst}/${hz.punkte.length}`} zurueck={() => gehe({ name: 'projekt' })} />
      <main class="inhalt">
        <Feld titel="Status">
          <Tasten werte={STATI} wert={a.status} text={(s) => STATUS_TEXT[s]} abwaehlbar={false} onWahl={(s) => s && statusSetzen(a.einheit_id, s)} />
        </Feld>
        <Hinweis>Keine Personen fotografieren.</Hinweis>
        {HZ_PUNKTE.slice(0, 1).map((def) => {
          const p = hz.punkte.find((x) => x.punkt_id === def.punkt_id);
          return p ? <PunktBlock key={def.punkt_id} a={a} def={def} p={p} /> : null;
        })}
        <h2>Abgänge am Verteiler</h2>
        {hz.abgaenge.map((g) => (
          <AbgangBlock key={g.abgang_id} a={a} g={g} />
        ))}
        <button
          class="knopf gross"
          onClick={() =>
            aendern(a.einheit_id, (au, jetzt) => {
              const h = au.heizzentrale!;
              const nr = h.abgaenge.reduce((m, x) => Math.max(m, x.nr), 0) + 1;
              h.abgaenge.push({ abgang_id: uuid(), nr, bezeichnung: '', pumpe: null, mischer_stellantrieb: null, notiz: '', fotos: [], geaendert_am: jetzt });
              h.geaendert_am = jetzt;
            })
          }
        >
          + Abgang
        </button>
        <h2>Checkliste</h2>
        {HZ_PUNKTE.slice(1).map((def) => {
          const p = hz.punkte.find((x) => x.punkt_id === def.punkt_id);
          return p ? <PunktBlock key={def.punkt_id} a={a} def={def} p={p} /> : null;
        })}
        <Feld titel="Notiz zur Heizzentrale">
          <TextFeld mehrzeilig wert={a.notiz} onAendern={(s) => aendern(a.einheit_id, (x) => (x.notiz = s))} />
        </Feld>
        <div class="knopfreihe">
          <button class="knopf" onClick={() => gehe({ name: 'export', eid: a.einheit_id })}>
            Heizzentrale exportieren
          </button>
          <button
            class="knopf primaer"
            onClick={() => {
              statusSetzen(a.einheit_id, 'fertig');
              gehe({ name: 'projekt' });
            }}
          >
            Heizzentrale fertig
          </button>
        </div>
      </main>
    </div>
  );
}
