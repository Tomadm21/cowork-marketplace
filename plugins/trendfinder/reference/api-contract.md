# Trendfinder API Contract

Backend: the customer's Trendfinder backend URL — **provided at onboarding** and stored in `config.json` (never hardcoded here). Multi-tenant architecture. This file is the single source of truth every skill in the plugin relies on. Do not invent endpoints or fields not listed here.

---

## Auth

Every request except `GET /health` carries the header `X-API-Key: <tenant key>`.

Error responses:
- Wrong or missing key → `401 {"error": "unauthorized"}`
- Tenant-required route called without tenant context → `400 {"error": "tenant key required"}`
- Admin routes (`/api/admin/*`) reject tenant keys with `403` — the plugin never calls them.

The key lives in `{workspace}/.trendfinder/config.json` with shape:

```json
{ "base_url": "<your Trendfinder backend URL>", "api_key": "..." }
```

Skills call the API exclusively through `scripts/tf.sh`, never raw curl with an inline key.

---

## Endpoints

All endpoints below are used by this plugin. Tenant-scoped routes enforce isolation server-side unless otherwise noted.

| Method + Path | Body | Returns | Notes |
|---|---|---|---|
| GET /health | — | 200 | Connectivity proof, no auth required |
| GET /api/niches/config | — | `[{niche_id, display_name, ...}]` | Tenant-scoped server-side |
| POST /api/niches/config | `{display_name, tiktok_hashtags?, instagram_hashtags?, youtube_search_queries?, tiktok_enabled?, instagram_enabled?, youtube_enabled?, ...}` | Created niche incl. derived `niche_id` slug | ALWAYS use the returned `niche_id` afterwards. **No generic `hashtags` field exists — unknown fields are silently ignored** (live-verified 2026-06-11); read the response back to confirm hashtags landed |
| PUT /api/niches/config/{niche_id} | Partial niche fields | Updated niche | 404 if not tenant's |
| DELETE /api/niches/config/{niche_id} | — | 200 | 404 if not tenant's |
| POST /api/tenant/settings | `{apify_api_key}` | `{ok: true, tenant_id}` | Apify key is Fernet-encrypted at rest |
| POST /api/schedules | `{type: "scrape", niche_id, interval_hours (1–168), enabled}` | 201 schedule | 404 `{"error": "niche not found for this tenant"}` for foreign/unknown slugs |
| GET /api/schedules | — | `[{id, type, niche_id, interval_hours, enabled, last_run_at}]` | Tenant-scoped |
| PATCH /api/schedules/{id} | `{interval_hours?, enabled?}` | 200 | 404 if not tenant's |
| DELETE /api/schedules/{id} | — | 204 | 404 if not tenant's |
| GET /api/trends/{niche_id} | query params: `min_score` (float, default 0.0), `persona_id` (optional), `limit` (int ≤100), `diversify` (bool) | Trend clusters (list). Fields per cluster: `cluster_id`, `trend_score`, `trend_label`, `description`, `hook_type`, `hook_examples`, `visual_style`, `velocity`, `video_count`, `video_count_delta`, `lifecycle`, `trajectory_counts`, `dominant_hashtags`, `dominant_audio_type`, `top_sounds`, `avg_engagement_rate`, `scripted_count`, `dismissed`, `persona_fit_score` | ✅ Tenant-scoped since 2026-06-16 — foreign/unknown niche slugs return 404. Empty list for a fresh owned niche = no data yet. `persona_id` is live since 2026-06-16: returns the niche clusters ranked by live DNA fit (`persona_fit_score` per cluster; may be null where no DNA/centroid vector exists — treat null as "unscored", never as 0). The plugin's avatar↔trend matching still happens natively in Claude (`script-studio`); `persona_id` is optional, for a backend-ranked view. |
| GET /api/trends/{niche_id}/velocity | query param: `persona_id` (optional) | `[{cluster_id, trend_label, trend_score, velocity, trajectory}]` | ✅ Tenant-scoped since 2026-06-16 — foreign slugs 404. Still: only query niche slugs resolved via `GET /api/niches/config`. Empty list for a fresh owned niche = no data yet. |
| GET /api/brands | — | Brand list (this tenant only) | ✅ Tenant-scoped since 2026-06-16 — safe to display |
| POST /api/brands | `{brand_id, display_name, mission?, target_audience?, content_pillars?, tone_of_voice?, visual_concept?, hashtag_strategy?, posting_schedule?, content_formats?}` | 201 created brand | `brand_id` stamped with this tenant. 409 if `brand_id` exists (globally unique). ⚠️ The optional rich fields are **objects/lists**, NOT strings (same shapes as the persona DNA sub-objects in § Avatars) — sending them as strings returns **422**. Keep the brand lean (`brand_id` + `display_name` + `mission` + `target_audience`) unless you have the structured shapes; carry rich content on the persona DNA |
| GET /api/brands/{brand_id} | — | One brand | 404 if not this tenant's |
| PUT /api/brands/{brand_id} | Partial brand fields | Updated brand | 404 if not this tenant's. `tenant_id` cannot be reassigned via body |
| DELETE /api/brands/{brand_id} | — | 204 | 404 if not this tenant's |
| GET /api/brands/{brand_id}/personas | — | **Slim** persona list: `[{id, persona_id, display_name, brand_id}]` — NO DNA fields | ✅ Tenant-scoped — safe to display. For DNA, fetch each persona via `GET /api/personas/{persona_id}` (enrich pattern; cockpit.ts does this) |
| POST /api/brands/{brand_id}/personas | `{persona_id, display_name, persona_profile?, content_pillars?, tone_of_voice?, system_prompt?, interests?, origin_story?, potential_development?, tiktok_enabled?, tiktok_hashtags?, instagram_enabled?, instagram_hashtags?, ...}` | 201 created persona | Inherits `tenant_id` from the parent brand (which is tenant-checked first). 409 if `persona_id` exists. Auto-embeds DNA best-effort on save |
| GET /api/personas/{persona_id} | — | One persona (avatar) | 404 if not this tenant's |
| PUT /api/personas/{persona_id} | Partial persona fields | Updated persona | 404 if not this tenant's. Re-embeds DNA if a DNA field changed |
| POST /api/personas/{persona_id}/embed-dna | — | `{status:"embedded", persona_id, vector_dims}` | Manual DNA (re-)embed. **503** if no Google embedder configured; **400** if persona has no DNA text |
| DELETE /api/personas/{persona_id} | — | 204 | 404 if not this tenant's |
| GET /api/pipeline/status | — | Pipeline state | For pipeline-control (Phase 3) |
| POST /api/ingest | `{niche_id, platform: "tiktok"\|"instagram", items[]}` | 201 `{inserted, updated, rejected, errors}` / 400 tenant / 404 niche | items MUST be raw actor dataset items (clockworks/tiktok-scraper or apify/instagram-hashtag-scraper) — do not reshape; max 500 items/request |

---

## Auto-pipeline (scrape → trends, no manual trigger)

After videos land via `POST /api/ingest` (on-demand) **or** a scheduled JobQueue scrape, the backend's always-on loop automatically (a) embeds the new pending videos and (b) **clusters the niche under its real slug** (`run_clustering(niche=<slug>, persona_id=None)`) on its ~10s cycle. No skill needs to call an embed/cluster endpoint — it is automatic (added 2026-06-15; before that, only `niche="all"`/per-persona clustering ran, so tenant niches never formed trends).

Consequences for skills:
- After ingest, trends appear in `GET /api/trends/{niche_id}` after a short delay (≈10–30s), not instantly. Poll (bounded) before rendering, then regenerate the artifact snapshot.
- A niche can have ingested videos but **zero trends** if too few clear the virality threshold to form a cluster — that is normal, not a failure.
- Clustering needs an LLM key (Anthropic or Google) configured on the backend; the embedder's Google key covers it. If neither is set, embedding still runs but clusters won't form (ops config, not a skill error).

## Avatars — Brands, Personas & DNA (tenant-scoped)

An **avatar** in Trendfinder is two layers:

1. **Brand** (`/api/brands`) — the overarching identity/Marke: mission, target audience, content pillars, tone, visual concept, hashtag strategy. A tenant can have several brands.
2. **Persona** (`/api/brands/{brand_id}/personas`) — the actual avatar that carries **DNA**: a rich profile (`persona_profile`, `tone_of_voice`, `content_pillars`, `system_prompt`, `interests`, `origin_story`) that gets vectorised into Qdrant and used to personalise trend matching (`GET /api/trends/{niche_id}?persona_id=...`). One brand → one or more personas.

**ID rules (both brand_id and persona_id):**
- Pattern `^[a-z0-9-]+$` (lowercase, digits, hyphens only — slugify display names), 1–100 chars.
- **Globally unique** across all tenants (like niche slugs). Convention: prefix with the tenant/brand name, e.g. `tom-beauty`, `tom-beauty-anna`. A clash returns **409** — pick another slug.

**Minimal create — Brand:**
```json
{ "brand_id": "tom-beauty", "display_name": "Tom Beauty" }
```

**Minimal create — Persona:**
```json
{ "persona_id": "tom-beauty-anna", "display_name": "Anna" }
```

**Full DNA Persona body (all DNA fields optional — synthesise what you have):**
```json
{
  "persona_id": "tom-beauty-anna",
  "display_name": "Anna",
  "persona_profile": { "name": "Anna", "age": 27, "background": "...", "location": "...", "appearance": "...", "personality": "...", "style": "..." },
  "tone_of_voice": { "tone": "...", "language": "de", "attitude": "...", "energy": "...", "avoid_words": ["..."], "example_openers": ["..."] },
  "content_pillars": [ { "name": "...", "description": "...", "topics": ["..."] } ],
  "system_prompt": "Du bist Anna ...",
  "interests": "...",
  "origin_story": "...",
  "potential_development": { "brand_deals": ["..."], "digital_products": ["..."], "community": ["..."] }
}
```

**DNA model (matches the `AI synthesis happens in Claude` axiom):**
- Claude synthesises the DNA *in the Cowork session* (from a short interview with the user) and POSTs it as structured JSON. The backend only **stores + embeds** — it never authors DNA.
- On persona create/update the backend auto-embeds DNA best-effort. `POST /api/personas/{id}/embed-dna` is the manual trigger and surfaces errors: **503** if no Google embedder is configured on the backend, **400** if the persona has no DNA text yet.
- `embed-dna` returning 200 (`vector_dims` set) is the proof the avatar's DNA is searchable. Until then the avatar exists and is editable, just not yet vector-matched to trends.

## Platform Limits

These are deliberate Phase-1 backend decisions. The plugin encodes and enforces them.

1. **Apify token BEFORE the first *enabled* schedule (not before on-demand).** Scheduled runs use the backend-deposited Apify token (`POST /api/tenant/settings`). **Since 2026-06-16 the backend hard-fails any tenant scheduled run without a deposited token — there is NO fallback to the operator's key.** The failure is server-side and invisible in the schedule row (`last_run_at` still updates on trigger), which is why the scheduler skill gates activation on the token (scheduler Step 2a; onboarding → „24/7-Automatik (optional)"). On-demand scrapes use the Cowork Apify MCP connector and require NO backend token.

2. **Niche slugs are globally unique.** `niche_id` is derived from `display_name` and shared across all tenants. Convention: prefix the display name with the tenant id (e.g. `"acme Beauty"`), and always continue with the `niche_id` the API returned — never a locally guessed slug.

3. **Trend routes are tenant-scoped since 2026-06-16.** `GET /api/trends/{niche}` and `/velocity` enforce niche ownership server-side — foreign slugs 404 (identical shape to "unknown"). Keep the self-scoping habit anyway: skills only pass niche slugs previously obtained from `GET /api/niches/config` in the same tenant context (defense-in-depth, better error messages). Never accept a free-text niche slug from the user without resolving it first.

4. **Schedules execute on the backend scheduler (60s tick), not in Cowork.** Cowork sessions are not 24/7. `last_run_at` on `GET /api/schedules` records when a run was last **triggered** (set at enqueue) — it does NOT prove the scrape succeeded. Success shows up as new data in `GET /api/trends/{niche}`.

5. **No tenant self-service for key rotation or tenant deletion.** The operator handles both.

6. **Brands/personas (avatars) ARE tenant-scoped (since 2026-06-16) — safe to create, fetch, and display.** All brand + persona routes (list/get/create/update/delete + embed-dna) filter by the tenant key server-side: a tenant sees and edits ONLY its own avatars, foreign access 404s, and created rows are stamped with the tenant. The old cross-tenant leak (live-verified 2026-06-11) is closed. The `avatar-studio` skill creates them; the Cockpit Avatare tab renders them. The self-scoping habit from limit 3 still applies whenever a niche slug is passed.

---

## Schedule CRUD — Supplementary Notes (added Phase 3)

**`POST /api/schedules` body details:**
- `type` — currently only `"scrape"` is valid
- `niche_id` — must be a niche owned by this tenant (tenant-scoped validation server-side); returns 404 `{"error": "niche not found for this tenant"}` for unknown/foreign slugs
- `interval_hours` — integer, bounds 1–168 (1 hour = minimum, 168 hours = 7 days/weekly maximum); backend rejects values outside this range
- `enabled` — boolean; default `true`; set `false` to create a paused schedule (backend scheduler will not execute it)

**`PATCH /api/schedules/{id}` body details:**
- Both fields optional; include only what you want to change
- `interval_hours` — same 1–168 bounds as POST
- `enabled` — `true` to resume, `false` to pause

**Execution model:**
Schedules run on the backend server scheduler (60-second tick) using the **Apify token deposited via `POST /api/tenant/settings`** (onboarding → „24/7-Automatik (optional)" or the scheduler skill's token gate). This is a distinct credential from the Cowork Apify MCP connector used by `scrape-now`. Scheduled runs continue 24/7 independent of active Cowork sessions. `last_run_at` on the schedule row records the last **trigger** (set at enqueue) — it is NOT proof the scrape succeeded; without a deposited token every run hard-fails server-side.

---

## Apify Credential Model

There are TWO distinct Apify credential paths. This split is intentional — not a gap.

| Path | Holder | When used | How established |
|------|--------|-----------|-----------------|
| **Cowork Apify MCP connector** | Cowork (OAuth per-user, `https://mcp.apify.com`) | On-demand scrapes (`scrape-now` skill) — runs while a Cowork session is active | User connects once via Cowork Settings → Connectors (OAuth); no token stored in the backend |
| **Backend Apify key** | Trendfinder backend server (Fernet-encrypted at rest) | 24/7 unattended scheduled scrapes (backend scheduler, 60s tick) — runs independently of any Cowork session | Deposited via `POST /api/tenant/settings` (onboarding → „24/7-Automatik (optional)" or the scheduler skill's token gate) |

**Rules:**
- On-demand scrapes via `scrape-now` always use the Cowork connector; they never read the backend Apify key.
- Scheduled scrapes managed by the backend scheduler always use the backend key; they never use the Cowork connector.
- A schedule must not be **activated** until the backend Apify token has been deposited (enforced by the scheduler skill's token gate; a paused schedule without a token is fine).
- If a tenant has no deposited token, the backend **hard-fails** every scheduled run ("scraping refused") — the operator's key is never used as a fallback. The failure is server-side and invisible in the schedule row: `last_run_at` still updates on trigger.

---

## Actor Cost Reference

Costs are estimates based on Apify pricing at time of writing. Actual amounts appear in the tenant's Apify dashboard. Skills display these estimates in cost-disclosure gates before running any actor.

| Actor | Actor ID | Approx. cost | Notes |
|-------|----------|--------------|-------|
| TikTok scraper | `clockworks/tiktok-scraper` | ≈ $1.70 per 1,000 posts | Current production actor used by `scrape-now` and the backend scheduler |
| Instagram hashtag scraper | `apify/instagram-hashtag-scraper` | ≈ $0.0004 per item | Already cheap; no alternative evaluation needed |

### Cost reduction opportunity (not implemented — separate evaluated task)

`apidojo/tiktok-scraper` runs at approximately $0.30 per 1,000 posts — roughly 5× cheaper than `clockworks/tiktok-scraper`. However, switching actors requires rewriting the backend's `normalize_tiktok_item` function to handle apidojo's different field shape (field names differ from clockworks output). This is a deliberate scope exclusion from Phase 3; it should be evaluated and implemented as a standalone task with its own test coverage for the normaliser rewrite.
