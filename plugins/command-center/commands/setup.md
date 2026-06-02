---
description: Set up the Command Center for this firm — runs firm onboarding, then process selection, then optional automation.
---

# /command-center:setup

Drive the full 3-step setup for the firm in this workspace. Be warm and non-technical; the user never edits files or uses a terminal.

Throughout, follow `${CLAUDE_PLUGIN_ROOT}/reference/onboarding-ux.md`: **look at the firm's folder first** and offer **numbered options the user picks by tapping a number** — they can always type their own answer (✏️) or skip (⏭️). Paths are **browsed, not typed** (the path-picker). The goal is a setup that feels like confirming, not filling a form.

1. **Firm onboarding** — invoke the `firm-onboarding` skill. It interviews the user for the company context, scaffolds the workspace folder structure, and writes `_firma/company-context.md`. (If it already exists, run it as an update.)

2. **Process selection** — invoke the `process-catalog` skill. The user picks which processes to activate; each one onboards itself (writes its own `_firma/config/<process>.json` and `_eingang/<process>/` folder).

3. **Automation (optional)** — for each onboarded process, offer to put it on a Cowork schedule per `${CLAUDE_PLUGIN_ROOT}/reference/automation.md`. State the app-open/awake caveat honestly and confirm consequential writes always wait for approval.

End by summarizing: what context was captured, which processes are live, and what (if anything) was scheduled. Then tell the user they can now just say things like *"erstelle die Rechnung für KW 21"* or *"sortier die Belege"* and the matching process runs.
