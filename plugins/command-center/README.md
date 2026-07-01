# Command Center — Cowork plugin

Turn any firm into a Cowork-automated operation. Onboard the company **once**, and every business process runs in plain language inside Claude Cowork — and can be put on a schedule.

This is the productized version of the Command Center skeleton: a generic plugin that any firm installs and stands up itself, in chat, with no developer work.

## How it works (onboard once, then run, then watch)

0. **Alles reinwerfen** (`intake` skill) — der Alltagsweg: leg jede Datei (Belege, Fotos, Tagesbericht — gemischt) in den **einen** Eingang `_eingang/` und sag „verarbeite alles". Die intake-Skill erkennt jeden Typ selbst, fragt nur das Nötige und öffnet ein interaktives Review-Board.

1. **Firm onboarding** (`firm-onboarding` skill / `/command-center:setup`)
   A friendly chat interview collects everything about the firm — identity, locations, team, tools, bank, accounting, file conventions, which processes they run. It then scaffolds a standardized workspace folder structure and writes one `company-context.md` that gives Cowork 100% context. Every process reads this.

2. **Process skills** — one per business process, each self-contained
   - `invoicing` — pro-forma invoices from timesheets (deterministic money math)
   - `daily-report` — fill the firm's daily/weekly report template
   - `photo-sorting` — rename + file site/job photos by date and activity
   - `receipt-filing` — read receipts/invoices and file them to the right folders
   - `intake` — one shared inbox; auto-detects each file's type and routes it to the right process above
   - `review-board` — interactive cards (preview + editable fields), collect approvals, save in one click
   Each one onboards itself the first time you use it (asking only its own questions), then runs on demand.

3. **Automation** (`reference/automation.md`)
   Put any process on a Cowork schedule (`/schedule`). Honest about the limits: Cowork scheduled tasks only run while the app is open and the machine is awake, and consequential writes always pause for your approval.

4. **Dashboard** (`dashboard` skill / `/command-center:dashboard`)
   A live overview — generated as a Cowork **Live Artifact** — showing how much time the firm has saved, every workflow *with plain steps for how it works*, what's already been done, and the one recommended next step. Built for someone using AI for the first time: it answers „bringt das was?", „was kann es?" and „was mache ich jetzt?" at a glance. Refresh anytime with *"zeig das Dashboard"*.

## Install (in Claude Cowork or Claude Code)

```
/plugin marketplace add ~/cowork-marketplace      # or: add from the GitHub repo
/plugin install command-center@command-center
```

Then, in the firm's Cowork workspace:

```
/command-center:setup
```

…or just say *"richte mein Command Center ein"* / *"set up my command center"*.

## How it's built (for the operator/developer)

- **Skill-first.** Most processes are SKILL.md instructions + bundled reference rules + templates, using Cowork's native abilities (vision, docx/xlsx/pdf, file ops). Determinism is reserved for money/legal math — `invoicing` ships a `compute.ts` helper and the skill is forbidden from doing the arithmetic itself.
- **Context is the product.** `company-context.md` is the single firm-level source of truth; each process keeps its own `config/<process>.json`. Process config may only *add* to the firm context, never restate it.
- **Firm-agnostic.** Galant is just firm #1 — no client data is hardcoded here. Master-data registers (sites/people/vendors) are optional; processes fall back to manual fields.

See `reference/architecture.md` for the design rationale and the Phase-2 path (per-process deterministic engines + MCP, the way `jan-kapitalfluss` does it).

## Status

**v0.6.0** — unified drop-zone intake + interactive review board on top of onboarding, the live dashboard, and the business processes.

| Capability | Depth |
|---|---|
| **Firm onboarding** | Full — detect-first interview, workspace scaffold, one source-of-truth context file |
| **Invoicing** | Full — deterministic `compute.ts` for every figure (hours, tiers, per-diems, VAT) + a documented end-to-end dry-run |
| **Dashboard** | Full — live time-saved artifact, workflow transparency, work log |
| **Daily report · Photo sorting · Receipt filing** | Skill-complete — self-onboarding, reference rules, review-gated output, running on Cowork's native vision/document abilities |

Every process is review-gated (nothing is written, sent, or booked without your approval). Phase 2 adds a per-process deterministic engine where a process outgrows skill-level instructions — the path `jan-kapitalfluss` already follows. See `reference/architecture.md` and the walkthrough in `docs/end-to-end-dry-run.md`.
