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

## Step 5b — Signal loggen (best-effort)
Append friction signals to `<workspace>/_firma/_state/signals.jsonl` per
`${CLAUDE_PLUGIN_ROOT}/reference/signals.md` — one JSON line each, never blocking the run:
- if a capped-day "prüfen" fired → `{type:"recurring_check", key:"daily-report:capped-day"}`
- if a missing day had to be asked → `{type:"recurring_check", key:"daily-report:missing-day"}`
- if the user said "wäre gut wenn…/merk dir…" → `{type:"observation", key:"observation:<slug>", detail:"…"}`
- if a learned firm fact came up → `{type:"fact", key:"fact:<slug>", detail:"…"}`
- if the template/path had changed → `{type:"tech_change", key:"tech:vorlage-geaendert", detail:"…"}`

## Step 6 — Log the run
After approval + save, append one line to the activity log so the dashboard reflects it (see `${CLAUDE_PLUGIN_ROOT}/reference/activity-log.md`): a stable `run_id` like „daily-report-<jahr>-KW<kw>" (so a correction updates the entry instead of double-counting), `process: daily-report`, `items` = number of reports produced (usually 1), `summary` like „Tagesbericht KW 21 · <Projekt>", `status: done`. A scheduled run left in review logs `status: prepared` instead (shown in the feed, not counted as time saved). Best-effort — logging must never block the run.

## Scheduled mode
Prepare the draft and stop at the review state; never finalize unattended. See `${CLAUDE_PLUGIN_ROOT}/reference/automation.md`.
