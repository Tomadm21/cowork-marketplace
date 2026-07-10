# Trendfinder — Cowork Plugin

Turn TikTok/Instagram trend data into content decisions inside Claude Cowork.
Thin data client: it connects to a Trendfinder backend (trends, velocity, avatars/DNA,
scrape schedules) and renders the Trendfinder-Cockpit as a Live Artifact. **All AI
synthesis (briefings, scripts, cluster labels, avatar DNA) happens natively in Claude** —
the backend only stores and scrapes.

## Components

| Component | Purpose |
|---|---|
| `skills/onboarding` | Avatar-first setup + creation: access → connector → avatar (brand+persona+DNA) → niche(s) with AI-derived scrape topics → Cockpit; also re-derives topics for existing niches. 24/7 scheduled scraping remains an optional add-on (see `scheduler`) |
| `skills/cockpit` | Trendfinder-Cockpit Live Artifact (tabs: Trends · Avatare), regenerated on demand |
| `skills/scrape-now` | On-demand scrape for one niche + platform via the Cowork Apify connector |
| `skills/trend-radar` · `skills/trend-briefing` | Read + synthesise current trends |
| `skills/script-studio` | Hooks + short-video scripts in an avatar's voice, matched to trends, steered by a chosen Ziel (Reichweite · Engagement · Verkauf · Follower · Vertrauen) |
| `skills/avatar-studio` | Edit/list existing avatars |
| `skills/scheduler` | Manage automatic scrape schedules |
| `scripts/mcp-server.mjs` + `.mcp.json` | The plugin's stdio MCP server (`tf_request` / `tf_health` / `tf_configure`) — carries ALL API traffic host-side, outside the Cowork bash sandbox whose egress allowlist blocks the backend |
| `scripts/tf.sh` | curl wrapper for Claude-Code-CLI / debugging only — in Cowork the sandbox blocks its egress; skills use the MCP server |
| `reference/api-contract.md` | Endpoint contract + platform limits every skill relies on |
| `reference/next-steps.md` | The interactive next-step option block every skill ends with |
| `reference/niche-hashtags.md` | The AI topic-derivation ruleset (+ read-skill relevance check) |

## Setup

**Voraussetzungen:** a Node.js runtime (≥ 18) on the host — the plugin ships a
dependency-free stdio MCP server (`scripts/mcp-server.mjs`, started via the plugin's
`.mcp.json` as `node …/mcp-server.mjs`) that carries all Trendfinder API calls. In
Claude Cowork and Claude Code Desktop the bundled runtime covers this; nothing to install.

You need two values from your Trendfinder provider: a **backend URL** and an **API key**.
Install the plugin, then say *„richte Trendfinder ein"* — onboarding asks for both, then
walks you avatar-first: you describe an avatar and Claude derives its niche(s) and scrape
topics with AI — you never type a hashtag.

## Configuration

Connection details (`{ "base_url": "...", "api_key": "..." }`) live in two places, both
written by onboarding and never committed:

1. `{workspace}/.trendfinder/config.json` — per-workspace copy (pins the workspace to its
   tenant; keeps the CLI debug helper working). Takes precedence when present.
2. `~/.trendfinder/config.json` (host, `0600`) — fallback deposited via the MCP server's
   `tf_configure` tool; survives across Cowork sessions, whose per-session workspaces
   start empty.

The MCP server resolves lazily per request: `$TRENDFINDER_CONFIG` → walk-up from cwd →
home fallback.
