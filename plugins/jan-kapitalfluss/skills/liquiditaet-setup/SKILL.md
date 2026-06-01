---
name: liquiditaet-setup
description: Use this once at kickoff to activate the Kapitalfluss automation for a store — map the real Vektonce + Liquiditätsplanung files, the real Commerzbank CSV columns, and the DBA categorization rules into config, then do the first Liquiditätsplanung fill. This is the workshop (config-only) step, run once per store.
---

# Einrichtung (einmalig pro Store)

This skill turns the synthetic fixtures into the store's real setup. It is a **data-mapping** step — no code changes.

## When to use

At the 1h kickoff workshop, once per store (and again when a new store like Dessau opens).

## Steps

1. **Confirm the files.** Verify the real `Vektonce.xlsx` is `.xlsx` (not `.xlsm` — macros are out of scope) and that the Liquiditätsplanung template is available. Place both in the Cowork-granted folder.
2. **Map the CSV.** Open a real Commerzbank CSV export. Reconcile `config/csv-profiles/commerzbank-default.json` against the actual header variant, delimiter, encoding, date and decimal format. If it differs, edit that JSON only.
3. **Map the workbook cells.** Open the real Vektonce.xlsx; read off the real sheet names and the target cells / append-anchors into `config/excel-maps/vektonce.<store>.json`. Do the same for the Liquiditätsplanung P&L lines in `config/excel-maps/liquiditaet.template.json` (`bucketTargets`).
4. **Author the DBA mapping.** Capture the store's categorization rules live with the operator into `config/dba-mapping/mapping.v1.json` (counterparty/purpose/sign → bucket). Semver the filename.
5. **Repoint the registry.** Edit `config/stores.json`: set the store's `vektonceWorkbook` / `liquiditaetWorkbook` to the real file paths in the Cowork-granted folder, and set the archive storage path.
6. **Validate.** Run a `plan_run` against the real CSV and review the change-overview together. Then run the **open-in-Excel smoke**: open the written Vektonce copy once in Excel and confirm formulas recalc and any chart survives — only after this passes do we promise the no-alter guarantee on this file.
7. **First Liquiditätsplanung fill.** With approval, commit the first run so the template is populated and from then on auto-maintained.

## Hard rules

- This is config-only. If a real file needs logic the engine does not have (a rule that is more than data, an `.xlsm`, a structural surprise), STOP and flag a scoped change — do not bend the no-alter guarantee.
- Develop and validate on the user's real files inside their own workspace — never copy real financial data out (keeps the Tier-3 no-AVV position intact).
