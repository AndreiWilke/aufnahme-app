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
          "flaeche_plan_m2": 26.6, "soll_temp_c": 20, "quelle": "Grundriss" }
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
| `raeume[].id` | `<Einheit-ID>-R<NN>`, im ganzen Projekt eindeutig | Schlüssel für Einspielen und Export (`raum_id`) |
| `raeume[].nutzung` | `key` aus `nutzungsarten` | vor Ort änderbar |
| `raeume[].flaeche_plan_m2` | Zahl oder `null` | `null` wird als „Fläche lt. Plan: –“ angezeigt, nicht als 0; im Export leer |
| `raeume[].soll_temp_c` | Zahl oder `null` | `null` wird als „–“ angezeigt; im Export leer |
| `raeume[].quelle` | Herkunft der Plandaten | klein unter dem Raumnamen; nicht im Export |

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
  `nutzungsarten` steht, Räume in der Heizzentrale.

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
- entfallene Räume oder Einheiten **mit** Aufnahmen bleiben erhalten und werden als „nicht mehr im Plan“ markiert,
  entfallene ohne Aufnahmen werden entfernt.

## Automatische Prüfung
`npm test` prüft die Beispieldatei und zusätzlich jede lokal vorhandene `data/*.objekt.json` (Raum-IDs eindeutig,
jede Nutzung vorhanden, Heizzentrale ohne Räume, lädt ohne Warnung). Auf GitHub liegt nur die Beispieldatei.
