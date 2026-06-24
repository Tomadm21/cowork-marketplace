# Trendfinder — Cowork Plugin

Turn TikTok/Instagram trend data into content decisions inside Claude Cowork.
Thin data client: it connects to a Trendfinder backend (trends, velocity, avatars/DNA,
scrape schedules) and renders the Trendfinder-Cockpit as a Live Artifact. **All AI
synthesis (briefings, scripts, cluster labels, avatar DNA) happens natively in Claude** —
the backend only stores and scrapes.

## Components

| Component | Purpose |
|---|---|
| `skills/onboarding` | First-run setup (connector-only default): access → Apify connector → niche → Cockpit. 24/7 scheduled scraping is an optional add-on (see `scheduler`) |
| `skills/cockpit` | Trendfinder-Cockpit Live Artifact (tabs: Trends · Avatare), regenerated on demand |
| `skills/scrape-now` | On-demand scrape for one niche + platform via the Cowork Apify connector |
| `skills/trend-radar` · `skills/trend-briefing` | Read + synthesise current trends |
| `skills/script-studio` | Hooks + short-video scripts in an avatar's voice, matched to trends |
| `skills/avatar-studio` | Create brand + persona + DNA |
| `skills/scheduler` | Manage automatic scrape schedules |
| `scripts/tf.sh` | curl wrapper reading `{workspace}/.trendfinder/config.json` |
| `reference/api-contract.md` | Endpoint contract + platform limits every skill relies on |
| `reference/next-steps.md` | The interactive next-step option block every skill ends with |

## Setup

You need two values from your Trendfinder provider: a **backend URL** and an **API key**.
Install the plugin, then say *„richte Trendfinder ein"* — onboarding asks for both and
walks you through the rest.

## Configuration

Connection details live in `{workspace}/.trendfinder/config.json`
(`{ "base_url": "...", "api_key": "..." }`). This file is local to your workspace and is
never committed.
