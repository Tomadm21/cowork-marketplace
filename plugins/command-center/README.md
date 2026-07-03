# Command Center — Cowork plugin

Turn any firm into a Cowork-automated operation. Onboard the company **once**, and every business process runs in plain language inside Claude Cowork — and can be put on a schedule.

This is the productized version of the Command Center skeleton: a generic plugin that any firm installs and stands up itself, in chat, with no developer work.

## How it works (onboard once, then run, then watch)

0. **Alles reinwerfen** (`intake` skill) — der Alltagsweg: leg jede Datei (Belege, Fotos, Tagesbericht — gemischt) in den **einen** Eingang `_eingang/` und sag „verarbeite alles". Die intake-Skill erkennt jeden Typ selbst, fragt nur das Nötige und öffnet ein interaktives Review-Board.

1. **Firm onboarding** (`firm-onboarding` skill / `/command-center:setup`)
   A friendly chat interview collects everything about the firm — identity, locations, team, tools, bank, accounting, file conventions, which processes they run. It then scaffolds a standardized workspace folder structure and writes one `company-context.md` that gives Cowork 100% context. Every process reads this.

2. **Process skills** — one per business process, each self-contained
   - `invoicing` — pro-forma invoices from timesheets (deterministic money math); optional **Montagebau/Service-Report-Preset** (`reference/montagebau-preset.md`) for firms billing skilled-trade crews — separate Montage-/Fahrt-Sätze, independent Sa-/So-Zuschlag, per-vehicle Geräte-Abrechnung
   - `daily-report` — fill the firm's daily/weekly report template
   - `photo-sorting` — rename + file site/job photos by date and activity (verbatim from the Bautagesbericht when one exists); Modus B archives scanned Montage-/Serviceberichte as `JJJJ KWnn BV V.Nachname …` into `KWnn` folders
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

**Runtime requirements (honest):** the review/apply path needs only **Python 3** — `_firma/apply.py` is pure stdlib and the **only** engine that applies approvals. The TypeScript helpers (`dashboard.ts`, `compute.ts`, and the read-only lister `apply.ts`) are written for **bun**, but plain **Node ≥ 22.6** runs them too (Node 24 executes `.ts` directly: `node skills/dashboard/scripts/dashboard.ts …`) — bun is not required on Windows.

## How it's built (for the operator/developer)

- **Skill-first.** Most processes are SKILL.md instructions + bundled reference rules + templates, using Cowork's native abilities (vision, docx/xlsx/pdf, file ops). Determinism is reserved for money/legal math — `invoicing` ships a `compute.ts` helper and the skill is forbidden from doing the arithmetic itself.
- **Context is the product.** `company-context.md` is the single firm-level source of truth; each process keeps its own `config/<process>.json`. Process config may only *add* to the firm context, never restate it.
- **Firm-agnostic.** Galant is just firm #1 — no client data is hardcoded here. Master-data registers (sites/people/vendors) are optional; processes fall back to manual fields.

See `reference/architecture.md` for the design rationale and the Phase-2 path (per-process deterministic engines + MCP, the way `jan-kapitalfluss` does it).

## Status

**v0.10.2 — security & correctness hardening** (full-plugin review, all findings fixed):
- **Apply engine containment** (`_firma/apply.py`): sources, relative targets and filenames from queue JSON can no longer escape the workspace (`../` → `skipped-unsafe`, action stays open); absolute targets are honoured only if configured as `output_paths` in `_firma/config/*.json`, otherwise they fall back to `_ausgang/<process>`. Structured errors instead of tracebacks; `reject` errors on unknown ids instead of claiming success; corrupt journal lines no longer blind the replay guard; garbled queues surface in `queue_warnings`. **Re-run onboarding Step 2b (or re-copy apply.py) in existing workspaces to get the fix.**
- **`apply.ts` demoted to a read-only lister** — its apply commands (which lacked the journal guard, md5 idempotency and the missing-source refusal) were removed; `_firma/apply.py` is the only engine that applies approvals. Tier display is fail-closed (unknown tier ≠ "sicher").
- **`compute.ts` validates hard**: legacy config shapes (single rate per tier), non-numeric/negative hour fields and the legacy `reisezeit_h` row field abort with a clear message instead of silently computing wrong (or null) totals; duplicate person+date rows, Schlechtwetter hotel days, spesen/hotel gaps and year mismatches warn; km without a vehicle appear as a visible `(kein Fahrzeug)` position instead of being dropped. New test suite (`compute.test.ts`) plus apply.py integration tests — 130+ tests green.
- **Review-board widget escaping** is now mandatory (HTML-escape all queue values; single-line sendPrompt composition), injection guards restated at every file-read site, and a new **`reference/datenschutz.md`** (DSGVO): storage map, retention periods (signals 12 months, journal 24), deletion routines, Art.-30 building block.

**v0.10.1** — two additions on top of v0.10.0: (1) **Anreise-km ab Firmensitz** in the Montagebau-Preset — arrival/departure trips are always billed as the Firmensitz→Baustelle distance (`sites.<baustelle>.anreise_km`, asked once per site), never the reported odometer value; deviations surface as "prüfen". (2) **Speed pass** — a plugin-wide Tempo contract (`reference/firm-config-contract.md` §8): batched reads, each dropped file read exactly once (classify + extract in one pass), one batched checksum command instead of per-file spawns, lazy reference loading, and the dashboard artifact regenerates once per review session instead of after every single approval.

**v0.10.0** — `invoicing` gained the **Montagebau/Service-Report-Preset**: separate Montage-/Fahrt-Sätze per tier, independent Samstags-/Sonntags-Zuschlag (instead of one blended weekend rate), per-vehicle Geräte-/KFZ-Abrechnung, and an `pause_pre_applied` mode for firms whose hour extraction already nets out breaks (Fahrt-h = Pendelanteil, not the full travel window). All of it stays inside `compute.ts`'s hard rule — the skill still never calculates by hand; every new edge case (unresolved vehicle, over-cap day, spesen/hotel-flag mismatch) surfaces as a `warnings[]` line instead of a silent guess. See `skills/invoicing/reference/montagebau-preset.md`.

Plus everything from v0.9.2: dashboard is a pure statistics & history artifact (fully static: hero stats, Verlauf, Zuletzt abgelegt aus dem Journal — no open items, no buttons; reviewing lives entirely in chat via the review board). Plus v0.9.1: unified drop-zone intake + sequential interactive review board (incl. Modus B report scans) on top of onboarding and the business processes; canonical pure-Python apply engine (`_firma/apply.py`, md5-idempotent, journal-guarded, multi-target-safe, BOM-tolerant).

| Capability | Depth |
|---|---|
| **Firm onboarding** | Full — detect-first interview, workspace scaffold, one source-of-truth context file |
| **Invoicing** | Full — deterministic `compute.ts` for every figure (hours, tiers, per-diems, VAT, Geräte) + a documented end-to-end dry-run; simple single-rate mode or the Montagebau-Preset (getrennte Montage-/Fahrt-Sätze, Sa/So-Zuschlag, Fahrzeug-Abrechnung) |
| **Dashboard** | Full — live time-saved artifact, workflow transparency, work log |
| **Daily report · Photo sorting · Receipt filing** | Skill-complete — self-onboarding, reference rules, review-gated output, running on Cowork's native vision/document abilities |

Every process is review-gated (nothing is written, sent, or booked without your approval). Phase 2 adds a per-process deterministic engine where a process outgrows skill-level instructions — the path `jan-kapitalfluss` already follows. See `reference/architecture.md` and the walkthrough in `docs/end-to-end-dry-run.md`.
