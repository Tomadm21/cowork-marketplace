# Firm onboarding — question bank

**How to ask** is defined in `${CLAUDE_PLUGIN_ROOT}/reference/onboarding-ux.md` (detect-first, numbered options + ✏️ free-text + ⏭️ skip, bulk confirm-by-exception, path-picker). This file is **what** to ask, batch by batch.

Legend: 🔍 = **detect from the workspace scan first**, then confirm (don't ask blind). · ★ = required (needed for a usable context). · ◦ = optional (firm can finish without it). Each answer maps to the `company-context.md` anchor in brackets.

For every question: offer the concrete options below **plus** ✏️ *selbst eingeben*; for ◦ optional ones also ⏭️ *überspringen*.

## Batch 1 — Identity  [cc:identity]
- ★ 🔍 **Firm name** — if a top-level folder looks like the company (e.g. `001 ‹Name› GmbH`), propose it.
- ★ **Legal form** — options: `GmbH` · `GmbH & Co. KG` · `GbR` · `Einzelunternehmen` · `UG` · `AG` · ✏️.
- ◦ 🔍 **Sibling / related companies** that share processes — if the scan shows several top-level company folders, propose them as the entity list ("ich sehe 001 … und 002 …, zwei Gesellschaften?").
- ◦ **USt-IdNr / Steuernr**.
- ★ **Address(es)** — at least the main one.
- ★ **Owner / management** names.
- ◦ **Primary contact** (name, email, phone).

## Batch 2 — Business model  [cc:business]
- ★ **What the firm does** in one or two sentences.
- ★ **Industry** — options seeded from name/folders if obvious (e.g. `Bau / Tiefbau` · `Handwerk` · `Handel` · `Dienstleistung`) · ✏️.
- ★ **Customers** — options: `B2B` · `B2C` · `beides` · ✏️ (typical client in a few words).
- ◦ **Default VAT rate** — options: `19%` · `7%` · `0% / steuerfrei` · ✏️. (invoicing confirms its own.)

## Batch 3 — Sites / projects  [cc:sites] → optional register `stammdaten/projekte.json`
- ★ **Work across multiple sites / jobs / client projects?** — `Ja` · `Nein` · ✏️.
- ◦ 🔍 **If yes — the active ones.** If a `Bauvorhaben`/`Baustellen`/`Projekte`/`Kunden` folder exists, **propose its subfolders as the project list** and let the user prune/confirm (bulk). For each kept one: short name, match keyword (how it appears in filenames), location, and the folder name (use the detected one). This is the biggest "type-less" win — don't ask them to list what's already on disk.

## Batch 4 — Team / people  [cc:people] → optional register `stammdaten/personen.json`
- ★ **Key roles in the processes** — e.g. who fills timesheets, who approves invoices.
- ◦ 🔍 **People on timesheets/reports** — if a `Personal`/`Mitarbeiter`/`Stundenzettel` folder exists, propose names found there. For each: name-match keyword + role. (invoicing/daily-report can also collect this — skip here if unsure.)

## Batch 5 — Tools & systems  [cc:tools]
- ★ **Accounting software** — options: `DATEV` · `Lexware` · `sevDesk` · `andere` · `keine` · ✏️.
- ◦ **Bank**.
- ★ 🔍 **Where files live** — options: `dieser Workspace-Ordner` (the granted folder, **detected** — usually correct) · `Netzlaufwerk` · `Google Drive` · `OneDrive/SharePoint` · ✏️. If a base path applies, capture it with the **path-picker**, not free text.
- ◦ **Email system**.
- ◦ **Line-of-business / industry software**.

## Batch 6 — File & folder conventions  [cc:conventions]
- ◦ 🔍 **Naming convention today** — if filenames in detected folders share a pattern, propose it back ("deine Rechnungen heißen `‹Firma› RG ‹Nr› von ‹Datum›` — so beibehalten?") · ✏️.
- ★ 🔍 **Where process outputs go** — default each to the workspace `_ausgang/…`, or pick the firm's real folders with the **path-picker** (most output paths are detectable: a `Rechnungsausgang`, `8.Bautagesberichte`, etc.). Detailed per-process paths live in each `config/‹process›.json` — here just capture the firm's general preference (workspace default vs. mirror into real folders).
- ◦ **Naming rules to preserve** — options: date `YYYY-MM-DD` · date `DD.MM.YYYY` · separators (`_` / space / `-`) · ✏️.

## Batch 7 — Processes to activate  [cc:processes]
Numbered **multi-select** (*„mehrere möglich, z.B. `1,3,5`"*):
1. **invoicing** — pro-forma invoices from timesheets
2. **daily-report** — fill the daily/weekly report template
3. **photo-sorting** — rename + file site/job photos
4. **receipt-filing** — read receipts and file them
✏️ etwas anderes / später

Record the chosen set with status `selected` (each gets onboarded individually next).

## Batch 8 — Glossary  [cc:glossary]  ◦
- Any firm-specific terms a stranger wouldn't understand (abbreviations, internal names). Skippable.

## Notes
- **Non-construction / non-German firms:** relabel freely — "Sites/projects" → "clients"/"matters"; "people on timesheets" → "staff". Keep the anchors; adapt the wording and the detection keywords.
- **Never** ask for bank credentials, passwords, or 2FA. The plugin never logs in anywhere.
