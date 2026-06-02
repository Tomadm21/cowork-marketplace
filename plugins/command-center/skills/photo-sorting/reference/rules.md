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
Collect into `_firma/config/photo-sorting.json`:
- `activities` — the list of activity tags used.
- `naming_pattern` (default above), `morning_heuristic` (default true).
- `output_base` + optional `project_subpath_pattern` + `bilder_subfolder`.
- (Sites come from `stammdaten/projekte.json` — offer to create it if absent.)
Then set `photo-sorting` under `cc:processes` to `onboarded`.
