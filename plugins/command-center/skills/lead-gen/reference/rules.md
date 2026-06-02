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
Collect into `_firma/config/lead-gen.json`:
- `icp_criteria` — industry/size/region/keywords that define a good customer (seed from `cc:business` customer type).
- `score_threshold` (default 40).
- `output_path` (default `_ausgang/leads`).
- `default_workers` (parallelism, default modest), `respect_robots` (default true).
Then set `lead-gen` under `cc:processes` to `onboarded`.
