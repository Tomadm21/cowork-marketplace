# End-to-end dry-run

A full walkthrough of the firm experience, with a synthetic firm (**Muster Bau GmbH** — no real client data). It shows the non-technical chat flow, the self-verify *routing* (not erroring), and the real deterministic `compute.ts` output.

## 0. Install (one time)

```
/plugin marketplace add ~/cowork-marketplace        # or the GitHub repo URL
/plugin install command-center@command-center
```

In Cowork, the user clicks **Work in a Folder** and grants the firm's workspace folder.

## 1. Setup

User: *"Richte mein Command Center ein."* → `firm-onboarding` runs.

Claude interviews in batches (identity → business → sites → people → tools → conventions → processes → glossary), using multiple-choice where possible. **No files are edited by the user; no terminal.** It then scaffolds:

```
<workspace>/
├── _firma/company-context.md
├── _firma/config/
├── _firma/stammdaten/            (projekte.json + personen.json — firm gave them)
├── _eingang/
└── _ausgang/
```

`_firma/company-context.md` (filled, firm-level only, stable anchors):

```
# Firmenkontext — Muster Bau GmbH
<!-- cc:meta -->
- plugin: command-center v0.1.0
- workspace_root: /Users/muster/MusterBau-Cowork
- onboarded: 2026-06-02
- sprache: de
## Identität
<!-- cc:identity -->
- Firmenname: Muster Bau GmbH
- Rechtsform: GmbH
- Adresse(n): Musterstraße 5, 49492 Musterstadt
- Inhaber / Geschäftsführung: Max Mustermann
...
## Geschäftsmodell
<!-- cc:business -->
- Was die Firma macht: Montage- und Bauleistungen für Industriekunden
- Branche: Bau/Montage
- Kundentyp: B2B Industrie
- Standard-MwSt: 0.19
...
## Aktive Prozesse
<!-- cc:processes -->
- invoicing — status: selected — config: _firma/config/invoicing.json
```

## 2. Activate a process — and the self-verify *routing* (negative branch)

User: *"Erstelle die Rechnung für KW 21, Baustelle Musterstraße."*

`invoicing` self-verifies (Step 0). `_firma/config/invoicing.json` doesn't exist yet, so instead of erroring it **routes**:

> *"Ich habe die Rechnungs-Einrichtung (Sätze, Personen, Spesen) noch nicht. Wollen wir das jetzt einrichten?"*

→ runs invoicing onboarding, collecting tiers, people, spesen, paths into `_firma/config/invoicing.json` (the shape in `skills/invoicing/scripts/config.example.json`). This is the fail-loud-by-routing behaviour (ISC-55): a non-technical user is never stuck on an error.

## 3. Run — vision + deterministic compute

The user drops a timesheet photo in `_eingang/invoicing/`. Claude reads it (Cowork vision) into rows, writes them to a temp `input.json`, and runs **the script — never inline math**:

```
bun ${CLAUDE_PLUGIN_ROOT}/skills/invoicing/scripts/compute.ts \
    /Users/muster/MusterBau-Cowork/_firma/config/invoicing.json \
    /tmp/input.json
```

Verified output (this is a real run of `compute.ts` against the example config; numbers hand-checked):

```
Summe netto:  2695.00 EUR
MwSt (19%):    512.05 EUR
Summe brutto: 3207.05 EUR

Mitarbeiter A (top): 29.5 h × tiered → 1180.00 + Spesen 60 + KFZ 180 (240km) + Hotel 170 (2 Nächte) = 1590.00
Mitarbeiter B (mid): 22.0 h → 797.50 + Spesen 30 = 827.50   (Mo 05-18 auf 17h gekappt; So 05-24 Wochenend-Satz 31)
Unbekannt Neu (std angenommen): 7.5 h → 262.50 + Spesen 15 = 277.50

prüfen:
- Mitarbeiter B 2026-05-18: Tag auf 17h gekappt
- Unbekannte Person "Unbekannt Neu" → Tier "std" angenommen
- Unbekannt Neu: 50 km erfasst, aber kein KFZ in config → nicht berechnet
- Spesen-Heuristik (An-/Abreise = Halbtag, dazwischen Volltag) angewandt
```

Claude shows this as a pro-forma, surfaces every **prüfen** line, and waits. On approval it builds the xlsx invoice into `_ausgang/rechnungen` (collision-safe) and confirms the path. Nothing is sent.

To reproduce locally:

```
cd plugins/command-center/skills/invoicing
bun scripts/compute.ts scripts/config.example.json <your-input.json>
```

## 4. Automate (optional)

User: *"Mach das jeden Montag automatisch."* → Claude walks `/schedule` (weekly), with the honest caveat that it runs only while Cowork is open + the Mac is awake, and that scheduled runs stop at the review state — invoices are never finalized unattended. See `reference/automation.md`.

## What this proves

- A non-technical owner completes setup and a run entirely in chat (no files/terminal) — ISC-29.
- Self-verify **routes** to onboarding instead of failing — ISC-55.
- Money math runs **only** through `compute.ts`, with the invocation + numeric output shown — ISC-33, ISC-57.
- One process onboarded + activated + a sample output produced, end to end — ISC-30.
