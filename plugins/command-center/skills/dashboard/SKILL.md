---
name: dashboard
description: Show the firm's live Command Center dashboard — an at-a-glance artifact with time saved, every workflow (and how it works), the work already done, and the recommended next step. Use when the user says "zeig das Dashboard", "show dashboard", "übersicht", "wie läuft es", "was wurde gemacht", "wie viel Zeit habe ich gespart", "was kann das command center", "wie funktioniert <Prozess>", "stats". Also good as the home screen for a returning firm.
---

# Dashboard — the live artifact

Generate the firm's status dashboard as a **Cowork Live Artifact**: one self-contained HTML page showing time saved, the workflows (with plain "so funktioniert's" steps), what was already done, and the next step. Warm and non-technical — the user never edits a file.

## Step 0 — Self-verify (route, don't error)
Find `workspace_root` and read `_firma/company-context.md`. If it's missing, the firm isn't set up yet — say *"Dein Command Center ist noch nicht eingerichtet — sollen wir das in 2 Minuten machen?"* and run `/command-center:setup` (firm-onboarding). Don't generate an empty dashboard for an un-onboarded firm.

## Step 1 — Generate
Run the generator (it reads the firm's own state + `reference/workflows.json` and writes a self-contained HTML file):

```
bun ${CLAUDE_PLUGIN_ROOT}/skills/dashboard/scripts/dashboard.ts <workspace_root>
```

It prints the path to the written file (default `<workspace_root>/_firma/dashboard.html`). It is best-effort and never crashes on missing/partial state — a brand-new firm gets a friendly zero-state, not an error.

## Step 2 — Show it as a Live Artifact
Present the generated HTML to the user as a **Live Artifact** so it opens in Cowork's Live-artifacts tab (interactive, reopenable, refreshable) — not just a file path. Then give a 2–3 line in-chat summary in the firm's language: total Stunden gespart, how many processes are active, and the one recommended next step. Remind them they can refresh anytime by saying *"zeig das Dashboard"*.

## Explain one workflow on demand
If the user asks *"wie funktioniert <Prozess>"* (or "was macht der Tagesbericht"), read that process's entry in `${CLAUDE_PLUGIN_ROOT}/reference/workflows.json` and answer in plain language: what it does, the `how` steps, what they give, what they get, and the exact phrase to start it. No need to regenerate the whole dashboard for a single explainer.

## Note
The dashboard reflects the run log `_firma/_state/activity.jsonl` (see `${CLAUDE_PLUGIN_ROOT}/reference/activity-log.md`). It's a fresh snapshot each time you generate it — there's a "Stand:" timestamp on it, and re-running this skill refreshes it.
