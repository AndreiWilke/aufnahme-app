# Export (Schnittstelle zu Claude)

ZIP über „Teilen → In Dateien sichern“ (Fallback: Herunterladen). Exportierbar je Einheit, je Begehungstag oder
für das ganze Projekt, jeweils „neu seit letztem Export“ (delta) oder „komplett“.

## Inhalt
- `aufnahme.json` – Schema aus UEBERGABE.md Abschnitt 5 (`schema_version: 1`)
- `einheiten.csv`, `raeume.csv`, `heizflaechen.csv`, `fenster.csv`, `heizzentrale.csv`, `pruefpunkte.csv` (seit
  1.5.0) – UTF-8 mit BOM, Semikolon, Dezimalkomma, `ja`/`nein`
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
| `heizflaechen[].nische_vorhanden` (seit 1.3.1) | `true`/`false`; ohne Angabe `false`, bei Fußbodenheizung `null`. Steht in `aufnahme.json` nach `lage` und in `heizflaechen.csv` als Spalte `nische_vorhanden` vor `nische_breite_mm`. Nötig, weil eine Nische ohne Maße sonst nicht von „keine Nische“ zu unterscheiden ist |
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

## Ergänzungen 1.5.0
Nur ergänzt, kein bestehendes Feld, keine Spalte und kein Fotoname umbenannt; Delta-Logik unverändert.
`schema_version` bleibt 1. Ältere Aufnahmen ohne die neuen Angaben exportieren `false` bzw. `null`.

### Prüfpunkte je Einheit
`aufnahme.json`, je Einheit nach `heizzentrale`:
```json
"pruefpunkte": [
  { "id": "ALLG-P02", "text": "MESSUNG: lichte Raumhöhe je Geschoss …", "antwort": "ja",
    "wert": { "wert": 2.55, "status": "gemessen" }, "notiz": "", "fotos": ["ALLG_P02_01.jpg"],
    "erledigt": true, "geaendert_am": "…" }
]
```
| Feld | Werte |
|---|---|
| `id`, `text` | aus der Projektdatei (`text` in der Fassung, die zuletzt eingespielt wurde) |
| `antwort` | `ja`, `nein`, `unklar` oder `null` |
| `wert` | `{ wert, status }`, nur bei `typ = "zahl"` belegt, sonst `{ "wert": null, "status": null }`; Einheit laut Projektdatei |
| `notiz`, `fotos`, `erledigt`, `geaendert_am` | wie bei den übrigen Objekten |

Alle Prüfpunkte der Einheit stehen im Export, auch unbeantwortete. Ein Prüfpunkt, der in einer neueren
Projektdatei fehlt, aber Antworten hat, bleibt mit seiner `id` im Export.

`pruefpunkte.csv`, eine Zeile je Prüfpunkt:
`einheit_id;pruefpunkt_id;ort;text;typ;antwort;wert;wert_einheit;status;notiz;erledigt;fotos;geaendert_am`
(`ort`, `typ` und `wert_einheit` aus der Projektdatei, zum Lesen ohne Projektdatei).

Fotos: `<Einheit-ID>_<Prüfpunkt-ID ohne Einheit>_01.jpg`, z. B. `ALLG_P03_01.jpg`, `ALLG-1OG_P02_01.jpg`,
`EH051_P01_01.jpg`. Bei Wohnungen steht hier die Einheit-ID, nicht die begangene Ersatzwohnung.

### Raum
`aufnahme.json`, je Raum vor `geaendert_am`; `raeume.csv`, neue Spalten am Ende:

| JSON | CSV-Spalten | Werte |
|---|---|---|
| `keine_heizflaeche` | `keine_heizflaeche` | `true`/`false` (CSV `ja`/`nein`): vor Ort bestätigt, dass der Raum keine Heizfläche hat. Ein Raum ohne Heizfläche mit `keine_heizflaeche = false` ist nicht bestätigt |
| `lichte_hoehe_m` | `lichte_hoehe_m`, `lichte_hoehe_status` | `{ wert, status }` in m, z. B. `2.55` (CSV `2,55`) |
| `beheizt_vor_ort` | `beheizt_vor_ort` | `ja`, `nein`, `unklar` oder `null` |

`heizlast_w` wird nur angezeigt und steht nicht im Export (er kommt aus der Projektdatei).

### Fenster
`aufnahme.json`, je Fenster vor `geaendert_am`; `fenster.csv`, neue Spalten am Ende `art;erneuert;baujahr`:

| Feld | Werte |
|---|---|
| `art` | `fenster`, `fenstertuer`, `ladenfront`, `dachfenster` oder `null` |
| `erneuert` | `ja`, `nein`, `unklar` oder `null` |
| `baujahr` | Zahl (z. B. `1975`, vom Glasstempel) oder `null` |

Das Foto „Glasstempel“ steht mit den übrigen Fensterfotos in `fotos`, Dateiname
`<Einheit>_<Raum>_Fenster_Glasstempel_01.jpg`, z. B. `EH013_Whg116_R03-Wohnraum_Fenster_Glasstempel_01.jpg`.

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
- `antwort` (Prüfpunkt), `erneuert` (Fenster), `beheizt_vor_ort` (Raum): `ja`, `nein`, `unklar`
- `art` (Fenster): `fenster`, `fenstertuer`, `ladenfront`, `dachfenster`

## Dateiname
`Aufnahme_<projekt-id>_<JJJJ-MM-TT_HHMM>_<komplett|delta>_<umfang>.zip`, z. B.
`Aufnahme_beispiel_2026-12-05_1610_delta_EH010.zip`. Der Zusatz `_<umfang>` (Einheit, Tag oder `alle`)
verhindert, dass zwei Exporte in derselben Minute denselben Namen bekommen und sich in OneDrive überschreiben.
