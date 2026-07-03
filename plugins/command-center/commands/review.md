---
description: Operator-only — generate the Command Center improvement report (recurrence + evidence gated). Reads the workspace signal log; never changes the plugin.
---

# /command-center:review

Generate the operator improvement report for the firm in this workspace.

Invoke the **`improvement-review`** skill. It runs the deterministic generator over the
workspace signal log, gates candidates by recurrence (≥3) — or on first occurrence for
`severity:"folgenreich"` signals — and the evidence library, writes
`_firma/optimierung-bericht.md`, and advances the review watermark. Present the report plus a
short German summary. New automations are built by Tom as a separate, deliberate step — this
command only produces the report.
