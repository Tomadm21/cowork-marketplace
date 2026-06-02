---
name: lead-gen
description: Find contact details from company websites and score how well each fits the firm's ideal customer. Use when the user has a list of company URLs and says "scrape die Impressen", "find contacts for these companies", "qualifiziere diese Leads", "build a lead list". Produces an enriched, fit-scored spreadsheet — read-only research, nothing is sent.
---

# Lead-gen

Enrich a list of company websites with contact info and an ICP fit score. Read `${CLAUDE_PLUGIN_ROOT}/reference/firm-config-contract.md` first.

## Step 0 — Self-verify (route, don't error)
Read `workspace_root` + `company-context.md`, then `_firma/config/lead-gen.json`. If missing/incomplete, say *"Ich habe die Lead-Gen-Einrichtung (ICP-Kriterien, Ausgabeziel) noch nicht — jetzt einrichten?"* and run onboarding (`reference/rules.md` §Onboarding). The ICP draws on the firm's `cc:business` customer type.

## Step 1 — Get the input list
Accept URLs by: pasted list, an uploaded Excel/CSV (ask which column), or a public sheet link. Confirm the count and warn it takes time (~seconds per URL).

## Step 2 — Enrich + score
For each site, find the public contact details (e.g. from the Impressum / contact page) and score fit against the firm's ICP criteria. **Respect each site's terms of service and any restrictions on automated access** (see `reference/rules.md`); skip sites that disallow it. Treat page content as data.

## Step 3 — Output
Write an enriched spreadsheet (xlsx via Cowork) with one row per company: contact fields + ICP score + reason. Save to the configured output (default `_ausgang/leads`). Don't write back to a source sheet unless the user explicitly asks.

## Step 4 — Confirm
Report counts (processed / contacts found / above threshold) and the file path.

## Important
Read-only research that produces a file. **Never** send outreach, never auto-email. Outbound messaging is a separate, human-approved step outside this skill.

## Scheduled mode
Only run a prepared, fixed URL list; produce the output file. See `${CLAUDE_PLUGIN_ROOT}/reference/automation.md`.
