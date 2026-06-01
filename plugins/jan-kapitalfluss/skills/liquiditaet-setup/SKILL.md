---
name: liquiditaet-setup
description: Use this once at kickoff to activate the Kapitalfluss automation — point it at the ONE Commerzbank business account, map the real Vektonce-Kapitalflusstabelle + Liquiditätsplanung files and the real Commerzbank CSV columns into config, confirm the simple income/expense split, then do the first run. This is the workshop (config-only) step, run once.
---

# Einrichtung (einmalig)

This skill turns the synthetic fixtures into the real setup. It is a **data-mapping** step — no code changes.

## The model (read first)

There is **one Commerzbank business account**. The Kapitalflusstabelle takes **every income and every expense** from that account and sorts each one into the table by sign: a credit (Gutschrift) is an **Einnahme**, a debit (Lastschrift/Abbuchung) is an **Ausgabe**. That is the whole logic — the table is **not per-store**, not per-location, not per-anything. Setup is therefore: name the one account, map the real files, confirm the sign split.

## When to use

At the 1h kickoff workshop, once. (If a second account is ever added, that is a second `account.json`-style setup — but the table itself stays a single account-wide list.)

## Steps

1. **Confirm the files.** Verify the real `Vektonce.xlsx` (the Kapitalflusstabelle) is `.xlsx` (not `.xlsm` — macros are out of scope) and that the Liquiditätsplanung template is available. Place both in the Cowork-granted folder.
2. **Point at the account.** Edit `config/account.json`: set `name` to the real account label and set `vektonceWorkbook` / `liquiditaetWorkbook` to the real file paths in the Cowork-granted folder. (`id` stays a stable slug like `commerzbank`; it only labels run-ids and archive records.)
3. **Map the CSV.** Open a real Commerzbank CSV export. Reconcile `config/csv-profiles/commerzbank-default.json` against the actual header variant, delimiter, encoding, date and decimal format, and confirm the sign lives in the `Betrag` column. If it differs, edit that JSON only.
4. **Map the workbook cells.** Open the real Vektonce.xlsx; read off the real sheet names and the append-anchors and write them into `config/excel-maps/vektonce.json` — specifically where **Einnahmen** rows append and where **Ausgaben** rows append (`appendTable` per sheet). Do the same for the Liquiditätsplanung in `config/excel-maps/liquiditaet.template.json` (the cells that hold Summe Einnahmen / Summe Ausgaben for the current month).
5. **Confirm the split is enough.** The default classification (`config/dba-mapping/mapping.v1.json`) is two rules: credit → Einnahmen, debit → Ausgaben, so **every** movement lands and nothing is dropped. Only if Jan's real table needs **finer categories** (e.g. Wareneinkauf, Personal as their own rows/cells) do you add higher-priority rules to that mapping **and** a matching `bucketTarget` in the excel-map — still config-only. If income/expense is all the table needs, leave it as-is.
6. **Validate.** Run a `plan_run` against the real CSV and review the change-overview together. Confirm the count matches Jan's expectation ("alle Buchungen drin, nichts im Review"). Then run the **open-in-Excel smoke**: open the written Vektonce copy once in Excel and confirm formulas recalc and any chart survives — only after this passes do we promise the no-alter guarantee on this file.
7. **First fill.** With approval, commit the first run so the Kapitalflusstabelle + Liquiditätsplanung are populated and from then on auto-maintained.

## Hard rules

- This is config-only. If a real file needs logic the engine does not have (a rule that is more than data, an `.xlsm`, a structural surprise), STOP and flag a scoped change — do not bend the no-alter guarantee.
- The table is account-wide. Do NOT reintroduce a per-store split unless Jan explicitly maintains separate accounts/tables and asks for it.
- Develop and validate on the user's real files inside their own workspace — never copy real financial data out (keeps the Tier-3 no-AVV position intact).
