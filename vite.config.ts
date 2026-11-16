import { defineConfig, type Plugin } from 'vite';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Erzeugt beim Build einen Service Worker (sw.js), der alle Dateien der App vorab
 * zwischenspeichert. Danach läuft die App vollständig offline.
 */
function serviceWorker(): Plugin {
  return {
    name: 'aufnahme-sw',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const dateien = new Set<string>(['./', './index.html']);
      for (const name of Object.keys(bundle)) if (!name.endsWith('.map')) dateien.add(`./${name}`);
      // Dateien aus public/
      const pub = 'public';
      const lauf = (dir: string, prefix: string) => {
        for (const f of readdirSync(dir)) {
          const p = join(dir, f);
          if (statSync(p).isDirectory()) lauf(p, `${prefix}${f}/`);
          else dateien.add(`./${prefix}${f}`);
        }
      };
      lauf(pub, '');
      const liste = [...dateien].sort();
      const hash = createHash('sha256');
      for (const name of Object.keys(bundle).sort()) {
        const c = bundle[name];
        hash.update(name);
        hash.update(c.type === 'chunk' ? c.code : typeof c.source === 'string' ? c.source : Buffer.from(c.source));
      }
      for (const f of liste) if (f.startsWith('./') && !Object.keys(bundle).includes(f.slice(2)) && f !== './' && f !== './index.html') {
        try { hash.update(readFileSync(join(pub, f.slice(2)))); } catch { /* */ }
      }
      const version = hash.digest('hex').slice(0, 12);
      const sw = readFileSync('src/sw-vorlage.js', 'utf-8')
        .replace('__VERSION__', version)
        .replace('__DATEIEN__', JSON.stringify(liste, null, 2));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: sw });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [serviceWorker()],
  build: { target: 'safari15', sourcemap: false },
  test: { environment: 'node' },
} as never);
