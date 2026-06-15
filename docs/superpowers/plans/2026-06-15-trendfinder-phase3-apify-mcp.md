# Trendfinder Phase 3 — Apify via MCP + Kern-Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apify connects to Cowork via its official MCP connector (on-demand, no token paste); a new backend ingest endpoint persists MCP-scraped data into the trend DB; and the core read-skills (trend-radar, trend-briefing) plus a schedule-config surface deliver real trend value — with tenant isolation intact.

**Architecture:** Two repos. (1) Backend `~/upwork-showcase-clean` (Python/FastAPI, branch `feat/phase3-ingest`): one new tenant-scoped `POST /api/ingest` endpoint that normalizes raw Apify dataset items (reusing the scrapers' existing `_normalize`, which is client-free) and runs them through the existing `upsert_video` → embed → Qdrant pipeline. (2) Plugin `~/cowork-marketplace/plugins/trendfinder` (bun/TS + skill markdown, branch `feat/phase3-apify-mcp`): on-demand scrape skill driving the **Cowork Apify MCP connector** (`call-actor`) then POSTing results to `/api/ingest`; read-skills trend-radar + trend-briefing; a schedule-surface skill over the **already-built** tenant `schedules` CRUD; and an onboarding update (MCP connector instead of token paste for on-demand).

**Tech Stack:** Backend — FastAPI, SQLAlchemy 2.0, Pydantic 2, pytest/ruff. Plugin — bun TypeScript (zero-dep), bash (`tf.sh`), skill markdown. Apify — official remote MCP server `https://mcp.apify.com` (OAuth, client-side connector in Cowork), actors `clockworks/tiktok-scraper` + `apify/instagram-hashtag-scraper`.

**Critical invariants (read before any task):**
- The on-demand MCP `call-actor` MUST use the SAME actor IDs the backend `_normalize` expects (`clockworks/tiktok-scraper`, `apify/instagram-hashtag-scraper`) and pass raw dataset items through unchanged — otherwise field mapping in `_normalize` breaks silently.
- Tenant isolation is non-negotiable: every new endpoint/skill is tenant-scoped; brands/personas stay un-fetched (Phase-2 platform-limit 6).
- `.trendfinder/` is gitignored — never stage it; never print the plugin-dev tenant key.
- No backend Apify token on the on-demand path; the server credential is needed ONLY for the unattended 24/7 scheduler (unchanged from Phase 1).

---

## Task 1 (D1): Backend `POST /api/ingest` + normalization extraction

**Repo:** `~/upwork-showcase-clean` · **Branch:** `feat/phase3-ingest`

**Files:**
- Modify: `src/scraper/tiktok.py` — extract module-level `normalize_tiktok_item`
- Modify: `src/scraper/instagram.py` — extract module-level `normalize_instagram_item`
- Create: `src/api/routes/ingest.py` — the endpoint
- Modify: `src/api/main.py` (or wherever routers are included) — register the router
- Test: `tests/api/test_ingest.py` (mirror the existing `tests/**/test_schedules*.py` tenant-scoped fixture pattern)

### Step 1.1 — Extract normalization to module-level (refactor, no behavior change)

- [ ] **Write the failing test** `tests/scraper/test_normalize_extract.py`:

```python
from src.scraper.tiktok import normalize_tiktok_item
from src.scraper.instagram import normalize_instagram_item

def test_normalize_tiktok_item_maps_fields():
    item = {"id": "123", "playCount": 200000, "diggCount": 5000,
            "commentCount": 10, "shareCount": 2, "hashtags": [{"name": "fitness"}],
            "webVideoUrl": "https://tt/123"}
    v = normalize_tiktok_item(item, "mytenant-fitness")
    assert v.platform == "tiktok" and v.video_id == "123"
    assert v.views == 200000 and v.niche == "mytenant-fitness"
    assert "fitness" in v.hashtags

def test_normalize_instagram_item_maps_fields():
    item = {"id": "abc", "videoPlayCount": 90000, "likesCount": 8000,
            "commentsCount": 50, "caption": "love #fit", "url": "https://ig/abc"}
    v = normalize_instagram_item(item, "mytenant-fitness")
    assert v.platform == "instagram" and v.video_id == "abc"
    assert v.likes == 8000 and v.niche == "mytenant-fitness"
```

- [ ] **Run, verify it fails** (ImportError): `pytest tests/scraper/test_normalize_extract.py -v`
- [ ] **Implement** — in `src/scraper/tiktok.py`, move the body of `TikTokScraper._normalize` into a new module-level function and delegate:

```python
def normalize_tiktok_item(item: dict, niche: str, persona_id: str | None = None) -> NormalizedVideo:
    # (exact current body of TikTokScraper._normalize, with `self.persona_id` → `persona_id`)
    ...

class TikTokScraper:
    def _normalize(self, item: dict, niche: str) -> NormalizedVideo:
        return normalize_tiktok_item(item, niche, self.persona_id)
```

  Do the identical extraction in `src/scraper/instagram.py` → `normalize_instagram_item(item, niche, persona_id=None)`, keeping the `_HASHTAG_RE` module constant available to it.
- [ ] **Run all scraper tests** to prove no regression: `pytest tests/scraper/ -v`
- [ ] **Commit:** `refactor(scraper): extract module-level normalize_{tiktok,instagram}_item for reuse`

### Step 1.2 — Ingest endpoint (TDD)

- [ ] **Write the failing test** `tests/api/test_ingest.py` covering: (a) 201 + counts on a valid tenant-owned niche; (b) 400 `{"error":"tenant key required"}` with no key; (c) 404 when niche_id is not owned by the tenant (anti / cross-tenant write blocked); (d) dedupe — re-posting the same item yields `updated` not a second insert; (e) inserted rows get `embedding_status="pending"`. Mirror the tenant fixture from the schedules tests. Sample assertions:

```python
def test_ingest_inserts_for_owned_niche(client, tenant_headers, owned_niche):
    body = {"niche_id": owned_niche, "platform": "tiktok",
            "items": [{"id": "v1", "playCount": 500000, "diggCount": 20000,
                       "commentCount": 5, "shareCount": 1, "webVideoUrl": "u"}]}
    r = client.post("/api/ingest", json=body, headers=tenant_headers)
    assert r.status_code == 201
    assert r.json()["inserted"] == 1

def test_ingest_requires_tenant(client):
    r = client.post("/api/ingest", json={"niche_id": "x", "platform": "tiktok", "items": []})
    assert r.status_code == 400 and r.json()["detail"]["error"] == "tenant key required"

def test_ingest_rejects_foreign_niche(client, tenant_headers, other_tenant_niche):
    r = client.post("/api/ingest",
                    json={"niche_id": other_tenant_niche, "platform": "tiktok", "items": []},
                    headers=tenant_headers)
    assert r.status_code == 404
```

- [ ] **Run, verify it fails** (404 route not found): `pytest tests/api/test_ingest.py -v`
- [ ] **Implement** `src/api/routes/ingest.py`:

```python
"""Tenant-scoped ingestion of externally-scraped (Cowork Apify MCP) dataset items."""
import logging
from typing import Literal, Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from src.api.deps import get_db, get_tenant_id
from src.db.models import NicheConfigDB
from src.scraper.runner import upsert_video
from src.scraper.tiktok import normalize_tiktok_item
from src.scraper.instagram import normalize_instagram_item

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ingest", tags=["ingest"])

_NORMALIZERS = {"tiktok": normalize_tiktok_item, "instagram": normalize_instagram_item}


class IngestBody(BaseModel):
    niche_id: str = Field(min_length=1, max_length=100)
    platform: Literal["tiktok", "instagram"]
    items: list[dict[str, Any]] = Field(default_factory=list)


def _require_tenant(tenant_id: str | None = Depends(get_tenant_id)) -> str:
    if tenant_id is None:
        raise HTTPException(status_code=400, detail={"error": "tenant key required"})
    return tenant_id


@router.post("", status_code=201)
def ingest(body: IngestBody, tenant: str = Depends(_require_tenant), db: Session = Depends(get_db)):
    niche = db.query(NicheConfigDB).filter(
        NicheConfigDB.niche_id == body.niche_id,
        NicheConfigDB.tenant_id == tenant,
    ).first()
    if niche is None:
        raise HTTPException(status_code=404, detail={"error": "niche not found for this tenant"})

    normalize = _NORMALIZERS[body.platform]
    inserted = updated = rejected = 0
    errors: list[str] = []
    for raw in body.items:
        try:
            v = normalize(raw, body.niche_id)
            if not v.video_id:
                rejected += 1
                continue
            result = upsert_video(db, v)
            if result == "inserted":
                inserted += 1
            elif result == "updated":
                updated += 1
            else:
                rejected += 1
        except Exception as e:  # noqa: BLE001 — one bad item must not fail the batch
            errors.append(str(e)[:200])
    logger.info("[Ingest] tenant=%s niche=%s platform=%s inserted=%d updated=%d rejected=%d errors=%d",
                tenant, body.niche_id, body.platform, inserted, updated, rejected, len(errors))
    return {"inserted": inserted, "updated": updated, "rejected": rejected, "errors": errors}
```

- [ ] **Register the router** in the app factory next to the other `include_router` calls (find `include_router(schedules` to locate the block; add `from src.api.routes import ingest` + `app.include_router(ingest.router)`).
- [ ] **Run** `pytest tests/api/test_ingest.py -v` → PASS
- [ ] **Run** `ruff check src/api/routes/ingest.py src/scraper/tiktok.py src/scraper/instagram.py` → clean
- [ ] **Commit:** `feat(api): add tenant-scoped POST /api/ingest for Cowork Apify MCP results`

---

## Task 2 (D2): Plugin on-demand scrape skill via Cowork Apify MCP connector

**Repo:** `~/cowork-marketplace` · **Branch:** `feat/phase3-apify-mcp`

**Files:**
- Create: `plugins/trendfinder/skills/scrape-now/SKILL.md`
- Modify (if needed): `plugins/trendfinder/scripts/tf.sh` — ensure `POST <path> @<file>` body support
- Modify: `plugins/trendfinder/reference/api-contract.md` — add `/api/ingest` row

### Step 2.1 — tf.sh body support

- [ ] **Verify** whether `tf.sh` already supports `POST /path @bodyfile.json` (read the script). If not, add it: accept an optional 3rd arg; if it starts with `@`, pass `--data-binary @file` with `-H "Content-Type: application/json"`. Keep the existing key-never-logged + non-2xx→stderr+exit-1 behavior. Add a one-line usage comment.
- [ ] **Manual verify** (no real scrape): `echo '{"niche_id":"plugin-dev-test","platform":"tiktok","items":[]}' > /tmp/ing.json && tf.sh POST /api/ingest @/tmp/ing.json` → expect the backend's 404 (niche not found) or 201 with zero counts, proving the body round-trips. (Uses the untracked plugin-dev config; zero items = no scrape, no cost.)

### Step 2.2 — scrape-now skill

- [ ] **Write** `skills/scrape-now/SKILL.md` with detect-first structure mirroring `skills/onboarding/SKILL.md`:
  - **Step 0 — self-check:** config present (route to onboarding if not).
  - **Step 1 — confirm target:** niche_id (use the API-returned niche_id, tenant-prefixed) + platform + a results limit; quote the per-run cost honestly (TikTok `clockworks/tiktok-scraper` ≈ $1.70/1k; Instagram `apify/instagram-hashtag-scraper` ≈ $0.0004/item) and require explicit confirmation before any run (HARD gate — a scrape spends money).
  - **Step 2 — run via the Cowork Apify MCP connector:** call the Apify MCP `call-actor` tool. TikTok: actor `clockworks/tiktok-scraper`, input `{"hashtags": [...bare tags...], "resultsPerPage": N, "shouldDownloadVideos": false}`. Instagram: actor `apify/instagram-hashtag-scraper`, input `{"hashtags": [...bare tags...], "resultsLimit": N}`. Then fetch the run's dataset items via the MCP `get-dataset-items` tool. **Pass items through UNCHANGED** — do not reshape; `_normalize` depends on the raw actor field names.
  - **Step 3 — persist:** write the raw items array into a body `{"niche_id", "platform", "items"}`, save to a temp file under the workspace `.trendfinder/`, and `tf.sh POST /api/ingest @<file>`. Report `{inserted, updated, rejected}` back to the user honestly (rejected = below virality threshold, not an error).
  - **Honesty rules** section: never claim trends appeared until ingest returns inserted>0; "rejected" is normal filtering; never use a backend token on this path (the connector is the credential).
- [ ] **Add** the `/api/ingest` row to `reference/api-contract.md` (body shape, 201/400/404, note "items must be raw actor dataset items; do not reshape").
- [ ] **Validate** the plugin: `plugin-dev:plugin-validator` agent or the marketplace's validator; expect PASS.
- [ ] **Commit:** `feat(trendfinder): scrape-now skill via Cowork Apify MCP connector + /api/ingest`

---

## Task 3 (D3): Plugin trend-radar skill

**Repo:** `~/cowork-marketplace` · **Files:** Create `plugins/trendfinder/skills/trend-radar/SKILL.md`

- [ ] **Confirm the read endpoints** the skill will use by reading `reference/api-contract.md` and (if missing) the backend routes `src/api/routes/{trends,virality,clusters}.py` — record exact paths + tenant-scoping. (Directed: the skill must only call tenant-scoped reads.)
- [ ] **Write** `skills/trend-radar/SKILL.md`:
  - Step 0 self-check (→ onboarding if no config).
  - Step 1: fetch trends/velocity via `tf.sh` for the active niche (tenant-scoped).
  - Step 2: native synthesis in Claude — rank by velocity/engagement, name the rising patterns; this is analysis, NOT a server call.
  - Step 3: honest cold-start — if zero trends, say so and route to `scrape-now` (action-first), never render an empty scaffold.
  - Honesty + tenant-isolation rules: never show another tenant's data; never fetch brands/personas (platform-limit 6).
- [ ] **Validate** plugin → PASS.
- [ ] **Commit:** `feat(trendfinder): trend-radar read skill (velocity, native synthesis)`

---

## Task 4 (D4): Plugin trend-briefing skill (Live Artifact)

**Repo:** `~/cowork-marketplace` · **Files:** Create `plugins/trendfinder/skills/trend-briefing/SKILL.md` + `plugins/trendfinder/skills/trend-briefing/scripts/briefing.ts`

- [ ] **Mirror** the proven `skills/cockpit/scripts/cockpit.ts` pattern: bun, zero-dep, fetch-at-generation-time, INLINE data into a self-contained HTML at `<workspace>/.trendfinder/briefing.html`, print the abs path as the last stdout line, German UI, `Stand:`-timestamp (Europe/Berlin), `esc()` on EVERY interpolation, never-crash (friendly stderr + exit 1).
- [ ] **briefing.ts**: fetch the active niche's top trends (tenant-scoped, via the resolved config base_url + key), build a briefing artifact (rising trends, hooks, example videos). Data inlined — no runtime fetch (file:// CORS). Cold-start state when empty.
- [ ] **SKILL.md**: Step 0 self-check; Step 1 generate; Step 2 present as a Cowork **Live Artifact** (read the generated path); honesty rules — the briefing *narrative* is synthesized natively by Claude, the artifact only renders the data.
- [ ] **Mock-render verify** (Advisor-gap learning): run `briefing.ts` against a synthetic populated source (a local `Bun.serve` mock or a fixture base_url) and render the HTML in chrome-devtools — confirm trends show, XSS-as-text, console clean. Screenshot under `.trendfinder/`.
- [ ] **Commit:** `feat(trendfinder): trend-briefing Live Artifact skill`

---

## Task 5 (D5): Plugin schedule-surface skill (over existing schedules CRUD)

**Repo:** `~/cowork-marketplace` · **Files:** Create `plugins/trendfinder/skills/scheduler/SKILL.md`

Backend support already exists — `src/api/routes/schedules.py`: `POST /api/schedules {type:"scrape", niche_id, interval_hours(1-168), enabled}`, `GET /api/schedules`, `PATCH /api/schedules/{id} {interval_hours?, enabled?}`, `DELETE /api/schedules/{id}` — all tenant-scoped. This task is plugin-side only.

- [ ] **Write** `skills/scheduler/SKILL.md`:
  - Step 0 self-check.
  - Step 1: detect-first — list current schedules (`tf.sh GET /api/schedules`), show them.
  - Step 2: natural-language interval → `interval_hours` (e.g. "stündlich"→1, "alle 6h"→6, "täglich"→24; clamp 1–168). Create/patch/delete via `tf.sh`.
  - Step 3: read-back — confirm the set frequency to the user in plain words ("läuft jetzt alle 6 Stunden").
  - Note honestly: scheduled (unattended) scrapes run on the backend scheduler and require the backend Apify credential; on-demand uses the MCP connector. Tenant-isolation rules.
- [ ] **Live verify** the CRUD round-trip against the dev backend with the plugin-dev tenant (create→list→patch→delete a schedule; no actual scrape triggered). Add `/api/schedules` rows to `reference/api-contract.md` if absent.
- [ ] **Commit:** `feat(trendfinder): scheduler skill over tenant schedules CRUD (hourly/daily)`

---

## Task 6 (D6): Onboarding update + actor cost calibration

**Repo:** `~/cowork-marketplace` · **Files:** Modify `plugins/trendfinder/skills/onboarding/SKILL.md`, `plugins/trendfinder/reference/api-contract.md`, `plugins/trendfinder/.claude-plugin/plugin.json`

- [ ] **Onboarding rewrite (on-demand path):** replace the Apify token-paste step with: "Connect the Apify MCP connector in Cowork (OAuth at `https://mcp.apify.com`) — this gives Claude access to run scrapes on demand, no token to paste." Keep the Apify HARD GATE concept (no scheduled scrape configured until Apify access is confirmed), but reframe it around the connector. **Keep** the backend-token path documented ONLY for the unattended 24/7 scheduler, clearly labeled as the separate server credential.
- [ ] **Credential-model honesty block** in `api-contract.md`: a short table — On-demand = Cowork Apify MCP connector (OAuth, per-user, no backend token); 24/7 unattended = backend scheduler + server Apify credential. State this is intentional, not a gap.
- [ ] **Actor cost calibration:** document in `api-contract.md` the current actors + costs (TikTok `clockworks/tiktok-scraper` ≈ $1.70/1k; Instagram `apify/instagram-hashtag-scraper` ≈ $0.0004/item) and **flag** the cheaper TikTok alternative `apidojo/tiktok-scraper` (≈ $0.30/1k) as an evaluated future swap — note it requires rewriting `normalize_tiktok_item` for apidojo's field shape, so it is deliberately NOT done in this round (out of scope, its own task).
- [ ] **plugin.json:** consider declaring the Apify remote MCP server so installing Trendfinder surfaces the connector. Verify the plugin manifest supports a remote/http MCP server entry (check an installed example or claude-code-guide); if supported, add it; if not, document the manual connect step in onboarding instead. Do not guess the schema — verify first.
- [ ] **Regression check:** existing cockpit + onboarding behavior still valid; re-run any plugin tests; `plugin-validator` → PASS.
- [ ] **Commit:** `feat(trendfinder): onboarding via Apify MCP connector + actor cost calibration`

---

## Final integration review (after all 6 tasks)

Dispatch a final whole-branch reviewer per repo. **Explicit cross-task SEAM mandate** (Phase-1 learning: per-task reviews structurally miss seam bugs):
- SEAM 1: on-demand actor field shape (Task 2 MCP `call-actor`) ↔ `_normalize` field names (Task 1) — do they match for BOTH platforms?
- SEAM 2: ingest body `{niche_id, platform, items}` (Task 1) ↔ what scrape-now POSTs (Task 2).
- SEAM 3: trend-radar/trend-briefing read paths (Tasks 3/4) ↔ actual tenant-scoped backend routes.
- SEAM 4: schedule-surface interval semantics (Task 5) ↔ `interval_hours` bounds (1–168).
- SEAM 5: tenant isolation across ALL new endpoints/skills; brands/personas still un-fetched.

Then surface to Tom: (a) deploy decision for the backend ingest endpoint (Railway from `main` — outward-facing, needs his go), (b) merge `feat/phase3-apify-mcp` → plugin `main` + `/plugin marketplace update command-center`, (c) the real Cowork-client round-trip (interactive with Tom).
