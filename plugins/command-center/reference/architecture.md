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
4. Add it to `skills/process-catalog/SKILL.md` and `reference/automation.md`.

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
The daily dashboard (`skills/dashboard/`) is deliberately unchanged — it stays the firm's clean,
stable home screen.
