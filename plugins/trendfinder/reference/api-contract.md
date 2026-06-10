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
| POST /api/niches/config | `{display_name, hashtags?, ...}` | Created niche incl. derived `niche_id` slug | ALWAYS use the returned `niche_id` afterwards |
| PUT /api/niches/config/{niche_id} | Partial niche fields | Updated niche | 404 if not tenant's |
| DELETE /api/niches/config/{niche_id} | — | 200 | 404 if not tenant's |
| POST /api/tenant/settings | `{apify_api_key}` | `{ok: true, tenant_id}` | Apify key is Fernet-encrypted at rest |
| POST /api/schedules | `{type: "scrape", niche_id, interval_hours (1–168), enabled}` | 201 schedule | 404 `{"error": "niche not found for this tenant"}` for foreign/unknown slugs |
| GET /api/schedules | — | `[{id, type, niche_id, interval_hours, enabled, last_run_at}]` | Tenant-scoped |
| PATCH /api/schedules/{id} | `{interval_hours?, enabled?}` | 200 | 404 if not tenant's |
| DELETE /api/schedules/{id} | — | 204 | 404 if not tenant's |
| GET /api/trends/{niche_id} | — | Trend clusters (list) | May be empty OR 404 for a fresh niche — both mean "no data yet" |
| GET /api/trends/{niche_id}/velocity | — | Velocity per cluster | Same empty-handling as above |
| GET /api/brands | — | Brand list | Avatars (personas) live under brands |
| GET /api/brands/{brand_id}/personas | — | Personas incl. DNA fields | |
| GET /api/personas/{persona_id} | — | One persona | |
| GET /api/pipeline/status | — | Pipeline state | For pipeline-control (Phase 3) |

---

## Platform Limits

These are deliberate Phase-1 backend decisions. The plugin encodes and enforces them.

1. **Apify key BEFORE first schedule.** A tenant without a deposited Apify key scrapes on the operator's global key. Onboarding deposits the customer's Apify token via `POST /api/tenant/settings` BEFORE any `POST /api/schedules`. This order is a hard gate, not a recommendation.

2. **Niche slugs are globally unique.** `niche_id` is derived from `display_name` and shared across all tenants. Convention: prefix the display name with the tenant id (e.g. `"acme Beauty"`), and always continue with the `niche_id` the API returned — never a locally guessed slug.

3. **Legacy data routes are not tenant-scoped.** `/api/trends/*` reads by niche slug, not by tenant. Self-scoping rule: skills ONLY pass niche slugs previously obtained from `GET /api/niches/config` in the same tenant context. Never accept a free-text niche slug from the user without resolving it against the tenant's niche list first.

4. **Schedules execute on the backend scheduler (60s tick), not in Cowork.** Cowork sessions are not 24/7. `last_run_at` on `GET /api/schedules` is the execution proof.

5. **No tenant self-service for key rotation or tenant deletion.** The operator handles both.
