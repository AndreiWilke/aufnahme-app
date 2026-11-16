import type { EinheitAufnahme, PlanEinheit } from '../model';
import { STATUS_TEXT } from '../model';
import { fotosDerEinheit, gehe, projektSchliessen, S } from '../store';
import { hatUnexportierteAenderungen } from '../export';
import { formatDatum, formatZeit } from '../util';
import { Hinweis, Kopf } from './common';

export function fortschritt(a: EinheitAufnahme) {
  const vorhanden = a.raeume.filter((r) => r.zustand === 'vorhanden');
  return {
    erledigt: vorhanden.filter((r) => r.erledigt).length,
    gesamt: vorhanden.length,
    hk: a.raeume.reduce((s, r) => s + r.heizflaechen.length, 0),
  };
}

const ART_KURZ: Record<PlanEinheit['art'], string> = {
  wohnung: 'Wohnung',
  gewerbe: 'Gewerbe',
  heizzentrale: 'Heizzentrale',
  allgemein: 'Allgemeinflächen',
};

export function einheitOeffnen(pe: PlanEinheit) {
  if (pe.art === 'heizzentrale') gehe({ name: 'hz', eid: pe.einheit_id });
  else gehe({ name: 'einheit', eid: pe.einheit_id });
}

export function EinheitKarte(props: { pe: PlanEinheit; a: EinheitAufnahme }) {
  const { pe, a } = props;
  const f = fortschritt(a);
  const fotos = fotosDerEinheit(a.einheit_id);
  const offenFotos = fotos.filter((x) => !x.exportiert_am).length;
  const unexp = hatUnexportierteAenderungen(a) || offenFotos > 0;
  const ersatz = a.aufgenommen_bezeichnung !== pe.bezeichnung;
  return (
    <button class={`karte einheit status-${a.status} ${unexp ? 'unexportiert' : ''}`} onClick={() => einheitOeffnen(pe)}>
      <div class="karte-kopf">
        <span class="karte-zeit">{pe.uhrzeit || '–'}</span>
        <span class="karte-titel">
          {pe.bezeichnung}
          {ersatz && <span class="ersatz"> → {a.aufgenommen_bezeichnung}</span>}
          {pe.dauer_min ? <span class="karte-dauer"> · {pe.dauer_min} min</span> : null}
        </span>
        <span class={`status-chip status-${a.status}`}>{STATUS_TEXT[a.status]}</span>
      </div>
      <div class="karte-zeile">
        {pe.einheit_id}
        {pe.eh !== null && ` · EH ${pe.eh}`}
        {pe.geschoss && ` · ${pe.geschoss}`} · {ART_KURZ[pe.art]}
      </div>
      <div class="karte-zeile">
        {pe.art === 'heizzentrale'
          ? `${a.heizzentrale?.punkte.filter((p) => p.geaendert_am).length ?? 0}/${a.heizzentrale?.punkte.length ?? 0} Punkte · ${a.heizzentrale?.abgaenge.length ?? 0} Abgänge`
          : `Räume ${f.erledigt}/${f.gesamt} · ${f.hk} Heizflächen`}{' '}
        · {fotos.length} Fotos
      </div>
      {unexp ? (
        <div class="karte-export warn">
          ● nicht exportierte Änderungen{offenFotos ? ` (${offenFotos} Fotos)` : ''}
          {a.letzter_export && ` · letzter Export ${formatZeit(a.letzter_export)}`}
        </div>
      ) : (
        a.letzter_export && <div class="karte-export ok">✓ exportiert {formatZeit(a.letzter_export)}</div>
      )}
      {(a.im_plan_entfallen || pe.hinweis) && <div class="karte-zeile hinweis-text">{pe.hinweis}</div>}
    </button>
  );
}

export function gruppiertNachTag(einheiten: PlanEinheit[]): [string, PlanEinheit[]][] {
  const g = new Map<string, PlanEinheit[]>();
  for (const e of einheiten) {
    const k = e.datum || '';
    if (!g.has(k)) g.set(k, []);
    g.get(k)!.push(e);
  }
  const tage = [...g.entries()].sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)));
  // Gleiche Uhrzeit (z. B. Heizzentrale und Allgemeinflächen): Reihenfolge der Projektdatei behalten.
  const platz = new Map(einheiten.map((e, i) => [e.einheit_id, i]));
  for (const [, l] of tage)
    l.sort((x, y) => (x.uhrzeit || '99').localeCompare(y.uhrzeit || '99') || platz.get(x.einheit_id)! - platz.get(y.einheit_id)!);
  return tage;
}

export function ProjektSeite() {
  const p = S.projekt!;
  const tage = gruppiertNachTag(p.einheiten);
  return (
    <div>
      <Kopf
        titel={p.name}
        unter={`${p.einheiten.length} Einheiten · ${p.einheiten.reduce((s, e) => s + e.raeume.length, 0)} Räume laut Plan`}
        zurueck={projektSchliessen}
        rechts={<button class="kopf-knopf" onClick={() => gehe({ name: 'einstellungen' })}>⚙︎</button>}
      />
      <main class="inhalt">
        {(p.warnungen?.length ?? 0) > 0 && (
          <Hinweis art="warn">
            Projektdatei mit {p.warnungen!.length} Warnungen geladen: {p.warnungen!.slice(0, 3).join(' ')}
            {p.warnungen!.length > 3 && ' …'}
          </Hinweis>
        )}
        {p.hinweis && <Hinweis>{p.hinweis}</Hinweis>}
        {tage.map(([tag, liste]) => {
          const fertig = liste.filter((e) => {
            const s = S.aufnahmen.get(e.einheit_id)?.status;
            return s === 'fertig' || s === 'nicht_angetroffen';
          }).length;
          return (
            <section key={tag}>
              <h2 class="tag-titel">
                {tag ? formatDatum(tag) : 'ohne Termin'}
                <span class="tag-zaehler">
                  {fertig}/{liste.length} erledigt
                </span>
              </h2>
              <div class="liste">
                {liste.map((pe) => {
                  const a = S.aufnahmen.get(pe.einheit_id);
                  return a ? <EinheitKarte key={pe.einheit_id} pe={pe} a={a} /> : null;
                })}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
