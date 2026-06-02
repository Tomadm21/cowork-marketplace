---
name: daily-report
description: Fill the firm's daily/weekly site report (Bautagesbericht / Tagesbericht) from the day's hours and notes. Use when the user says "mach den Tagesbericht", "Bautagesbericht für KW 21", "fill the daily report", or provides per-day hours for a report. Computes capped netto hours, fills the firm's report template, and saves a collision-safe copy after review.
---

# Daily report

Produce a filled report document from per-day hours + site metadata. Read `${CLAUDE_PLUGIN_ROOT}/reference/firm-config-contract.md` first.

## Step 0 — Self-verify (route, don't error)
Read `workspace_root` + `company-context.md`, then `_firma/config/daily-report.json`. If missing/incomplete, say *"Ich habe die Tagesbericht-Einrichtung (Vorlage, Felder) noch nicht — jetzt einrichten?"* and run onboarding (`reference/rules.md` §Onboarding, asking per `${CLAUDE_PLUGIN_ROOT}/reference/onboarding-ux.md`). Don't proceed without the template path.

## Step 1 — Gather
Collect site/project, week (KW), people present, and per-day hours (Mon–Sun) + notes — from the user or a provided form. Don't guess missing days; ask.

## Step 2 — Compute
Apply the rules in `reference/rules.md`: daily cap, netto-hour recalc. Keep it simple and transparent; show the per-day netto back to the user.

## Step 3 — Review
Show the assembled report content + total netto hours, flag any capped day as "prüfen". Wait for approval.

## Step 4 — Fill + save
Fill the firm's template (DOCX via Cowork's document ability) with the approved values. Save to the configured output path (default `_ausgang/berichte`) with a collision-safe name (`KW-Projekt-Jahr`, append `_2` if it exists — never overwrite). Never auto-send.

## Step 5 — Confirm
Report the file path and any unresolved "prüfen" items.

## Scheduled mode
Prepare the draft and stop at the review state; never finalize unattended. See `${CLAUDE_PLUGIN_ROOT}/reference/automation.md`.
