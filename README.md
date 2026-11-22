# Aufnahme-App Heizkörper

Offline-Web-App (PWA) für Safari auf dem iPad. Erfasst je Einheit und Raum Heizkörper, Ventile, Fenster und die
Heizzentrale mit Fotos und liefert ein ZIP (JSON, CSV, Fotos) als Grundlage für Heizlast und hydraulischen
Abgleich. Kurzregeln: [`AGENTS.md`](AGENTS.md). Die Anforderungen (`UEBERGABE*.md`) enthalten Projektdaten und liegen nur lokal.

## Entwickeln

```bash
npm install
npm run dev        # Entwicklungsserver (ohne Service Worker)
npm test           # Tests (Import, Projektdatei-Format, Einspielen, CSV, ZIP, Ergänzungen 1.5.0)
npm run build      # Build nach dist/ inkl. Service Worker
npm run preview    # gebaute App lokal ansehen
```

Technik: Vite, TypeScript, Preact, `idb` (IndexedDB), `fflate` (ZIP). Kein Backend, keine CDNs, kein Tracking.
Der Service Worker wird beim Build aus `src/sw-vorlage.js` erzeugt und speichert alle Dateien vorab.

## Veröffentlichen (HTTPS ist Pflicht für Kamera und Offline-Betrieb)

### GitHub Pages
1. Repository auf GitHub, Einstellungen → Pages → Source: „GitHub Actions“.
2. Jeder Push auf `main` baut und veröffentlicht automatisch (`.github/workflows/pages.yml`).
3. Adresse: `https://<benutzer>.github.io/<repository>/`

Hinweis: Bei einem kostenlosen GitHub-Konto muss das Repository für Pages öffentlich sein. Im Repository liegen nur
Programmcode und fiktive Beispieldaten, keine Projektdaten.

### AWS S3 + CloudFront
Einmalig einrichten:
1. S3-Bucket anlegen (privat, „Block all public access“ an).
2. CloudFront-Distribution mit dem Bucket als Ursprung, Zugriff über Origin Access Control (OAC), die
   Bucket-Policy übernimmt CloudFront auf Nachfrage.
3. Default root object: `index.html`. Viewer protocol policy: „Redirect HTTP to HTTPS“.
4. Optional eigene Domain mit Zertifikat aus ACM (Region us-east-1).

Bei jedem Update (Linux/macOS bzw. PowerShell unter Windows):
```bash
BUCKET=mein-bucket DISTRIBUTION=E123ABC ./deploy/deploy-s3.sh
```
```powershell
$env:BUCKET="mein-bucket"; $env:DISTRIBUTION="E123ABC"; .\deploy\deploy-s3.ps1
```
Das Skript setzt lange Cache-Zeiten für `assets/` und „no-cache“ für `index.html`, `sw.js` und das Manifest und
leert danach den CloudFront-Cache für diese Dateien.

## Installation auf dem iPad
1. Adresse in **Safari** öffnen (nicht in Chrome, sonst kein Home-Bildschirm-Betrieb mit Offline-Speicher).
2. Teilen-Symbol → „Zum Home-Bildschirm“.
3. App vom Home-Bildschirm starten. Ab jetzt funktioniert sie auch im Flugmodus.
4. Updates: App mit Netz öffnen, in den Einstellungen „Neu laden“ tippen (ggf. zweimal).

Wichtig: Die Home-Bildschirm-App und Safari haben **getrennte Speicher**. Aufnahmen immer in der
Home-Bildschirm-App machen.

## Projektdatei
Format siehe [`docs/projektdatei.md`](docs/projektdatei.md). Beispiel: [`data/beispiel.objekt.json`](data/beispiel.objekt.json).

## Export
Beschreibung der ZIP-Inhalte und Abweichungen vom Schema in [`docs/export.md`](docs/export.md).

## Pläne (Grundrisse)
In jeder Einheit und in jedem Raum öffnet der Knopf „Plan“ die Plan-Ansicht. Über „+ Plan laden“ werden Grundrisse als
Bilder (JPG/PNG) aus OneDrive gewählt; sie bleiben nur auf dem Gerät und stehen nicht im Export. Heißt ein Bild wie das
Geschoss der Einheit (z. B. `2. OG.jpg`), wird es automatisch gewählt. Plan, Zoom und Ausschnitt merkt sich die App je
Einheit. Echte Pläne gehören nicht ins Repository.
