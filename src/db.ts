// IndexedDB: Projekte, Aufnahmen je Einheit, Foto-Metadaten und Foto-Blobs getrennt.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { EinheitAufnahme, FotoBlob, FotoMeta, Projekt } from './model';

interface AufnahmeDB extends DBSchema {
  projekte: { key: string; value: Projekt };
  einheiten: {
    key: [string, string];
    value: EinheitAufnahme;
    indexes: { projekt: string };
  };
  fotometa: {
    key: string;
    value: FotoMeta;
    indexes: { projekt: string; einheit: [string, string] };
  };
  fotoblob: { key: string; value: FotoBlob };
  einstellungen: { key: string; value: unknown };
}

let dbPromise: Promise<IDBPDatabase<AufnahmeDB>> | null = null;

export function db(): Promise<IDBPDatabase<AufnahmeDB>> {
  if (!dbPromise) {
    dbPromise = openDB<AufnahmeDB>('aufnahme-app', 1, {
      upgrade(d) {
        d.createObjectStore('projekte', { keyPath: 'projekt_id' });
        const e = d.createObjectStore('einheiten', { keyPath: ['projekt_id', 'einheit_id'] });
        e.createIndex('projekt', 'projekt_id');
        const fm = d.createObjectStore('fotometa', { keyPath: 'foto_id' });
        fm.createIndex('projekt', 'projekt_id');
        fm.createIndex('einheit', ['projekt_id', 'einheit_id']);
        d.createObjectStore('fotoblob', { keyPath: 'foto_id' });
        d.createObjectStore('einstellungen');
      },
      blocked() {
        alert('Die App ist in einem anderen Fenster geöffnet. Bitte dort schließen.');
      },
    });
  }
  return dbPromise;
}

/** Nur für Tests: Verbindung zurücksetzen. */
export function _dbZuruecksetzen(): void {
  dbPromise = null;
}

export async function projekteLaden(): Promise<Projekt[]> {
  return (await db()).getAll('projekte');
}

export async function projektSpeichern(p: Projekt): Promise<void> {
  await (await db()).put('projekte', p);
}

export async function aufnahmenLaden(projekt_id: string): Promise<EinheitAufnahme[]> {
  return (await db()).getAllFromIndex('einheiten', 'projekt', projekt_id);
}

export async function aufnahmeSpeichern(a: EinheitAufnahme): Promise<void> {
  await (await db()).put('einheiten', a);
}

export async function projektMitAufnahmenSpeichern(p: Projekt, aufnahmen: EinheitAufnahme[]): Promise<void> {
  const d = await db();
  const tx = d.transaction(['projekte', 'einheiten'], 'readwrite');
  await tx.objectStore('projekte').put(p);
  const st = tx.objectStore('einheiten');
  // Einheiten, die es nicht mehr gibt (ohne Aufnahmen), entfernen
  const vorhanden = await st.index('projekt').getAllKeys(p.projekt_id);
  const neu = new Set(aufnahmen.map((a) => a.einheit_id));
  for (const k of vorhanden) if (!neu.has(k[1])) await st.delete(k);
  for (const a of aufnahmen) await st.put(a);
  await tx.done;
}

export async function fotoMetaLaden(projekt_id: string): Promise<FotoMeta[]> {
  return (await db()).getAllFromIndex('fotometa', 'projekt', projekt_id);
}

export async function fotoSpeichern(meta: FotoMeta, blob: FotoBlob, aufnahme: EinheitAufnahme): Promise<void> {
  const d = await db();
  const tx = d.transaction(['fotometa', 'fotoblob', 'einheiten'], 'readwrite');
  await tx.objectStore('fotoblob').put(blob);
  await tx.objectStore('fotometa').put(meta);
  await tx.objectStore('einheiten').put(aufnahme);
  await tx.done;
}

export async function fotosLoeschen(ids: string[], aufnahme: EinheitAufnahme | null): Promise<void> {
  const d = await db();
  const tx = d.transaction(['fotometa', 'fotoblob', 'einheiten'], 'readwrite');
  for (const id of ids) {
    await tx.objectStore('fotometa').delete(id);
    await tx.objectStore('fotoblob').delete(id);
  }
  if (aufnahme) await tx.objectStore('einheiten').put(aufnahme);
  await tx.done;
}

export async function fotoBlobLaden(foto_id: string): Promise<FotoBlob | undefined> {
  return (await db()).get('fotoblob', foto_id);
}

export async function fotoMetaAktualisieren(metas: FotoMeta[]): Promise<void> {
  const d = await db();
  const tx = d.transaction('fotometa', 'readwrite');
  for (const m of metas) await tx.store.put(m);
  await tx.done;
}

export async function exportMarkieren(aufnahmen: EinheitAufnahme[], metas: FotoMeta[]): Promise<void> {
  const d = await db();
  const tx = d.transaction(['einheiten', 'fotometa'], 'readwrite');
  for (const a of aufnahmen) await tx.objectStore('einheiten').put(a);
  for (const m of metas) await tx.objectStore('fotometa').put(m);
  await tx.done;
}

export async function projektLoeschen(projekt_id: string): Promise<void> {
  const d = await db();
  const fotoIds = await d.getAllKeysFromIndex('fotometa', 'projekt', projekt_id);
  const tx = d.transaction(['projekte', 'einheiten', 'fotometa', 'fotoblob'], 'readwrite');
  await tx.objectStore('projekte').delete(projekt_id);
  const eKeys = await tx.objectStore('einheiten').index('projekt').getAllKeys(projekt_id);
  for (const k of eKeys) await tx.objectStore('einheiten').delete(k);
  for (const id of fotoIds) {
    await tx.objectStore('fotometa').delete(id);
    await tx.objectStore('fotoblob').delete(id);
  }
  await tx.done;
}

export async function einstellungLesen<T>(key: string): Promise<T | undefined> {
  return (await (await db()).get('einstellungen', key)) as T | undefined;
}

export async function einstellungSchreiben(key: string, value: unknown): Promise<void> {
  await (await db()).put('einstellungen', value, key);
}
