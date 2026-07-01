# Photo sorting — rules & onboarding

## Date parsing (try in order)
1. **WhatsApp**: `... YYYY-MM-DD at HH.MM.SS` → date + time.
2. **IMG-YYYYMMDD-WA####** → date.
3. **Plain ISO** start `YYYY-MM-DD` / `YYYYMMDD`.
4. Else read the image's visible date or EXIF, or ask.

## Morning heuristic
If a time is known and it's **07:00–10:59**, subtract one day — photos taken in the morning usually document the **previous** day's work. (Configurable on/off.)

## Naming convention
Default: `<datum>_<site-slug>_<taetigkeit>_<lfd:02d>.<ext>`. `lfd` is a per-day, per-site running number, zero-padded. Collision-safe: bump `lfd` rather than overwrite.

## Site & activity matching
- Site: match filename/image cues against `stammdaten/projekte.json` (`match` keyword → `name` + `ordner_name`). No register → ask.
- Activity: pick from the firm's configured activity list; if none fits, ask.

## Target path
Default `_ausgang/bilder`. If the firm mirrors into project folders, use `<base>/<kunde>/<ordner_name>/<bilder_subfolder>` from config.

## Onboarding (run once per firm)
**Ask per `${CLAUDE_PLUGIN_ROOT}/reference/onboarding-ux.md`** (detect-first, numbered options + ✏️ + ⏭️, path-picker). Collect into `_firma/config/photo-sorting.json`:

1. **Activity catalog** `activities` — options: `1. Bau-Standardset übernehmen` (the generic Tiefbau starter below, editable) · `2. eigene Liste eingeben` · `3. später / frei lassen` · ✏️. A fixed catalog keeps filenames consistent (the model picks from it, not free text).
2. **Naming pattern** `naming_pattern` — default `{datum}_{baustelle}_{taetigkeit}_{lfd}` · ✏️. `lfd` = per day+site+activity running number, zero-padded.
3. **Umlauts** `umlaut_map` — default `ä→ae, ö→oe, ü→ue, ß→ss` (cross-platform) · „Umlaute behalten" · ✏️.
4. **Morning heuristic** `morning_heuristic` — default `an` (a photo taken 07:00–10:59 documents the previous day) · `aus` · ✏️.
5. **Fallback activity** `fallback` — default `Uebersicht` · ✏️.
6. **Zielordner** 🔍 — path-picker; propose a detected `Bauvorhaben`/`Baustellen` folder; capture the per-project pattern `Bauvorhaben ‹Jahr›/‹Kunde›/‹Baustelle›/` (resolve `‹Kunde›`/`‹Baustelle›` per run — match-or-create, never duplicate). Default `_ausgang/bilder`. *(gespeichert als `output_base` + `project_subpath_pattern`)*

(Sites come from `stammdaten/projekte.json` — propose its entries; offer to create it if absent.)
Then set `photo-sorting` under `cc:processes` to `onboarded`.

## Activity starter catalog (generic Tiefbau — editable per firm)
A neutral construction set the firm can adopt and edit; spaces become `-` in filenames:

Baustelleneinrichtung · Verkehrsabsicherung · Materialanlieferung · Geraete-Maschineneinsatz · Aufraeumen · Oberbodenabtrag · Auskoffern · Aushub-Fundament · Kabelgraben-herstellen · Baugrube-herstellen · Aushub-seitlich-lagern · Schotter-seitlich-lagern · Regenwasserleitung-legen · Kabel-verlegen · Kabel-absanden · Leitungen-verfuellen · Baugrube-anfuellen · Fundament-herstellen · Fundament-setzen · Poller-setzen · Markierungsplatten-legen · Schotter-einbauen · Splitt-einbauen · Sand-einbauen · Planum-herstellen · Splitt-abziehen · Verdichten · Borde-setzen · Pflastern · Einschlaemmen · Anfahrpfosten-anschneiden · Trafolieferung · Trafosetzung · Asphalt-stemmen · Lastplattendruckversuch · Restarbeiten · Feinreinigung · Endzustand

## Confidence-Kalibrierung & Lernschleife (v0.7.0)
- **`sicher`** nur, wenn: Baustelle in `stammdaten/projekte.json` zugeordnet, Datum sicher (EXIF oder eindeutig aus Dateiname), Tätigkeit aus dem Katalog mit hoher Sicherheit, Zielordner eindeutig.
- **`prüfen`** sonst — fehlendes EXIF-Datum, unklare Baustelle, geratene Tätigkeit (`Uebersicht`-Fallback).
- **Neue Baustelle** (nicht in `projekte.json`): `prüfen` **und** `fact:baustelle-<slug>`-Signal mit `severity:"folgenreich"`. Nach Freigabe Übernahme in Stammdaten anbieten (Lernschleife).
