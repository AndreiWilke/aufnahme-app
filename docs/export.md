# Export (Schnittstelle zu Claude)

ZIP über „Teilen → In Dateien sichern“ (Fallback: Herunterladen). Exportierbar je Einheit, je Begehungstag oder
für das ganze Projekt, jeweils „neu seit letztem Export“ (delta) oder „komplett“.

## Inhalt
- `aufnahme.json` – Schema aus UEBERGABE.md Abschnitt 5 (`schema_version: 1`)
- `einheiten.csv`, `raeume.csv`, `heizflaechen.csv`, `fenster.csv`, `heizzentrale.csv` – UTF-8 mit BOM,
  Semikolon, Dezimalkomma, `ja`/`nein`
- `fotos/<einheit_id>/<dateiname>.jpg` – 2560 px lange Kante, JPEG 0,82; ZIP mit UTF-8-Flag

## Delta-Export
Enthält alle Einheiten des gewählten Umfangs, die seit ihrem letzten Export geändert wurden oder nicht
exportierte Fotos haben. Diese Einheiten stehen **vollständig** in `aufnahme.json` und den CSV-Dateien, damit
jede Datei für sich lesbar ist. Fotos sind nur die noch nicht exportierten. Jedes Objekt trägt
`geaendert_am`, damit sich Änderungen auch auf Datensatzebene erkennen lassen.

## Ergänzungen gegenüber Abschnitt 5 (bitte bestätigen)
Die Felder aus Abschnitt 5 sind unverändert. Zusätzlich:

| Feld | Grund |
|---|---|
| `export_art`, `export_umfang` (oben) | Delta oder komplett, welche Einheit bzw. welcher Tag |
| `projekt` (oben) | Projektdaten der eingespielten Projektdatei (Abschnitt 5: „Projektdaten + alle Aufnahmen“) |
| `einheiten[].geaendert_am`, `raeume[].geaendert_am`, `heizflaechen[].geaendert_am`, `fenster[].geaendert_am` | Delta-Export, Abschnitt 5 letzter Absatz |
| `einheiten[].im_plan_entfallen`, `raeume[].im_plan_entfallen` | Einheit/Raum in neuerer Projektdatei nicht mehr enthalten |
| `fenster[].fenster_id` | eindeutige Zuordnung von Fotos und Änderungen |
| `fenster[].masse_status` | Datenstatus für Breite/Höhe (jeder Messwert trägt einen Status, AGENTS.md) |
| `heizzentrale` | Struktur siehe unten (in Abschnitt 5 nur `null`) |

### Heizzentrale
```json
"heizzentrale": {
  "punkte": [
    { "punkt_id": "innendurchmesser", "vorhanden": null, "text": "", "wert": 42,
      "status": "gemessen", "notiz": "", "fotos": ["HZ_Innendurchmesser_01.jpg"], "geaendert_am": "…" }
  ],
  "abgaenge": [
    { "abgang_id": "uuid", "nr": 2, "bezeichnung": "Heizkreis Nord", "pumpe": true,
      "mischer_stellantrieb": false, "notiz": "", "fotos": ["HZ_Abgang2_01.jpg", "HZ_Abgang2_Pumpe_01.jpg"],
      "geaendert_am": "…" }
  ],
  "geaendert_am": "…"
}
```
`punkt_id`: `verteiler`, `pumpen`, `regelgeraet`, `fernwaerme`, `innendurchmesser` (Wert in mm),
`rohrmaterial`, `schlammabscheider`, `entlueftung`, `druckhaltung`, `strangventile` (Text = Fabrikat),
`trinkwasser` (Text = Art, Wert = Speichergröße in Liter).

## Feste Schlüssel
- `art`: `platte`, `glieder`, `roehren`, `bad`, `konvektor`, `fussbodenheizung`, `sonstiges`
- `typ`: `10`, `11`, `20`, `21`, `22`, `33`, `unbekannt` (nur bei `platte`, sonst `null`)
- `anschluss`: `seitlich_gleich`, `seitlich_wechsel`, `unten_mittig_vk`, `unten_seitlich_vk`, `unbekannt`
- `lage`: `unter_fenster`, `aussenwand_ohne_fenster`, `innenwand`
- `verglasung`: `1-fach`, `2-fach`, `3-fach`, `unbekannt`
- `rahmen`: `kunststoff`, `holz`, `holz_alu`, `alu`, `unbekannt`
- `status` (Einheit): `offen`, `in_arbeit`, `fertig`, `nicht_angetroffen`
- `zustand` (Raum): `vorhanden`, `nicht_vorhanden`, `zusammengelegt`
- Datenstatus Messwert: `gemessen`, `geschätzt` (wie in AGENTS.md geschrieben); ohne Wert `null`
- `gliederzahl` nur bei `glieder` und `roehren`, sonst `null`

## Dateiname
`Aufnahme_<projekt-id>_<JJJJ-MM-TT_HHMM>_<komplett|delta>_<umfang>.zip`, z. B.
`Aufnahme_beispiel_2026-12-05_1610_delta_EH010.zip`. Der Zusatz `_<umfang>` (Einheit, Tag oder `alle`)
verhindert, dass zwei Exporte in derselben Minute denselben Namen bekommen und sich in OneDrive überschreiben.
