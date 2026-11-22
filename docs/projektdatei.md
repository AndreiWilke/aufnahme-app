# Projektdatei `<projekt>.objekt.json`

Die App liest die Projektdatei per Dateiauswahl ein. Das Format unten ist **verbindlich** (Übergabe 2, Abschnitt 3).
Eine Datei in diesem Format lädt vollständig und ohne Warnung. Beispiel: [`data/beispiel.objekt.json`](../data/beispiel.objekt.json).

Echte Projektdateien gehören **nicht** ins Repository (`data/*.objekt.json` steht in `.gitignore`). Sie werden auf
dem iPad über „Projektdatei (JSON) laden“ aus OneDrive geöffnet.

```json
{
  "schema_version": 1,
  "projekt": {
    "id": "beispiel", "name": "Beispielprojekt", "adresse": "", "auftrag": "",
    "verwaltung": "", "bearbeiter": "", "stand": "2026-11-16", "hinweis": ""
  },
  "nutzungsarten": [
    { "key": "wohnen", "name": "Wohnraum", "soll_temp_c": 20 },
    { "key": "technik", "name": "Technik/Lüftung", "soll_temp_c": null }
  ],
  "einheiten": [
    {
      "id": "EH013",
      "eh": 13,
      "eh_zusatz": [],
      "art": "Wohnung",
      "bezeichnung": "Whg. 216",
      "geschoss": "2. OG",
      "wohnungstyp": 11,
      "ersatz": [ { "eh": 2, "bezeichnung": "Whg. 116", "geschoss": "1. OG" } ],
      "termin": "2026-12-05T12:35",
      "dauer_min": 15,
      "hinweis": "Räume gelten auch für die Ersatzwohnungen.",
      "raeume": [
        { "id": "EH013-R03", "nr": "03", "name": "Wohnraum", "nutzung": "wohnen",
          "flaeche_plan_m2": 26.6, "soll_temp_c": 20, "quelle": "Grundriss", "heizlast_w": 1209 }
      ],
      "pruefpunkte": [
        { "id": "EH013-P01", "ort": "Wohnraum", "text": "Fenster erneuert? Baujahr am Glasstempel",
          "typ": "text", "einheit": null, "wirkung": "U-Wert Fenster", "quelle": "iSFP" }
      ]
    }
  ]
}
```

## Felder

| Feld | Bedeutung | Verhalten in der App |
|---|---|---|
| `projekt.id` | nur Buchstaben, Ziffern, `-`, `_` | Schlüssel des Projekts, steht im ZIP-Namen |
| `projekt.name`, `projekt.hinweis` | Anzeigename, Hinweis zum Projekt | Hinweis steht oben in der Einheitenliste |
| `nutzungsarten[]` | `key`, `name`, `soll_temp_c` (Zahl oder `null`) | Die Auswahl der Nutzungen kommt immer aus dieser Liste, nie aus dem Code |
| `einheiten[].id` | `EH013`, `HZ`, `ALLG` | Schlüssel für Einspielen und Export (`einheit_id`) |
| `einheiten[].art` | `Wohnung`, `Gewerbe`, `Allgemein`, `Heizzentrale` | `Heizzentrale`: Checkliste statt Räume. `Gewerbe`: Nutzungszeiten, Wunschtemperatur und Ansprechpartner oben in der Einheit |
| `einheiten[].eh`, `eh_zusatz` | EH-Nummer, weitere zugehörige EH | Anzeige |
| `einheiten[].termin`, `dauer_min` | `JJJJ-MM-TTTHH:MM`, Minuten | Liste nach Tag gruppiert, nach Termin sortiert; gleiche Uhrzeit in Reihenfolge der Datei |
| `einheiten[].ersatz[]` | Ersatzwohnungen `{ eh, bezeichnung, geschoss }` | Auswahl in der Einheit, siehe unten |
| `einheiten[].hinweis` | optionaler Text | gut sichtbar oben in der Einheit |
| `raeume[].id` | im ganzen Projekt eindeutig, nur `A-Z a-z 0-9 -`. Seit Fassung 2 die ID des Rechenmodells (z. B. `ALLG-E01`, `ALLG-R01` in Einheit `ALLG-1OG`); das Muster `<Einheit-ID>-R<NN>` ist nicht mehr verbindlich | Schlüssel für Einspielen und Export (`raum_id`) |
| `raeume[].nutzung` | `key` aus `nutzungsarten` | vor Ort änderbar |
| `raeume[].flaeche_plan_m2` | Zahl oder `null` | `null` wird als „Fläche lt. Plan: –“ angezeigt, nicht als 0; im Export leer |
| `raeume[].soll_temp_c` | Zahl oder `null` | `null` wird als „–“ angezeigt; im Export leer |
| `raeume[].quelle` | Herkunft der Plandaten | klein unter dem Raumnamen; nicht im Export |
| `raeume[].heizlast_w` (seit 1.5.0) | Norm-Heizlast aus der Vorberechnung in W, Zahl oder `null` (unbeheizt), kann negativ sein | im Raum klein unter der Fläche: „Heizlast lt. Vorberechnung: 1.209 W (vorläufig)“, negativ „kein Wärmebedarf (Innenraum)“, `null` ohne Anzeige; Summe in der Raumliste. Nur Anzeige, keine eigene Berechnung, nicht im Export |
| `einheiten[].pruefpunkte[].annahme` (seit 1.6.0) | `{ text, wert, einheit, status: "D" \| "A" \| "S", quelle }` oder `null` (reine Frage) | über den Eingaben „Angenommen: <text> (<status>, <quelle>)“ und die Knöpfe passt / ändern / unklar. Bei `typ = "zahl"` übernimmt „passt“ `wert`, „ändern“ füllt das Zahlenfeld damit vor |
| `raeume[].annahmen` (seit 1.6.0) | `{ lichte_hoehe_m: { wert, status, quelle }, beheizt: { wert: true \| false, status, quelle } }`, beide optional | im Raum oben je eine Zeile mit passt / ändern / unklar und der Knopf „Raum wie angenommen“. Ohne Annahme bleiben die Felder lichte Höhe und beheizt aus 1.5.0 |
| `raeume[].fenster_plan[]` (seit 1.6.0) | `{ id, typ: "fenster" \| "fenstertuer" \| "ladenfront", bezeichnung, orientierung, breite_m, hoehe_m, anzahl, breite_status, hoehe_status, quelle, verglasung, erneuert: "ja" \| "nein" \| "unklar", baujahr, bestand_status }`, `id` im Projekt eindeutig | im Abschnitt Fenster zuerst die Liste „Laut Plan“ (Bezeichnung, Orientierung, „1,59 × 1,75 m“, Bestand, Status klein) mit passt / ändern / nicht vorhanden / unklar. „ändern“ legt einen vorbefüllten Fenster-Datensatz an |
| `einheiten[].pruefpunkte[]` (seit 1.5.0) | `{ id, ort, text, typ: "text" \| "zahl", einheit: "m" \| null, wirkung, quelle }`, `id` im Projekt eindeutig, nur `A-Z a-z 0-9 -` | einklappbare Liste „Prüfpunkte 2/4“ unter dem Hinweis der Einheit (auch Heizzentrale). Antwort ja/nein/unklar, bei `typ = "zahl"` Wert mit Einheit und gemessen/geschätzt, Notiz, Fotos, „erledigt“. `quelle` nur intern |

## Ersatzwohnung
Bei Wohnungen gilt die Raumliste auch für die Ersatzwohnungen. Wird in der Einheit eine Ersatzwohnung gewählt,
bleibt die Raumliste gleich. Es ändern sich nur `aufgenommen_eh` und `aufgenommen_bezeichnung`; `einheit_id` und
`raum_id` bleiben die der vorgesehenen Wohnung. Fotos tragen die tatsächlich begangene Wohnung im Namen, z. B.
`EH013_Whg116_R03-Wohnraum_HK1_Ventil_01.jpg`. Die Ersatzwohnung deshalb wählen, bevor das erste Foto entsteht.

## Warnungen und Fehler
- **Fehler** (Datei wird nicht geladen): kein gültiges JSON, `projekt.id` fehlt, keine Einheiten, doppelte
  Einheit-ID, doppelte Raum-ID.
- **Warnungen** (Datei wird geladen, Meldung nach dem Laden und in der Einheitenliste): unbekannte
  `schema_version`, unbekannte `art`, Einheit ohne Termin, Raum ohne Nutzung oder mit einer Nutzung, die nicht in
  `nutzungsarten` steht, Räume in der Heizzentrale, Prüfpunkt ohne `id` oder mit doppelter `id` (wird übergangen),
  Prüfpunkt mit unbekanntem `typ` (gilt als `text`).

## Toleranz
Ältere Schreibweisen aus Version 1.0 werden weiter gelesen (`projekt_id`, `projekt_name`, `einheit_id`, `raum_id`,
`schluessel`/`bezeichnung` bei Nutzungsarten, `datum` + `uhrzeit` statt `termin`). Neue Dateien bitte nur im
verbindlichen Format liefern.

Vor Ort angelegte Räume bekommen die Nummern `V01`, `V02` … (`raum_id` z. B. `EH010-V01`), damit sie nie mit
Planräumen zusammenfallen.

## Neuere Fassung einspielen
Einstellungen → „Neuere Projektdatei einspielen“. Zuordnung über Einheit-ID und Raum-ID:
- neue Einheiten und Räume werden ergänzt,
- Name, Nummer, Fläche und Quelle bestehender Räume werden aktualisiert,
- eine vor Ort geänderte Nutzung bleibt erhalten,
- eine gewählte Ersatzwohnung bleibt erhalten,
- `heizlast_w` bestehender Räume wird aktualisiert, die Angaben vor Ort (Keine Heizfläche, lichte Höhe, beheizt vor
  Ort) bleiben,
- Prüfpunkte werden über ihre `id` zugeordnet: Antworten bleiben, der Text wird aktualisiert, neue kommen dazu,
  entfallene **mit** Antwort bleiben und werden als „nicht mehr in der Projektdatei“ markiert, entfallene ohne
  Antwort werden entfernt,
- Prüfungen der Annahmen (seit 1.6.0) bleiben über Prüfpunkt-ID, Raum-ID und `fenster_plan[].id` erhalten. Hat sich
  eine Annahme geändert, wird „passt“ zurückgesetzt und der Punkt als „Annahme geändert, neu prüfen“ markiert;
  „ändern“ behält den eingegebenen Wert (Einzelheiten in `docs/export.md`),
- entfallene Räume oder Einheiten **mit** Aufnahmen bleiben erhalten und werden als „nicht mehr im Plan“ markiert,
  entfallene ohne Aufnahmen werden entfernt.

Ein Projekt, das mit einer älteren Version geladen wurde (bis 1.5), liest die App beim ersten Öffnen mit 1.6.0 einmal
neu aus der gespeicherten Projektdatei ein (wie „Neuere Fassung einspielen“). Damit erscheinen Prüfpunkte, Heizlast,
Annahmen und Fenster laut Plan, die Aufnahmen bleiben erhalten.

## Automatische Prüfung
`npm test` prüft die Beispieldatei und zusätzlich jede lokal vorhandene `data/*.objekt.json` (Raum-IDs und
Prüfpunkt-IDs eindeutig und nur `A-Z a-z 0-9 -`, jede Nutzung vorhanden, Heizzentrale ohne Räume, `heizlast_w` und
Prüfpunkte vollständig übernommen, Annahmen und Fenster laut Plan vollständig übernommen, Fenster-IDs eindeutig,
lädt ohne Warnung). Ältere Fassungen unter `data/alt/` werden nicht geprüft.
Für `ismaninger136.objekt.json` (Fassung 3) zusätzlich: 47 Einheiten, 295 Räume, 278 Prüfpunkte, 226 Fenster laut
Plan in 136 Räumen, `ALLG` mit 13
Räumen und 12 Prüfpunkten, Freitag Heizzentrale/`ALLG`/Gewerbe, Samstag Wohnungen und `ALLG-1OG` bis `ALLG-4OG`.
Auf GitHub liegt nur die Beispieldatei.
