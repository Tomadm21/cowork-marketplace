---
description: Show this firm's Command Center statistics & history — time saved, every workflow and how it works, the run history, every filed file, and the next step. Fully static; approving and editing happen in chat.
---

# /command-center:dashboard

Show the firm their Command Center statistics & history. This is the look-back home screen for a returning firm — approving and editing happen in chat.

Invoke the **`dashboard`** skill. It:
1. Checks the firm is set up (routes to `/command-center:setup` if not).
2. Runs the generator and produces one self-contained, fully static HTML page: hero stats (Stunden gespart, Vorgänge, Läufe, open-count), process cards, **Verlauf** (run history) and **Zuletzt abgelegt** (every filed file from the journal).
3. Presents it as a **Live Artifact** (Cowork's Live-artifacts tab) plus a short in-chat summary: Stunden gespart, active processes, items awaiting review, and the recommended next step.

**The artifact shows statistics & history only — it never lists open review items and carries no actions.** To act on what's waiting, the user says *"zeig offene Freigaben"*; the review-board/chat flow then handles annehmen, bearbeiten (voll: Felder/Ziel/Name), nochmal and ablehnen and runs the canonical workspace engine `_firma/apply.py` (see `${CLAUDE_PLUGIN_ROOT}/reference/chat-review.md`). Nothing touches the workspace until that explicit step. After any approval, edit or rejection, regenerate the overview so its stats stay current.

If the user instead asks how a single workflow works (e.g. *"wie funktioniert der Tagesbericht"*), the skill explains just that one from the catalog — no full overview regeneration needed.
