---
description: Show this firm's live Command Center overview — time saved, every workflow and how it works, what's been done, the next step, and how many items are waiting for review. Read-only; approving happens in chat.
---

# /command-center:dashboard

Show the firm the live overview for their Command Center. This is the read-only home screen for a returning firm — approving happens in chat.

Invoke the **`dashboard`** skill. It:
1. Checks the firm is set up (routes to `/command-center:setup` if not).
2. Runs the generator and produces a self-contained HTML overview with an **Überblick** tab (time saved, active processes, next step, items waiting) plus one **read-only** tab per process that has open review items.
3. Presents it as a **Live Artifact** (Cowork's Live-artifacts tab) plus a short in-chat summary: Stunden gespart, active processes, items awaiting review, and the recommended next step.

**The overview is read-only — approving happens in chat.** Each pending item shows its VORSCHLAG fields, BEGRÜNDUNG, and a tier badge (sicher / prüfen / folgenreich). To act on what's waiting, the user says *"zeig offene Freigaben"*; the skill then handles annehmen, bearbeiten (voll: Felder/Ziel/Name), nochmal and ablehnen in chat and runs the canonical workspace engine `_firma/apply.py` (see `${CLAUDE_PLUGIN_ROOT}/reference/chat-review.md`). Nothing touches the workspace until that explicit step. After any approval, edit or rejection, regenerate the overview so its counts stay current.

If the user instead asks how a single workflow works (e.g. *"wie funktioniert der Tagesbericht"*), the skill explains just that one from the catalog — no full overview regeneration needed.
