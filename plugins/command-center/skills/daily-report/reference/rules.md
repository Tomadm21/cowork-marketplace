# Daily report — rules & onboarding

## Compute rules
This arithmetic (cap + break subtraction) is intentionally done inline by the skill — it is simple, non-monetary, and shown to the operator for review. (Contrast invoicing, whose money math is forbidden from running inline and must go through `compute.ts`. The script-only rule applies to money/legal totals, not to a report's hour count.)

- **Daily cap**: if a day's total (Reisezeit + Arbeit) exceeds the configured cap (default 17h), cap it and flag "prüfen".
- **Netto hours**: subtract the statutory break (floored at the configured minimum, default 0.5h) per worked day.
- **Filename**: `KW<KW>-<Projekt>-<Jahr>` (configurable). Collision-safe: if the target exists, append `_2`, `_3`… — never overwrite.

## Onboarding (run once per firm)
**Ask per `${CLAUDE_PLUGIN_ROOT}/reference/onboarding-ux.md`** (detect-first, numbered options + ✏️ + ⏭️, path-picker). Collect into `_firma/config/daily-report.json` (keyed JSON; firm-level facts stay in `company-context.md`). Present each with a default:

1. **Template** 🔍 `template_path` — scan for a `*Vorlage*` / `*Bautagebuch*` / `*Tagesbericht*` DOCX and propose it (path-picker); else offer „eine einfache Vorlage anlegen" (starter, replaceable).
2. **Time cap** `cap_time` — default `17:00` (the „Bis"-Zeit is capped to it and netto recomputed). Options: `17:00` · `keine Kappung` · ✏️.
3. **Whose hours** `roles_in_report` — default `nur Vorarbeiter` (others on the source are ignored). Options: `nur Vorarbeiter` · `alle` · ✏️.
4. **Project-title parsing** `title_parts` — how the project title splits into fields. Default order `Ort · Netzbetreiber · GU · Nummer · Bauleiter` (e.g. „Musterstadt M-Netz Musterbau 1234 Vorname"). Confirm/reorder; ✏️.
5. **Template fields** 🔍 `fields` — read the template's placeholders and propose the mapping (Standort, PLZ, Straße, Projekt, KW, Bauleiter, roles) in bulk to confirm.
6. **Day labels** `day_labels` — default `Montag…Sonntag` · ✏️.
7. **Pause & Tages-Obergrenze** — Pflichtpause pro Tag (Vorschlag 0,5h) und Obergrenze Arbeit+Reise pro Tag (Vorschlag 17h). Optionen: `Vorschläge übernehmen` · ✏️. *(gespeichert als `pflicht_pause_h`, `daily_cap_total_h`)*
8. **Filename schema** `filename_schema` — default `{standort} Bautagesbericht KW {kw}` · tagesbasiert `{standort}_Bautagesbericht_{datum}` · ✏️.
9. **Output path** 🔍 `output_path` — path-picker; propose a detected `*Bautagesberichte*` folder; capture as a pattern if it nests per project (`Bauvorhaben ‹Jahr›/‹Kunde›/‹Baustelle›/8.Bautagesberichte`). Default `_ausgang/berichte`.

Then set the `daily-report` line under `cc:processes` to `onboarded`. If the firm has no template, offer to generate a simple starter they can replace.
