# Lead-gen — rules & onboarding

## Input modes
- **paste** — URLs one per line.
- **file** — Excel/CSV; ask which column holds the URL.
- **sheet** — a public sheet link (export to CSV). Private sheets need the firm's own credentials and are out of scope for the default skill.

## Enrichment
Pull publicly available contact details from each company's site (typically the Impressum / Kontakt page in DE): company name, contact person if listed, email, phone, address. Don't fabricate fields — leave blank if not found.

## ICP scoring
Score each company 0–100 against the firm's ICP criteria (industry, size signals, region, keywords). Output the score + a one-line reason. Default threshold to flag "good fit" is configurable.

## Compliance (hard)
- Respect each site's **terms of service**, including restrictions on automated access; skip sites that prohibit it.
- Public business contact data only. Note GDPR context: B2B contact data still has obligations — this skill **collects + scores**, it does not message anyone.
- Cowork's built-in Chrome automation can be slow; for large lists, warn the user and consider batching.

## Onboarding (run once per firm)
**Ask per `${CLAUDE_PLUGIN_ROOT}/reference/onboarding-ux.md`** (numbered options + ✏️ + ⏭️, path-picker). Collect into `_firma/config/lead-gen.json`:

1. **ICP criteria** 🔍 `icp_criteria` — seed from `cc:business` customer type and propose it back to edit: industry, size signals, region, keywords (✏️ per field).
2. **Score threshold** `score_threshold` — default `40` · options `25 / 40 / 60` · ✏️.
3. **Output path** `output_path` — path-picker; default `_ausgang/leads`.
4. **Höflichkeit** — robots.txt respektieren (Vorschlag: ja) und moderate Geschwindigkeit. Optionen: `übernehmen` · ✏️. *(gespeichert als `respect_robots`, `default_workers`)*

Then set `lead-gen` under `cc:processes` to `onboarded`.
