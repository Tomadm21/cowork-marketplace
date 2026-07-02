# Photo sorting — rules & onboarding

> **Modus B (Bericht-Scans):** Regeln für das Umbenennen/Archivieren abfotografierter Montage-/Serviceberichte stehen in `reference/bericht-scans.md` (aktiv bei `bericht_scans: an`).

## Date parsing (try in order)
1. **WhatsApp**: `... YYYY-MM-DD at HH.MM.SS` → date + time.
2. **IMG-YYYYMMDD-WA####** → date.
3. **Plain ISO** start `YYYY-MM-DD` / `YYYYMMDD`.
4. Else read the image's visible date or EXIF, or ask.

## Morning heuristic
If a time is known and it's **07:00–10:59**, subtract one day — photos taken in the morning usually document the **previous** day's work. (Configurable on/off.)

## Inhalt schlägt Zeitstempel
Der Zeitstempel ist nur eine Heuristik. Liegt ein Bautagesbericht vor (§Site & activity matching), gilt: zeigt ein Foto eindeutig eine Tätigkeit, die der Bericht einem **anderen** Tag zuordnet, bekommt das Foto das Datum aus dem Bericht — egal wann es aufgenommen oder gesendet wurde. Widerspruch ohne klare Auflösung → tier `prüfen`.

## Naming convention
Default: `<datum>_<site-slug>_<taetigkeit>_<lfd:02d>.<ext>`. `lfd` is a per-day, per-site running number, zero-padded. Collision-safe: bump `lfd` rather than overwrite.

## Site & activity matching
- Site: match filename/image cues against `stammdaten/projekte.json` (`match` keyword → `name` + `ordner_name`). No register → ask.
- Activity — Quellen in dieser Reihenfolge:
  1. **Bautagesbericht zuerst** (wenn vorhanden): suche den Bericht zu Projekt + Datum/KW — in `_ausgang/berichte/` (eigene daily-report-Ausgabe) und im konfigurierten `bericht_quelle`-Ordner. Extrahiere die **wörtlichen** Tätigkeits-Formulierungen pro Tag und bilde daraus Slugs (z. B. „Säulen und Dachstützen rundherum eingeschnitten" → `Saeulen-eingeschnitten`, „Lastplattendruckversuch durchgeführt" → `Lastplattendruckversuch`). Wörtlich bleiben — daran hängt der Bezug zur Abrechnung/Dokumentation.
  2. Katalog: pick from the firm's configured activity list.
  3. Bild lesen (Vision) / fragen.
  Nicht zu generisch: „Pflasterarbeiten" für alles ist unzureichend, wenn der Bericht Spezifischeres hergibt.

## Target path
Default `_ausgang/bilder`. If the firm mirrors into project folders, use `<base>/<kunde>/<ordner_name>/<bilder_subfolder>` from config.

**KW-Subordner** (`kw_subfolder: an`): unterhalb des Bilder-Ziels je Kalenderwoche ein Unterordner. Schreibweise: **vorhandene Konvention im Zielordner beibehalten** (`KW 19` vs. `KW19` — erst schauen, dann anlegen); für neue Ordner gilt `kw_folder_prefix` (Default `"KW "` mit Leerzeichen). Die Woche ist die **ISO-Woche** (ISO 8601, Montag-Start) aus dem Foto-Datum — bei Unsicherheit per `python3 -c "import datetime; print(datetime.date(J,M,T).isocalendar()[:2])"` prüfen (liefert ISO-Jahr + KW, auch am Jahreswechsel korrekt).

## Lose Dateien im Bilder-Bestand säubern
Auf Zuruf („lose Bilder einsortieren") oder wenn beim Ablegen Dateien direkt im Bilder-Wurzelordner liegen (statt in KW-/Projekt-Subordnern):
1. **Hash-Check gegen die Zielstruktur**: md5 jeder losen Datei gegen alle Dateien der Subordner. Treffer = **Dublette** → als Karte „Dublette — bereits einsortiert unter `<pfad>`" ausweisen, nichts kopieren (Löschen des losen Originals nur auf ausdrücklichen Wunsch).
2. **Unikat** → normaler Posten: Datum aus dem Dateinamen (§Date parsing), KW per ISO-Woche, Vorschlag in den passenden KW-Ordner (anlegen falls fehlend, Konvention s. o.).
3. Alles läuft über die normale Review-Queue — nie unbeaufsichtigt verschieben.

## Anti-Patterns
- **Vorhandenen Dateinamen blind vertrauen** — auch halbautomatisch erzeugte Namen sind oft falsch (klassischer Fall: „Schalungen_Fundamente" auf Fotos, die in Wahrheit einen Lastplattendruckversuch zeigen). Vor großen Umbenennungen 5–10 Stichproben per Vision lesen.
- **EXIF blind vertrauen** — WhatsApp strippt EXIF; das Datum MUSS dann aus dem Dateinamen kommen.
- **Bericht-Header blind vertrauen** — zeigt der Bericht-Kopf „KW 19", die Tagesdaten innen gehören aber zu KW 20, ist meist der Header der Tippfehler. Tagesdaten gewinnen; als `prüfen` markieren, Dateien nicht vorschnell „korrigieren".
- **Tätigkeit zu generisch** — die spezifische Bericht-Formulierung schlägt den Sammelbegriff.

## Onboarding (run once per firm)
**Ask per `${CLAUDE_PLUGIN_ROOT}/reference/onboarding-ux.md`** (detect-first, numbered options + ✏️ + ⏭️, path-picker). Collect into `_firma/config/photo-sorting.json`:

1. **Activity catalog** `activities` — options: `1. Bau-Standardset übernehmen` (the generic Tiefbau starter below, editable) · `2. eigene Liste eingeben` · `3. später / frei lassen` · ✏️. A fixed catalog keeps filenames consistent (the model picks from it, not free text).
2. **Naming pattern** `naming_pattern` — default `{datum}_{baustelle}_{taetigkeit}_{lfd}` · ✏️. `lfd` = per day+site+activity running number, zero-padded.
3. **Umlauts** `umlaut_map` — default `ä→ae, ö→oe, ü→ue, ß→ss` (cross-platform) · „Umlaute behalten" · ✏️.
4. **Morning heuristic** `morning_heuristic` — default `an` (a photo taken 07:00–10:59 documents the previous day) · `aus` · ✏️.
5. **Fallback activity** `fallback` — default `Uebersicht` · ✏️.
6. **Zielordner** 🔍 — path-picker; propose a detected `Bauvorhaben`/`Baustellen` folder; capture the per-project pattern `Bauvorhaben ‹Jahr›/‹Kunde›/‹Baustelle›/` (resolve `‹Kunde›`/`‹Baustelle›` per run — match-or-create, never duplicate). Default `_ausgang/bilder`. *(gespeichert als `output_base` + `project_subpath_pattern`)*

7. **Bericht-Quelle** `bericht_quelle` 🔍 — Ordner mit fertigen Bautagesberichten (für den Tätigkeits-Abgleich). Default `_ausgang/berichte` (die eigene daily-report-Ausgabe); zusätzlich per Path-Picker den Berichtsordner der Firma erfassen · ⏭️.
8. **KW-Unterordner** `kw_subfolder` — default `aus` · `an` (+ `kw_folder_prefix`, Default `"KW "` mit Leerzeichen) · ✏️.
9. **Bericht-Scans (Modus B)** `bericht_scans` — „Sollen abfotografierte/gescannte Montage-/Serviceberichte mit umbenannt und archiviert werden?" — default `aus` · `an` → Sub-Onboarding nach `reference/bericht-scans.md` §Onboarding (Zielordner, BV-Kurzformen, Monteur-Schreibweisen → `stammdaten/monteure.json`).

(Sites come from `stammdaten/projekte.json` — propose its entries; offer to create it if absent.)
Then set `photo-sorting` under `cc:processes` to `onboarded`.

## Activity starter catalog (generic Tiefbau — editable per firm)
A neutral construction set the firm can adopt and edit; spaces become `-` in filenames:

Baustelleneinrichtung · Verkehrsabsicherung · Materialanlieferung · Geraete-Maschineneinsatz · Aufraeumen · Oberbodenabtrag · Auskoffern · Aushub-Fundament · Kabelgraben-herstellen · Baugrube-herstellen · Aushub-seitlich-lagern · Schotter-seitlich-lagern · Regenwasserleitung-legen · Kabel-verlegen · Kabel-absanden · Leitungen-verfuellen · Baugrube-anfuellen · Fundament-herstellen · Fundament-setzen · Poller-setzen · Markierungsplatten-legen · Schotter-einbauen · Splitt-einbauen · Sand-einbauen · Planum-herstellen · Splitt-abziehen · Verdichten · Borde-setzen · Pflastern · Einschlaemmen · Anfahrpfosten-anschneiden · Trafolieferung · Trafosetzung · Asphalt-stemmen · Lastplattendruckversuch · Restarbeiten · Feinreinigung · Endzustand

## Confidence-Kalibrierung & Lernschleife (v0.7.0)
- **`sicher`** nur, wenn: Baustelle in `stammdaten/projekte.json` zugeordnet, Datum sicher (EXIF oder eindeutig aus Dateiname), Tätigkeit aus dem Katalog mit hoher Sicherheit, Zielordner eindeutig.
- **`prüfen`** sonst — fehlendes EXIF-Datum, unklare Baustelle, geratene Tätigkeit (`Uebersicht`-Fallback).
- **Neue Baustelle** (nicht in `projekte.json`): `prüfen` **und** `fact:baustelle-<slug>`-Signal mit `severity:"folgenreich"`. Nach Freigabe Übernahme in Stammdaten anbieten (Lernschleife).
