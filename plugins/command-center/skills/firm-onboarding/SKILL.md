---
name: firm-onboarding
description: One-time company onboarding for the Command Center. Use when the user says "set up my command center", "richte mein Command Center ein", "Firma/Mandant einrichten", "neue Firma anlegen", "onboard my firm", "new firm", "let's get started", or "onboarding" — or when any other Command Center process needs firm context that doesn't exist yet. Interviews the user in chat for the full company context, then scaffolds the workspace and writes company-context.md.
---

# Firm onboarding

Goal: capture the firm's full context **once**, scaffold a clean workspace, and write `_firma/company-context.md` — the single source of truth every other process reads. Read `${CLAUDE_PLUGIN_ROOT}/reference/firm-config-contract.md` before starting; it defines the file layout, anchors, idempotency, and the self-verify rule you are establishing here.

This runs in interactive chat. Be warm, plain, and non-technical. The user should never edit a file or open a terminal.

**Read `${CLAUDE_PLUGIN_ROOT}/reference/onboarding-ux.md` first** — it defines how to ask: detect-first, numbered selectable options with a ✏️ free-text escape on every question, bulk confirm-by-exception, and the path-picker. Follow it for every question below.

## Step 0 — Workspace + scan

Confirm the workspace (in Cowork, the granted "Work in a Folder" folder) using the path-picker; record it as `workspace_root`. Everything below is created **inside** the workspace, never inside the plugin.

Then **scan it** (bounded — onboarding-ux §1: top-level first, names not contents, ignore image/archive dumps): infer what the firm already has — legal entities (multiple top-level company folders), accounting folder, projects/sites, output folders. You'll propose these as defaults instead of asking the user to type them.

If `_firma/company-context.md` already exists, this is a **re-run**: load it, re-offer only the values marked *detected* for a quick re-confirm, and overwrite each section in place by its anchor (contract §2) — never append duplicates.

## Step 1 — Interview (detect-first, in batches)

Walk `reference/question-bank.md` batch by batch. For each batch, **lead with what you detected and confirm in bulk** (onboarding-ux §3), then ask only the gaps — every question as numbered options with a ✏️ free-text escape; optional ones also offer ⏭️ skip. Rules:
- One batch at a time; bulk-confirm detected values, edit by exception. Present detections as **labeled guesses** ("ich vermute … weil"), never as fact.
- Optional answers are clearly skippable — the firm must be able to finish without any register.
- Mirror the firm's language (German default; switch if they answer in another) and store it in `cc:meta`.
- Don't ask for anything a later process can collect itself — that belongs in the process's own onboarding (inheritance rule, contract §5).

## Step 2 — Scaffold the workspace

Create this structure under `workspace_root` (skip any that already exist; never overwrite firm data):

```
_firma/company-context.md
_firma/config/                  (empty; processes write their own files here)
_firma/stammdaten/              (only if the firm gave register data)
_eingang/                       (+ a subfolder per process the firm activates)
_ausgang/                       (+ rechnungen/ berichte/ belege/ bilder/ as needed)
```

## Step 3 — Write company-context.md

Fill `templates/company-context.template.md` with the interview answers and write it to `_firma/company-context.md`. Keep the stable anchors intact so future re-runs are idempotent. Put **only firm-level facts** here — no process-specific settings.

If the firm provided master data, also write `_firma/stammdaten/projekte.json`, `personen.json`, and/or `lieferanten.json` (keyed JSON; see the template comments). These are optional matching aids.

## Step 4 — Confirm + hand off to process selection

Show the user a short summary of what was captured and the folder structure created. Then invoke the **process-catalog** skill (or say: *"Welche Prozesse möchtest du aktivieren?"*) to let them pick which processes to set up next. Each process onboards itself the first time it runs.

## Done means

- `_firma/company-context.md` exists, every required anchor filled, only firm-level facts.
- Workspace folders exist; nothing was written into the plugin directory.
- `workspace_root` and language are recorded under `cc:meta`.
- The user was offered process selection.

Never invent firm facts. If you don't know something, ask or leave it explicitly marked `(noch offen)`.
