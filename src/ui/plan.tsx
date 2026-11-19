// Plan-Ansicht: Grundrisse als Bilder, lokal in IndexedDB. Je Einheit merkt sich die App Plan, Zoom und Ausschnitt.
import { useEffect, useRef, useState } from 'preact/hooks';
import { einstellungLesen, einstellungSchreiben, planLaden, planLoeschen, planSpeichern, plaeneListen, type PlanMeta } from '../db';
import { planEinheit, S } from '../store';

interface PlanPos {
  plan_id: string;
  zoom: number;
  fx: number;
  fy: number;
}

let planSetzen: ((eid: string | null) => void) | null = null;

/** Öffnet die Plan-Ansicht für eine Einheit. */
export function planZeigen(eid: string) {
  planSetzen?.(eid);
}

export function PlanKnopf(props: { eid: string }) {
  return (
    <button class="kopf-knopf plan-knopf" onClick={() => planZeigen(props.eid)}>
      Plan
    </button>
  );
}

const ZOOM_MAX = 12;

export function PlanViewer() {
  const [eid, setEid] = useState<string | null>(null);
  const [plaene, setPlaene] = useState<PlanMeta[]>([]);
  const [aktiv, setAktiv] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const flaeche = useRef<HTMLDivElement>(null);
  const datei = useRef<HTMLInputElement>(null);
  const start = useRef<PlanPos | null>(null);
  planSetzen = setEid;

  const pid = S.projekt?.projekt_id ?? '';
  const geschoss = eid ? (planEinheit(eid)?.geschoss ?? '') : '';
  const posKey = `planpos:${pid}:${eid}`;
  const geschossKey = `plangeschoss:${pid}:${geschoss}`;

  /** Plan, dessen Name zum Geschoss der Einheit passt („2. OG“ → Bild „2. OG“). */
  const nachGeschoss = (liste: PlanMeta[]) => {
    const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, '');
    const g = norm(geschoss);
    return g ? (liste.find((p) => norm(p.name) === g) ?? liste.find((p) => norm(p.name).startsWith(g))) : undefined;
  };

  // Öffnen: Liste laden, gemerkten Plan und Ausschnitt der Einheit wählen
  useEffect(() => {
    if (!eid) return;
    let ok = true;
    void (async () => {
      const liste = await plaeneListen(pid);
      const pos = await einstellungLesen<PlanPos>(posKey);
      const vomGeschoss = await einstellungLesen<string>(geschossKey);
      if (!ok) return;
      setPlaene(liste);
      const gibt = (id?: string | null) => !!id && liste.some((p) => p.plan_id === id);
      if (pos && gibt(pos.plan_id)) {
        start.current = pos;
        setZoom(pos.zoom);
        setAktiv(pos.plan_id);
      } else {
        start.current = null;
        setZoom(1);
        setAktiv(gibt(vomGeschoss) ? vomGeschoss! : (nachGeschoss(liste)?.plan_id ?? liste[0]?.plan_id ?? null));
      }
    })();
    return () => {
      ok = false;
    };
  }, [eid]);

  // Bild des gewählten Plans laden
  useEffect(() => {
    if (!eid || !aktiv) {
      setUrl(null);
      return;
    }
    let u: string | null = null;
    let ok = true;
    void planLaden(aktiv).then((p) => {
      if (!ok || !p) return;
      u = URL.createObjectURL(p.blob);
      setUrl(u);
    });
    return () => {
      ok = false;
      if (u) URL.revokeObjectURL(u);
      setUrl(null);
    };
  }, [eid, aktiv]);

  if (!eid) return null;

  const merken = () => {
    const f = flaeche.current;
    if (!f || !aktiv) return;
    const pos: PlanPos = {
      plan_id: aktiv,
      zoom,
      fx: f.scrollWidth ? (f.scrollLeft + f.clientWidth / 2) / f.scrollWidth : 0.5,
      fy: f.scrollHeight ? (f.scrollTop + f.clientHeight / 2) / f.scrollHeight : 0.5,
    };
    void einstellungSchreiben(posKey, pos);
    if (geschoss) void einstellungSchreiben(geschossKey, aktiv);
  };

  const mitte = (fx: number, fy: number) => {
    const f = flaeche.current;
    if (!f) return;
    f.scrollLeft = fx * f.scrollWidth - f.clientWidth / 2;
    f.scrollTop = fy * f.scrollHeight - f.clientHeight / 2;
  };

  const zoomen = (neu: number) => {
    const f = flaeche.current;
    const z = Math.min(ZOOM_MAX, Math.max(1, neu));
    if (!f) return setZoom(z);
    const fx = f.scrollWidth ? (f.scrollLeft + f.clientWidth / 2) / f.scrollWidth : 0.5;
    const fy = f.scrollHeight ? (f.scrollTop + f.clientHeight / 2) / f.scrollHeight : 0.5;
    setZoom(z);
    requestAnimationFrame(() => mitte(fx, fy));
  };

  const schliessen = () => {
    merken();
    setEid(null);
  };

  const wechseln = (id: string) => {
    if (id === aktiv) return;
    start.current = null;
    setZoom(1);
    setAktiv(id);
  };

  const pe = planEinheit(eid);

  return (
    <div class="viewer plan-viewer">
      <div class="viewer-leiste">
        <span class="viewer-name plan-titel">
          Plan · {pe?.bezeichnung ?? eid}
          {geschoss ? ` · ${geschoss}` : ''}
        </span>
        <button class="knopf" onClick={() => zoomen(zoom / 1.5)} disabled={zoom <= 1} aria-label="Verkleinern">
          −
        </button>
        <button class="knopf" onClick={() => zoomen(zoom * 1.5)} disabled={zoom >= ZOOM_MAX} aria-label="Vergrößern">
          +
        </button>
        <button class="knopf" onClick={schliessen}>
          Schließen
        </button>
      </div>
      <div class="plan-reiter">
        {plaene.map((p) => (
          <button key={p.plan_id} class={`taste klein ${p.plan_id === aktiv ? 'aktiv' : ''}`} onClick={() => wechseln(p.plan_id)}>
            {p.name}
          </button>
        ))}
        <button class="taste klein andere" disabled={laeuft} onClick={() => datei.current?.click()}>
          {laeuft ? 'lädt …' : '+ Plan laden'}
        </button>
        {aktiv && (
          <button
            class="taste klein plan-weg"
            onClick={async () => {
              const p = plaene.find((x) => x.plan_id === aktiv);
              if (!p || !confirm(`Plan „${p.name}“ aus der App entfernen?`)) return;
              await planLoeschen(aktiv);
              const rest = plaene.filter((x) => x.plan_id !== aktiv);
              setPlaene(rest);
              setAktiv(rest[0]?.plan_id ?? null);
            }}
          >
            Plan entfernen
          </button>
        )}
      </div>
      {fehler && <div class="fehler">{fehler}</div>}
      <div class="plan-flaeche" ref={flaeche}>
        {plaene.length === 0 ? (
          <div class="plan-leer">
            Noch kein Plan geladen. Über „+ Plan laden“ die Grundrisse als Bilder (JPG oder PNG) aus OneDrive wählen, mehrere auf
            einmal sind möglich. Die Pläne bleiben auf diesem Gerät; Ausschnitt und Zoom merkt sich die App je Einheit.
          </div>
        ) : url ? (
          <img
            class="plan-bild"
            src={url}
            alt="Plan"
            style={{ width: `${zoom * 100}%` }}
            onLoad={() => {
              const s = start.current;
              start.current = null;
              if (s) requestAnimationFrame(() => mitte(s.fx, s.fy));
            }}
          />
        ) : (
          <div class="viewer-laden">Lädt …</div>
        )}
      </div>
      <input
        ref={datei}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={async (e) => {
          const el = e.target as HTMLInputElement;
          const dateien = Array.from(el.files ?? []);
          el.value = '';
          if (!dateien.length) return;
          setLaeuft(true);
          setFehler(null);
          try {
            let erster: string | null = null;
            for (const d of dateien) {
              if (!d.type.startsWith('image/')) throw new Error(`„${d.name}“ ist kein Bild (JPG oder PNG).`);
              const plan_id = `${pid}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
              await planSpeichern({ plan_id, projekt_id: pid, name: d.name.replace(/\.[a-z0-9]+$/i, ''), blob: d });
              erster ??= plan_id;
            }
            const liste = await plaeneListen(pid);
            setPlaene(liste);
            const ziel = (!aktiv && nachGeschoss(liste)?.plan_id) || erster;
            if (ziel) wechseln(ziel);
          } catch (err) {
            setFehler(`Plan nicht gespeichert: ${(err as Error).message}`);
          } finally {
            setLaeuft(false);
          }
        }}
      />
    </div>
  );
}
