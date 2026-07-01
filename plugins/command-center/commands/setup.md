---
description: Set up the Command Center for this firm — runs firm onboarding, then process selection, then optional automation.
---

# /command-center:setup

Drive the full 3-step setup for the firm in this workspace. Be warm and non-technical; the user never edits files or uses a terminal.

Throughout, follow `${CLAUDE_PLUGIN_ROOT}/reference/onboarding-ux.md`: **look at the firm's folder first** and offer **numbered options the user picks by tapping a number** — they can always type their own answer (✏️) or skip (⏭️). Paths are **browsed, not typed** (the path-picker). The goal is a setup that feels like confirming, not filling a form.

1. **Firm onboarding** — invoke the `firm-onboarding` skill. It interviews the user for the company context, scaffolds the workspace folder structure, and writes `_firma/company-context.md`. (If it already exists, run it as an update.)

2. **Process selection** — invoke the `process-catalog` skill. The user picks which processes to activate; each one onboards itself (writes its own `_firma/config/<process>.json` and `_eingang/<process>/` folder).

3. **Automation (optional)** — offer to set up the single **hourly collector task** (Cron `0 * * * *`) that scans the shared `_eingang/` and runs the **intake** skill to classify + route new files for review, using the exact self-contained prompt in `${CLAUDE_PLUGIN_ROOT}/reference/automation.md`. State the app-open/awake caveat honestly, and make clear: the collector only **prepares** — annehmen/bearbeiten/nochmal/ablehnen always happen in chat via *"zeig offene Freigaben"*, never unattended.

4. **Dashboard** — finish by invoking the `dashboard` skill. It generates the firm's live overview as a **Live Artifact** (time saved, every workflow and how it works, what's been done, the next step, and how many items wait for review). The dashboard is a **read-only overview** — approving happens in chat. This is the home screen the firm returns to — they refresh it by saying *"zeig das Dashboard"*, and act on what's waiting by saying *"zeig offene Freigaben"*.

End by summarizing: what context was captured, which processes are live, and whether the hourly collector was scheduled — and point them at the dashboard you just generated. Then tell the user they can now just say things like *"erstelle die Rechnung für KW 21"* or *"sortier die Belege"* to run a process directly — and that scheduled runs prepare work automatically, which they review anytime by saying *"zeig offene Freigaben"*.
