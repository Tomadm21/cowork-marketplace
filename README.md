# Command Center — Cowork Plugin Marketplace

Private Claude plugin marketplace by **Tom Adomeit**. Per-client workflow automations, installable into Claude Code / Claude Cowork.

## Plugins

| Plugin | What it does | Status |
|---|---|---|
| **jan-kapitalfluss** | Approval-gated Commerzbank → Kapitalflusstabelle + Liquiditätsplanung automation for a McDonald's franchise. Plans monthly writes from a CSV export, shows a change-overview live artifact, writes into the existing Excel files **only after explicit approval**. No auto-booking, no auto-send. GoBD-archived. | Phase 1 (engine + shell green; real data + Cowork validation pending) |

## Install

**Add this marketplace, then install the plugin.**

From a local clone (for testing on your own machine):
```bash
# in Claude Code / Cowork:
/plugin marketplace add ~/cowork-marketplace
/plugin install jan-kapitalfluss@command-center
```

From a private GitHub repo (once pushed — the installer needs repo access):
```bash
/plugin marketplace add <your-org>/cowork-marketplace
/plugin install jan-kapitalfluss@command-center
```

> The `/plugin` menu in the Cowork/Claude UI does the same thing interactively (Customize → add marketplace → install).

## Before the first live run (one-time, per machine)

The `jan-kapitalfluss` plugin ships a local **bun** MCP server. Install its dependencies once in the plugin directory so the server can start:

```bash
cd plugins/jan-kapitalfluss
bun install
```

(Requires [`bun`](https://bun.sh). The MCP server then runs as `bun ${CLAUDE_PLUGIN_ROOT}/mcp/server.ts`.)

## Structure

```
cowork-marketplace/
├── .claude-plugin/
│   └── marketplace.json          # this marketplace
└── plugins/
    └── jan-kapitalfluss/
        ├── .claude-plugin/plugin.json   # plugin manifest (MCP server inline)
        ├── skills/                      # liquiditaet-run, liquiditaet-setup
        ├── hooks/hooks.json             # blocks commit_writes without approval
        ├── mcp/server.ts                # local MCP server (engine adapter)
        ├── engine/                      # portable bun+TS core (no Cowork import)
        ├── config/                      # the workshop swap-seam (data, not code)
        ├── artifacts/                   # the live-artifact approval UI
        ├── fixtures/ · tests/ · docs/   # synthetic data, 34 tests, GoBD Verfahrensdok.
        └── ISA.md                       # system of record
```
