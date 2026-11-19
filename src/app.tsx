import { S, useStore } from './store';
import { FotoViewer } from './ui/common';
import { PlanViewer } from './ui/plan';
import { HilfeViewer } from './ui/hilfe';
import { Start } from './ui/start';
import { ProjektSeite } from './ui/projekt';
import { EinheitSeite } from './ui/einheit';
import { RaumSeite } from './ui/raum';
import { HfSeite } from './ui/hf';
import { HzSeite } from './ui/hz';
import { ExportSeite } from './ui/export';
import { EinstellungenSeite } from './ui/einstellungen';

function Seite() {
  const r = S.route;
  if (r.name === 'einstellungen') return <EinstellungenSeite />;
  if (!S.projekt || r.name === 'start') return <Start />;
  switch (r.name) {
    case 'projekt':
      return <ProjektSeite />;
    case 'einheit':
      return S.aufnahmen.has(r.eid) ? <EinheitSeite eid={r.eid} /> : <ProjektSeite />;
    case 'raum': {
      const a = S.aufnahmen.get(r.eid);
      return a?.raeume.some((x) => x.raum_id === r.rid) ? <RaumSeite eid={r.eid} rid={r.rid} /> : <ProjektSeite />;
    }
    case 'hf': {
      const raum = S.aufnahmen.get(r.eid)?.raeume.find((x) => x.raum_id === r.rid);
      return raum?.heizflaechen.some((h) => h.hf_id === r.hfid) ? <HfSeite eid={r.eid} rid={r.rid} hfid={r.hfid} /> : <ProjektSeite />;
    }
    case 'hz':
      return S.aufnahmen.has(r.eid) ? <HzSeite eid={r.eid} /> : <ProjektSeite />;
    case 'export':
      return <ExportSeite eid={r.eid} />;
  }
}

export function App() {
  useStore();
  if (!S.bereit) return <div class="laden">Lädt …</div>;
  // key: bei jedem Seitenwechsel frischer Komponentenzustand
  return (
    <>
      <div key={JSON.stringify(S.route)}>
        <Seite />
      </div>
      <FotoViewer />
      <PlanViewer />
      <HilfeViewer />
    </>
  );
}
