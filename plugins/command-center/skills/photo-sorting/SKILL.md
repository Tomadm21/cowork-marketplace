---
name: photo-sorting
description: Rename and file site/job photos by date and activity. Use when the user drops jobsite photos or says "sortier die Baustellenfotos", "benenne die Bilder um", "file these photos", "Bautagesbericht-Bilder einsortieren". Reads each photo, infers date (from filename or image) and site/activity, proposes consistent names, and files them after review.
---

# Photo sorting

Rename + file photos into the firm's structure with a consistent convention. Read `${CLAUDE_PLUGIN_ROOT}/reference/firm-config-contract.md` first.

## Step 0 — Self-verify (route, don't error)
Read `workspace_root` + `company-context.md`, then `_firma/config/photo-sorting.json`. If missing/incomplete, say *"Ich habe die Foto-Einrichtung (Tätigkeiten, Namensschema, Zielordner) noch nicht — jetzt einrichten?"* and run onboarding (`reference/rules.md` §Onboarding, asking per `${CLAUDE_PLUGIN_ROOT}/reference/onboarding-ux.md`).

## Step 1 — Read each photo
For photos in `_eingang/photo-sorting/` (or attached): determine the **date** (parse the filename first per `reference/rules.md`; apply the morning heuristic; else read the image / ask). Infer **site/project** (match against `stammdaten/projekte.json` if present, else ask) and **activity** (from the configured list / image).

## Step 2 — Propose names
Build the filename per the configured convention (default `<datum>_<site-slug>_<taetigkeit>_<lfd:02d>.<ext>`). Show the full proposed name + target folder for each photo. Flag low-confidence inferences as "prüfen".

## Step 3 — Review → file
After approval, **copy** (don't move originals unless asked) each photo to its target folder (default `_ausgang/bilder`, or the firm's project subpath e.g. `<kunde>/<ordner>/Bilder`). Collision-safe lfd numbering — never overwrite.

## Step 4 — Confirm
List what was filed and any "prüfen" items.

## Scheduled mode
Propose the renames/filings and stop at the review state; never move files unattended. See `${CLAUDE_PLUGIN_ROOT}/reference/automation.md`.
