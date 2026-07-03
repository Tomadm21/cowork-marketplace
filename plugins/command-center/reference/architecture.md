# Architecture — for the operator/developer

Design rationale for Command Center, and how to extend it. (Not loaded by the firm-facing skills.)

## The thesis

Command Center is the productized "skeleton for per-customer workflow automation." The original lives as a local Electron/tRPC app (`~/commandcenter`); this plugin makes the *same processes* stand themselves up inside Claude Cowork, for any firm, with no developer.

The irreducible value is **captured, self-verifying firm context** — not the process code. Onboard a firm once into `company-context.md`; every process inherits it. That's the reinforcing loop the product is built on.

## Why skill-first (not engine-port)

The reference plugin `jan-kapitalfluss` ports a deterministic TypeScript engine + MCP server because GoBD financial writes forbid an LLM doing the arithmetic. That determinism is a **hard constraint only for money/legal math**. For naming files, filling a report, sorting photos, and filing receipts, Cowork's native abilities (vision, docx/xlsx/pdf skills, file ops) plus instructed Claude are sufficient and far simpler — which is exactly the "easier in Cowork" goal.

So the rule is:
- **Default:** a process is a `SKILL.md` (instructions) + bundled `reference/` rules + templates.
- **Determinism where it's load-bearing:** ship a small helper script the skill is *required* to use and forbidden to bypass. `invoicing/scripts/compute.ts` is the first example.

## Mapping: Command Center workflow → Command Center skill

| CC workflow concept | Plugin equivalent |
|---|---|
| DAG `bash compute` node | bundled helper script (only where determinism matters) or skill instructions |
| DAG `prompt` node (vision extract) | the skill instructs Claude to read the dropped file (Cowork vision) |
| DAG `approval` node + operator edits | the skill shows a proposal and waits for approval before writing |
| `_shared/*.ts` registers (baustellen/monteure/lieferanten) | optional `_firma/stammdaten/*.json` registers |
| `workflow_config` DB row (serverOutputPath…) | `_firma/config/<process>.json` (`output_paths`) |
| per-client `client.config.ts` | `_firma/company-context.md` |

## Self-verify + inheritance (the anti-drift design)

- **company-context.md** = firm-level facts only, with stable anchors (idempotent updates).
- **config/<process>.json** = per-process, keyed JSON, decoupled per process.
- Each process **self-verifies** its required context at run start and, if missing, **routes into its own onboarding** rather than erroring.
- Process onboarding may **only add** config; it never restates firm facts. One fact, one home.

Full rules: `reference/firm-config-contract.md`.

## Adding a new firm

1. Install the plugin in the firm's Cowork.
2. Run `/command-center:setup` → firm onboarding → scaffolds the workspace + `company-context.md`.
3. Activate the processes the firm wants; each onboards itself.
Galant onboards exactly this way — it is firm #1, with no special-casing in the plugin. (A sample appears in `docs/end-to-end-dry-run.md`.)

## Adding a new process skill

1. `mkdir skills/<process>` with a `SKILL.md` (frontmatter `name` + trigger-rich `description`) + `reference/rules.md` + `reference/onboarding.md`.
2. Obey the config contract: self-verify gate, own `config/<process>.json`, read firm facts from `company-context.md`, resolve I/O against `workspace_root`.
3. If the process has money/legal math, add a `scripts/` helper and forbid inline computation in the SKILL.md.
4. Register it in `reference/workflows.json` (order, card texts, minutes_per_item — dashboard, process-catalog and review-board all read it; without this entry the process is invisible) and mention it in `reference/automation.md`.

## Phase-2 (deterministic engines per process)

For any process that later needs guaranteed determinism or true headless runs, follow the `jan-kapitalfluss` pattern: a portable, Cowork-free TS engine + a thin MCP adapter + an approval hook, with the skill driving it. The skill-first version and the engine version can coexist (Tier-3 Cowork / Tier-2 headless / Tier-1 CLI) because the engine has zero Cowork imports.

## Self-improvement loop (v0.3.0)

The plugin improves over time without ever self-modifying. Two roles, hard boundary:

- **Daily users** use processes and write only to the workspace. Each process appends
  best-effort friction signals to `_firma/_state/signals.jsonl` (schema: `reference/signals.md`).
- **Operator (Tom)** pulls `/command-center:review` every 2–4 weeks. `review.ts` windows
  signals by a watermark, clusters them, and gates candidates by **recurrence (≥3)** AND
  **evidence** (`reference/patterns.md`), writing a Markdown report. Nothing auto-applies —
  acting on a recommendation is a deliberate plugin edit by Tom.

`patterns.md` is the operator-curated evidence library; curating it is how the review sharpens.
The daily dashboard (`skills/dashboard/`) stays the firm's clean, stable home screen — in v0.5.0
it became read-only (review moved to chat), but it remains separate from this operator loop.

## Overview + chat-review (v0.4.0 → v0.5.0)

The dashboard Live Artifact is a **pure statistics & history page** (since v0.9.2): fully static HTML — hero stats (time saved, Vorgänge, Läufe, open-count), process cards, the run history (Verlauf) and every filed file from the engine journal (Zuletzt abgelegt). It never lists open review items and carries **no script and no buttons** — reviewing lives entirely in chat (review-board skill / `reference/chat-review.md`).

- **Queues** — prepared runs write `_firma/_review/R-<date>-<slug>.json` (contract: `reference/review-queue.md`). Writing a queue never moves files; it is the "prepared" state.
- **Engine** — canonical: the workspace-resident `_firma/apply.py` (pure Python 3, installed by onboarding — see v0.7.0 below). It applies an approval: copy collision-safe to the target(s), append a reversible journal record in `_firma/_journal/`, remove the action, archive the emptied queue. Commands: `list`, `approve`, `reject`, `approve-safe`, `--dry`. Since v0.10.2 it enforces workspace containment (sources/relative targets/filenames; absolute targets only if configured as `output_paths`). `skills/dashboard/scripts/apply.ts` is a **read-only lister** (`list` only — its apply commands were removed in v0.10.2 because a partial engine port is more dangerous than none); runnable via bun or Node ≥ 22.6.
- **Review in chat (v0.5.0)** — approving, **editing (full: values/targets/filename), re-running**, and rejecting all happen in chat, not from the artifact. The dashboard skill maps natural language to engine commands and queue patches (`reference/chat-review.md`). The dashboard triggers nothing; the role boundary is unchanged — apply is always a deliberate human step in chat.

## Unified intake + interactive review (v0.6.0)

Two additions make the firm-facing flow „drop everything, review once":

- **`skills/intake/`** — a single drop-zone entry point. It scans the shared `_eingang/`, classifies each new file by content (`reference/classify.md`), de-duplicates (content hash + magic-byte vs extension), routes each to the right process, asks only the unavoidable questions (photos: site/date, once per batch; receipts & daily-report: none), runs each process in prepare-mode, and writes the per-process review queues. It is also the collector's loop entry (one inbox instead of four).
- **`skills/review-board/`** — the action surface. Per pending item it renders **native `present_files` file boxes** (📄 Ergebnis = the produced output from `_firma/_review/_preview/`, 📎 Quelle = the input) directly under the item; clicking a box opens the file in Cowork's right-hand sidebar natively (no chat round-trip). A compact `show_widget` action panel collects approvals and saves them in one batch click (sendPrompt → apply). The button only sendPrompts the batch, so the role firewall (`reference/review-queue.md`) is unchanged. Save target resolves to the firm's real N:/S: path when connected, else the workspace `_ausgang/<process>/` with the intended path noted. The read-only `dashboard` stays the stable home screen. (v0.6.2: preview moved from embedded images to native side-bar file boxes.) (v0.6.3: review is **sequential, one process at a time** — each item is a full **editable** card (Dateiname, Speicherort, Werte) with its native Ergebnis/Quelle boxes beneath; a single "Freigeben (Prozess)" saves that process and renders the next prepared one. intake still prepares all processes together.)

## Reliability hardening (v0.7.0)

From an end-to-end audit of the first real run:
- **Canonical engine in the workspace.** `firm-onboarding` writes `_firma/apply.py` (pure Python 3) — no `bun` dependency. **Content-idempotent** (md5: identical file → `skipped-identical`, never a `_2` clone), **journal-guarded** and **atomic** (interrupted runs repeat safely), records applied hashes in `_firma/_state/filed-md5.json`, derives counts from `len(actions)`, cleans a run's preview/staging on archive.
- **Gate enforced + configs.** Intake refuses a process without `config/<process>.json` and routes into its onboarding. A shared-inbox mapping lives in `config/intake.json` (`inbox_roots`, `ordner_routing`, `externe_eingaenge`).
- **Delete permission up front.** Onboarding requests `allow_cowork_file_delete` once, so archiving never breaks mid-approval.
- **Learning loop + confidence.** Confirmed `fact:` signals (new site/vendor) are written into `stammdaten/` after approval; per-process confidence calibration makes clear cases `sicher` (eligible for one-click `approve-safe`).
- **Severity axis.** `improvement-review` lets a `severity:"folgenreich"` signal bypass the recurrence-≥3 gate, surfacing a structurally damaging issue on first occurrence.

## Hourly loop (v0.5.0, heutige Form seit v0.7.0)

One shared hourly collector task drives everything (`reference/automation.md`): it runs **intake** over the shared `_eingang/` (plus configured `externe_eingaenge`), skips anything already seen/prepared/filed (dedupe via open queues + journal + `_firma/_state/seen-<process>.json`), batches new inputs into one queue per process — the dashboard then shows the open **count**, review happens in chat. Honest limit: scheduled tasks only run while the app is open and the Mac is awake.
