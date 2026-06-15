# Trendfinder API Contract

Backend: `https://api-production-78bb.up.railway.app` — multi-tenant architecture live since 2026-06-10. This file is the single source of truth every skill in the plugin relies on. Do not invent endpoints or fields not listed here.

---

## Auth

Every request except `GET /health` carries the header `X-API-Key: <tenant key>`.

Error responses:
- Wrong or missing key → `401 {"error": "unauthorized"}`
- Tenant-required route called without tenant context → `400 {"error": "tenant key required"}`
- Admin routes (`/api/admin/*`) reject tenant keys with `403` — the plugin never calls them.

The key lives in `{workspace}/.trendfinder/config.json` with shape:

```json
{ "base_url": "https://api-production-78bb.up.railway.app", "api_key": "..." }
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
| GET /api/trends/{niche_id} | query params: `min_score` (float, default 0.0), `persona_id` (optional), `limit` (int ≤100), `diversify` (bool) | Trend clusters (list). Fields per cluster: `cluster_id`, `trend_score`, `trend_label`, `description`, `hook_type`, `hook_examples`, `visual_style`, `velocity`, `video_count`, `video_count_delta`, `lifecycle`, `trajectory_counts`, `dominant_hashtags`, `dominant_audio_type`, `top_sounds`, `avg_engagement_rate`, `scripted_count`, `dismissed` | **NOT tenant-scoped at the backend** — the skill MUST only query niche slugs obtained from `GET /api/niches/config` for this tenant. Empty list OR 404 for a fresh niche — both mean no data yet. |
| GET /api/trends/{niche_id}/velocity | query param: `persona_id` (optional) | `[{cluster_id, trend_label, trend_score, velocity, trajectory}]` | **NOT tenant-scoped at the backend** — only query tenant-owned niche slugs from `GET /api/niches/config`. Empty list OR 404 for a fresh niche. |
| GET /api/brands | — | Brand list | ⚠️ NOT tenant-scoped — see platform limit 6; do not display to customers |
| GET /api/brands/{brand_id}/personas | — | Personas incl. DNA fields | ⚠️ NOT tenant-scoped — see platform limit 6 |
| GET /api/personas/{persona_id} | — | One persona | ⚠️ NOT tenant-scoped — see platform limit 6 |
| GET /api/pipeline/status | — | Pipeline state | For pipeline-control (Phase 3) |
| POST /api/ingest | `{niche_id, platform: "tiktok"\|"instagram", items[]}` | 201 `{inserted, updated, rejected, errors}` / 400 tenant / 404 niche | items MUST be raw actor dataset items (clockworks/tiktok-scraper or apify/instagram-hashtag-scraper) — do not reshape; max 500 items/request |

---

## Platform Limits

These are deliberate Phase-1 backend decisions. The plugin encodes and enforces them.

1. **Apify key BEFORE first schedule.** A tenant without a deposited Apify key scrapes on the operator's global key. Onboarding deposits the customer's Apify token via `POST /api/tenant/settings` BEFORE any `POST /api/schedules`. This order is a hard gate, not a recommendation.

2. **Niche slugs are globally unique.** `niche_id` is derived from `display_name` and shared across all tenants. Convention: prefix the display name with the tenant id (e.g. `"acme Beauty"`), and always continue with the `niche_id` the API returned — never a locally guessed slug.

3. **Legacy data routes are not tenant-scoped.** `/api/trends/*` reads by niche slug, not by tenant. Self-scoping rule: skills ONLY pass niche slugs previously obtained from `GET /api/niches/config` in the same tenant context. Never accept a free-text niche slug from the user without resolving it against the tenant's niche list first.

4. **Schedules execute on the backend scheduler (60s tick), not in Cowork.** Cowork sessions are not 24/7. `last_run_at` on `GET /api/schedules` is the execution proof.

5. **No tenant self-service for key rotation or tenant deletion.** The operator handles both.

6. **Brands/personas (avatars) are NOT tenant-scoped — do not display them.** `GET /api/brands` and `GET /api/brands/{id}/personas` return GLOBAL data across all tenants (cross-tenant data leak, live-verified 2026-06-11: a fresh tenant saw 8 foreign brands). Until Phase 3 adds tenant scoping to these routes, no skill may fetch or render brands/personas; the Cockpit shows the Avatare cold-start state instead.

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
Schedules run on the backend server scheduler (60-second tick) using the **Apify key deposited via `POST /api/tenant/settings`** during onboarding. This is a distinct credential from the Cowork Apify MCP connector used by `scrape-now`. Scheduled runs continue 24/7 independent of active Cowork sessions. `last_run_at` on the schedule row is the authoritative proof of execution.
