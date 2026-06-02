# Firm onboarding — question bank

Ask in these batches. Required = needed for a usable context; Optional = improves matching/automation but can be skipped. Map each answer to the `company-context.md` anchor in brackets.

## Batch 1 — Identity  [cc:identity]
- Firm name (required)
- Legal form (GmbH, GbR, Einzelunternehmen, …) (required)
- Are there sibling/related companies that share processes? (e.g. an operating + a holding/second GmbH) — names + how they differ (optional)
- VAT-ID / tax number (optional)
- Address(es) (required: at least the main one)
- Owner / management names (required)
- Primary contact (name, email, phone) (optional)

## Batch 2 — Business model  [cc:business]
- In one or two sentences, what does the firm do? (required)
- Industry (required)
- Who are the customers (B2B/B2C, typical client)? (required)
- Default VAT rate used on invoices (e.g. 19%) (optional — invoicing will confirm)

## Batch 3 — Sites / projects  [cc:sites] → optional register `stammdaten/projekte.json`
- Do you work across multiple sites, jobs, or client projects? (required yes/no)
- If yes: list the active ones. For each: a short name, a match keyword (how it appears in filenames/documents), location, and the folder name you file it under (optional but recommended for photo-sorting/receipt-filing)

## Batch 4 — Team / people  [cc:people] → optional register `stammdaten/personen.json`
- Key roles involved in the processes (e.g. who fills timesheets, who approves invoices) (required)
- If relevant: list the people who appear on timesheets/reports, with a name-match keyword and role (optional — invoicing/daily-report can also collect this)

## Batch 5 — Tools & systems  [cc:tools]
- Accounting software (DATEV, Lexware, sevDesk, none…) (required)
- Bank (optional)
- Where do files live? (local folders, a network drive, Google Drive, OneDrive/SharePoint…) + the base path if applicable (required)
- Email system (optional)
- Any line-of-business / industry software (optional)

## Batch 6 — File & folder conventions  [cc:conventions]
- How are files named today, if there's a convention? (optional — show an example)
- Where should process outputs go? Use the workspace `_ausgang/` by default, or give real target paths (e.g. a project-folder structure on the network drive). (required for any process that mirrors to the firm's real folders)
- Any naming rules to preserve (date format, separators)? (optional)

## Batch 7 — Processes to activate  [cc:processes]
Show the catalog and let them pick (multi-select):
- invoicing — pro-forma invoices from timesheets
- daily-report — fill the daily/weekly report template
- photo-sorting — rename + file site/job photos
- receipt-filing — read receipts and file them
- lead-gen — scrape company sites for contacts + score fit
Record the chosen set with status `selected` (they get onboarded individually next).

## Batch 8 — Glossary  [cc:glossary] (optional)
- Any firm-specific terms a stranger wouldn't understand? (abbreviations, internal names)

## Notes
- For non-construction / non-German firms: relabel freely. "Sites/projects" can be "clients" or "matters"; "people on timesheets" can be "staff". Keep the anchors; adapt the wording.
- Never ask for bank credentials, passwords, or 2FA. The plugin never logs in anywhere.
