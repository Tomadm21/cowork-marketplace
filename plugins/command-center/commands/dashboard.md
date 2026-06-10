---
description: Show this firm's live Command Center review cockpit — time saved, every workflow and how it works, what's been done, the next step, and all open review items waiting for approval.
---

# /command-center:dashboard

Show the firm the live review cockpit for their Command Center. This is the home screen for a returning firm.

Invoke the **`dashboard`** skill. It:
1. Checks the firm is set up (routes to `/command-center:setup` if not).
2. Runs the generator and produces a self-contained HTML cockpit with an **Überblick** tab (time saved, active processes, next step) plus one tab per process that has open review items.
3. Presents it as a **Live Artifact** (Cowork's Live-artifacts tab) plus a short in-chat summary: Stunden gespart, active processes, items awaiting review, and the recommended next step.

**Approvals happen here.** Each pending item shows its VORSCHLAG fields, BEGRÜNDUNG, and a tier badge (sicher / prüfen / folgenreich). The user presses **Freigeben** or **Ablehnen** — the button calls `sendPrompt`, the skill picks it up and runs `apply.ts` to copy the file and write a journal entry. Nothing touches the workspace until that explicit step. After every approval or rejection the cockpit regenerates automatically so count chips stay current.

If the user instead asks how a single workflow works (e.g. *"wie funktioniert der Tagesbericht"*), the skill explains just that one from the catalog — no full cockpit regeneration needed.
