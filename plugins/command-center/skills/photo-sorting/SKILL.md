---
name: photo-sorting
description: Rename and file site/job photos by date and activity — and (Modus B) rename/archive scanned handwritten Montage-/Serviceberichte by week, site, and crew. Use when the user drops jobsite photos or report scans, or says "sortier die Baustellenfotos", "benenne die Bilder um", "file these photos", "Bautagesbericht-Bilder einsortieren", "Bericht-Scans umbenennen", "Montageberichte einsortieren", "lose Bilder einsortieren". Reads each photo, infers date (from filename or image) and site/activity — matching activities verbatim against the Bautagesbericht when one exists — proposes consistent names, and files them after review.
---

# Photo sorting

Rename + file photos into the firm's structure with a consistent convention. Read `${CLAUDE_PLUGIN_ROOT}/reference/firm-config-contract.md` first.

## Step 0 — Self-verify (route, don't error)
Read `workspace_root` + `company-context.md`, then `_firma/config/photo-sorting.json`. If missing/incomplete, say *"Ich habe die Foto-Einrichtung (Tätigkeiten, Namensschema, Zielordner) noch nicht — jetzt einrichten?"* and run onboarding (`reference/rules.md` §Onboarding, asking per `${CLAUDE_PLUGIN_ROOT}/reference/onboarding-ux.md`).

## Step 1 — Read each photo
For photos in `_eingang/photo-sorting/` (oder von der **intake**-Skill aus dem gemeinsamen `_eingang/` hierher geroutet; or attached): determine the **date** (parse the filename first per `reference/rules.md`; apply the morning heuristic; else read the image / ask). Infer **site/project** (match against `stammdaten/projekte.json` if present, else ask) and **activity** — **Bautagesbericht zuerst**: suche den Bericht zu Projekt + Datum/KW (in `_ausgang/berichte/` und im konfigurierten `bericht_quelle`-Ordner) und übernimm die wörtliche Tages-Formulierung als Slug; erst danach Katalog / Bild / Frage (Reihenfolge + Content-over-Timestamp-Regel: `reference/rules.md`).

### Modus B — Bericht-Scans (bei `bericht_scans: an`)
Ist die Datei kein Baustellenfoto, sondern ein **abfotografierter/gescannter handschriftlicher Bericht-Vordruck** (Montage-/Servicebericht — von intake als Modus B geroutet): folge `reference/bericht-scans.md`. Schema `JJJJ KWnn BV V.Nachname [V.Nachname …][_Suffix].ext`, Monteur-Schreibweisen exakt aus `stammdaten/monteure.json`, Ziel `<zielordner>/KWnn/`. Queue-Posten mit `values`: `jahr, kw, bv, monteure, suffix`. Mehrdeutige Handschrift → `prüfen` + Rückfrage, nie raten.

### Lose Dateien im Bestand
Sagt der Nutzer „lose Bilder einsortieren" (oder liegen Dateien direkt im Bilder-Wurzelordner): Hash-Check gegen die Zielstruktur, Dubletten ausweisen, Unikate per ISO-Woche in KW-Ordner vorschlagen — `reference/rules.md` §Lose Dateien. Alles über die normale Review-Queue.

## Step 2 — Propose names
Build the filename per the configured convention (default `<datum>_<site-slug>_<taetigkeit>_<lfd:02d>.<ext>`). Show the full proposed name + target folder for each photo. Flag low-confidence inferences as "prüfen".

## Step 3 — Review → file
After approval, **copy** (don't move originals unless asked) each photo to its target folder (default `_ausgang/bilder`, or the firm's project subpath e.g. `<kunde>/<ordner>/Bilder`). Collision-safe lfd numbering — never overwrite.

## Step 4 — Confirm
List what was filed and any "prüfen" items.

## Step 4b — Signal loggen (best-effort)
Append friction signals to `<workspace>/_firma/_state/signals.jsonl` per
`${CLAUDE_PLUGIN_ROOT}/reference/signals.md` — one JSON line each, never blocking the run:
- if the site was unknown and the user named it → `{type:"correction", key:"photo:unknown-site"}`
- if a low-confidence date had to be corrected → `{type:"correction", key:"photo:low-confidence-date"}`
- if the user said "wäre gut wenn…/merk dir…" → `{type:"observation", key:"observation:<slug>", detail:"…"}`
- if a project folder/structure had changed → `{type:"tech_change", key:"tech:pfad-geaendert", detail:"…"}`

## Step 5 — Log the run
After approval + filing, append one line to the activity log so the dashboard reflects it (see `${CLAUDE_PLUGIN_ROOT}/reference/activity-log.md`): a stable `run_id` like „photo-sorting-<YYYY-MM-DD>" (so a re-run updates the entry instead of double-counting), `process: photo-sorting`, `items` = number of photos filed, `summary` like „<N> Fotos sortiert · <Projekt>", `status: done`. A scheduled run left in review logs `status: prepared` instead (shown in the feed, not counted as time saved). Best-effort — logging must never block the run.

## Loop- / Sammel-Modus (stündlich)
Propose the renames/filings and stop at the review state; never move files unattended. See `${CLAUDE_PLUGIN_ROOT}/reference/automation.md`.

Dieser Prozess läuft stündlich über einen gemeinsamen Sammel-Task (siehe `${CLAUDE_PLUGIN_ROOT}/reference/automation.md`). Jeder Lauf ist idempotent:

- **Nur neuer Input.** Bevor eine Quelldatei eingereiht wird, prüfe, ob ihr workspace-relativer Pfad bereits (a) in einer offenen Queue unter `_firma/_review/`, (b) im Journal `_firma/_journal/*.jsonl`, oder (c) in der Merkliste `_firma/_state/seen-photo-sorting.json` steht. Wenn ja: überspringen. Ist nichts Neues da, beende den Lauf sofort ohne Queue — best-effort, nie blockierend.
- **Bündeln.** Alle neuen Quellen eines Laufs kommen in EINE Queue: existiert für heute schon eine offene Queue dieses Prozesses, hänge die neuen Aktionen dort an (fortlaufende `id`) und setze `rechecked`; sonst lege eine neue an. Niemals pro Datei eine eigene Queue.
- **Merkliste pflegen.** Nach dem Vorbereiten ergänze die neu eingereihten Quellpfade in `_firma/_state/seen-photo-sorting.json` (JSON-Array; Datei/Ordner anlegen, falls fehlend). Best-effort.

When a run is prepared but not reviewed inline (scheduled runs or any run where the user is not present to approve in chat), write one review-queue file (bzw. an die heutige offene Queue anhängen) per `${CLAUDE_PLUGIN_ROOT}/reference/review-queue.md` at `<workspace>/_firma/_review/R-<YYYY-MM-DD>-photo-sorting.json`. Use `runid` matching the activity-log entry (e.g. `photo-sorting-<YYYY-MM-DD>`), `process: "photo-sorting"`. Each photo becomes one action with `verb: "kopieren"`, `tier: "sicher"` when the date, site, and activity were all inferred with high confidence, `tier: "prüfen"` for any inference flagged as low-confidence, `reason` being the same justification shown in the inline review (what was verified, what is uncertain), `source` the `_eingang/photo-sorting/` path, `filename` the proposed collision-safe target name, `targets` the configured destination folder (inkl. KW-Subordner, wenn `kw_subfolder: an`), and `values` carrying: `standort`, `datum`, `taetigkeit` — bei Modus-B-Posten stattdessen `jahr`, `kw`, `bv`, `monteure`, `suffix`. The activity-log entry stays `status: prepared`; copying files happens only via the cockpit / `apply.ts`.
