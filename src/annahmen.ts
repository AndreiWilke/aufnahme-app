// Seit 1.6.0: Annahmen aus der Projektdatei vor Ort bestätigen (passt / ändern / unklar).
// Reine Logik ohne Oberfläche; alle Annahmen kommen aus der Projektdatei, nichts davon steht im Code.
import type {
  Antwort,
  Bestaetigung,
  EinheitAufnahme,
  Fenster,
  FensterPlanBestaetigung,
  FensterPlanPruefung,
  Messwert,
  PlanAnnahme,
  PlanEinheit,
  PlanFenster,
  PlanPruefpunkt,
  PlanRaum,
  Pruefpunkt,
  Raum,
  RaumAnnahmeSchluessel,
  Verglasung,
} from './model';
import { uuid } from './util';

export const RAUM_ANNAHMEN: RaumAnnahmeSchluessel[] = ['lichte_hoehe_m', 'beheizt'];

const leer = (): Messwert => ({ wert: null, status: null });

// ---------------- Stand einer Annahme (zum Erkennen von Änderungen beim Einspielen) ----------------

/** Inhalt der Annahme, der für „passt“ zählt. Status und Quelle allein ändern die Bestätigung nicht. */
export function ppStand(a: PlanAnnahme | null | undefined): string {
  return a ? JSON.stringify([a.text, a.wert, a.einheit]) : 'null';
}

export function raumStand(pr: PlanRaum | undefined, k: RaumAnnahmeSchluessel): string {
  const a = pr?.annahmen?.[k];
  return a ? JSON.stringify(a.wert) : 'null';
}

export function fensterStand(pf: PlanFenster | undefined): string {
  return pf
    ? JSON.stringify([pf.typ, pf.breite_m, pf.hoehe_m, pf.anzahl, pf.verglasung, pf.erneuert, pf.baujahr])
    : 'null';
}

// ---------------- Vorbefüllung ----------------

/**
 * Bei „ändern“ wird ein Wert mit der Annahme vorbefüllt (Status geschätzt). Wird er dann geändert, ohne dass der
 * Status angetippt wurde, gilt der neue Wert als gemessen.
 */
export function nachVorbefuellung(alt: Messwert, neu: Messwert, annahme: number | null | undefined): Messwert {
  if (
    annahme !== null &&
    annahme !== undefined &&
    alt.status === 'geschätzt' &&
    alt.wert === annahme &&
    neu.wert !== null &&
    neu.wert !== annahme &&
    neu.status === 'geschätzt'
  )
    return { wert: neu.wert, status: 'gemessen' };
  return neu;
}

// ---------------- Prüfpunkte ----------------

/**
 * Setzt die Prüfung einer Annahme an einem Prüfpunkt. Gleicher Knopf noch einmal: Prüfung zurücknehmen (null).
 * passt: erledigt, bei typ „zahl“ Wert = Annahme mit Status „bestätigt“.
 * ändern: Eingaben offen, Zahl mit der Annahme vorbefüllt.
 * unklar: nicht prüfbar, erledigt (Notiz optional).
 */
export function ppPruefen(q: Pruefpunkt, d: PlanPruefpunkt, b: Bestaetigung | null): void {
  const ann = d.annahme ?? null;
  const zahl = d.typ === 'zahl';
  const wertAusAnnahme = q.wert.status === 'bestätigt';
  delete q.annahme_geaendert;
  if (b === null) {
    if (wertAusAnnahme) q.wert = leer();
    q.bestaetigung = null;
    q.erledigt = false;
    delete q.annahme_stand;
    return;
  }
  q.bestaetigung = b;
  q.annahme_stand = ppStand(ann);
  if (b === 'bestaetigt') {
    q.erledigt = true;
    if (zahl && ann && ann.wert !== null) q.wert = { wert: ann.wert, status: 'bestätigt' };
  } else if (b === 'geaendert') {
    q.erledigt = false;
    if (zahl && (q.wert.wert === null || wertAusAnnahme))
      q.wert = ann && ann.wert !== null ? { wert: ann.wert, status: 'geschätzt' } : leer();
  } else {
    q.erledigt = true;
    if (wertAusAnnahme) q.wert = leer();
  }
}

// ---------------- Raum-Annahmen ----------------

export function raumBestaetigung(r: Raum): Record<RaumAnnahmeSchluessel, Bestaetigung | null> {
  return { lichte_hoehe_m: r.annahmen_bestaetigung?.lichte_hoehe_m ?? null, beheizt: r.annahmen_bestaetigung?.beheizt ?? null };
}

const beheiztAntwort = (w: boolean): Antwort => (w ? 'ja' : 'nein');

/**
 * Prüfung der lichten Höhe oder von „beheizt“. Die Werte stehen in den Feldern aus 1.5.0
 * (lichte_hoehe_m, beheizt_vor_ort). Gleicher Knopf noch einmal: Prüfung zurücknehmen.
 */
export function raumAnnahmePruefen(r: Raum, pr: PlanRaum, k: RaumAnnahmeSchluessel, b: Bestaetigung | null): void {
  const best = raumBestaetigung(r);
  const vorher = best[k];
  best[k] = b;
  r.annahmen_bestaetigung = best;
  if (r.annahmen_geaendert) {
    delete r.annahmen_geaendert[k];
    if (Object.keys(r.annahmen_geaendert).length === 0) delete r.annahmen_geaendert;
  }
  const stand = { ...(r.annahmen_stand ?? {}) };
  if (b === null) delete stand[k];
  else stand[k] = raumStand(pr, k);
  r.annahmen_stand = stand;

  if (k === 'lichte_hoehe_m') {
    const ann = pr.annahmen?.lichte_hoehe_m;
    const h = r.lichte_hoehe_m ?? leer();
    const ausAnnahme = h.status === 'bestätigt';
    if (b === 'bestaetigt') r.lichte_hoehe_m = ann ? { wert: ann.wert, status: 'bestätigt' } : h;
    else if (b === 'geaendert') {
      if (h.wert === null || ausAnnahme) r.lichte_hoehe_m = ann ? { wert: ann.wert, status: 'geschätzt' } : leer();
    } else if (ausAnnahme) r.lichte_hoehe_m = leer();
  } else {
    const ann = pr.annahmen?.beheizt;
    const ausAnnahme = vorher === 'bestaetigt' || vorher === 'unklar';
    if (b === 'bestaetigt') r.beheizt_vor_ort = ann ? beheiztAntwort(ann.wert) : (r.beheizt_vor_ort ?? null);
    else if (b === 'geaendert') {
      // „ändern“ bei ja/nein heißt fast immer das Gegenteil der Annahme.
      if (ann && ((r.beheizt_vor_ort ?? null) === null || ausAnnahme)) r.beheizt_vor_ort = beheiztAntwort(!ann.wert);
    } else if (b === 'unklar') r.beheizt_vor_ort = 'unklar';
    else if (ausAnnahme) r.beheizt_vor_ort = null;
  }
}

// ---------------- Fenster laut Plan ----------------

const VERGLASUNGEN: Verglasung[] = ['1-fach', '2-fach', '3-fach'];

/** Fenster-Datensatz, vorbefüllt aus dem Plan-Fenster (Maße als geschätzt). */
export function fensterAusPlan(pf: PlanFenster, jetzt: string): Fenster {
  const mm = (m: number | null) => (m === null ? null : Math.round(m * 1000));
  const breite = mm(pf.breite_m);
  const hoehe = mm(pf.hoehe_m);
  return {
    fenster_id: uuid(),
    anzahl: pf.anzahl ?? 1,
    verglasung: (VERGLASUNGEN as string[]).includes(pf.verglasung) ? (pf.verglasung as Verglasung) : null,
    rahmen: null,
    breite_mm: breite,
    hoehe_mm: hoehe,
    masse_status: breite === null && hoehe === null ? null : 'geschätzt',
    art: pf.typ,
    erneuert: pf.erneuert,
    baujahr: pf.baujahr,
    fotos: [],
    fenster_plan_id: pf.id,
    geaendert_am: jetzt,
  };
}

export function fensterPlanPruefung(r: Raum, id: string): FensterPlanPruefung | undefined {
  return r.fenster_plan_bestaetigung?.find((x) => x.id === id);
}

/**
 * Prüfung eines Fensters laut Plan. „ändern“ legt einen Fenster-Datensatz an (falls noch keiner da ist),
 * alle anderen Prüfungen entfernen ihn wieder. Gibt die fenster_id eines entfernten Datensatzes zurück
 * (für das Löschen seiner Fotos).
 */
export function fensterPlanPruefen(r: Raum, pf: PlanFenster, b: FensterPlanBestaetigung | null, jetzt: string): string | null {
  const liste = r.fenster_plan_bestaetigung ?? [];
  let e = liste.find((x) => x.id === pf.id);
  if (!e) {
    e = { id: pf.id, bestaetigung: null, fenster_id: null, geaendert_am: null };
    liste.push(e);
  }
  r.fenster_plan_bestaetigung = liste;
  let entfernt: string | null = null;
  const datensatz = r.fenster.find((f) => f.fenster_plan_id === pf.id);
  if (b === 'geaendert') {
    if (datensatz) e.fenster_id = datensatz.fenster_id;
    else {
      const f = fensterAusPlan(pf, jetzt);
      r.fenster.push(f);
      e.fenster_id = f.fenster_id;
    }
  } else {
    if (datensatz) {
      r.fenster = r.fenster.filter((f) => f !== datensatz);
      entfernt = datensatz.fenster_id;
    }
    e.fenster_id = null;
  }
  e.bestaetigung = b;
  delete e.annahme_geaendert;
  if (b === null) delete e.stand;
  else e.stand = fensterStand(pf);
  e.geaendert_am = jetzt;
  return entfernt;
}

/** Ein Fenster-Datensatz mit fenster_plan_id wurde gelöscht: Prüfung des Plan-Fensters zurücknehmen. */
export function fensterDatensatzEntfernt(r: Raum, f: Fenster, jetzt: string): void {
  if (!f.fenster_plan_id) return;
  const e = fensterPlanPruefung(r, f.fenster_plan_id);
  if (e && e.fenster_id === f.fenster_id) {
    e.bestaetigung = null;
    e.fenster_id = null;
    delete e.stand;
    e.geaendert_am = jetzt;
  }
}

// ---------------- „Raum wie angenommen“ ----------------

/** Offene Annahmen des Raums (lichte Höhe, beheizt, Fenster laut Plan). Heizflächen zählen nicht. */
export function raumAnnahmenOffen(r: Raum, pr: PlanRaum | undefined): number {
  if (!pr) return 0;
  const best = raumBestaetigung(r);
  let n = RAUM_ANNAHMEN.filter((k) => pr.annahmen?.[k] && best[k] === null).length;
  for (const pf of pr.fenster_plan ?? []) if ((fensterPlanPruefung(r, pf.id)?.bestaetigung ?? null) === null) n++;
  return n;
}

/**
 * Bestätigt alle noch offenen Annahmen des Raums mit „passt“. Bereits geprüfte (ändern, unklar,
 * nicht vorhanden) bleiben unverändert. Gibt die Zahl der bestätigten Annahmen zurück.
 */
export function raumWieAngenommen(r: Raum, pr: PlanRaum, jetzt: string): number {
  let n = 0;
  const best = raumBestaetigung(r);
  for (const k of RAUM_ANNAHMEN) {
    if (pr.annahmen?.[k] && best[k] === null) {
      raumAnnahmePruefen(r, pr, k, 'bestaetigt');
      n++;
    }
  }
  for (const pf of pr.fenster_plan ?? []) {
    if ((fensterPlanPruefung(r, pf.id)?.bestaetigung ?? null) === null) {
      fensterPlanPruefen(r, pf, 'bestaetigt', jetzt);
      n++;
    }
  }
  return n;
}

// ---------------- Zähler ----------------

/** Annahmen einer Einheit: Prüfpunkte mit Annahme, Raum-Annahmen und Fenster laut Plan der vorhandenen Räume. */
export function annahmenFortschritt(a: EinheitAufnahme, pe: PlanEinheit | undefined): { geprueft: number; gesamt: number } {
  let geprueft = 0;
  let gesamt = 0;
  if (!pe) return { geprueft, gesamt };
  const pp = new Map((a.pruefpunkte ?? []).map((q) => [q.id, q]));
  for (const d of pe.pruefpunkte ?? []) {
    if (!d.annahme) continue;
    gesamt++;
    if ((pp.get(d.id)?.bestaetigung ?? null) !== null) geprueft++;
  }
  const raeume = new Map(a.raeume.map((r) => [r.raum_id, r]));
  for (const pr of pe.raeume) {
    const r = raeume.get(pr.raum_id);
    if (!r || r.zustand !== 'vorhanden') continue;
    const best = raumBestaetigung(r);
    for (const k of RAUM_ANNAHMEN) {
      if (!pr.annahmen?.[k]) continue;
      gesamt++;
      if (best[k] !== null) geprueft++;
    }
    for (const pf of pr.fenster_plan ?? []) {
      gesamt++;
      if ((fensterPlanPruefung(r, pf.id)?.bestaetigung ?? null) !== null) geprueft++;
    }
  }
  return { geprueft, gesamt };
}

/** Zähler nur für die Prüfpunkte mit Annahme. */
export function ppAnnahmenFortschritt(a: EinheitAufnahme, pe: PlanEinheit | undefined): { geprueft: number; gesamt: number } {
  const pp = new Map((a.pruefpunkte ?? []).map((q) => [q.id, q]));
  const mit = (pe?.pruefpunkte ?? []).filter((d) => d.annahme);
  return { geprueft: mit.filter((d) => (pp.get(d.id)?.bestaetigung ?? null) !== null).length, gesamt: mit.length };
}

// ---------------- Einspielen ----------------

/** Prüfpunkt beim Einspielen: geänderte Annahme setzt „passt“ zurück. true, wenn zurückgesetzt. */
export function ppEinspielen(q: Pruefpunkt, d: PlanPruefpunkt): boolean {
  if (q.bestaetigung !== 'bestaetigt' || q.annahme_stand === ppStand(d.annahme)) return false;
  if (q.wert.status === 'bestätigt') q.wert = leer();
  q.bestaetigung = null;
  q.erledigt = false;
  delete q.annahme_stand;
  q.annahme_geaendert = true;
  return true;
}

/**
 * Raum beim Einspielen: Prüfungen bleiben über die IDs erhalten. Geänderte Annahmen setzen „passt“ zurück
 * (Wert aus der Annahme wird geleert), „ändern“ behält den eingegebenen Wert. Gibt die Zahl der
 * zurückgesetzten Bestätigungen zurück.
 */
export function raumEinspielen(r: Raum, pr: PlanRaum): number {
  let n = 0;
  const best = raumBestaetigung(r);
  for (const k of RAUM_ANNAHMEN) {
    if (best[k] !== 'bestaetigt' || r.annahmen_stand?.[k] === raumStand(pr, k)) continue;
    best[k] = null;
    if (r.annahmen_stand) delete r.annahmen_stand[k];
    r.annahmen_geaendert = { ...(r.annahmen_geaendert ?? {}), [k]: true };
    if (k === 'lichte_hoehe_m') {
      if (r.lichte_hoehe_m?.status === 'bestätigt') r.lichte_hoehe_m = leer();
    } else r.beheizt_vor_ort = null;
    n++;
  }
  r.annahmen_bestaetigung = best;

  const alt = new Map((r.fenster_plan_bestaetigung ?? []).map((e) => [e.id, e]));
  const liste: FensterPlanPruefung[] = [];
  for (const pf of pr.fenster_plan ?? []) {
    const e = alt.get(pf.id);
    alt.delete(pf.id);
    if (!e) {
      liste.push({ id: pf.id, bestaetigung: null, fenster_id: null, geaendert_am: null });
      continue;
    }
    delete e.im_plan_entfallen;
    if (e.bestaetigung === 'bestaetigt' && e.stand !== fensterStand(pf)) {
      e.bestaetigung = null;
      delete e.stand;
      e.annahme_geaendert = true;
      n++;
    }
    liste.push(e);
  }
  // Entfallene Plan-Fenster: geprüfte behalten (markiert), ungeprüfte entfernen.
  for (const e of alt.values()) {
    if (e.bestaetigung !== null) {
      e.im_plan_entfallen = true;
      liste.push(e);
    }
  }
  r.fenster_plan_bestaetigung = liste;
  return n;
}

/** Leere Prüfungen für einen neuen Raum aus dem Plan. */
export function raumPruefungenNeu(pr: PlanRaum): Pick<Raum, 'annahmen_bestaetigung' | 'fenster_plan_bestaetigung'> {
  return {
    annahmen_bestaetigung: { lichte_hoehe_m: null, beheizt: null },
    fenster_plan_bestaetigung: (pr.fenster_plan ?? []).map((pf) => ({ id: pf.id, bestaetigung: null, fenster_id: null, geaendert_am: null })),
  };
}

/** Raum hat eine Prüfung (für „hat Aufnahmen“ beim Einspielen). */
export function raumHatPruefung(r: Raum): boolean {
  const best = raumBestaetigung(r);
  return best.lichte_hoehe_m !== null || best.beheizt !== null || (r.fenster_plan_bestaetigung ?? []).some((e) => e.bestaetigung !== null);
}
