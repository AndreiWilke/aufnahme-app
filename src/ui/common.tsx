import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { FotoMeta, MessStatus, Messwert } from '../model';
import { fotoAufnehmen, fotosEntfernen, gehe, S, thumbUrl, unexportierteFotos, unexportierteEinheiten, type FotoZiel } from '../store';
import { fotoBlobLaden } from '../db';
import { zahlOderNull } from '../util';

// ---------------- Kopfzeile ----------------

export function Kopf(props: { titel: string; unter?: string; zurueck?: () => void; rechts?: ComponentChildren }) {
  const fotos = unexportierteFotos();
  const einheiten = unexportierteEinheiten();
  return (
    <header class="kopf">
      {props.zurueck ? (
        <button class="kopf-zurueck" onClick={props.zurueck} aria-label="Zurück">
          ‹ Zurück
        </button>
      ) : (
        <span class="marke">Green Aktiv</span>
      )}
      <div class="kopf-titel">
        <div class="kopf-haupt">{props.titel}</div>
        {props.unter && <div class="kopf-unter">{props.unter}</div>}
      </div>
      {props.rechts}
      {S.projekt && (
        <button
          class={`kopf-status ${fotos + einheiten > 0 ? 'warn' : 'ok'}`}
          onClick={() => gehe({ name: 'export' })}
          title="Export"
        >
          {fotos + einheiten === 0
            ? '✓ alles exportiert'
            : fotos > 0
              ? `${fotos} Fotos nicht exportiert`
              : `${einheiten} Einheiten nicht exportiert`}
        </button>
      )}
      {S.speicherFehler && <div class="kopf-fehler">{S.speicherFehler}</div>}
    </header>
  );
}

// ---------------- Schnelltasten ----------------

export function Tasten<T extends string | number>(props: {
  werte: readonly T[];
  wert: T | null;
  text?: (w: T) => string;
  onWahl: (w: T | null) => void;
  abwaehlbar?: boolean;
  klein?: boolean;
}) {
  return (
    <div class={`tasten ${props.klein ? 'klein' : ''}`}>
      {props.werte.map((w) => (
        <button
          key={String(w)}
          class={`taste ${props.wert === w ? 'aktiv' : ''}`}
          onClick={() => props.onWahl(props.wert === w && props.abwaehlbar !== false ? null : w)}
        >
          {props.text ? props.text(w) : String(w)}
        </button>
      ))}
    </div>
  );
}

export function JaNein(props: { wert: boolean | null; onWahl: (w: boolean | null) => void }) {
  return (
    <div class="tasten">
      <button class={`taste ${props.wert === true ? 'aktiv' : ''}`} onClick={() => props.onWahl(props.wert === true ? null : true)}>
        ja
      </button>
      <button class={`taste ${props.wert === false ? 'aktiv' : ''}`} onClick={() => props.onWahl(props.wert === false ? null : false)}>
        nein
      </button>
    </div>
  );
}

export function Feld(props: { titel: string; children: ComponentChildren; hinweis?: string }) {
  return (
    <div class="feld">
      <div class="feld-titel">{props.titel}</div>
      {props.children}
      {props.hinweis && <div class="feld-hinweis">{props.hinweis}</div>}
    </div>
  );
}

// ---------------- Eingabefelder (Autosave bei jeder Eingabe) ----------------

export function TextFeld(props: {
  wert: string;
  onAendern: (s: string) => void;
  platzhalter?: string;
  mehrzeilig?: boolean;
}) {
  if (props.mehrzeilig)
    return (
      <textarea
        class="eingabe"
        rows={3}
        value={props.wert}
        placeholder={props.platzhalter}
        onInput={(e) => props.onAendern((e.target as HTMLTextAreaElement).value)}
      />
    );
  return (
    <input
      class="eingabe"
      type="text"
      value={props.wert}
      placeholder={props.platzhalter}
      onInput={(e) => props.onAendern((e.target as HTMLInputElement).value)}
    />
  );
}

/** Zahlenfeld mit numerischer Tastatur. Lokaler Text, damit Komma und Zwischenstände erhalten bleiben. */
export function ZahlFeld(props: {
  wert: number | null;
  onAendern: (n: number | null) => void;
  platzhalter?: string;
  einheit?: string;
  ganzzahl?: boolean;
  autoFokus?: boolean;
}) {
  const [text, setText] = useState(props.wert === null ? '' : String(props.wert).replace('.', ','));
  const fokus = useRef(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!fokus.current) setText(props.wert === null ? '' : String(props.wert).replace('.', ','));
  }, [props.wert]);
  useEffect(() => {
    if (props.autoFokus) ref.current?.focus();
  }, []);
  return (
    <div class="zahl">
      <input
        ref={ref}
        class="eingabe"
        type="text"
        inputMode={props.ganzzahl ? 'numeric' : 'decimal'}
        pattern={props.ganzzahl ? '[0-9]*' : undefined}
        value={text}
        placeholder={props.platzhalter}
        onFocus={() => (fokus.current = true)}
        onBlur={() => {
          fokus.current = false;
          setText(props.wert === null ? '' : String(props.wert).replace('.', ','));
        }}
        onInput={(e) => {
          const t = (e.target as HTMLInputElement).value;
          setText(t);
          props.onAendern(zahlOderNull(t));
        }}
      />
      {props.einheit && <span class="zahl-einheit">{props.einheit}</span>}
    </div>
  );
}

export function StatusSchalter(props: { status: MessStatus | null; aktiv: boolean; onWahl: (s: MessStatus) => void }) {
  const s = props.status ?? 'gemessen';
  return (
    <div class={`status-schalter ${props.aktiv ? '' : 'inaktiv'}`}>
      <button class={`taste klein ${s === 'gemessen' ? 'aktiv' : ''}`} disabled={!props.aktiv} onClick={() => props.onWahl('gemessen')}>
        gemessen
      </button>
      <button
        class={`taste klein ${s === 'geschätzt' ? 'aktiv geschaetzt' : ''}`}
        disabled={!props.aktiv}
        onClick={() => props.onWahl('geschätzt')}
      >
        geschätzt
      </button>
    </div>
  );
}

/** Zahlenfeld mit Datenstatus gemessen/geschätzt. */
export function MessFeld(props: {
  wert: Messwert;
  onAendern: (m: Messwert) => void;
  einheit?: string;
  platzhalter?: string;
  /** Standard: ganze Zahl. false erlaubt Dezimalstellen (Komma). */
  ganzzahl?: boolean;
}) {
  return (
    <div class={`messfeld ${props.wert.status === 'geschätzt' ? 'ist-geschaetzt' : ''}`}>
      <ZahlFeld
        wert={props.wert.wert}
        ganzzahl={props.ganzzahl !== false}
        einheit={props.einheit}
        platzhalter={props.platzhalter}
        onAendern={(n) =>
          props.onAendern(n === null ? { wert: null, status: null } : { wert: n, status: props.wert.status ?? 'gemessen' })
        }
      />
      <StatusSchalter
        status={props.wert.status}
        aktiv={props.wert.wert !== null}
        onWahl={(s) => props.onAendern({ wert: props.wert.wert, status: s })}
      />
    </div>
  );
}

/**
 * Messwert mit Standardwerten zum Antippen. „andere“ öffnet das Zahlenfeld für jeden beliebigen Wert.
 * Der Status gemessen/geschätzt bleibt immer am Wert.
 */
export function WahlMess(props: {
  wert: Messwert;
  werte: readonly number[];
  einheit?: string;
  onAendern: (m: Messwert) => void;
  /** Standard: ganze Zahl. false erlaubt Dezimalstellen (Komma). */
  ganzzahl?: boolean;
  /** Beschriftung der Tasten, z. B. 2,55 statt 2.55 */
  text?: (n: number) => string;
}) {
  const [offen, setOffen] = useState(false);
  const w = props.wert.wert;
  const andere = offen || (w !== null && !props.werte.includes(w));
  return (
    <div class={`wahl ${props.wert.status === 'geschätzt' ? 'ist-geschaetzt' : ''}`}>
      <div class="tasten">
        {props.werte.map((b) => (
          <button
            key={b}
            class={`taste ${!andere && w === b ? 'aktiv' : ''}`}
            onClick={() => {
              setOffen(false);
              props.onAendern(w === b && !andere ? { wert: null, status: null } : { wert: b, status: props.wert.status ?? 'gemessen' });
            }}
          >
            {props.text ? props.text(b) : b}
          </button>
        ))}
        <button class={`taste andere ${andere ? 'aktiv' : ''}`} onClick={() => setOffen(!andere)}>
          andere
        </button>
      </div>
      {andere && (
        <ZahlFeld
          wert={w}
          ganzzahl={props.ganzzahl !== false}
          autoFokus={offen}
          einheit={props.einheit}
          onAendern={(n) => props.onAendern(n === null ? { wert: null, status: null } : { wert: n, status: props.wert.status ?? 'gemessen' })}
        />
      )}
      <StatusSchalter status={props.wert.status} aktiv={w !== null} onWahl={(s) => props.onAendern({ wert: w, status: s })} />
    </div>
  );
}

/** Ganze Zahl mit Standardwerten zum Antippen, „andere“ für freie Eingabe. */
export function WahlZahl(props: { wert: number | null; werte: readonly number[]; einheit?: string; onAendern: (n: number | null) => void }) {
  const [offen, setOffen] = useState(false);
  const w = props.wert;
  const andere = offen || (w !== null && !props.werte.includes(w));
  return (
    <div class="wahl">
      <div class="tasten">
        {props.werte.map((b) => (
          <button
            key={b}
            class={`taste ${!andere && w === b ? 'aktiv' : ''}`}
            onClick={() => {
              setOffen(false);
              props.onAendern(w === b && !andere ? null : b);
            }}
          >
            {b}
          </button>
        ))}
        <button class={`taste andere ${andere ? 'aktiv' : ''}`} onClick={() => setOffen(!andere)}>
          andere
        </button>
      </div>
      {andere && <ZahlFeld wert={w} ganzzahl autoFokus={offen} einheit={props.einheit} onAendern={props.onAendern} />}
    </div>
  );
}

/** Text mit Vorschlägen zum Antippen, „andere“ für freie Eingabe. */
export function WahlText(props: { wert: string; werte: readonly string[]; platzhalter?: string; onAendern: (s: string) => void }) {
  const [offen, setOffen] = useState(false);
  const andere = offen || (props.wert !== '' && !props.werte.includes(props.wert));
  return (
    <div class="wahl">
      <div class="tasten">
        {props.werte.map((b) => (
          <button
            key={b}
            class={`taste ${!andere && props.wert === b ? 'aktiv' : ''}`}
            onClick={() => {
              setOffen(false);
              props.onAendern(props.wert === b && !andere ? '' : b);
            }}
          >
            {b}
          </button>
        ))}
        <button class={`taste andere ${andere ? 'aktiv' : ''}`} onClick={() => setOffen(!andere)}>
          andere
        </button>
      </div>
      {andere && <TextFeld wert={props.wert} platzhalter={props.platzhalter} onAendern={props.onAendern} />}
    </div>
  );
}

// ---------------- Fotos ----------------

export function Thumb(props: { foto: FotoMeta; onClick?: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let ok = true;
    void thumbUrl(props.foto.foto_id).then((u) => ok && setUrl(u));
    return () => {
      ok = false;
    };
  }, [props.foto.foto_id]);
  return (
    <button class={`thumb ${props.foto.exportiert_am ? '' : 'neu'}`} onClick={props.onClick} title={props.foto.dateiname}>
      {url ? <img src={url} alt={props.foto.dateiname} /> : <span>…</span>}
    </button>
  );
}

let fotoViewerSetzen: ((f: FotoMeta | null) => void) | null = null;
export function fotoZeigen(f: FotoMeta) {
  fotoViewerSetzen?.(f);
}

export function FotoViewer() {
  const [foto, setFoto] = useState<FotoMeta | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  fotoViewerSetzen = setFoto;
  useEffect(() => {
    if (!foto) return;
    let u: string | null = null;
    void fotoBlobLaden(foto.foto_id).then((b) => {
      if (b) {
        u = URL.createObjectURL(b.blob);
        setUrl(u);
      }
    });
    return () => {
      if (u) URL.revokeObjectURL(u);
      setUrl(null);
    };
  }, [foto?.foto_id]);
  if (!foto) return null;
  return (
    <div class="viewer" onClick={() => setFoto(null)}>
      <div class="viewer-leiste" onClick={(e) => e.stopPropagation()}>
        <span class="viewer-name">{foto.dateiname}</span>
        <button
          class="knopf gefahr"
          onClick={async () => {
            if (!confirm(`Foto „${foto.dateiname}“ löschen?`)) return;
            await fotosEntfernen(foto.einheit_id, [foto.foto_id]);
            setFoto(null);
          }}
        >
          Löschen
        </button>
        <button class="knopf" onClick={() => setFoto(null)}>
          Schließen
        </button>
      </div>
      {url ? <img class="viewer-bild" src={url} alt={foto.dateiname} /> : <div class="viewer-laden">Lädt …</div>}
    </div>
  );
}

/**
 * Fotoleiste: Vorschaubilder und Kamera-Knopf. Nach jedem Foto bleibt man im Formular
 * und kann sofort das nächste aufnehmen.
 */
export function FotoLeiste(props: {
  titel: string;
  ziel: FotoZiel;
  fotos: FotoMeta[];
  hinweis?: string;
  knopfText?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  return (
    <div class="fotoleiste">
      <div class="feld-titel">
        {props.titel}
        {props.fotos.length > 0 && <span class="zaehler"> · {props.fotos.length}</span>}
      </div>
      {props.hinweis && <div class="feld-hinweis">{props.hinweis}</div>}
      <div class="fotoreihe">
        {props.fotos.map((f) => (
          <Thumb key={f.foto_id} foto={f} onClick={() => fotoZeigen(f)} />
        ))}
        <button class="foto-knopf" disabled={laeuft} onClick={() => input.current?.click()}>
          {laeuft ? 'speichert …' : `📷 ${props.knopfText ?? (props.fotos.length ? 'weiteres Foto' : 'Foto')}`}
        </button>
      </div>
      {fehler && <div class="fehler">{fehler}</div>}
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={async (e) => {
          const el = e.target as HTMLInputElement;
          const dateien = Array.from(el.files ?? []);
          el.value = '';
          if (!dateien.length) return;
          setLaeuft(true);
          setFehler(null);
          try {
            for (const d of dateien) await fotoAufnehmen(d, props.ziel);
          } catch (err) {
            setFehler(`Foto nicht gespeichert: ${(err as Error).message}`);
          } finally {
            setLaeuft(false);
          }
        }}
      />
    </div>
  );
}

export function Hinweis(props: { children: ComponentChildren; art?: 'info' | 'warn' | 'fehler' }) {
  return <div class={`hinweis ${props.art ?? 'info'}`}>{props.children}</div>;
}
