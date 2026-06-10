---
description: Show this firm's live Command Center dashboard — time saved, every workflow and how it works, what's been done, and the next step.
---

# /command-center:dashboard

Show the firm the live status of their Command Center. This is the home screen for a returning firm.

Invoke the **`dashboard`** skill. It:
1. Checks the firm is set up (routes to `/command-center:setup` if not).
2. Runs the generator and produces a self-contained HTML dashboard.
3. Presents it as a **Live Artifact** (Cowork's Live-artifacts tab) plus a short in-chat summary: Stunden gespart, active processes, and the recommended next step.

If the user instead asks how a single workflow works (e.g. *"wie funktioniert der Tagesbericht"*), the skill explains just that one from the catalog — no full dashboard needed.
