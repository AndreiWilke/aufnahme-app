// Fotos: Verkleinern (2560 px lange Kante, JPEG 0,82), Vorschaubild, feste Dateinamen.
import type { EinheitAufnahme, FotoRolle } from './model';
import { kurz } from './util';

export const LANGE_KANTE = 2560;
export const JPEG_QUALITAET = 0.82;
const THUMB_KANTE = 360;

async function bildLaden(datei: Blob): Promise<{ img: HTMLImageElement; url: string }> {
  const url = URL.createObjectURL(datei);
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  // Safari und Chrome wenden die EXIF-Orientierung beim Dekodieren/Zeichnen an
  // (image-orientation: from-image ist Standard).
  try {
    await img.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new Error('Foto konnte nicht gelesen werden.');
  }
  return { img, url };
}

function zeichnen(img: HTMLImageElement, maxKante: number, qualitaet: number): Promise<{ blob: Blob; w: number; h: number }> {
  const sw = img.naturalWidth;
  const sh = img.naturalHeight;
  const f = Math.min(1, maxKante / Math.max(sw, sh));
  const w = Math.round(sw * f);
  const h = Math.round(sh * f);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas nicht verfügbar');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise((resolve, reject) => {
    c.toBlob(
      (b) => {
        // Speicher der Canvas unter iOS sofort freigeben
        c.width = 0;
        c.height = 0;
        if (b) resolve({ blob: b, w, h });
        else reject(new Error('Foto konnte nicht umgewandelt werden.'));
      },
      'image/jpeg',
      qualitaet,
    );
  });
}

export interface VerarbeitetesFoto {
  blob: Blob;
  thumb: Blob;
  breite: number;
  hoehe: number;
}

export async function fotoVerarbeiten(datei: Blob): Promise<VerarbeitetesFoto> {
  const { img, url } = await bildLaden(datei);
  try {
    const gross = await zeichnen(img, LANGE_KANTE, JPEG_QUALITAET);
    const klein = await zeichnen(img, THUMB_KANTE, 0.7);
    return { blob: gross.blob, thumb: klein.blob, breite: gross.w, hoehe: gross.h };
  } finally {
    img.src = '';
    URL.revokeObjectURL(url);
  }
}

// ---------------- Dateinamen ----------------

/** Einheitenteil: EH010_Whg212 (aus tatsächlich aufgenommener Bezeichnung). */
export function einheitTeil(a: EinheitAufnahme): string {
  const b = kurz(a.aufgenommen_bezeichnung, 20);
  return b && b !== a.einheit_id ? `${a.einheit_id}_${b}` : a.einheit_id;
}

export function raumTeil(nr: string, name: string): string {
  return `R${nr}-${kurz(name, 24)}`;
}

/** Präfix ohne laufende Nummer, z. B. EH010_Whg212_R03-Wohnraum_HK1_Ventil */
export function fotoPraefix(
  a: EinheitAufnahme,
  ziel:
    | { art: 'hf'; raumNr: string; raumName: string; hfNr: number; rolle: FotoRolle }
    | { art: 'fenster'; raumNr: string; raumName: string }
    | { art: 'raum'; raumNr: string; raumName: string }
    | { art: 'hz_punkt'; kurz: string }
    | { art: 'hz_abgang'; nr: number; rolle: 'Abgang' | 'Pumpe' | 'Mischer' },
): string {
  switch (ziel.art) {
    case 'hf':
      return `${einheitTeil(a)}_${raumTeil(ziel.raumNr, ziel.raumName)}_HK${ziel.hfNr}_${ziel.rolle}`;
    case 'fenster':
      return `${einheitTeil(a)}_${raumTeil(ziel.raumNr, ziel.raumName)}_Fenster`;
    case 'raum':
      return `${einheitTeil(a)}_${raumTeil(ziel.raumNr, ziel.raumName)}_Raum`;
    case 'hz_punkt':
      return `HZ_${ziel.kurz}`;
    case 'hz_abgang':
      return ziel.rolle === 'Abgang' ? `HZ_Abgang${ziel.nr}` : `HZ_Abgang${ziel.nr}_${ziel.rolle}`;
  }
}

/** Vergibt den nächsten Dateinamen und erhöht den Zähler in der Aufnahme (Name wird nie doppelt vergeben). */
export function naechsterDateiname(a: EinheitAufnahme, praefix: string): string {
  const n = (a.foto_zaehler[praefix] ?? 0) + 1;
  a.foto_zaehler[praefix] = n;
  return `${praefix}_${String(n).padStart(2, '0')}.jpg`;
}
