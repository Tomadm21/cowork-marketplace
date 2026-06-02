# Daily report — rules & onboarding

## Compute rules
This arithmetic (cap + break subtraction) is intentionally done inline by the skill — it is simple, non-monetary, and shown to the operator for review. (Contrast invoicing, whose money math is forbidden from running inline and must go through `compute.ts`. The script-only rule applies to money/legal totals, not to a report's hour count.)

- **Daily cap**: if a day's total (Reisezeit + Arbeit) exceeds the configured cap (default 17h), cap it and flag "prüfen".
- **Netto hours**: subtract the statutory break (floored at the configured minimum, default 0.5h) per worked day.
- **Filename**: `KW<KW>-<Projekt>-<Jahr>` (configurable). Collision-safe: if the target exists, append `_2`, `_3`… — never overwrite.

## Onboarding (run once per firm)
Collect into `_firma/config/daily-report.json` (keyed JSON; firm-level facts stay in `company-context.md`):
- `template_path` — the firm's report template (DOCX). Ask them to place it in the workspace; store the path.
- `fields` — which fields the template needs (Standort, PLZ, Straße, Projekt, KW, Bauleiter, roles like Meister/Fachmonteure/Monteure). Map them to template placeholders.
- `day_labels` — day names (default Montag…Sonntag).
- `daily_cap_total_h` (default 17), `pflicht_pause_h` (default 0.5).
- `output_path` (default `_ausgang/berichte`).
Then set the `daily-report` line under `cc:processes` to `onboarded`.

If the firm has no template yet, offer to generate a simple one; note it's a starter they can replace.
