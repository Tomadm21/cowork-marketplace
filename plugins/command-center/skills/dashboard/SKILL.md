---
name: dashboard
description: Show the firm's live Command Center overview — a read-only at-a-glance artifact with time saved, every workflow (and how it works), the work already done, the recommended next step, and how many items are waiting for review. Approving, editing and re-running happen in chat, not in the artifact. Use when the user says "zeig das Dashboard", "show dashboard", "übersicht", "wie läuft es", "was wurde gemacht", "wie viel Zeit habe ich gespart", "was kann das command center", "wie funktioniert dieser Prozess", "stats", "zeig offene Freigaben", "freigaben", "was liegt zur freigabe", "review board", "freigeben", "ablehnen". Also good as the home screen for a returning firm.
---

# Dashboard — the overview (read-only)

Generate the firm's overview as a **Cowork Live Artifact**: one self-contained HTML page with two sections:

1. **Überblick tab** — time saved, active workflows (with plain "so funktioniert's" steps), what was already done, the recommended next step, and how many items are waiting for review. Warm and non-technical.
2. **One tab per process that has open review items** — a **read-only** list of each pending action with its VORSCHLAG fields (lieferant, betrag, kategorie, etc.), the BEGRÜNDUNG (reason), and a tier badge (sicher / prüfen / folgenreich). No action buttons.

The dashboard never changes anything — it only shows. **Approving, editing, re-running and rejecting all happen in chat** (see `## Review im Chat` below). When the user wants to act on what's waiting, they say *"zeig offene Freigaben"*.

## Step 0 — Self-verify (route, don't error)
Find `workspace_root` and read `_firma/company-context.md`. If it's missing, the firm isn't set up yet — say *"Dein Command Center ist noch nicht eingerichtet — sollen wir das in 2 Minuten machen?"* and run `/command-center:setup` (firm-onboarding). Don't generate an empty dashboard for an un-onboarded firm.

## Step 1 — Generate
Run the generator (it reads the firm's own state + `reference/workflows.json` + open review queues in `_firma/_review/` and writes a self-contained HTML file):

```
bun ${CLAUDE_PLUGIN_ROOT}/skills/dashboard/scripts/dashboard.ts <workspace_root>
```

It prints the path to the written file (default `<workspace_root>/_firma/dashboard.html`). It is best-effort and never crashes on missing/partial state — a brand-new firm gets a friendly zero-state, not an error.

## Step 2 — Show it as a Live Artifact
Present the generated HTML to the user as a **Live Artifact** so it opens in Cowork's Live-artifacts tab (interactive, reopenable, refreshable) — not just a file path. Then give a 2–3 line in-chat summary in the firm's language: total Stunden gespart, how many processes are active, how many items are waiting for review, and the one recommended next step. Remind them they can refresh anytime by saying *"zeig das Dashboard"*, and act on what's waiting by saying *"zeig offene Freigaben"*.

## Review im Chat

The dashboard is read-only; **all approving and editing happens here in chat.** Full mechanics — exact commands, the edit-patch format, and the re-run procedure — are in `${CLAUDE_PLUGIN_ROOT}/reference/chat-review.md`. Summary:

**Trigger.** When the user says *"zeig offene Freigaben"*, "was liegt zur Freigabe", "freigaben", "review" (or a scheduled collector just prepared work and they want to act), list the open queues:

```
bun ${CLAUDE_PLUGIN_ROOT}/skills/dashboard/scripts/apply.ts <workspace_root> list
```

Parse the JSON and present, grouped by process, each open action numbered with its VORSCHLAG fields, BEGRÜNDUNG, and tier. Then handle the user's natural-language answer — four intents:

> **Grafische Freigabe (Karten):** Wünscht der Nutzer Karten mit Vorschau, editierbaren Feldern und Sammel-Freigabe statt Tippen, rufe die **review-board**-Skill auf (`${CLAUDE_PLUGIN_ROOT}/skills/review-board/SKILL.md`) — gleiches Queue-Format und gleiche Apply-Engine, nur als interaktives Widget. Das Dashboard selbst bleibt read-only.

1. **Annehmen / Freigeben** — `apply.ts <workspace_root> approve <runid> <id>`. For "alle sicheren freigeben" use `approve-safe`. This is the **only** step that moves files (collision-safe copy + reversible journal entry).
2. **Bearbeiten (voll)** — the user corrects a field, the target folder, or the filename. Patch that action inside its queue file `_firma/_review/R-…json` (edit `values`, `targets`, and/or `filename`), set the queue's `rechecked`, then re-show the corrected proposal. Editing moves nothing. Append a `correction` signal (`${CLAUDE_PLUGIN_ROOT}/reference/signals.md`). Approve only when the user then says so.
3. **Nochmal (KI neu rechnen)** — the user says the reading/routing is wrong; re-run the owning process skill on that action's `source` only, replace the action in place (bump `rechecked`), and re-show. Procedure in `chat-review.md`.
4. **Ablehnen** — `apply.ts <workspace_root> reject <runid> <id>` — removes the action, copies nothing.

**After any approve / approve-safe / reject / edit**, regenerate the overview so its counts refresh, then present it again as a Live Artifact:

```
bun ${CLAUDE_PLUGIN_ROOT}/skills/dashboard/scripts/dashboard.ts <workspace_root>
```

Report in plain German what happened (what was filed where, what was corrected, what was rejected). Use `--dry` on any `apply.ts` command to preview without touching files.

**Honest semantics to communicate:**
- `approve` performs a collision-safe copy to every target directory and writes a journal entry — nothing was applied before this step.
- editing only changes the proposal in the queue; no file moves until you approve.
- `reject` removes the action from the queue without copying anything.
- `approve-safe` applies all `sicher`-tier actions in one pass; `prüfen` and `folgenreich` always require individual approval.

> **Backward compatibility:** if a message still arrives in the old button form `Freigeben: <runid> Aktion <id> (...)` or `Ablehnen: <runid> Aktion <id> (...)` (e.g. from an older cached artifact), treat it as the approve / reject intent above and run the same `apply.ts` command.

## Explain one workflow on demand
If the user asks *"wie funktioniert dieser Prozess"* (or "was macht der Tagesbericht"), read that process's entry in `${CLAUDE_PLUGIN_ROOT}/reference/workflows.json` and answer in plain language: what it does, the `how` steps, what they give, what they get, and the exact phrase to start it. No need to regenerate the whole overview for a single explainer.

## Note
The overview reflects the run log `_firma/_state/activity.jsonl` (see `${CLAUDE_PLUGIN_ROOT}/reference/activity-log.md`) and the open review queues in `_firma/_review/`. It's a fresh snapshot each time you generate it — there's a "Stand:" timestamp on it, and re-running this skill refreshes it.
