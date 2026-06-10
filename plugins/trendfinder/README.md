# Trendfinder — Cowork Plugin

Customer-facing client for the Trendfinder multi-tenant data backend (Railway).
Thin data client: the backend stores trends/transcripts/avatars and runs 24/7
scrape schedules on the customer's own Apify token; ALL AI synthesis happens
natively in Claude inside the customer's Cowork seat.

## Components

| Component | Purpose |
|---|---|
| `skills/onboarding` | First-run setup: API key → health proof → Apify token → niches → first schedule → proof |
| `skills/cockpit` | Trendfinder-Cockpit Live Artifact (tabs: Trends · Avatare), regenerated on demand |
| `scripts/tf.sh` | curl wrapper reading `{workspace}/.trendfinder/config.json` |
| `reference/api-contract.md` | Endpoint contract + platform limits every skill relies on |

## Install

`/plugin marketplace add Tomadm21/cowork-marketplace` → `/plugin install trendfinder@command-center`

## Dev verification

A test tenant (`plugin-dev`) key lives in the untracked `.trendfinder/config.json`
at the repo root. Never commit it.
