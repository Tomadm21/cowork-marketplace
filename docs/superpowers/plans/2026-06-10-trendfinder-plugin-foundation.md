# Trendfinder Plugin Foundation (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the customer-facing foundation of the Trendfinder Cowork plugin — plugin.json + marketplace registration, api-contract.md, tf.sh CLI helper, onboarding skill, and the Trendfinder-Cockpit Live-Artifact generator — verified against the live multi-tenant API.

**Architecture:** "Thin Data Client, Fat Native Intelligence." The plugin wraps only data/trigger endpoints of the live Railway API (`https://api-production-78bb.up.railway.app`, X-API-Key auth, one key per tenant). All AI synthesis happens natively in Claude/Cowork. The Cockpit is a deterministic bun-TypeScript generator that fetches API data at generation time and INLINES it into one self-contained HTML (file:// CORS forbids runtime fetch in the artifact). Conventions follow the existing `command-center` plugin in this repo.

**Tech Stack:** Markdown skills (Cowork plugin format), bash (tf.sh), bun TypeScript (cockpit generator, dependency-free), jq for JSON validation.

---

## Context every implementer needs

- **Repo:** `~/cowork-marketplace` (private). Work on branch `feat/trendfinder-plugin`. Plugin root: `plugins/trendfinder/`.
- **Live API:** `https://api-production-78bb.up.railway.app`. Auth header: `X-API-Key: <tenant key>`. Wrong/missing key → `401 {"error": "unauthorized"}`. Tenant-required routes without tenant context → `400 {"error": "tenant key required"}`.
- **Dev credentials:** A test tenant `plugin-dev` exists. Its key lives ONLY in the untracked file `~/cowork-marketplace/.trendfinder/config.json` (shape below). **NEVER print, echo, commit, or copy this key. Reference it only via the file.** `.trendfinder/` is gitignored (Task 1 adds the entry).
- **Config file shape** (same shape customers get at `{workspace}/.trendfinder/config.json`):

```json
{
  "base_url": "https://api-production-78bb.up.railway.app",
  "api_key": "<tenant api key>"
}
```

- **Phase-1 platform limits the plugin must encode** (these are deliberate backend decisions, do not "fix" them server-side):
  1. A tenant WITHOUT a deposited Apify key silently scrapes on Tom's global key → onboarding MUST deposit the Apify key BEFORE creating any schedule.
  2. Niche slugs (`niche_id`) are globally unique across tenants → onboarding prefixes slugs with the tenant id (e.g. display name "Beauty" for tenant `acme` → ask the API to create display_name "acme Beauty" or accept the returned slug; the rule: always check the returned `niche_id` and use THAT in later calls).
  3. Legacy data routes (`/api/trends/*`, dashboard routes) are NOT tenant-scoped server-side — but a tenant's niches ARE tenant-scoped, and trends are read per niche slug. The plugin scopes itself by ONLY ever passing niche slugs obtained from `GET /api/niches/config` (which returns only the tenant's niches).
- **Key API shapes** (verified against `src/api/routes/` in the backend repo at commit 6fa7fcc):
  - `GET /health` → 200, no auth.
  - `GET /api/niches/config` → 200, list of the tenant's niches; each item has `niche_id` (slug) and `display_name`.
  - `POST /api/niches/config` body `{"display_name": "...", "hashtags": [...], ...}` → 200/201, returns created niche incl. derived `niche_id` slug.
  - `POST /api/tenant/settings` body `{"apify_api_key": "..."}` → 200 `{"ok": true, "tenant_id": "..."}`.
  - `POST /api/schedules` body `{"type": "scrape", "niche_id": "<slug>", "interval_hours": 6, "enabled": true}` → 201; 404 `{"error": "niche not found for this tenant"}` if the slug isn't the tenant's.
  - `GET /api/schedules` → 200 list `{id, type, niche_id, interval_hours, enabled, last_run_at}`.
  - `PATCH /api/schedules/{id}` body `{"interval_hours"?, "enabled"?}` → 200; `DELETE /api/schedules/{id}` → 204.
  - `GET /api/trends/{niche_id}` → 200 list of trend clusters (may be empty for a fresh niche; a 404 is also possible — treat both as "no data yet").
  - `GET /api/trends/{niche_id}/velocity` → velocity data per cluster.
  - `GET /api/brands` → list; `GET /api/brands/{brand_id}/personas` → list of avatars/personas with DNA fields.
- **Cowork interaction constraints** (from `plugins/command-center/reference/onboarding-ux.md` patterns): no clickable buttons — numbered options the user answers by typing a number, every question offers a ✏️ free-text escape, optional questions offer ⏭️ skip. Detect-and-confirm beats ask-and-type.
- **Live Artifact constraints:** generated HTML must inline ALL data (no `fetch()` inside the HTML), show a "Stand: <timestamp>" line, never crash the generator (API down → friendly error message + exit 1, no stacktrace spew), and render an action-first cold-start state when the tenant has no data yet.
- **Commit discipline:** one commit per task, conventional-commit style `feat(trendfinder): ...`. After committing, run `git show --stat HEAD` and verify every file you created is listed (this repo has an `archive/` gitignore gotcha that can silently eat files).

---

### Task 1: Plugin skeleton + marketplace registration

**Files:**
- Create: `plugins/trendfinder/.claude-plugin/plugin.json`
- Create: `plugins/trendfinder/README.md`
- Modify: `.claude-plugin/marketplace.json` (add plugins[] entry)
- Modify: `.gitignore` (add `.trendfinder/`)

- [ ] **Step 1: Create plugin.json**

```json
{
  "name": "trendfinder",
  "description": "Turn TikTok/Instagram trend data into content decisions inside Cowork. Connects to your Trendfinder data backend (trends, velocity, avatars/DNA, scrape schedules), guides a detect-first onboarding (API key, Apify token, niches, first schedule), and renders the Trendfinder-Cockpit as a Live Artifact with Trends and Avatare tabs. All AI synthesis (briefings, scripts, cluster labels) happens natively in Claude — the backend only stores and scrapes.",
  "version": "0.1.0",
  "author": { "name": "Tom Adomeit" },
  "keywords": ["trends", "tiktok", "instagram", "content", "avatars", "scraping", "cowork", "trendfinder"]
}
```

- [ ] **Step 2: Create README.md**

```markdown
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
```

- [ ] **Step 3: Register in marketplace.json**

Add to the `plugins` array of `.claude-plugin/marketplace.json` (keep existing entries untouched):

```json
{
  "name": "trendfinder",
  "source": "./plugins/trendfinder",
  "description": "Trend data → content decisions in Cowork. Detect-first onboarding (API key, Apify token, niches, schedules) against the Trendfinder backend, plus the Trendfinder-Cockpit Live Artifact (Trends · Avatare). Customer pays own scraping (Apify) and inference (Cowork seat); backend only stores and scrapes.",
  "version": "0.1.0",
  "author": { "name": "Tom Adomeit" },
  "keywords": ["trends", "tiktok", "content", "avatars", "cowork", "trendfinder"]
}
```

- [ ] **Step 4: Add `.trendfinder/` to .gitignore**

Append to the repo root `.gitignore` (create the file if missing):

```
# Trendfinder dev credentials (tenant API key) — never commit
.trendfinder/
```

- [ ] **Step 5: Verify**

Run: `jq -e '.name == "trendfinder"' plugins/trendfinder/.claude-plugin/plugin.json && jq -e '.plugins | map(.name) | index("trendfinder")' .claude-plugin/marketplace.json && git check-ignore .trendfinder/config.json && echo VERIFIED`
Expected: `VERIFIED` (exit 0). Note: `git check-ignore` needs the path to be ignorable — if `.trendfinder/` doesn't exist yet, `mkdir -p .trendfinder && touch .trendfinder/config.json` first is fine for the check IF the file doesn't already exist — if it already exists, DO NOT touch it (it holds the dev key).

- [ ] **Step 6: Commit**

```bash
git add plugins/trendfinder/.claude-plugin/plugin.json plugins/trendfinder/README.md .claude-plugin/marketplace.json .gitignore
git commit -m "feat(trendfinder): plugin skeleton + marketplace registration"
git show --stat HEAD   # verify all 4 files present
```

---

### Task 2: reference/api-contract.md

**Files:**
- Create: `plugins/trendfinder/reference/api-contract.md`

- [ ] **Step 1: Write the contract document**

Write `plugins/trendfinder/reference/api-contract.md` with EXACTLY these sections (content below is the required substance; phrase naturally, keep tables):

```markdown
# Trendfinder API Contract

> The single source of truth every skill in this plugin relies on.
> Backend: https://api-production-78bb.up.railway.app (Railway, multi-tenant since 2026-06-10).

## Auth

Every request (except `GET /health`) carries `X-API-Key: <tenant key>`.
- Wrong/missing key → `401 {"error": "unauthorized"}`
- Tenant-required route reached with a non-tenant context → `400 {"error": "tenant key required"}`
- Admin routes (`/api/admin/*`) reject tenant keys with `403` — the plugin never calls them.

The key lives in `{workspace}/.trendfinder/config.json`:
{ "base_url": "https://api-production-78bb.up.railway.app", "api_key": "..." }
Skills call the API exclusively through `scripts/tf.sh`, never raw curl with an inline key.

## Endpoints used by this plugin

| Method + Path | Body | Returns | Notes |
|---|---|---|---|
| GET /health | — | 200 | connectivity proof, no auth |
| GET /api/niches/config | — | tenant's niches `[{niche_id, display_name, ...}]` | tenant-scoped server-side |
| POST /api/niches/config | `{display_name, hashtags?, ...}` | created niche incl. derived `niche_id` slug | ALWAYS use the returned `niche_id` afterwards |
| PUT /api/niches/config/{niche_id} | partial | updated niche | 404 if not tenant's |
| DELETE /api/niches/config/{niche_id} | — | 200 | 404 if not tenant's |
| POST /api/tenant/settings | `{apify_api_key}` | `{ok: true, tenant_id}` | Fernet-encrypted at rest |
| POST /api/schedules | `{type: "scrape", niche_id, interval_hours (1–168), enabled}` | 201 schedule | 404 `niche not found for this tenant` for foreign/unknown slugs |
| GET /api/schedules | — | `[{id, type, niche_id, interval_hours, enabled, last_run_at}]` | tenant-scoped |
| PATCH /api/schedules/{id} | `{interval_hours?, enabled?}` | 200 | 404 if not tenant's |
| DELETE /api/schedules/{id} | — | 204 | 404 if not tenant's |
| GET /api/trends/{niche_id} | — | trend clusters (list) | may be empty OR 404 for a fresh niche — both mean "no data yet" |
| GET /api/trends/{niche_id}/velocity | — | velocity per cluster | same empty-handling |
| GET /api/brands | — | brand list | avatars live under brands |
| GET /api/brands/{brand_id}/personas | — | personas (avatars) incl. DNA fields | |
| GET /api/personas/{persona_id} | — | one persona | |
| GET /api/pipeline/status | — | pipeline state | for pipeline-control (Phase 3) |

## Platform limits (deliberate Phase-1 backend decisions — the plugin encodes them)

1. **Apify key BEFORE first schedule.** A tenant without a deposited Apify key scrapes on the operator's global key. Onboarding deposits the customer's Apify token via POST /api/tenant/settings BEFORE any POST /api/schedules. This order is a hard gate, not a recommendation.
2. **Niche slugs are globally unique.** `niche_id` is derived from display_name and shared across all tenants. Collisions return errors / wrong scoping. Convention: prefix the display name with the tenant id ("acme Beauty"), and always continue with the `niche_id` the API returned, never a locally guessed slug.
3. **Legacy data routes are not tenant-scoped.** `/api/trends/*` reads by niche slug, not by tenant. Self-scoping rule: skills ONLY pass niche slugs previously obtained from GET /api/niches/config in the same tenant context. Never accept a free-text niche slug from the user without resolving it against the tenant's niche list first.
4. **Schedules execute on the backend scheduler (60s tick), not in Cowork.** Cowork sessions are not 24/7. `last_run_at` on GET /api/schedules is the execution proof.
5. **No tenant self-service for key rotation or tenant deletion.** Operator (Tom) handles both.
```

- [ ] **Step 2: Verify**

Run: `rg -c 'X-API-Key|niche not found for this tenant|Apify key BEFORE|globally unique|not tenant-scoped' plugins/trendfinder/reference/api-contract.md`
Expected: count ≥ 5.

- [ ] **Step 3: Commit**

```bash
git add plugins/trendfinder/reference/api-contract.md
git commit -m "docs(trendfinder): API contract + platform limits"
git show --stat HEAD
```

---

### Task 3: scripts/tf.sh

**Files:**
- Create: `plugins/trendfinder/scripts/tf.sh` (mode 755)

- [ ] **Step 1: Write tf.sh**

```bash
#!/usr/bin/env bash
# tf.sh — Trendfinder API helper. Usage:
#   tf.sh GET /api/niches/config
#   tf.sh POST /api/schedules '{"niche_id":"acme-beauty","interval_hours":6}'
#   tf.sh DELETE /api/schedules/3
# Reads {base_url, api_key} from .trendfinder/config.json — resolved from
# $TRENDFINDER_CONFIG, else ./.trendfinder/config.json, else walking up
# parent directories. Prints the response body; exit 0 on 2xx, 1 otherwise.
# SECURITY: never echoes the api key, never enables xtrace.
set -euo pipefail

find_config() {
  if [[ -n "${TRENDFINDER_CONFIG:-}" ]]; then echo "$TRENDFINDER_CONFIG"; return; fi
  local dir="$PWD"
  while [[ "$dir" != "/" ]]; do
    if [[ -f "$dir/.trendfinder/config.json" ]]; then echo "$dir/.trendfinder/config.json"; return; fi
    dir="$(dirname "$dir")"
  done
  return 1
}

CONFIG="$(find_config)" || { echo "tf.sh: no .trendfinder/config.json found (set TRENDFINDER_CONFIG or run inside the workspace)" >&2; exit 1; }
BASE_URL="$(jq -r '.base_url // empty' "$CONFIG")"
API_KEY="$(jq -r '.api_key // empty' "$CONFIG")"
[[ -n "$BASE_URL" && -n "$API_KEY" ]] || { echo "tf.sh: config $CONFIG is missing base_url or api_key" >&2; exit 1; }

METHOD="${1:-}"; ENDPOINT="${2:-}"; BODY="${3:-}"
[[ -n "$METHOD" && -n "$ENDPOINT" ]] || { echo "usage: tf.sh METHOD /api/path ['{json body}']" >&2; exit 1; }

ARGS=(-sS -X "$METHOD" -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" -w '\n%{http_code}')
[[ -n "$BODY" ]] && ARGS+=(-d "$BODY")

RESPONSE="$(curl "${ARGS[@]}" "${BASE_URL}${ENDPOINT}")" || { echo "tf.sh: request failed (network/curl)" >&2; exit 1; }
HTTP_CODE="${RESPONSE##*$'\n'}"
BODY_OUT="${RESPONSE%$'\n'*}"
echo "$BODY_OUT"
[[ "$HTTP_CODE" =~ ^2 ]] || { echo "tf.sh: HTTP $HTTP_CODE" >&2; exit 1; }
```

- [ ] **Step 2: Make executable and verify error path WITHOUT config**

Run (from a directory with no config above it, e.g. `/tmp`): `cd /tmp && TRENDFINDER_CONFIG= ~/cowork-marketplace/plugins/trendfinder/scripts/tf.sh GET /health; echo "exit=$?"`
Expected: one friendly stderr line containing "no .trendfinder/config.json", `exit=1`, NO curl output, NO stacktrace. (Note: `TRENDFINDER_CONFIG=` empty is treated as unset by the `:-` default.)

- [ ] **Step 3: Verify live round-trips with the dev tenant**

Run from `~/cowork-marketplace` (the dev config lives at `.trendfinder/config.json` there):

```bash
cd ~/cowork-marketplace
./plugins/trendfinder/scripts/tf.sh GET /health && echo OK-HEALTH
./plugins/trendfinder/scripts/tf.sh GET /api/niches/config && echo OK-NICHES
```

Expected: health JSON + `OK-HEALTH`; a JSON list (the plugin-dev tenant's niches — likely `[]` or a single dev niche) + `OK-NICHES`. The output must NOT contain the api key.

- [ ] **Step 4: Verify auth failure shape**

Run: `cd /tmp && mkdir -p .trendfinder && printf '{"base_url":"https://api-production-78bb.up.railway.app","api_key":"wrong-key-123"}' > .trendfinder/config.json && ~/cowork-marketplace/plugins/trendfinder/scripts/tf.sh GET /api/niches/config; echo "exit=$?"; rm -rf /tmp/.trendfinder`
Expected: body `{"error":"unauthorized"}` (or detail-wrapped equivalent), stderr `tf.sh: HTTP 401`, `exit=1`.

- [ ] **Step 5: Commit**

```bash
git add plugins/trendfinder/scripts/tf.sh
git commit -m "feat(trendfinder): tf.sh API helper with config discovery + safe error paths"
git show --stat HEAD
```

---

### Task 4: skills/onboarding

**Files:**
- Create: `plugins/trendfinder/skills/onboarding/SKILL.md`

- [ ] **Step 1: Write SKILL.md**

Frontmatter requirements: `name: onboarding`; `description` must name the first-run triggers ("richte Trendfinder ein", "set up trendfinder", "trendfinder setup", "verbinde mein trendfinder", first use of any trendfinder skill without a config file).

Body must implement THIS flow, in THIS order, using numbered options + ✏️ free-text escape on every question (no buttons exist in Cowork) and detect-and-confirm where possible. All API calls go through `bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh ...`. Required steps:

1. **Step 0 — Self-check:** if `{workspace}/.trendfinder/config.json` exists AND `tf.sh GET /health` succeeds, say setup is already done and offer the Cockpit instead. Never re-run a completed setup blindly.
2. **Step 1 — API key + connection proof:** ask for the Trendfinder API key (provided by Tom when the tenant was created). Write `{workspace}/.trendfinder/config.json` with base_url + key. Immediately run `tf.sh GET /health` AND `tf.sh GET /api/niches/config`; on 401, say the key is wrong and re-ask (don't continue). The niches call doubles as tenant-identity proof: present any existing niches as detected state.
3. **Step 2 — Apify token (HARD GATE):** explain in one honest sentence: "Deine Scrapes laufen 24/7 auf deinem eigenen Apify-Account — dafür brauche ich einmalig deinen Apify-Token; ohne ihn lege ich keinen Zeitplan an." Capture the token (✏️ free-text — inherently open value), deposit via `tf.sh POST /api/tenant/settings '{"apify_api_key":"..."}'`, confirm `{"ok": true}`. **The skill text MUST state explicitly: no schedule is ever created before this step succeeds.** If the user wants to skip: park onboarding at this step, do NOT proceed to schedules.
4. **Step 3 — Niches (detect-first):** show existing niches from Step 1 as numbered confirm-by-exception list; for new niches ask display name + hashtags (✏️ free-text). Create via `tf.sh POST /api/niches/config`. **Slug rule:** prefix the display name with the tenant id (globally-unique-slug platform limit; cite `reference/api-contract.md`), and always read the returned `niche_id` from the response — never guess the slug.
5. **Step 4 — First schedule (with cost honesty):** propose interval as numbered options (1: alle 6h — empfohlen, 2: alle 12h, 3: täglich, ✏️ eigener Wert 1–168h). BEFORE creating, state the cost note: scrape costs hit the customer's own Apify account, roughly proportional to runs/day × hashtags — phrase as estimate, no invented prices. Create via `tf.sh POST /api/schedules '{"type":"scrape","niche_id":"<returned slug>","interval_hours":N,"enabled":true}'`, expect 201.
6. **Step 5 — Proof:** wait/offer to check: `tf.sh GET /api/schedules` shows the schedule (and `last_run_at` once the backend tick ran ≤60s later). Then read `tf.sh GET /api/trends/<niche_id>` — for a fresh niche this is empty: say honestly that first trends appear after the first scrape completes. Finish by generating the Cockpit (`skills/cockpit`) so the user ends on the artifact, even in cold-start state.
7. **Throughout:** every question shows numbered options where the value space is enumerable, ✏️ free-text escape always, ⏭️ skip only on optional steps (niches beyond the first, schedule tuning). Secrets (API key, Apify token) are never echoed back in full — confirm with last-4-chars only.

- [ ] **Step 2: Verify content**

Run: `rg -c 'tf.sh|Apify|niche_id|✏️|numbered|/health' plugins/trendfinder/skills/onboarding/SKILL.md`
Expected: count ≥ 6. Also: `rg -n 'before|bevor|vor' plugins/trendfinder/skills/onboarding/SKILL.md | rg -i 'schedule'` must show the Apify-before-schedule gate sentence.

- [ ] **Step 3: Commit**

```bash
git add plugins/trendfinder/skills/onboarding/SKILL.md
git commit -m "feat(trendfinder): detect-first onboarding skill with Apify hard gate"
git show --stat HEAD
```

---

### Task 5: Cockpit generator (skills/cockpit/scripts/cockpit.ts)

**Files:**
- Create: `plugins/trendfinder/skills/cockpit/scripts/cockpit.ts`

- [ ] **Step 1: Write the generator**

Requirements (bun TypeScript, NO npm dependencies — only `fetch`, `Bun.file`/`Bun.write`, `process`):

1. **Input:** `bun cockpit.ts <workspace_root>` — reads `<workspace_root>/.trendfinder/config.json` (fallback: walk up from cwd like tf.sh; also honor `TRENDFINDER_CONFIG`).
2. **Data collection (generation-time fetch is fine — the BAN is on fetch inside the generated HTML):**
   - `GET /api/niches/config` → niches.
   - For each niche: `GET /api/trends/{niche_id}` (and `GET /api/trends/{niche_id}/velocity` if trends exist). Treat 404 AND empty list both as "no data yet". Per-niche try/catch — one broken niche must not kill the page.
   - `GET /api/brands` → for each brand `GET /api/brands/{brand_id}/personas`. Same tolerance.
   - `GET /api/schedules` → for the status line (next scrape context).
3. **Output:** ONE self-contained HTML at `<workspace_root>/.trendfinder/cockpit.html`, all data inlined as a `const DATA = {...}` script block, print the absolute output path to stdout as the last line.
4. **HTML structure:** two tabs **Trends** and **Avatare** (pure CSS/JS tab switch, no external assets, German UI):
   - Header: "Trendfinder-Cockpit" + `Stand: DD.MM.YYYY, HH:MM` (Europe/Berlin) + tenant context (niche count, schedule count).
   - **Trends tab:** one section per niche (display_name). Each trend cluster renders defensively: use whichever of `label`/`name`/`topic` exists for the title, show `trend_score`, video count and velocity/lifecycle if present, skip unknown fields silently. Sort by trend_score desc.
   - **Avatare tab:** one card per persona (name, brand, short DNA excerpt if present).
   - **Action-first cold-start:** if there are no trends anywhere: the Trends tab leads with "Noch keine Trends — dein erster Scrape läuft <interval-context from schedules, else: lege einen Zeitplan an: ‚Scrape <Nische> alle 6h'>" — a next step, not a sad zero. Same pattern for Avatare ("Erstell deinen ersten Avatar: …" — avatar-studio is Phase 3, so phrase it as upcoming).
5. **Never crash:** config missing → one friendly stderr line + exit 1. API completely unreachable → friendly stderr line + exit 1. Partial failures (one niche 500s) → render the rest + a small "⚠️ <niche> konnte nicht geladen werden" note in the HTML. No stacktrace spew on any expected failure path (wrap main in try/catch, print `error.message` only).
6. **Security:** never embed the api key in the HTML or in stdout/stderr.

Implementation skeleton (extend, keep the shape):

```typescript
#!/usr/bin/env bun
// cockpit.ts — generates the Trendfinder-Cockpit as ONE self-contained HTML.
// Data is fetched at GENERATION time and inlined; the HTML itself never fetches.

type Config = { base_url: string; api_key: string };

function findConfig(workspaceRoot: string | undefined): string | null { /* env → workspaceRoot → walk up from cwd */ }

async function api(cfg: Config, path: string): Promise<{ ok: boolean; status: number; data: unknown }> {
  try {
    const res = await fetch(`${cfg.base_url}${path}`, { headers: { "X-API-Key": cfg.api_key } });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

function esc(s: unknown): string { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)); }

async function main() {
  // 1. resolve config (friendly exit 1 if missing)
  // 2. health-gate: GET /api/niches/config — if status 0 or 401, friendly exit 1
  // 3. collect niches → per-niche trends(+velocity) with per-niche try, brands → personas, schedules
  // 4. build html string: header with Stand:, tab bar, Trends sections, Avatare cards, cold-start branches, warnings list
  // 5. await Bun.write(outPath, html); console.log(outPath)
}

main().catch(e => { console.error(`cockpit: ${e instanceof Error ? e.message : e}`); process.exit(1); });
```

Use `esc()` on EVERY interpolated value (XSS hardening — trend labels come from scraped content).

- [ ] **Step 2: Verify cold-start against the live dev tenant**

Run: `cd ~/cowork-marketplace && bun plugins/trendfinder/skills/cockpit/scripts/cockpit.ts ~/cowork-marketplace && ls -la .trendfinder/cockpit.html`
Expected: stdout ends with the absolute path to `cockpit.html`; file exists; exit 0. Then: `rg -c 'Stand:|Trends|Avatare' .trendfinder/cockpit.html` ≥ 3, `rg -c 'fetch\(' .trendfinder/cockpit.html` returns 0 matches (exit 1 from rg is the PASS here), `rg -c 'Noch keine Trends' .trendfinder/cockpit.html` ≥ 1 (plugin-dev has no data), and the api key (check: `jq -r .api_key .trendfinder/config.json | head -c 8` prefix) does NOT appear: `rg -c "$(jq -r .api_key .trendfinder/config.json)" .trendfinder/cockpit.html` must return no matches.

- [ ] **Step 3: Verify the unreachable-API path**

Run: `cd /tmp && mkdir -p tfcrash/.trendfinder && printf '{"base_url":"http://127.0.0.1:9","api_key":"x"}' > tfcrash/.trendfinder/config.json && bun ~/cowork-marketplace/plugins/trendfinder/skills/cockpit/scripts/cockpit.ts /tmp/tfcrash; echo "exit=$?"; rm -rf /tmp/tfcrash`
Expected: ONE friendly stderr line (e.g. "cockpit: Backend nicht erreichbar …"), `exit=1`, no stacktrace.

- [ ] **Step 4: Commit**

```bash
git add plugins/trendfinder/skills/cockpit/scripts/cockpit.ts
git commit -m "feat(trendfinder): cockpit live-artifact generator (inline data, cold-start, never-crash)"
git show --stat HEAD
```

---

### Task 6: skills/cockpit/SKILL.md

**Files:**
- Create: `plugins/trendfinder/skills/cockpit/SKILL.md`

- [ ] **Step 1: Write SKILL.md**

Frontmatter: `name: cockpit`; description triggers: "zeig das Cockpit", "show cockpit", "trendfinder dashboard", "was trendet", "zeig meine trends", "zeig meine avatare", "übersicht" — plus "good as the home screen for a returning user" (mirror the command-center dashboard skill's description style).

Body (mirror `plugins/command-center/skills/dashboard/SKILL.md` structure):

1. **Step 0 — Self-verify (route, don't error):** if `{workspace}/.trendfinder/config.json` is missing → "Trendfinder ist noch nicht eingerichtet — sollen wir das in 2 Minuten machen?" and route to the onboarding skill. Don't generate against a missing config.
2. **Step 1 — Generate:** `bun ${CLAUDE_PLUGIN_ROOT}/skills/cockpit/scripts/cockpit.ts <workspace_root>` — prints the HTML path; best-effort, never crashes on missing data (a fresh tenant gets the action-first cold-start, not an error).
3. **Step 2 — Present as Live Artifact:** present the generated HTML as a **Live Artifact** (persistent Cowork tab, reopenable/refreshable) — NOT just a file path. Then a 2–3 line in-chat summary in the user's language: how many niches/trends/avatars, the single recommended next step, and "sag einfach ‚zeig das Cockpit', um zu aktualisieren".
4. **Honesty rules:** the cockpit is a regenerated snapshot ("Stand:"-timestamp), not streaming; empty states name the next action; never invent trend numbers in the chat summary — only what the generator reported.

- [ ] **Step 2: Verify**

Run: `rg -c 'Live Artifact|cockpit.ts|Stand:|onboarding' plugins/trendfinder/skills/cockpit/SKILL.md`
Expected: count ≥ 4.

- [ ] **Step 3: Commit**

```bash
git add plugins/trendfinder/skills/cockpit/SKILL.md
git commit -m "feat(trendfinder): cockpit skill — generate + present as live artifact"
git show --stat HEAD
```

---

## Final integration review mandate (controller dispatches after Task 6)

Whole-branch review with an explicit cross-task seam trace (Phase-1 learning: per-task reviews structurally miss seam bugs):

1. Trace the FULL onboarding path end-to-end as written: config file shape Task 3 expects == shape Task 4 writes == shape Task 5 reads; the slug the onboarding stores is the API-returned `niche_id`; the Apify gate sentence is unambiguous.
2. Trace cockpit data flow: every endpoint cockpit.ts calls exists in api-contract.md; empty/404 handling consistent.
3. Secret scan: `git log -p feat/trendfinder-plugin --not main | rg -i 'api_key.*[A-Za-z0-9_-]{20,}|sk-ant'` → no real keys (field names in code/docs are fine).
4. `.trendfinder/` never staged: `git log --name-only feat/trendfinder-plugin --not main | rg '^\.trendfinder/'` → empty.
5. Marketplace consistency: plugin.json version == marketplace.json entry version.
