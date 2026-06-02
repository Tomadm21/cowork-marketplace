---
name: process-catalog
description: Show the available Command Center processes and help the user choose which to activate, then run each chosen process's onboarding. Use after firm onboarding, or when the user asks "welche Prozesse gibt es", "what can the command center do", "aktiviere einen Prozess", "add a process".
---

# Process catalog

Help the firm pick which processes to activate, then onboard each one. Requires firm onboarding to have run (read `_firma/company-context.md`); if it hasn't, run the `firm-onboarding` skill first.

Present every choice per `${CLAUDE_PLUGIN_ROOT}/reference/onboarding-ux.md` — numbered options, a ✏️ free-text escape, and (here) multi-select.

## The catalog

| Process | What it does | Onboards |
|---|---|---|
| **invoicing** | Pro-forma invoices from timesheets (deterministic money math) | rates, people, spesen, output paths |
| **daily-report** | Fill the firm's daily/weekly report template | template, fields, day labels |
| **photo-sorting** | Rename + file site/job photos by date & activity | activities, naming, target folders |
| **receipt-filing** | Read receipts/invoices and file them to the right folders | entities, targets, categories |
| **lead-gen** | Scrape company sites for contacts + score fit | ICP criteria, output |

## Flow

1. Present the catalog as a **numbered multi-select** (*„mehrere möglich, z.B. `1,3`"* · ✏️ etwas anderes). Mark any already `onboarded` in `cc:processes` as ✅ and offer them for re-config rather than re-listing as new.
2. For each newly chosen process: invoke that process's skill — it self-verifies, finds no config, and runs its own onboarding (which writes `_firma/config/<process>.json` and creates the matching `_eingang/<process>/` drop folder).
3. After each is onboarded, update its line under `cc:processes` in `company-context.md` (status `onboarded`).
4. Offer to set up automation for any onboarded process (point to `${CLAUDE_PLUGIN_ROOT}/reference/automation.md`); be honest about the app-open caveat.

Activating one process never requires another — each is independent (config contract §5).
