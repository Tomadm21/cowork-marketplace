---
name: improvement-review
description: Operator-only — generate the Command Center improvement report (the "what can we optimize" stack). Use when Tom says "optimierungs-bericht", "command center review", "was kann ich optimieren", "review ziehen", "improvement report". Reads the workspace signal log, gates candidates by recurrence (≥3) AND the evidence library, and writes a Markdown report. Does NOT change the plugin.
---

# Improvement review (operator)

Generate the operator report that surfaces what is worth improving — gated by **recurrence
(≥3)** and **evidence** (`${CLAUDE_PLUGIN_ROOT}/reference/patterns.md`). This is an operator
tool (Tom). It is read-only with respect to the plugin: it only reads the workspace and writes
one Markdown report. Nothing here changes the Command Center's capabilities.

## Step 0 — Locate the workspace
Find `workspace_root` and confirm `_firma/company-context.md` exists. If the firm isn't set up,
there is nothing to review — say so and point to `/command-center:setup`.

## Step 1 — Generate
Run the generator (deterministic, dependency-free; never crashes on missing/partial state):

```
bun ${CLAUDE_PLUGIN_ROOT}/skills/improvement-review/scripts/review.ts <workspace_root>
```

It prints the path to the written report (default `<workspace_root>/_firma/optimierung-bericht.md`)
and advances the review watermark so the next report covers only new signals.

## Step 2 — Present
Show Tom the report (Markdown) and a 3–4 line summary in German: how many gated items, how many
facts to confirm, how many new-automation candidates. For each candidate, remember: **only Tom
builds new automations** — the report is a decision aid, not an action.

## Step 3 — Act (Tom's call, outside this skill)
If Tom decides to act, that happens as a normal plugin edit in Claude Code (sharpen a process
rule, add a `stammdaten` register, build a new process). This skill does not perform those edits.

## Note
The gates and signal schema live in `${CLAUDE_PLUGIN_ROOT}/reference/patterns.md` and
`${CLAUDE_PLUGIN_ROOT}/reference/signals.md`. Curating `patterns.md` over time is how the
review gets sharper — that is also an operator (Tom) task.
