# Plugin↔Frontend Parity — Avatar→Script Flow (SP1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Trendfinder Cowork plugin a guided, interactive Avatar→Script tool with full frontend parity, persisting scripts as the same tenant-scoped `content_pieces` the frontend uses.

**Architecture:** Two repos. **Backend** (`~/upwork-showcase-clean`, FastAPI/SQLAlchemy): split the ops-only `content_pieces` router into a tenant-scoped CRUD router (list/create/patch/delete, scoped via `persona → tenant_id`) plus an ops-only LLM router (generate/generate-script/regenerate/translate — unchanged, no tenant may spend backend LLM budget). **Plugin** (`~/cowork-marketplace/plugins/trendfinder`, Markdown skills + one dependency-free TS generator): add a guided `journey` coach, a native `content-plan` step, script persistence in `script-studio`, a `review` step, and a Cockpit "Content" tab. All AI synthesis stays native in Claude; the backend only stores + scrapes.

**Tech Stack:** Python 3.11 · FastAPI · SQLAlchemy (sync) · pytest · ruff (backend). Markdown skills · Bun/Node TS (cockpit generator) · `scripts/tf.sh` (curl+jq) for all API calls (plugin).

## Global Constraints

- **Native synthesis, backend persists only.** Ideas and scripts are written by Claude in the Cowork session; the backend stores them. The plugin MUST NOT call the backend LLM routes (`.../content-pieces/generate`, `.../generate-script`, `.../regenerate-section`, `.../translate`) — those stay ops-only.
- **Shared data model, existing stage vocabulary only.** Use `content_pieces` with stages from `VALID_STAGES = {"idea","script","review","rendering","done"}`. SP1 runs `idea → script → review → done`; `rendering` (video) is out of scope. No new stage strings.
- **Tenant scoping enforced in code**, via the persona-ownership filter (`persona.tenant_id`), NOT the peer-IP trust model. Dual-mode: `tenant_id is None` (ops/internal) sees all; a tenant sees only its own; foreign access returns an identical `404` (no leak). Coordinate with the S1 auth decision.
- **Plugin API calls go through `bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh METHOD /path ['json'|@file]`** — never raw curl, never an inline key, never print the key. Bodies with secrets/large JSON go via `mktemp` file + `@path`, cleaned up after.
- **Every plugin skill answer ends with the interactive Next-Steps select-block** per `${CLAUDE_PLUGIN_ROOT}/reference/next-steps.md`, marking exactly one ⭐ recommendation. Numbered options are clickable in Cowork; `✏️` = free-text (only for genuinely creative input — avatar DNA, own idea).
- **Honesty:** never invent trends/pieces/DNA; empty `GET /api/trends/{niche}` → route to `scrape-now`, never fabricate. Read-back after writes.
- **Tooling:** bun/bunx never npm/npx; no hardcoded home paths (`${CLAUDE_PLUGIN_ROOT}`, `{workspace}`). German user-facing copy (peer-level).

---

## File Structure

**Backend (`~/upwork-showcase-clean`):**
- Modify `src/api/routes/content_pieces.py` — split into tenant `router` (CRUD, scoped) + `ops_router` (LLM, unchanged). One responsibility per router.
- Modify `src/api/main.py` — register `content_pieces.router` in the tenant block; swap the ops-block entry to `content_pieces.ops_router`.
- Create `tests/test_content_pieces_tenant_scoping.py` — tenant isolation for the CRUD routes + ops-gate for the LLM routes.

**Plugin (`~/cowork-marketplace/plugins/trendfinder`):**
- Modify `reference/api-contract.md` — document the now-tenant-scoped content_pieces CRUD endpoints; mark the LLM routes ops-only/not-used-by-plugin.
- Modify `reference/next-steps.md` — add "Content-Plan" and "Freigeben/Review" options.
- Create `skills/content-plan/SKILL.md` — native idea proposals from DNA+trends → `idea` pieces.
- Modify `skills/script-studio/SKILL.md` — persist native script (PATCH `script_data` + `stage=script`).
- Create `skills/review/SKILL.md` — list `script` pieces → approve (→`done`) / reject via block.
- Create `skills/journey/SKILL.md` — guided state-detection coach that chains the steps.
- Modify `skills/cockpit/scripts/cockpit.ts` — add a "Content" tab (pieces grouped by stage).

Each task ends with an independently testable deliverable and a commit.

---

## Task B1: Backend — tenant-scope the content_pieces CRUD routes

**Files:**
- Modify: `/Users/tomadomeit/upwork-showcase-clean/src/api/routes/content_pieces.py`
- Modify: `/Users/tomadomeit/upwork-showcase-clean/src/api/main.py:443` (ops block) and `:415-423` (tenant block)
- Test: `/Users/tomadomeit/upwork-showcase-clean/tests/test_content_pieces_tenant_scoping.py`

**Interfaces:**
- Consumes: `get_tenant_id` from `src.api.deps` (returns `str | None`, tenant context from auth middleware); `Persona.tenant_id`, `ContentPiece.persona_id`, `ContentPiece.persona` (relationship) from `src.db.models`; `create_tenant(session, tenant_id, display_name) -> (Tenant, key)` from `src.db.tenants`.
- Produces (relied on by the plugin tasks — these routes become tenant-callable with a tenant `X-API-Key`):
  - `GET /api/personas/{persona_id}/content-pieces?stage=&page=&limit=` → `200 list[ContentPieceResponse]`; foreign/unknown persona → `404`.
  - `POST /api/personas/{persona_id}/content-pieces` body `{title, pillar?, format?, stage?, hook_type?, trend_cluster_id?}` → `201 ContentPieceResponse`; foreign persona → `404`.
  - `PATCH /api/content-pieces/{piece_id}` body `{title?, pillar?, format?, stage?, hook_type?, trend_cluster_id?, script_data?, video_url?}` → `200 ContentPieceResponse`; foreign/unknown piece → `404`.
  - `DELETE /api/content-pieces/{piece_id}` → `204`; foreign/unknown piece → `404`.
  - The four LLM routes (`.../generate`, `/api/content-pieces/{id}/generate-script`, `/regenerate-section`, `/translate`) remain **ops-only** → a tenant key gets `403`.

- [ ] **Step 1: Write the failing tenant-scoping test file**

Create `/Users/tomadomeit/upwork-showcase-clean/tests/test_content_pieces_tenant_scoping.py`:

```python
"""Server-side tenant isolation for the content_pieces CRUD routes (SP1).

A tenant may only list/create/patch/delete pieces under a persona it owns.
Mirrors the personas/trends guard: own → 200/201, cross-tenant → identical 404,
ops/global → sees all. The four LLM routes stay ops-only (tenant → 403).
"""
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from src.db.models import Brand, Persona, ContentPiece
from src.db.tenants import create_tenant


def _app(db_engine, mock_qdrant):
    factory = sessionmaker(bind=db_engine)
    with patch("src.api.main.install_log_handler"):
        from src.api.main import create_app
        app = create_app(session_factory=factory, qdrant=mock_qdrant)
    app.state.api_key = "global-ops-key"
    return app


def _tenant_client(db_engine, db_session, mock_qdrant, tenant):
    _, key = create_tenant(db_session, tenant, tenant.title())
    client = TestClient(_app(db_engine, mock_qdrant))
    client.headers["X-API-Key"] = key
    return client


def _ops_client(db_engine, mock_qdrant):
    client = TestClient(_app(db_engine, mock_qdrant))
    client.headers["X-API-Key"] = "global-ops-key"
    return client


def _seed_piece(db_session, tenant: str, persona_slug: str) -> tuple[str, int]:
    """Seed a brand+persona+one idea-piece owned by `tenant`; return (persona_id, piece_id)."""
    brand = Brand(brand_id=f"{tenant}-brand", tenant_id=tenant, display_name=f"{tenant} Brand")
    db_session.add(brand)
    db_session.flush()
    persona = Persona(persona_id=persona_slug, brand_id=brand.id, tenant_id=tenant, display_name="P")
    db_session.add(persona)
    db_session.flush()
    piece = ContentPiece(persona_id=persona.id, title="Seed idea", stage="idea")
    db_session.add(piece)
    db_session.commit()
    return persona.persona_id, piece.id


def test_tenant_lists_own_pieces(db_engine, db_session, mock_qdrant):
    persona_id, _ = _seed_piece(db_session, "acme", "acme-anna")
    client = _tenant_client(db_engine, db_session, mock_qdrant, tenant="acme")
    r = client.get(f"/api/personas/{persona_id}/content-pieces")
    assert r.status_code == 200
    assert len(r.json()) == 1


def test_tenant_cannot_list_other_pieces(db_engine, db_session, mock_qdrant):
    persona_id, _ = _seed_piece(db_session, "acme", "acme-anna")
    client = _tenant_client(db_engine, db_session, mock_qdrant, tenant="globex")
    assert client.get(f"/api/personas/{persona_id}/content-pieces").status_code == 404


def test_ops_lists_any_pieces(db_engine, db_session, mock_qdrant):
    persona_id, _ = _seed_piece(db_session, "acme", "acme-anna")
    client = _ops_client(db_engine, mock_qdrant)
    r = client.get(f"/api/personas/{persona_id}/content-pieces")
    assert r.status_code == 200
    assert len(r.json()) == 1


def test_tenant_creates_under_own_persona(db_engine, db_session, mock_qdrant):
    persona_id, _ = _seed_piece(db_session, "acme", "acme-anna")
    client = _tenant_client(db_engine, db_session, mock_qdrant, tenant="acme")
    r = client.post(f"/api/personas/{persona_id}/content-pieces",
                    json={"title": "Neue Idee", "stage": "idea"})
    assert r.status_code == 201
    assert r.json()["title"] == "Neue Idee"


def test_tenant_cannot_create_under_other_persona(db_engine, db_session, mock_qdrant):
    persona_id, _ = _seed_piece(db_session, "acme", "acme-anna")
    client = _tenant_client(db_engine, db_session, mock_qdrant, tenant="globex")
    r = client.post(f"/api/personas/{persona_id}/content-pieces",
                    json={"title": "Fremd", "stage": "idea"})
    assert r.status_code == 404


def test_tenant_patches_own_script_data(db_engine, db_session, mock_qdrant):
    _, piece_id = _seed_piece(db_session, "acme", "acme-anna")
    client = _tenant_client(db_engine, db_session, mock_qdrant, tenant="acme")
    r = client.patch(f"/api/content-pieces/{piece_id}",
                     json={"script_data": {"hook": "H", "body": "B", "cta": "C"}, "stage": "script"})
    assert r.status_code == 200
    body = r.json()
    assert body["stage"] == "script"
    assert body["script_data"]["hook"] == "H"


def test_tenant_cannot_patch_other_piece(db_engine, db_session, mock_qdrant):
    _, piece_id = _seed_piece(db_session, "acme", "acme-anna")
    client = _tenant_client(db_engine, db_session, mock_qdrant, tenant="globex")
    r = client.patch(f"/api/content-pieces/{piece_id}", json={"stage": "script"})
    assert r.status_code == 404


def test_tenant_cannot_delete_other_piece(db_engine, db_session, mock_qdrant):
    _, piece_id = _seed_piece(db_session, "acme", "acme-anna")
    client = _tenant_client(db_engine, db_session, mock_qdrant, tenant="globex")
    assert client.delete(f"/api/content-pieces/{piece_id}").status_code == 404


def test_tenant_deletes_own_piece(db_engine, db_session, mock_qdrant):
    _, piece_id = _seed_piece(db_session, "acme", "acme-anna")
    client = _tenant_client(db_engine, db_session, mock_qdrant, tenant="acme")
    assert client.delete(f"/api/content-pieces/{piece_id}").status_code == 204


def test_llm_generate_script_is_ops_only(db_engine, db_session, mock_qdrant):
    # The native-synthesis boundary: a tenant key must NOT reach a backend-LLM route.
    _, piece_id = _seed_piece(db_session, "acme", "acme-anna")
    client = _tenant_client(db_engine, db_session, mock_qdrant, tenant="acme")
    assert client.post(f"/api/content-pieces/{piece_id}/generate-script").status_code == 403
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `cd /Users/tomadomeit/upwork-showcase-clean && .venv/bin/python -m pytest tests/test_content_pieces_tenant_scoping.py -v`
Expected: FAILs — e.g. `test_tenant_cannot_list_other_pieces` gets `403` (route still ops-only, tenant rejected wholesale) instead of `404`; `test_tenant_lists_own_pieces` gets `403` instead of `200`. (The routes aren't tenant-reachable yet.)

- [ ] **Step 3: Add `get_tenant_id` import + the ops router + scoping helpers in `content_pieces.py`**

In `/Users/tomadomeit/upwork-showcase-clean/src/api/routes/content_pieces.py`, change the deps import (line 6):

```python
from src.api.deps import get_db, get_tenant_id
```

Add `ops_router` right after the existing `router` definition (after line 15 `router = APIRouter(tags=["content-pieces"])`):

```python
ops_router = APIRouter(tags=["content-pieces-ops"])
```

Replace the existing `_get_persona_or_404` helper (lines 29–33) with a tenant-aware version plus a new piece helper:

```python
def _get_persona_or_404(persona_id: str, db: Session, tenant_id: str | None) -> Persona:
    persona = db.query(Persona).filter(Persona.persona_id == persona_id).first()
    if not persona or (tenant_id is not None and persona.tenant_id != tenant_id):
        raise HTTPException(status_code=404, detail="Persona not found")
    return persona


def _get_piece_or_404(piece_id: int, db: Session, tenant_id: str | None) -> ContentPiece:
    piece = db.query(ContentPiece).filter(ContentPiece.id == piece_id).first()
    if not piece:
        raise HTTPException(status_code=404, detail="Content piece not found")
    if tenant_id is not None:
        persona = db.query(Persona).filter(Persona.id == piece.persona_id).first()
        if not persona or persona.tenant_id != tenant_id:
            raise HTTPException(status_code=404, detail="Content piece not found")
    return piece
```

- [ ] **Step 4: Thread `tenant_id` into the four CRUD routes**

In the same file, update the CRUD route signatures + helper calls. `list_content_pieces` (was lines 40–53):

```python
@router.get(
    "/api/personas/{persona_id}/content-pieces",
    response_model=list[ContentPieceResponse],
)
def list_content_pieces(
    persona_id: str,
    stage: str | None = None,
    page: int = 1,
    limit: int = 50,
    db: Session = Depends(get_db),
    tenant_id: str | None = Depends(get_tenant_id),
):
    persona = _get_persona_or_404(persona_id, db, tenant_id)
    query = db.query(ContentPiece).filter(ContentPiece.persona_id == persona.id)
    if stage is not None:
        query = query.filter(ContentPiece.stage == stage)
    offset = (page - 1) * limit
    pieces = query.order_by(ContentPiece.created_at.desc()).offset(offset).limit(limit).all()
    return pieces
```

`create_content_piece` (was lines 61–84) — add `tenant_id` param, pass it to the helper:

```python
def create_content_piece(
    persona_id: str,
    body: ContentPieceCreate,
    db: Session = Depends(get_db),
    tenant_id: str | None = Depends(get_tenant_id),
):
    if body.stage not in VALID_STAGES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid stage '{body.stage}'. Must be one of: {sorted(VALID_STAGES)}",
        )
    persona = _get_persona_or_404(persona_id, db, tenant_id)
    piece = ContentPiece(
        persona_id=persona.id,
        title=body.title,
        pillar=body.pillar,
        format=body.format,
        stage=body.stage,
        hook_type=body.hook_type,
        trend_cluster_id=body.trend_cluster_id,
    )
    db.add(piece)
    db.commit()
    db.refresh(piece)
    return piece
```

`update_content_piece` (was lines 91–109) — use `_get_piece_or_404`:

```python
def update_content_piece(
    piece_id: int,
    body: ContentPieceUpdate,
    db: Session = Depends(get_db),
    tenant_id: str | None = Depends(get_tenant_id),
):
    if body.stage is not None and body.stage not in VALID_STAGES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid stage '{body.stage}'. Must be one of: {sorted(VALID_STAGES)}",
        )
    piece = _get_piece_or_404(piece_id, db, tenant_id)
    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(piece, field, value)
    db.commit()
    db.refresh(piece)
    return piece
```

`delete_content_piece` (was lines 116–124) — use `_get_piece_or_404`:

```python
def delete_content_piece(
    piece_id: int,
    db: Session = Depends(get_db),
    tenant_id: str | None = Depends(get_tenant_id),
):
    piece = _get_piece_or_404(piece_id, db, tenant_id)
    db.delete(piece)
    db.commit()
```

- [ ] **Step 5: Move the four LLM routes onto `ops_router`**

In the same file, change ONLY the decorator prefix `@router.` → `@ops_router.` on the four LLM routes (bodies unchanged), so they stay ops-gated after registration:
- `generate_content_pieces` — `@router.post("/api/personas/{persona_id}/content-pieces/generate", ...)` → `@ops_router.post(...)` (same path/args).
- `generate_script` — `@router.post("/api/content-pieces/{piece_id}/generate-script", ...)` → `@ops_router.post(...)`.
- `regenerate_section` — `@router.post("/api/content-pieces/{piece_id}/regenerate-section", ...)` → `@ops_router.post(...)`.
- `translate_content_piece` — `@router.post("/api/content-pieces/{piece_id}/translate", ...)` → `@ops_router.post(...)`.

Leave every function body, path, and parameter exactly as-is — only the decorator object changes from `router` to `ops_router`.

- [ ] **Step 6: Register the routers in `main.py`**

In `/Users/tomadomeit/upwork-showcase-clean/src/api/main.py`, add the tenant CRUD router to the tenant-facing block (after `app.include_router(ingest.router)` at line 423):

```python
    app.include_router(content_pieces.router)
```

Then in the ops-only loop (lines 431–452), replace the line `content_pieces.router,` with:

```python
        content_pieces.ops_router,
```

(Net effect: CRUD is tenant-scoped in the tenant block; the four LLM routes stay behind `require_ops`.)

- [ ] **Step 7: Run the new tests to verify they pass**

Run: `cd /Users/tomadomeit/upwork-showcase-clean && .venv/bin/python -m pytest tests/test_content_pieces_tenant_scoping.py -v`
Expected: PASS (10/10).

- [ ] **Step 8: Run the existing content-piece suites to confirm no regression**

Run: `cd /Users/tomadomeit/upwork-showcase-clean && .venv/bin/python -m pytest tests/test_content_pieces_routes.py tests/test_content_piece_script.py tests/test_content_piece_delete.py tests/test_launch_hardening.py -q`
Expected: PASS (all). These use `app_client` (`api_key=None` → `tenant_id=None` → ops dual-mode sees all), so scoping does not change their behaviour, and the LLM routes still resolve under `require_ops`.

- [ ] **Step 9: Lint**

Run: `cd /Users/tomadomeit/upwork-showcase-clean && .venv/bin/ruff check src/api/routes/content_pieces.py src/api/main.py tests/test_content_pieces_tenant_scoping.py`
Expected: `All checks passed!`

- [ ] **Step 10: Commit**

```bash
cd /Users/tomadomeit/upwork-showcase-clean
git add src/api/routes/content_pieces.py src/api/main.py tests/test_content_pieces_tenant_scoping.py
git commit -m "feat(content): tenant-scope content_pieces CRUD, keep LLM routes ops-only (SP1)"
```

---

## Task P1: Plugin — document the content_pieces endpoints in the API contract

**Files:**
- Modify: `/Users/tomadomeit/cowork-marketplace/plugins/trendfinder/reference/api-contract.md` (endpoints table + a short "Content pieces" note)

**Interfaces:**
- Consumes: the routes shipped in Task B1.
- Produces: the single source of truth the new/edited skills (P2–P6) rely on for content endpoints. No skill may use an endpoint not listed here.

- [ ] **Step 1: Add the content_pieces rows to the endpoints table**

In `reference/api-contract.md`, insert these rows into the main `| Method + Path | Body | Returns | Notes |` table, right after the `POST /api/ingest` row (line 59):

```markdown
| GET /api/personas/{persona_id}/content-pieces | query: `stage?`, `page?` (default 1), `limit?` (default 50) | `[{id, persona_id, title, pillar, format, stage, hook_type, trend_cluster_id, script_data, translations, video_url, created_at, updated_at}]` | ✅ Tenant-scoped (SP1). Foreign/unknown persona → 404. `stage` ∈ `idea\|script\|review\|rendering\|done`. Empty list = no pieces yet |
| POST /api/personas/{persona_id}/content-pieces | `{title, pillar?, format?, stage?(default "idea"), hook_type?, trend_cluster_id?}` | 201 the created piece | ✅ Tenant-scoped (SP1). Use for saving a **native idea**. `title` 1–500 chars; invalid `stage` → 422; foreign persona → 404. `script_data` is NOT accepted here — set it via PATCH after writing the script |
| PATCH /api/content-pieces/{piece_id} | `{title?, pillar?, format?, stage?, hook_type?, trend_cluster_id?, script_data?, video_url?}` | 200 the updated piece | ✅ Tenant-scoped (SP1). This is how the plugin **persists a native script**: `{"script_data": {...}, "stage": "script"}`, and how review advances stage: `{"stage": "done"}`. Foreign/unknown piece → 404; invalid `stage` → 422 |
| DELETE /api/content-pieces/{piece_id} | — | 204 | ✅ Tenant-scoped (SP1). Foreign/unknown piece → 404 |
```

- [ ] **Step 2: Add a "Content pieces" explainer section**

Append this section after the "Avatars — Brands, Personas & DNA" section (after line 111):

```markdown
## Content pieces — the shared content board (tenant-scoped, SP1)

A **content piece** is one idea/script row shared with the frontend content board. It belongs to a persona (`persona_id` FK) and moves through **stages**: `idea → script → review → done` (`rendering` = video, out of SP1 scope). The plugin uses only the four CRUD routes above; **all writing is native in Claude**.

Lifecycle the plugin drives:
1. **Idea** — `POST /api/personas/{persona_id}/content-pieces` with `{title, pillar?, format?, hook_type?, trend_cluster_id?, stage:"idea"}` (content-plan step). Claude proposes the ideas; the backend just stores them.
2. **Script** — after writing hooks + script natively (script-studio), `PATCH /api/content-pieces/{id}` with `{script_data:{hook, body, cta, hooks?, caption?, hashtags?, ...}, stage:"script"}`. Read the piece back to confirm `script_data` landed.
3. **Freigabe/Review** — `PATCH /api/content-pieces/{id}` with `{stage:"done"}` on approval; reject stays at `script` (optionally `DELETE` to discard).

**`script_data` is a free-form JSON object** — the plugin owns its shape. A reasonable, frontend-compatible shape: `{"hook": "...", "hooks": ["..."], "body": "...", "cta": "...", "caption": "...", "hashtags": ["..."], "ziel": "reichweite|engagement|verkauf|follower|vertrauen", "visual_notes": "...", "audio": "..."}`. Keep it consistent across pieces.

**Ops-only routes the plugin must NOT call** (they spend backend LLM budget; a tenant key gets `403`): `POST /api/personas/{id}/content-pieces/generate`, `POST /api/content-pieces/{id}/generate-script`, `POST /api/content-pieces/{id}/regenerate-section`, `POST /api/content-pieces/{id}/translate`. Synthesis is native in Claude.
```

- [ ] **Step 3: Verify the file is valid Markdown and self-consistent**

Run: `cd /Users/tomadomeit/cowork-marketplace && rg -n "content-pieces" plugins/trendfinder/reference/api-contract.md`
Expected: shows the four new table rows + the section references; no stray/duplicate endpoint rows.

- [ ] **Step 4: Commit**

```bash
cd /Users/tomadomeit/cowork-marketplace
git add plugins/trendfinder/reference/api-contract.md
git commit -m "docs(plugin): document tenant-scoped content_pieces CRUD in API contract (SP1)"
```

---

## Task P2: Plugin — new `content-plan` skill (native ideas → idea pieces)

**Files:**
- Create: `/Users/tomadomeit/cowork-marketplace/plugins/trendfinder/skills/content-plan/SKILL.md`

**Interfaces:**
- Consumes: `GET /api/brands`, `GET /api/brands/{brand_id}/personas`, `GET /api/personas/{persona_id}` (DNA), `GET /api/niches/config`, `GET /api/trends/{niche_id}` (from api-contract.md); `POST /api/personas/{persona_id}/content-pieces` (Task P1/B1).
- Produces: one or more `stage:"idea"` content pieces, each carrying `{title, pillar?, format?, hook_type?, trend_cluster_id?}`, that `script-studio` (P3) and the Cockpit Content tab (P6) read back.

- [ ] **Step 1: Create the skill file**

Create `/Users/tomadomeit/cowork-marketplace/plugins/trendfinder/skills/content-plan/SKILL.md`:

````markdown
---
name: content-plan
description: Propose a batch of concrete content ideas for a Trendfinder avatar — natively in Claude, from the avatar's DNA + current trends — and save the chosen ones as idea-pieces on the shared content board. Use when the user says "Content-Plan", "Ideen für <Avatar>", "was könnte <Avatar> posten", "Themenplan", "plan meinen content", "gib mir Post-Ideen", "content ideas", "Wochenplan". Proposes ideas as clickable options; saves selected ideas as content pieces (stage=idea). Never scrapes, never spends Apify or backend-LLM budget.
---

# Trendfinder — Content-Plan

Goal: turn an avatar's DNA + the niche's current trends into a short list of **concrete post ideas**, let the user pick which to keep with a select-block, and persist each kept idea as a `content_piece` (stage `idea`) on the shared board — the same rows the frontend and Cockpit show. All ideation is **native in Claude**; the backend only stores. Read `${CLAUDE_PLUGIN_ROOT}/reference/api-contract.md` (§ "Content pieces") first. All API calls go through `bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh`.

## Step 0 — Self-check (config required)

1. Check `{workspace}/.trendfinder/config.json` exists.
2. If it does, `bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /health`.

If either fails → "Trendfinder ist noch nicht eingerichtet. Starte bitte zuerst das Onboarding." → route to `onboarding`. Else continue.

## Step 1 — Pick the avatar + load its DNA

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/brands
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/brands/<brand_id>/personas
```

Present avatars as a numbered list (Cowork renders it clickable):

```
Für welchen Avatar soll ich Ideen planen?

1) Lena   (Marke: Lena Beauty)
2) Mia    (Marke: Lena Beauty)
✏️  Anderer / neuen Avatar anlegen (→ onboarding)
```

If the tenant has **no** avatars → say so and route to `onboarding`. Then load full DNA:

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/personas/<persona_id>
```

Hold `content_pillars`, `interests`, `tone_of_voice`, `persona_profile`, `system_prompt`.

## Step 2 — Pull current trends (no persona_id)

Resolve the niche only from `GET /api/niches/config` (never a guessed slug). One niche → use it; several → ask which (numbered).

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/niches/config
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/trends/<niche_id>
```

- Trends present → continue to Step 3.
- Empty / 404 → no trends yet: say so honestly and offer `scrape-now`. You MAY still propose DNA-only ideas (no `trend_cluster_id`), but never invent trends.

Keep per cluster: `cluster_id`, `trend_label`, `hook_type`, `description`, `dominant_hashtags`, `lifecycle`.

## Step 3 — Propose ideas natively (from DNA × trends)

This is Claude's judgment — say so. Propose **5–7 concrete ideas**, each anchored in a real DNA field and (where possible) a real trend. For each idea decide: `title` (the post topic, ≤500 chars), `pillar` (an actual `content_pillars[].name`), `format` (e.g. `Reel`, `Story`, `Carousel`), `hook_type` (from the trend or DNA), and `trend_cluster_id` (the real `cluster_id` if the idea rests on a trend, else omit).

Show them as a numbered multi-select block with a one-line reason each, grounded in a named DNA field/trend:

```
Ideen für Lena (K-Beauty) — meine Einschätzung aus DNA + aktuellen Trends, kein Backend-Score. Wähle die, die ich als Ideen speichern soll (mehrere möglich):

1) „Abendroutine mit 3 Produkten" — Pillar „K-Beauty Abendroutine", Trend Evening Routines (steigt), Hook How-To
2) „Inhaltsstoff-Mythos: Niacinamid" — Pillar „Inhaltsstoffe erklärt", Trend Ingredient Deep-Dives, Hook Mythos-Bust
3) „Glow-up in 7 Tagen" — Pillar „Glow-up", Trend Before-After (Peak), Hook Transformation
...
✏️  Eigene Idee ergänzen
```

Ground every reason in an actual DNA field or trend — never fabricate a pillar to justify an idea; "kein starkes DNA-Signal" is a valid reason to drop one.

## Step 4 — Persist the chosen ideas as content pieces

For EACH selected idea, POST it (write the body to a temp file to avoid quoting issues):

```
IDEA_BODY=$(mktemp)   # real temp dir, NOT the synced workspace
echo '{"title":"<title>","pillar":"<pillar>","format":"<format>","hook_type":"<hook_type>","trend_cluster_id":<id or omit>,"stage":"idea"}' > "$IDEA_BODY"
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh POST /api/personas/<persona_id>/content-pieces @"$IDEA_BODY"; rm -f "$IDEA_BODY" 2>/dev/null || : > "$IDEA_BODY"
```

Interpret: **201** created (keep the returned `id`) · **404** persona not this tenant's (re-resolve the avatar) · **422** bad field (fix `title`/`stage`). Omit `trend_cluster_id` entirely for DNA-only ideas — do not send `null` guesses of other fields.

**Read-back (honesty rule):** after saving, `GET /api/personas/<persona_id>/content-pieces?stage=idea` and confirm the new titles are there. Report exactly how many ideas were saved — never claim more than the API confirmed.

## Step 5 — Deliver + hand off

Summarise: which avatar, how many ideas saved (real count), which niche/trends they rest on. Offer to write a script for one now (→ `script-studio`).

## Honesty & safety rules

- Ideas are **Claude's native judgment from DNA + real trends** — say so; never present them as a backend plan. The ops route `content-pieces/generate` is NOT used (native only).
- Never invent trends; empty trends → route to `scrape-now`. Only real `cluster_id` values go into `trend_cluster_id`.
- Never claim an idea was saved unless the POST returned 201 and the read-back shows it.
- Use `tf.sh`; never print the API key; clean up `mktemp` files.

## Done means

- Config present, `/health` 200.
- Avatar chosen, full DNA loaded; niche resolved from `GET /api/niches/config`.
- Trends fetched (no `persona_id`); empty → honest cold-start + scrape-now offer.
- 5–7 ideas proposed natively with DNA/trend-grounded reasons, shown as a multi-select block.
- Selected ideas persisted as `stage:"idea"` pieces; read-back confirms them; real count reported.
- No `content-pieces/generate` call, no Apify call, no key printed.

## Abschluss (PFLICHT) — Next-Steps-Auswahlblock

Beende deine Antwort IMMER mit dem interaktiven **Auswahlblock** aus `${CLAUDE_PLUGIN_ROOT}/reference/next-steps.md`. Nach dem Speichern von Ideen ist die ⭐-Empfehlung in der Regel „✍️ Skript schreiben" (→ script-studio) für eine der neuen Ideen.
````

- [ ] **Step 2: Verify the skill file is well-formed**

Run: `cd /Users/tomadomeit/cowork-marketplace && rg -n "^name:|^description:" plugins/trendfinder/skills/content-plan/SKILL.md`
Expected: exactly one `name: content-plan` and one `description:` line in the frontmatter.

- [ ] **Step 3: Commit**

```bash
cd /Users/tomadomeit/cowork-marketplace
git add plugins/trendfinder/skills/content-plan/SKILL.md
git commit -m "feat(plugin): content-plan skill — native ideas → idea pieces (SP1)"
```

---

## Task P3: Plugin — persist native scripts in `script-studio`

**Files:**
- Modify: `/Users/tomadomeit/cowork-marketplace/plugins/trendfinder/skills/script-studio/SKILL.md` (add a persistence step + update "Done means" + description)

**Interfaces:**
- Consumes: `GET /api/personas/{persona_id}/content-pieces?stage=idea` (find an existing idea), `POST /api/personas/{persona_id}/content-pieces` (create if writing ad-hoc), `PATCH /api/content-pieces/{piece_id}` (Task P1/B1).
- Produces: a piece advanced to `stage:"script"` with `script_data` set — read by `review` (P4) and the Cockpit Content tab (P6).

- [ ] **Step 1: Insert a persistence step between "Write" (Step 4) and "Deliver" (Step 5)**

In `skills/script-studio/SKILL.md`, insert this new section immediately before the `## Step 5 — Deliver` heading:

````markdown
## Step 4.5 — Persist the script on the content board

The script you just wrote is native text — now store it as a `content_piece` so it shows on the shared board (frontend + Cockpit). **This is a PATCH of `script_data` + a stage bump — never the backend `generate-script` route.**

First, is there already an `idea` piece for this? Look:

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET "/api/personas/<persona_id>/content-pieces?stage=idea"
```

- **A matching idea exists** (same trend/topic — match on `title` or `trend_cluster_id`) → use its `id`.
- **No matching idea** (ad-hoc script) → create one first:
  ```
  IDEA_BODY=$(mktemp)
  echo '{"title":"<trend/topic title>","pillar":"<pillar>","format":"<format>","hook_type":"<hook_type>","trend_cluster_id":<id or omit>,"stage":"idea"}' > "$IDEA_BODY"
  bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh POST /api/personas/<persona_id>/content-pieces @"$IDEA_BODY"; rm -f "$IDEA_BODY" 2>/dev/null || : > "$IDEA_BODY"
  ```
  Keep the returned `id`.

Then persist the script and advance the stage (write the body to a temp file — it contains the full script JSON):

```
SCRIPT_BODY=$(mktemp)
# script_data shape (plugin-owned, see api-contract § Content pieces):
echo '{"script_data":{"hook":"<chosen hook>","hooks":["..."],"body":"<beats>","cta":"<cta>","caption":"<caption>","hashtags":["..."],"ziel":"<reichweite|engagement|verkauf|follower|vertrauen>","visual_notes":"<shooting notes>","audio":"<audio type>"},"stage":"script"}' > "$SCRIPT_BODY"
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh PATCH /api/content-pieces/<piece_id> @"$SCRIPT_BODY"; rm -f "$SCRIPT_BODY" 2>/dev/null || : > "$SCRIPT_BODY"
```

Interpret: **200** saved · **404** foreign/unknown piece (re-resolve) · **422** invalid stage.

**Read-back (honesty rule):** the PATCH returns the updated piece — confirm `stage == "script"` and `script_data.hook` is present before telling the user it's saved. If the save failed, deliver the script in chat anyway and say persistence didn't succeed — never claim it's on the board if the API didn't confirm.
````

- [ ] **Step 2: Update the skill description to mention persistence**

In the frontmatter `description:` of `skills/script-studio/SKILL.md`, append this sentence before the closing quote/period: ` Saves the finished script to the shared content board (content piece, stage=script) so it appears in the Cockpit and Review.`

- [ ] **Step 3: Update "Done means"**

In the `## Done means` list, add these two bullets after the "Hooks + a full short-video script + caption" bullet:

```markdown
- Script persisted as a content piece via `PATCH /api/content-pieces/{id}` (`script_data` set, `stage:"script"`); read-back confirmed. Backend `generate-script` route NOT used.
- If persistence failed, the script was still delivered in chat and the failure was stated honestly.
```

- [ ] **Step 4: Verify the edits landed**

Run: `cd /Users/tomadomeit/cowork-marketplace && rg -n "Step 4.5|content-pieces/<piece_id>|stage.:.script" plugins/trendfinder/skills/script-studio/SKILL.md`
Expected: shows the new Step 4.5 heading and the PATCH call with `stage:"script"`.

- [ ] **Step 5: Commit**

```bash
cd /Users/tomadomeit/cowork-marketplace
git add plugins/trendfinder/skills/script-studio/SKILL.md
git commit -m "feat(plugin): script-studio persists native script to content board (SP1)"
```

---

## Task P4: Plugin — new `review` skill (approve/reject scripts)

**Files:**
- Create: `/Users/tomadomeit/cowork-marketplace/plugins/trendfinder/skills/review/SKILL.md`

**Interfaces:**
- Consumes: `GET /api/brands`, `GET /api/brands/{brand_id}/personas`, `GET /api/personas/{persona_id}/content-pieces?stage=script`, `PATCH /api/content-pieces/{piece_id}`, `DELETE /api/content-pieces/{piece_id}` (Task P1/B1).
- Produces: pieces advanced to `stage:"done"` (approved) or left at `script` / deleted (rejected) — reflected in the Cockpit Content tab (P6).

- [ ] **Step 1: Create the skill file**

Create `/Users/tomadomeit/cowork-marketplace/plugins/trendfinder/skills/review/SKILL.md`:

````markdown
---
name: review
description: Review the scripts waiting for approval on a Trendfinder avatar's content board and approve or reject them with a click. Use when the user says "Review", "Freigabe", "Skripte freigeben", "was steht zur Freigabe", "welche Skripte sind fertig", "content freigeben", "approve scripts", "review meine Skripte". Lists pieces at stage=script and advances approved ones to done. Never scrapes, never spends budget.
---

# Trendfinder — Review / Freigabe

Goal: show the scripts that are written but not yet approved (stage `script`) for an avatar, and let the user **approve** (→ stage `done`) or **reject** (keep at `script`, or discard) each with a select-block. Pure state transitions on the shared board — no synthesis, no scraping. Read `${CLAUDE_PLUGIN_ROOT}/reference/api-contract.md` (§ "Content pieces") first. All API calls via `bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh`.

## Step 0 — Self-check (config required)

1. Check `{workspace}/.trendfinder/config.json` exists.
2. If it does, `bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /health`.

If either fails → route to `onboarding`. Else continue.

## Step 1 — Pick the avatar

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/brands
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/brands/<brand_id>/personas
```

Numbered list to choose (clickable). No avatars → route to `onboarding`.

## Step 2 — List scripts awaiting approval

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET "/api/personas/<persona_id>/content-pieces?stage=script"
```

- **Empty** → say honestly "Keine Skripte zur Freigabe für <Avatar>." and offer to write one (→ `script-studio`) or plan ideas (→ `content-plan`). Do NOT invent pieces.
- **Non-empty** → for each piece show a compact preview from its `script_data` (Hook + CTA + Ziel), keyed by `id` and `title`. Never fabricate content that isn't in `script_data`.

## Step 3 — Approve / reject per piece (select-block)

Present a select-block per piece (or a batch block if several):

```
„Abendroutine mit 3 Produkten" (Lena) — Hook: „Diese 3 Produkte …" · Ziel: 🚀 Reichweite

1) ✅ Freigeben  → Stage „done"
2) ↩︎ Zurück in Skript lassen (nochmal überarbeiten)
3) 🗑️ Verwerfen (löschen)
```

- **Freigeben** → advance stage:
  ```
  bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh PATCH /api/content-pieces/<piece_id> '{"stage":"done"}'
  ```
  **200** approved · **404** foreign/unknown piece (re-resolve).
- **Zurück lassen** → no API call; it stays at `script`. Optionally offer to hand off to `script-studio` to rewrite.
- **Verwerfen** → confirm first (destructive), then:
  ```
  bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh DELETE /api/content-pieces/<piece_id>
  ```
  **204** deleted · **404** foreign/unknown. Only delete after an explicit user confirm.

**Read-back (honesty rule):** after approvals, `GET /api/personas/<persona_id>/content-pieces?stage=done` (or re-list `stage=script`) and report the real counts — how many approved, how many still waiting. Never claim an approval the API didn't confirm.

## Step 4 — Summary

State the real outcome: N freigegeben, M noch offen, K verworfen. Offer the next natural step (write another script, or view the Cockpit Content tab).

## Honesty & safety rules

- Only ever show/act on pieces the API returned; never invent a piece or its content.
- Delete is destructive → always confirm before `DELETE`.
- Never advance a stage the user didn't choose; never claim a transition the API didn't confirm (read-back).
- Use `tf.sh`; never print the API key.

## Done means

- Config present, `/health` 200; avatar chosen.
- `stage=script` pieces listed (or honest "none"); previews only from real `script_data`.
- User choices applied: approve → `PATCH stage=done`; reject → keep or (confirmed) `DELETE`.
- Read-back confirms transitions; real counts reported.

## Abschluss (PFLICHT) — Next-Steps-Auswahlblock

Beende IMMER mit dem Auswahlblock aus `${CLAUDE_PLUGIN_ROOT}/reference/next-steps.md`. Nach Freigaben ist die ⭐-Empfehlung meist „✍️ Nächstes Skript" oder „📈 Trends ansehen" (bzw. „Content-Plan", wenn keine Ideen offen sind).
````

- [ ] **Step 2: Verify the skill file is well-formed**

Run: `cd /Users/tomadomeit/cowork-marketplace && rg -n "^name:|stage=script|stage.:.done" plugins/trendfinder/skills/review/SKILL.md`
Expected: `name: review`, the `stage=script` list call, and the `{"stage":"done"}` approve call all present.

- [ ] **Step 3: Commit**

```bash
cd /Users/tomadomeit/cowork-marketplace
git add plugins/trendfinder/skills/review/SKILL.md
git commit -m "feat(plugin): review skill — approve/reject scripts on content board (SP1)"
```

---

## Task P5: Plugin — new `journey` coach skill (guided spine)

**Files:**
- Create: `/Users/tomadomeit/cowork-marketplace/plugins/trendfinder/skills/journey/SKILL.md`
- Modify: `/Users/tomadomeit/cowork-marketplace/plugins/trendfinder/reference/next-steps.md` (add Content-Plan + Freigabe options)

**Interfaces:**
- Consumes (read-only state detection): `GET /health`, `GET /api/brands`, `GET /api/niches/config`, `GET /api/trends/{niche_id}`, `GET /api/personas/{persona_id}/content-pieces?stage=idea`, `?stage=script`.
- Produces: routes to the existing skills (`onboarding`, `scrape-now`, `trend-radar`, `content-plan`, `script-studio`, `review`, `cockpit`) with a single ⭐ next-step block after each detected state. No writes of its own.

- [ ] **Step 1: Create the journey skill file**

Create `/Users/tomadomeit/cowork-marketplace/plugins/trendfinder/skills/journey/SKILL.md`:

````markdown
---
name: journey
description: The guided Trendfinder start — detects where you are and walks you step-by-step from avatar to finished, approved script, proposing exactly one recommended next step each time. Use when the user says "Los geht's", "Trendfinder starten", "wie fange ich an", "was soll ich als nächstes tun", "führ mich durch", "start", "guide me", "next step", or opens Trendfinder without a specific request. Delegates to onboarding, scrape-now, trend-radar, content-plan, script-studio, review, and cockpit — never writes data itself.
---

# Trendfinder — Journey (geführter Einstieg)

Goal: be the **spine** of the whole Avatar→Script flow. Detect the current state, tell the user in one line where they are, and offer exactly **one ⭐ recommended next step** (plus the other sensible options) as a select-block — then delegate to the matching skill. The single-purpose skills stay underneath; this one just orchestrates and never writes data. Read `${CLAUDE_PLUGIN_ROOT}/reference/api-contract.md` and `${CLAUDE_PLUGIN_ROOT}/reference/next-steps.md` first. All API calls via `bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh`.

## Step 0 — Config / connection gate

1. Check `{workspace}/.trendfinder/config.json` exists.
2. If it does, `bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /health`.

Missing config or non-200 → state = **not set up** → ⭐ „⚙️ Einrichtung" → route to `onboarding`. Do not detect further.

## Step 1 — Detect state (read-only)

Fetch, tolerating empties (never invent):

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/brands
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/niches/config
```

Then, if ≥1 niche, check trends for the (first/relevant) niche, and if ≥1 avatar, check that avatar's open pieces:

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/trends/<niche_id>
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET "/api/personas/<persona_id>/content-pieces?stage=idea"
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET "/api/personas/<persona_id>/content-pieces?stage=script"
```

## Step 2 — Map state → the one ⭐ next step

Decide with this ladder (first match wins), name the state to the user, then show the select-block:

| Detected state | ⭐ Recommendation | Delegates to |
|---|---|---|
| Not set up / no config / health≠200 | ⚙️ Einrichtung | `onboarding` |
| No avatar (0 brands/personas) | 🎭 Avatar anlegen | `onboarding` |
| Avatar exists, niche has **no trends** | 🔥 Jetzt scrapen | `scrape-now` |
| Trends exist, **no idea pieces** | 🗂️ Content-Plan (Ideen) | `content-plan` |
| Idea pieces exist, **no script pieces** | ✍️ Skript schreiben | `script-studio` |
| Script pieces exist (awaiting approval) | ✅ Freigeben / Review | `review` |
| Everything approved / unclear | 📈 Trends ansehen | `cockpit` / `trend-radar` |

Always render the full sensible option set as a numbered block (per `next-steps.md`) with exactly one ⭐, e.g.:

```
Du hast einen Avatar (Lena) und frische Trends, aber noch keine Ideen geplant. Nächster Schritt:

1) 🗂️ Content-Plan — Ideen aus Lenas DNA + Trends  ⭐
2) ✍️ Direkt ein Skript schreiben
3) 🔥 Neu scrapen
4) 📈 Cockpit ansehen
```

On the user's pick, invoke the matching skill. After that skill finishes, its own Next-Steps block continues the journey — you do not need to re-run detection unless the user returns to you.

## Honesty & safety rules

- Detection is **read-only** — the journey never creates/patches/deletes; the delegated skills do that.
- Base the state on real API responses; an empty list is a real state ("noch keine Ideen"), never a reason to invent one.
- Config missing / health≠200 → always route to `onboarding`, never guess past a broken connection.
- Use `tf.sh`; never print the API key.

## Done means

- Connection gated (config + `/health`), else routed to onboarding.
- State detected from real API responses (brands, niches, trends, idea/script pieces).
- Exactly one ⭐ next step shown in a select-block, with the other sensible options; correct skill invoked on pick.

## Abschluss (PFLICHT) — Next-Steps-Auswahlblock

Dieser Skill IST der Next-Steps-Block — er endet immer mit genau einem ⭐ und delegiert. Spezifikation: `${CLAUDE_PLUGIN_ROOT}/reference/next-steps.md`.
````

- [ ] **Step 2: Add the two new options to `next-steps.md`**

In `reference/next-steps.md`, under `## Die Optionen (alles, was man mit Trendfinder machen kann)`, add these two bullets (after the "✍️ Skript schreiben" bullet):

```markdown
- 🗂️ **Content-Plan** — Ideen aus Avatar-DNA + Trends vorschlagen und als Ideen speichern
- ✅ **Freigeben / Review** — geschriebene Skripte durchsehen und freigeben (Stage → done)
```

Then extend the `## ⭐-Empfehlung nach Kontext` table with these rows (after the "Trends angesehen, Avatar existiert" row):

```markdown
| Trends da, noch keine Ideen | 🗂️ Content-Plan |
| Ideen da, noch kein Skript | ✍️ Skript schreiben |
| Skript geschrieben, nicht freigegeben | ✅ Freigeben / Review |
```

- [ ] **Step 3: Verify both files**

Run: `cd /Users/tomadomeit/cowork-marketplace && rg -n "^name: journey" plugins/trendfinder/skills/journey/SKILL.md && rg -n "Content-Plan|Freigeben / Review" plugins/trendfinder/reference/next-steps.md`
Expected: `name: journey` present; the two new options + three new table rows present in `next-steps.md`.

- [ ] **Step 4: Commit**

```bash
cd /Users/tomadomeit/cowork-marketplace
git add plugins/trendfinder/skills/journey/SKILL.md plugins/trendfinder/reference/next-steps.md
git commit -m "feat(plugin): journey coach skill + content-plan/review next-steps options (SP1)"
```

---

## Task P6: Plugin — Cockpit "Content" tab

**Files:**
- Modify: `/Users/tomadomeit/cowork-marketplace/plugins/trendfinder/skills/cockpit/scripts/cockpit.ts`

**Interfaces:**
- Consumes: `GET /api/brands`, `GET /api/brands/{brand_id}/personas`, `GET /api/personas/{persona_id}/content-pieces` (Task P1/B1). Reuses the existing `apiFetch`, `extractList`, `esc`, `berlinStand` helpers.
- Produces: a third "Content" tab in the generated `cockpit.html`, pieces grouped by stage — a visual status board.

- [ ] **Step 1: Add a `ContentPiece` type + fetch pieces per persona**

In `cockpit.ts`, after the `interface Persona { ... }` block (line 90), add:

```typescript
interface ContentPiece {
  id?: number | string;
  title?: string;
  stage?: string;
  pillar?: string;
  format?: string;
  persona_id?: number | string;
  [k: string]: unknown;
}

interface PersonaContent {
  personaName: string;
  brandName: string;
  pieces: ContentPiece[];
}
```

In `main()`, right after the brands+personas fetch loop finishes (after the `brandData.push(...)` loop closes, ~line 659, before the schedules fetch), collect content pieces per persona:

```typescript
  // ── Content pieces per persona (tenant-scoped CRUD, SP1) ──────────────────
  const personaContent: PersonaContent[] = [];
  for (const bd of brandData) {
    for (const p of bd.personas) {
      const pid = String(p.persona_id ?? p.id ?? "");
      if (!pid) continue;
      try {
        const raw = await apiFetch(cfg, `/api/personas/${pid}/content-pieces`);
        const pieces = extractList(raw) as ContentPiece[];
        if (pieces.length > 0) {
          personaContent.push({
            personaName: String(p.display_name ?? p.name ?? pid),
            brandName: brandName(bd.brand),
            pieces,
          });
        }
      } catch {
        warnings.push(`Content für ${String(p.display_name ?? pid)} konnte nicht geladen werden`);
      }
    }
  }
```

- [ ] **Step 2: Pass `personaContent` into `buildHtml` and build the Content panel**

Change the `buildHtml` signature (line 285) to accept the new data:

```typescript
function buildHtml(
  stand: string,
  niches: NicheData[],
  brandData: BrandData[],
  schedules: Schedule[],
  personaContent: PersonaContent[],
  warnings: string[]
): string {
```

Update the call site in `main()` (line 674) to pass it:

```typescript
  const html = buildHtml(stand, nicheData, brandData, schedules, personaContent, warnings);
```

Inside `buildHtml`, after the `avatareHtml` block is built (after line 427), add the Content panel builder:

```typescript
  // ── Content tab content (pieces grouped by stage) ─────────────────────────
  const STAGE_LABEL: Record<string, string> = {
    idea: "💡 Ideen",
    script: "✍️ Skripte",
    review: "🔍 In Review",
    done: "✅ Freigegeben",
  };
  const STAGE_ORDER = ["idea", "script", "review", "done"];
  const totalPieces = personaContent.reduce((s, pc) => s + pc.pieces.length, 0);

  let contentHtml: string;
  if (totalPieces === 0) {
    contentHtml = `<div class="cold-start">
      <div class="cold-icon">🗂️</div>
      <h2>Noch kein Content</h2>
      <p>Sag „Content-Plan" für Ideen aus der Avatar-DNA, oder „Skript schreiben" — deine Ideen und Skripte erscheinen hier nach Stufe sortiert.</p>
    </div>`;
  } else {
    contentHtml = personaContent
      .map((pc) => {
        const byStage = new Map<string, ContentPiece[]>();
        for (const piece of pc.pieces) {
          const st = String(piece.stage ?? "idea");
          if (!byStage.has(st)) byStage.set(st, []);
          byStage.get(st)!.push(piece);
        }
        const stageBlocks = STAGE_ORDER.filter((st) => byStage.has(st))
          .map((st) => {
            const rows = byStage
              .get(st)!
              .map((piece) => {
                const title = String(piece.title ?? "Ohne Titel");
                const meta = [piece.pillar, piece.format].filter(Boolean).map((x) => esc(String(x)));
                return `<div class="content-row">
                  <div class="content-title">${esc(title)}</div>
                  ${meta.length ? `<div class="content-meta">${meta.map((m) => `<span class="meta-tag">${m}</span>`).join("")}</div>` : ""}
                </div>`;
              })
              .join("");
            return `<div class="stage-group">
              <h3 class="stage-title">${esc(STAGE_LABEL[st] ?? st)} <span class="niche-count">${byStage.get(st)!.length}</span></h3>
              <div class="content-list">${rows}</div>
            </div>`;
          })
          .join("");
        return `<section class="brand-section">
          <h2 class="brand-title">${esc(pc.personaName)} · ${esc(pc.brandName)}</h2>
          ${stageBlocks}
        </section>`;
      })
      .join("");
  }
```

- [ ] **Step 3: Add the Content tab button, panel, and CSS; fix `showTab` index mapping**

Add these CSS rules inside the `<style>` block (before the closing `</style>` at line 514):

```css
.stage-group{margin-bottom:18px}
.stage-title{font-size:13px;font-weight:600;margin:0 0 8px;display:flex;align-items:center;gap:8px}
.content-list{display:flex;flex-direction:column;gap:6px}
.content-row{background:var(--sf);border:1px solid var(--bd);border-radius:10px;padding:10px 14px}
.content-title{font-size:14px;font-weight:500;margin-bottom:4px}
.content-meta{display:flex;flex-wrap:wrap;gap:6px}
```

Add the tab button after the "Avatare" tab button (line 531):

```html
    <button class="tab" onclick="showTab('content')">Content</button>
```

Add the tab panel after the `#tab-avatare` panel (line 539):

```html
  <div class="tab-panel" id="tab-content">
    ${contentHtml}
  </div>
```

Replace the `showTab` index mapping (line 551) — the old ternary only knew two tabs — with an index map covering three:

```javascript
  var order = { trends: 0, avatare: 1, content: 2 };
  var idx = order[name] != null ? order[name] : 0;
  if (tabs[idx]) tabs[idx].classList.add('on');
```

- [ ] **Step 4: Typecheck / smoke-run the generator**

Run (typecheck the file compiles under Bun; it's dependency-free):
`cd /Users/tomadomeit/cowork-marketplace && bun build plugins/trendfinder/skills/cockpit/scripts/cockpit.ts --target=node > /dev/null && echo "compiles ok"`
Expected: `compiles ok` (no type/parse errors). If `bun` is unavailable, run `node --experimental-strip-types --check plugins/trendfinder/skills/cockpit/scripts/cockpit.ts` instead.

- [ ] **Step 5: Render against the local stack and confirm the Content tab**

Precondition: the local full stack is up (`scratchpad/run_live.sh`; api on `:8000`) with a tenant config at a scratch workspace, and at least one content piece seeded (create one via `POST /api/personas/{id}/content-pieces`). Generate and grep the output:

```bash
cd /Users/tomadomeit/cowork-marketplace
TRENDFINDER_CONFIG=/private/tmp/claude-501/-Users-tomadomeit-Galant/79cbee37-0f8d-4d20-a468-4b90326ca71f/scratchpad/tf-config.json \
  bun plugins/trendfinder/skills/cockpit/scripts/cockpit.ts /private/tmp/claude-501/-Users-tomadomeit-Galant/79cbee37-0f8d-4d20-a468-4b90326ca71f/scratchpad
rg -n "tab-content|showTab\('content'\)|stage-group" /private/tmp/claude-501/-Users-tomadomeit-Galant/79cbee37-0f8d-4d20-a468-4b90326ca71f/scratchpad/.trendfinder/cockpit.html
```

Expected: the generator prints the output path; the grep shows the Content tab button, panel, and at least one `stage-group` (the seeded piece). If the stack/prod is down (see Test B gate below), skip the render and rely on Step 4's typecheck — mark this step blocked, do not fake the evidence.

- [ ] **Step 6: Commit**

```bash
cd /Users/tomadomeit/cowork-marketplace
git add plugins/trendfinder/skills/cockpit/scripts/cockpit.ts
git commit -m "feat(plugin): Cockpit Content tab — pieces grouped by stage (SP1)"
```

---

## Test B — end-to-end validation gate (blocked on prod)

The Markdown skills (P2–P5) are validated by running the real flow against a live tenant, which needs the backend up. This is **blocked until Railway is restored** (all 5 services down since 2026-07-07) AND Task B1 is deployed. When unblocked:

1. Restore Railway; deploy B1 (push `hardening-2026-07-09` context is separate — this is a new content-scoping change).
2. Create a fresh tenant + point a scratch workspace's `.trendfinder/config.json` at prod with the tenant key.
3. Run the S1 live curl once (`POST /api/scrape/trigger-all` with no key → expect 401) before trusting any public exposure.
4. Walk the journey: `journey` → `onboarding` (avatar) → `scrape-now` → `content-plan` (ideas saved) → `script-studio` (script persisted) → `review` (approve) → `cockpit` (Content tab shows the done piece). Confirm each read-back.

Until then, P1–P6 ship as reviewed, committed, typechecked code; the live walkthrough is the final acceptance.

---

## Self-Review (against the spec)

**Spec coverage:**
- §2 guided avatar→script journey → Task P5 (journey) + P2/P3/P4 chain. ✓
- §2 persist as same `content_pieces` → Task B1 (tenant-scoped CRUD) + P3 (PATCH script_data). ✓
- §2 native synthesis, backend stores → Global Constraints + P2/P3 never call LLM routes; B1 keeps them ops-only. ✓
- §2 maximally interactive select-blocks → every skill ends with the Next-Steps block; P2/P4 use multi-/single-select. ✓
- §4 existing stage vocabulary, no new strings → B1 keeps `VALID_STAGES`; P1 documents `idea→script→review→done`; `rendering` excluded. ✓
- §4 content-plan step IN, native, not `content_plans/generate` → Task P2 uses native ideas + `POST content-pieces`; the server-LLM route stays ops-only. ✓
- §5.1 tenant-scope content routes via persona ownership → Task B1 `_get_persona_or_404` / `_get_piece_or_404` on `persona.tenant_id`. ✓
- §5.1 persist native `script_data` → `ContentPieceUpdate` already accepts `script_data`; P3 PATCHes it (no schema change needed — confirmed by reading avatar.py). ✓
- §5.2 journey coach, content-plan skill, script-studio persistence, review skill, cockpit Content tab → P5/P2/P3/P4/P6. ✓
- §5.2 update api-contract + next-steps → P1 + P5 Step 2. ✓
- §7 S1 interaction: scoping enforced in code, not peer-IP → Global Constraints + B1. ✓
- §8 backend tenant-scoping tests + round-trip script_data → Task B1 test file (own/cross/ops + patch script_data + ops-gate). ✓

**Resolved open points (§10):**
- create/patch shape for `script_data`: create does NOT accept it (only `ContentPieceCreate` fields); PATCH does — so the flow is create-idea → PATCH-script. Documented in P1/P3. No backend schema change.
- `review` as its own step vs. direct `done`: kept as its own step (Task P4), advancing `script → done`; `review` stage string exists in `VALID_STAGES` but SP1 uses `script → done` directly (a piece "awaiting approval" = stage `script`), which keeps the plugin simple. Documented in P4.
- Cockpit Content tab read-only vs. actionable: **read-only status** (P6) — actions live in the `review`/`content-plan` skills, not the artifact. Matches the existing Trends/Avatare tabs.

**Placeholder scan:** no TBD/TODO; every code step shows full code; every skill file is complete content. ✓

**Type consistency:** `_get_persona_or_404(persona_id, db, tenant_id)` and `_get_piece_or_404(piece_id, db, tenant_id)` used consistently across list/create (persona) and patch/delete (piece); `content_pieces.router` (tenant CRUD) vs `content_pieces.ops_router` (LLM) named consistently in the file and in `main.py`; cockpit `PersonaContent`/`ContentPiece` types and `personaContent` variable consistent through fetch → `buildHtml` → panel; `showTab` order map covers all three tab names. ✓
