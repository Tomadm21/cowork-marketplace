# Automation — putting a process on a schedule

How to make any Command Center process run automatically in Claude Cowork, and the honest limits.

## How Cowork automation actually works (2026)

Cowork runs recurring work via **scheduled tasks**:
- Create one with the **`/schedule`** command in a task chat, or via the **Scheduled** page in the sidebar (**+ New task** → name, prompt, frequency, optional folder).
- Cadences: **hourly, daily, weekly, on weekdays, or manual** (on-demand).
- Each scheduled task is its own Cowork session with access to your installed plugins and skills.

### The limit you must tell the firm about

> **Scheduled tasks only run while your computer is awake and the Claude Desktop app is open.** If the machine is asleep or the app is closed at trigger time, Cowork skips the run and executes it once the computer wakes / the app reopens.

This is **not** server-side, headless, 24/7 cron. For genuinely unattended automation, the realistic options are:
1. A dedicated always-on machine with Cowork open (a "back-office Mac").
2. A documented **manual trigger** — the firm runs the process in chat when they have the inputs (most processes are fast).
3. (Developer path) move the deterministic core to a headless runner — see `reference/architecture.md` Phase-2.

Never promise unattended 24/7 automation from a normal laptop.

## The non-negotiable rule: automatic ≠ unattended writes

Command Center processes use vision/LLM extraction, which is non-deterministic. A scheduled run therefore:
- **prepares** the work and **lands it in a review state** (a proposed invoice, a proposed set of file renames),
- **never auto-commits** consequential writes (renaming/moving the firm's files, finalizing an invoice, sending anything),
- waits for the operator to approve on their next session.

"Automatic" means "the preparation is done for you," not "irreversible actions happened while you weren't looking."

## Recommended schedule per process

| Process | Good cadence | What the scheduled run does (then waits for approval) |
|---|---|---|
| `invoicing` | weekly (e.g. Mon AM) | scan `_eingang/invoicing/` for new timesheets, run `compute.ts`, prepare pro-forma invoices for review |
| `daily-report` | weekdays (end of day) | assemble the day's report draft from provided hours/notes for review |
| `photo-sorting` | daily | propose renamed/filed photos from `_eingang/photo-sorting/` for review |
| `receipt-filing` | daily | read new receipts in `_eingang/receipt-filing/`, propose filing targets for review |
| `lead-gen` | manual / weekly | run a prepared URL list, produce the scored output file |

## Setting one up (operator walkthrough)

1. Make sure the process is onboarded (run it once manually first).
2. In Cowork, run `/schedule`.
3. Prompt template (German example for `receipt-filing`):
   > *"Verarbeite neue Belege in `_eingang/receipt-filing/` mit dem Command-Center-Prozess 'receipt-filing'. Bereite die Ablage vor und lege sie mir zur Freigabe vor — buche/verschiebe nichts ohne meine Freigabe."*
4. Pick the cadence; click **Schedule**.
5. Tell the firm the app-open caveat.

The `/command-center:setup` flow offers to walk through this for each activated process.
