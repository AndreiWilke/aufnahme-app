# AGENTS.md – Aufnahme-App Heizkörper

Lies zuerst `UEBERGABE.md`. Sie ist die verbindliche Anforderung.

Kurzregeln:
- Offline-first PWA für Safari auf dem iPad, statisch, kein Backend.
- Oberfläche auf Deutsch, Umlaute und ß korrekt, keine Gendersprache.
- Datenmodell und Exportformat aus `UEBERGABE.md` Abschnitt 5 exakt einhalten; das ist die Schnittstelle zu Claude.
- Jeder Messwert trägt den Status `gemessen` oder `geschätzt`; dieser Status darf nirgends verloren gehen.
- Fotos und Daten in IndexedDB, Autosave nach jeder Eingabe, kein Datenverlust.
- Projektdaten kommen aus `data/*.objekt.json`; die App ist projektneutral.
- Termin: lauffähige Version 1 bis Fr 20.11.2026 (Testlauf auf dem iPad), Einsatz am 04./05.12.2026.
