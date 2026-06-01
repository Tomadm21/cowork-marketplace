# Kapitalfluss — Cowork Plugin (Jan Theobald)

Approval-gated automation: **Commerzbank CSV → Vektonce-Kapitalflusstabelle + McDonald's-Liquiditätsplanung**, packaged as a Claude Cowork plugin. The system **proposes**; the operator **disposes**. No auto-booking, no auto-send, ever. Every run is GoBD-archived.

> **System of record:** [`ISA.md`](./ISA.md) — goal, criteria (ISCs), test strategy, decisions.
> **Compliance:** [`docs/Verfahrensdokumentation.md`](./docs/Verfahrensdokumentation.md).

## Architecture

- **`engine/`** — portable bun+TS core, **zero Cowork import**. Same code ships Tier-1 (CLI), Tier-2 (Command Center cron), Tier-3 (Cowork). Ingest → categorize → diff → approval gate → values-only Excel write (xlsx-populate, structure-fingerprint guarded) → hash-chained GoBD archive.
- **`mcp/server.ts`** — thin local MCP server (the only Cowork-facing surface; the bank reach runs here, not via a native connector). Enforces the gate.
- **`skills/`** — `liquiditaet-run` (monthly, stops at approval) + `liquiditaet-setup` (workshop activation).
- **`artifacts/change-overview.template.html`** — the live-artifact approval UI.
- **`hooks/pre-write.hook.json`** — blocks any `commit_writes` not bound to an approval.
- **`config/`** — the workshop **swap-seam** (store registry, CSV profile, Excel cell-maps, DBA rules). Synthetic→real is config-only.
- **`fixtures/`** — synthetic, format-realistic test data. No real Jan data is ever committed.

## Develop

```bash
bun install
PLUGIN_ROOT="$PWD" bun run make-fixtures   # generate synthetic fixtures
PLUGIN_ROOT="$PWD" bun test                # 30 tests, incl. the no-alter round-trip + the approval gate
bun run typecheck
PLUGIN_ROOT="$PWD" bun cli/run.ts --store linde --csv fixtures/commerzbank/linde-2026-05.csv   # plan (no write)
```

## Status

**Phase 1 complete (green on synthetic fixtures).** Phase 2 (real Vektonce/CSV/DBA-mapping) and Phase 3 (Cowork-workspace validation) are workshop-gated — see `ISA.md`.
