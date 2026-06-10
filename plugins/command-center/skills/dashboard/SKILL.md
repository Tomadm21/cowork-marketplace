---
name: dashboard
description: Show the firm's live Command Center review cockpit — an at-a-glance artifact with time saved, every workflow (and how it works), the work already done, the recommended next step, and open review items awaiting approval. Use when the user says "zeig das Dashboard", "show dashboard", "übersicht", "wie läuft es", "was wurde gemacht", "wie viel Zeit habe ich gespart", "was kann das command center", "wie funktioniert <Prozess>", "stats", "freigaben", "was liegt zur freigabe", "review board", "freigeben", "ablehnen". Also good as the home screen for a returning firm.
---

# Dashboard — the review cockpit

Generate the firm's review cockpit as a **Cowork Live Artifact**: one self-contained HTML page with two sections:

1. **Überblick tab** — time saved, active workflows (with plain "so funktioniert's" steps), what was already done, and the recommended next step. Warm and non-technical.
2. **One tab per process that has open review items** — shows each pending action with its VORSCHLAG fields (lieferant, betrag, kategorie, etc.), the BEGRÜNDUNG (reason), tier badge (sicher / prüfen / folgenreich), and **Freigeben / Ablehnen** buttons. Buttons call `sendPrompt("Freigeben: <runid> Aktion <id> (<label>)")` or `sendPrompt("Ablehnen: <runid> Aktion <id> (<label>)")`.

The user never edits a file — all workspace mutations happen only after an explicit Freigeben press.

## Step 0 — Self-verify (route, don't error)
Find `workspace_root` and read `_firma/company-context.md`. If it's missing, the firm isn't set up yet — say *"Dein Command Center ist noch nicht eingerichtet — sollen wir das in 2 Minuten machen?"* and run `/command-center:setup` (firm-onboarding). Don't generate an empty dashboard for an un-onboarded firm.

## Step 1 — Generate
Run the generator (it reads the firm's own state + `reference/workflows.json` + open review queues in `_firma/_review/` and writes a self-contained HTML file):

```
bun ${CLAUDE_PLUGIN_ROOT}/skills/dashboard/scripts/dashboard.ts <workspace_root>
```

It prints the path to the written file (default `<workspace_root>/_firma/dashboard.html`). It is best-effort and never crashes on missing/partial state — a brand-new firm gets a friendly zero-state, not an error.

## Step 2 — Show it as a Live Artifact
Present the generated HTML to the user as a **Live Artifact** so it opens in Cowork's Live-artifacts tab (interactive, reopenable, refreshable) — not just a file path. Then give a 2–3 line in-chat summary in the firm's language: total Stunden gespart, how many processes are active, how many items are waiting for review, and the one recommended next step. Remind them they can refresh anytime by saying *"zeig das Dashboard"*.

## Freigaben verarbeiten

When the user's message matches `Freigeben: <runid> Aktion <id> (<label>)` or `Ablehnen: <runid> Aktion <id> (...)` — this is the cockpit's button calling `sendPrompt` — run the apply engine:

```
# Approve one action:
bun ${CLAUDE_PLUGIN_ROOT}/skills/dashboard/scripts/apply.ts <workspace_root> approve <runid> <id>

# Reject one action:
bun ${CLAUDE_PLUGIN_ROOT}/skills/dashboard/scripts/apply.ts <workspace_root> reject <runid> <id>

# Approve all sicher-tier actions across all open queues:
bun ${CLAUDE_PLUGIN_ROOT}/skills/dashboard/scripts/apply.ts <workspace_root> approve-safe

# Dry-run preview (add --dry to any command):
bun ${CLAUDE_PLUGIN_ROOT}/skills/dashboard/scripts/apply.ts <workspace_root> approve <runid> <id> --dry
```

Parse the returned JSON and report in plain German: what was filed where (approve), or that it was rejected and removed (reject). For `approve-safe` report how many actions were applied across which processes.

**After every approve/reject/approve-safe**, regenerate the cockpit immediately:

```
bun ${CLAUDE_PLUGIN_ROOT}/skills/dashboard/scripts/dashboard.ts <workspace_root>
```

Then present the refreshed HTML as a Live Artifact again so the count chips update and the approved/rejected item disappears from the board.

**Honest semantics to communicate to the user:**
- `approve` performs a collision-safe copy to every target directory and writes a journal entry — nothing was applied before this step.
- `reject` removes the action from the queue without copying anything.
- `--dry` previews the outcome without touching any files.
- `approve-safe` applies all `sicher`-tier actions in one pass; `prüfen` and `folgenreich` items always require individual approval.

For "alle sicheren freigeben" / "approve all safe" or similar bulk-approve requests, use `approve-safe`.

## Explain one workflow on demand
If the user asks *"wie funktioniert <Prozess>"* (or "was macht der Tagesbericht"), read that process's entry in `${CLAUDE_PLUGIN_ROOT}/reference/workflows.json` and answer in plain language: what it does, the `how` steps, what they give, what they get, and the exact phrase to start it. No need to regenerate the whole cockpit for a single explainer.

## Note
The cockpit reflects the run log `_firma/_state/activity.jsonl` (see `${CLAUDE_PLUGIN_ROOT}/reference/activity-log.md`) and the open review queues in `_firma/_review/`. It's a fresh snapshot each time you generate it — there's a "Stand:" timestamp on it, and re-running this skill refreshes it.
