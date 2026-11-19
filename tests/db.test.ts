import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { _dbZuruecksetzen, db, planLaden, planLoeschen, planSpeichern, plaeneListen } from '../src/db';

/** Legt die Datenbank so an, wie Version 1.0–1.2 der App sie angelegt hat, mit Inhalt. */
function altbestandAnlegen(): Promise<void> {
  return new Promise((fertig, fehler) => {
    const r = indexedDB.open('aufnahme-app', 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore('projekte', { keyPath: 'projekt_id' });
      d.createObjectStore('einheiten', { keyPath: ['projekt_id', 'einheit_id'] }).createIndex('projekt', 'projekt_id');
      const fm = d.createObjectStore('fotometa', { keyPath: 'foto_id' });
      fm.createIndex('projekt', 'projekt_id');
      fm.createIndex('einheit', ['projekt_id', 'einheit_id']);
      d.createObjectStore('fotoblob', { keyPath: 'foto_id' });
      d.createObjectStore('einstellungen');
    };
    r.onerror = () => fehler(r.error);
    r.onsuccess = () => {
      const d = r.result;
      const tx = d.transaction(['projekte', 'einheiten', 'fotometa'], 'readwrite');
      tx.objectStore('projekte').put({ projekt_id: 'p1', name: 'Alt' });
      tx.objectStore('einheiten').put({ projekt_id: 'p1', einheit_id: 'EH001', notiz: 'bleibt' });
      tx.objectStore('fotometa').put({ foto_id: 'f1', projekt_id: 'p1', einheit_id: 'EH001' });
      tx.oncomplete = () => {
        d.close();
        fertig();
      };
    };
  });
}

describe('Datenbank-Update auf Version 2 (Pläne)', () => {
  it('behält alle vorhandenen Daten und ergänzt nur den Bereich für Pläne', async () => {
    await altbestandAnlegen();
    _dbZuruecksetzen();
    const d = await db();
    expect(d.version).toBe(2);
    expect([...d.objectStoreNames].sort()).toEqual(['einheiten', 'einstellungen', 'fotoblob', 'fotometa', 'plaene', 'projekte']);
    expect(await d.get('projekte', 'p1')).toMatchObject({ name: 'Alt' });
    expect(await d.getAllFromIndex('einheiten', 'projekt', 'p1')).toHaveLength(1);
    expect((await d.get('einheiten', ['p1', 'EH001'])) as unknown).toMatchObject({ notiz: 'bleibt' });
    expect(await d.get('fotometa', 'f1')).toBeTruthy();
  });

  it('speichert, listet und entfernt Pläne je Projekt', async () => {
    const blob = new Blob(['x'], { type: 'image/jpeg' });
    await planSpeichern({ plan_id: 'p1:b', projekt_id: 'p1', name: '2. OG', blob });
    await planSpeichern({ plan_id: 'p1:a', projekt_id: 'p1', name: '1. OG', blob });
    await planSpeichern({ plan_id: 'p2:a', projekt_id: 'p2', name: 'EG', blob });
    expect((await plaeneListen('p1')).map((p) => p.name)).toEqual(['1. OG', '2. OG']);
    expect((await planLaden('p1:a'))?.name).toBe('1. OG');
    await planLoeschen('p1:a');
    expect(await plaeneListen('p1')).toHaveLength(1);
    expect(await plaeneListen('p2')).toHaveLength(1);
  });
});
