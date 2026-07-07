# Avatar-First Onboarding + AI-Derived Scrape Topics — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. This is a **Markdown skill-authoring** plan (no code/test suite) — "verification" per task is a self-consistency + spec-conformance checklist plus a skill-reviewer/plugin-validator pass, NOT pytest.

**Goal:** Turn the Trendfinder plugin avatar-first: the user describes an avatar via a questionnaire, Claude derives the scrape topics (hashtags + keywords) natively, shows them for a light confirm, and attaches the niche to the avatar — no hand-typed hashtags. Plus a re-derive path fixes existing niches (Dore).

**Architecture:** Pure plugin (Markdown skills) change. The `onboarding` skill becomes the unified avatar-first *creation* flow (gated by its Step-0 self-check to serve both first-run and "add avatar later"); `avatar-studio` shrinks to editing/listing; `niche-hashtags.md` becomes the AI derivation ruleset. Uses sub-project-1's already-deployed backend endpoints. AI synthesis (DNA + topics) runs natively in Claude — the backend only stores.

**Tech Stack:** Claude Cowork plugin — Markdown SKILL.md files, `reference/*.md`, `.claude-plugin/{plugin.json,marketplace.json}`, `README.md`. All backend calls via `bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh <METHOD> <path> [json|@file]` (curl wrapper reading `{workspace}/.trendfinder/config.json`).

## Global Constraints

- **Plugin-only. No backend change.** Uses sub-project-1 endpoints already live in prod (verified 2026-07-07: `persona_niches` created, migration applied).
- **AI synthesis is native in Claude, never the backend** — DNA and derived topics are authored in-session and POSTed as structured JSON; the backend only stores + embeds (plugin's core "thin data client" axiom).
- **Derivation UX = show + light confirm** — Claude derives topics, shows the list grouped by platform with a one-line rationale, the user can nudge; only after confirm does it write. (Same idiom as avatar-studio's DNA confirm.)
- **Topics only = hashtags + keywords** (`tiktok_hashtags`, `instagram_hashtags`, `youtube_search_queries`). Seed-accounts are out of scope.
- **No naked niches** — every niche is created via `POST /api/personas/{persona_id}/niches` (avatar attach). The plugin never calls `POST /api/niches/config` to make a niche.
- **Honesty rules (carried over):** never claim "created" without a read-back (`GET /api/personas/{id}` returns it AND the sent DNA fields are present; the niche's hashtags are non-empty in the attach response); never claim "embedded" unless `embed-dna` returned 200; report the scrape as a separate step.
- **Credits-free creation** — the flow never calls an Apify actor; it *offers* the scrape and routes to `scrape-now`.
- **Numbered options + ✏️ free-text escape** everywhere (Cowork has no buttons). Every skill ends with the interactive next-step block from `reference/next-steps.md`.
- **Never invent slugs** — always carry forward the `niche_id`/`persona_id`/`brand_id` the API returned; re-query rather than guess.
- **Language:** user-facing copy in German (the plugin's existing voice); keep the honest, no-fluff tone.
- **Version bump to `0.10.0`** in TWO files with DIFFERENT current values: `plugins/trendfinder/.claude-plugin/plugin.json` (currently `0.9.3`) AND the repo-root `.claude-plugin/marketplace.json` (a shared 3-plugin manifest — trendfinder is the entry whose `name == "trendfinder"`, currently `0.9.0`, already drifted from plugin.json). There is NO `marketplace.json` under `plugins/trendfinder/`. Publishing to the public install repo is a SEPARATE owner-run round-trip, out of scope here.

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `plugins/trendfinder/reference/niche-hashtags.md` (rewrite) | The AI **derivation ruleset** (rules Claude applies when generating tags) + the read-skill relevance-check (kept) | 1 |
| `plugins/trendfinder/skills/onboarding/SKILL.md` (core rewrite) | Unified avatar-first creation flow: self-check branch → avatar/DNA → niche(s) → derive topics → attach → cockpit; + re-derive path | 2 |
| `plugins/trendfinder/skills/avatar-studio/SKILL.md` (reduce) | Editing/listing existing avatars only (creation removed; triggers/description adjusted) | 3 |
| `plugins/trendfinder/reference/api-contract.md` (edit) | Document the sub-project-1 niche-attach endpoints; mark `POST /api/niches/config` plugin-deprecated | 4 |
| `plugins/trendfinder/.claude-plugin/plugin.json` (edit) | Version `0.10.0` + description mentions avatar-first onboarding | 4 |
| `.claude-plugin/marketplace.json` (repo root, edit) | Bump the trendfinder entry (select by `name == "trendfinder"`; it is `plugins[2]`, currently `0.9.0`) to `0.10.0` + mirror description | 4 |
| `plugins/trendfinder/README.md` (edit) | Reflect avatar-first onboarding in the components table + setup line | 4 |

All paths are relative to `~/cowork-marketplace`. Branch: `feat/avatar-first-onboarding` (spec already committed there).

---

## Task 1: `niche-hashtags.md` → AI derivation ruleset

**Files:**
- Modify (rewrite): `plugins/trendfinder/reference/niche-hashtags.md`

**Interfaces:**
- Produces: the ruleset that Task 2 (onboarding derivation, §5) and the read-skills reference. Section anchors the onboarding skill will point at: the "5 Regeln" (derivation rules) and the "Relevanz-Check" (read-skill post-scrape check).

**What the rewrite must contain** (the rules are unchanged; the framing shifts from "guide the typing user" to "the ruleset Claude applies when it derives tags itself"):

- [ ] **Step 1: Reframe the intro + retitle.** New title/intro states this file is the **derivation ruleset**: Claude derives the niche's scrape topics from the niche theme + avatar DNA + language/region, then self-checks the derived list against these rules *before showing it to the user*. Keep the one-sentence "why it matters" (broad/English/abstract tags pull off-topic global content — the #1 cause of unusable trends).
- [ ] **Step 2: Keep the 5 rules verbatim in intent**, reworded as derivation directives ("Derive specific, not broad" … ), preserving every concrete example already in the file: the mega-tag blocklist (`#mindset`, `#motivation`, `#transformation`, `#success`, `#highperformer`, `#viral`, `#fyp`), the DACH→German rule with its examples (`#persönlichkeitsentwicklung`, `#selbstfürsorge`, `#achtsamkeit`), concrete-topics-not-abstract-values (`#atemübung` not `#lebendigkeit`), 5–10 precise tags, and the post-scrape gegenprüfen rule.
- [ ] **Step 3: Add a "Selbst-Check vor dem Zeigen" subsection** — an explicit checklist Claude runs on its OWN derived list before presenting: drop mega-tags, drop wrong-language tags, drop abstract-value tags, cap at 5–10. This is the first line of defence against Dore-class bad tags.
- [ ] **Step 4: Keep the real negative example (Dore launch)** verbatim (techtok 28×, 61% off-topic, "Minimalist Gaming Setup" clusters) — it is the concrete evidence for why the rules exist.
- [ ] **Step 5: Keep the "Relevanz-Check (für die Read-Skills)" section** as-is — it stays the post-scrape check for trend-radar/trend-briefing/cockpit (unchanged responsibility). Add one line noting it complements the derivation self-check (derive well up front; verify after the scrape).
- [ ] **Step 6: Self-consistency verification.** Run:
  ```bash
  cd ~/cowork-marketplace && grep -qi "derivation\|ableit" plugins/trendfinder/reference/niche-hashtags.md && grep -q "techtok" plugins/trendfinder/reference/niche-hashtags.md && grep -qi "Selbst-Check\|selbst-check" plugins/trendfinder/reference/niche-hashtags.md && grep -qi "Relevanz-Check" plugins/trendfinder/reference/niche-hashtags.md && echo "OK: reframed + example + self-check + relevance-check all present"
  ```
  Expected: `OK: …`. (Confirms the reframe kept the example, added the self-check, and kept the read-skill relevance-check.)
- [ ] **Step 7: Commit**
  ```bash
  cd ~/cowork-marketplace && git add plugins/trendfinder/reference/niche-hashtags.md
  git commit -m "docs(trendfinder): reframe niche-hashtags.md as the AI topic-derivation ruleset"
  ```

---

## Task 2: `onboarding/SKILL.md` → unified avatar-first creation flow

**Files:**
- Modify (core rewrite): `plugins/trendfinder/skills/onboarding/SKILL.md`

**Interfaces:**
- Consumes: `reference/niche-hashtags.md` (Task 1 derivation ruleset), `reference/api-contract.md`, `reference/next-steps.md`, `scripts/tf.sh`, and sub-project-1 endpoints.
- Produces: the primary user entry point. Routes to `scrape-now`, `cockpit`, and (for editing) `avatar-studio`.

**Frontmatter `description` must trigger on creation intents** (this is what makes "Avatar anlegen" route here, not avatar-studio):
`First-time Trendfinder setup AND avatar-first creation. Use when the user says "richte Trendfinder ein", "set up trendfinder", "trendfinder setup", "Avatar anlegen", "Avatar erstellen", "create an avatar", "neue Persona", "Marke anlegen", "Themen neu ableiten", "Hashtags verbessern" — or whenever any Trendfinder skill is invoked and {workspace}/.trendfinder/config.json is missing. Walks the user avatar-first: access → Apify connector → avatar (brand+persona+DNA) → niche(s) derived from the avatar with AI-derived scrape topics (the user never types hashtags) → Cockpit. Also re-derives topics for existing niches. 24/7 scheduled scraping is an optional add-on.`

**The rewritten body must contain these sections/steps:**

- [ ] **Step 1: Preamble + Step 0 self-check with THREE branches.** Keep the "read api-contract.md first; all calls via tf.sh; never inline key" preamble. Rewrite Step 0 with all three states (a stale key on re-entry is an ordinary case, not an edge case):
  - **Config missing** → first-run: do access (Step 2) + Apify connector (Step 2), then enter the avatar flow (Step 3).
  - **Config present AND `tf.sh GET /health` 200** → **skip access/connector**; go straight to the avatar flow (Step 3) — this branch is how "Avatar anlegen"/"noch einen Avatar" re-enters. Do NOT tell the user to re-onboard; detect existing state and offer: new avatar / extend existing / re-derive topics.
  - **Config present BUT `/health` non-200** (revoked/expired key) → treat like first-run for the access part: re-run Step 2's access capture (reuse its 401/non-2xx handling — delete the stale config, re-ask for the "Dein Zugang" block) until `/health` is 200, THEN enter the avatar flow. Do not proceed to the avatar flow on a broken connection.
- [ ] **Step 2: Keep Step 1 (Zugang einfügen) and Step 2 (Apify-Connector) essentially as today** — parse `base_url`+`api_key` from the pasted "Dein Zugang" block, write `config.json`, prove with `GET /health` + `GET /api/niches/config`, handle 401 (delete config, re-ask) / non-2xx (report, ask). Connector step unchanged (OAuth in Cowork, on-demand only, not a gate). These run ONLY on the first-run branch.
- [ ] **Step 3: Detect-first state.** After connection, fetch existing avatars and niches to present current state:
  ```
  bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/brands
  bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/niches/config
  ```
  `GET /api/niches/config` now returns each niche with a `personas: [{persona_id, display_name}]` array (sub-project 1 enrichment). Present existing avatars/niches, then offer numbered: (1) neuen Avatar anlegen (→ Step 4), (2) bestehenden Avatar um eine Niche erweitern (→ **Step 4a**), (3) Themen einer bestehenden Niche neu ableiten (→ Step 7), ✏️ etwas anderes. **Show option (3) only if ≥1 niche exists** (meaningless otherwise). If the tenant has zero brands, skip the menu and go straight to avatar creation (Step 4).
- [ ] **Step 4: Avatar — questionnaire → DNA → brand+persona.** Absorb avatar-studio's interview:
  - Ask 4–6 focused questions (name/personality, niche/topics, tone & language, platform focus, focused-vs-broad). Explicitly ask focused-vs-broad — it sets DNA depth (broad → 4–6 rich `content_pillars`).
  - **Brand select-or-create (numbered user choice, never a silent auto-attach):** if the tenant already has brands, present them numbered and let the user pick one OR "neue Marke" (mirrors today's avatar-studio Step 1). On "neue Marke" (or zero brands): slugify display name → `brand_id` (lowercase, spaces→`-`, strip non-`[a-z0-9-]`, prefix to keep globally unique), then
    ```
    BRAND_BODY=$(mktemp); echo '{"brand_id":"<slug>","display_name":"<Name>","mission":"...","target_audience":"..."}' > "$BRAND_BODY"
    bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh POST /api/brands @"$BRAND_BODY"; rm -f "$BRAND_BODY" 2>/dev/null || : > "$BRAND_BODY"
    ```
    Interpret 201 / 409 slug-taken (re-slug) / 422 malformed / 401-400 tenant→route to access.
  - **Claude synthesises the DNA natively.** **DNA field shapes are NESTED OBJECTS, not flat strings** (sending a string 422s — this is the primary creation path, get it right). Follow the exact shapes documented in `api-contract.md` § "Avatars — Brands, Personas & DNA" (the same shapes today's avatar-studio uses): `persona_profile` = `{name, age, background, location, appearance, personality, style}`; `tone_of_voice` = `{tone, language, attitude, energy, avoid_words, example_openers}`; `content_pillars` = a **list** of `{name, description, topics}`; plus scalar `system_prompt` (string), `interests` (string), `origin_story` (string). Every DNA field is optional, so partial DNA is fine — but any field you send must match its shape. **Show the DNA → confirm before writing.** Then create the persona (`persona_id` = slugified name prefixed with brand) — write the full confirmed body to the temp file:
    ```
    PERSONA_BODY=$(mktemp)   # body = {"persona_id":"<brand>-<name>","display_name":"<Name>","persona_profile":{...},"tone_of_voice":{...},"content_pillars":[{...}],"system_prompt":"...","interests":"...","origin_story":"..."}
    bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh POST /api/brands/<brand_id>/personas @"$PERSONA_BODY"; rm -f "$PERSONA_BODY" 2>/dev/null || : > "$PERSONA_BODY"
    ```
    Interpret 201 / 409 persona-id-taken / 404 brand-not-tenant / 422. **Read back** `GET /api/personas/<persona_id>` and confirm the DNA fields are present before proceeding (honesty rule). Then `POST /api/personas/<persona_id>/embed-dna` and report the result honestly (200 embedded / 503 not-configured-still-usable / 400 no-DNA).
- [ ] **Step 4a: Extend an existing avatar (entry: option 2 in Step 3).** Skip the Step-4 questionnaire — the avatar already has DNA. Pick the avatar (numbered), then: if the new niche's topic is **already within** the avatar's `content_pillars`, feed that pillar straight into Step 5. If the topic is **genuinely new** (e.g. a "Fitness" avatar's owner now wants "Nutrition"), ask the user to describe it in 1–2 sentences, treat it as an additional `content_pillar` (optionally `PUT /api/personas/<persona_id>` to add it to the DNA so future matching sees it), then run Step 5 for that one new pillar. Do NOT re-run the full DNA interview on an avatar that already has one.
- [ ] **Step 5: Derive the niche(s) from the avatar.** From the avatar's `content_pillars`, Claude determines the niche(s) it covers (mono → 1; broad → several). **Before creating a new niche, check the existing `GET /api/niches/config` list**: if a theme overlaps an existing niche, offer to **attach to it** (shared) instead of duplicating. Confirm the niche split with the user ("eine Niche, oder in diese zwei splitten?").
- [ ] **Step 6: Derive topics per NEW niche + attach.** For each new niche, apply the `reference/niche-hashtags.md` derivation ruleset:
  - Derive 5–10 precise TikTok/IG hashtags + YouTube queries from niche theme + avatar DNA + language/region (DACH→German).
  - **Self-check the derived list against niche-hashtags.md BEFORE showing** (drop mega-tags/wrong-language/abstract).
  - **Show grouped by platform + one-line rationale → light confirm/nudge loop.** On an uncertain niche, ask ONE clarifying question rather than guess.
  - **The self-check runs on EVERY re-shown list, not just the first** — including a list adjusted by a user nudge. If a nudge itself proposes a blocklisted mega-tag / wrong-language / abstract-value tag (e.g. "nimm stattdessen #mindset"), do NOT accept it verbatim: push back using the niche-hashtags.md reasoning (why it pulls off-topic content) and propose a specific on-topic alternative. This closes the one channel through which a hand-typed off-topic tag could still reach the attach payload (the Dore failure mode via "confirm" instead of "type").
  - Attach on confirm — new niche (create-and-attach):
    ```
    NICHE_BODY=$(mktemp); echo '{"display_name":"<prefixed niche name>","tiktok_hashtags":["..."],"instagram_hashtags":["..."],"youtube_search_queries":["..."],"instagram_enabled":true,"youtube_enabled":true}' > "$NICHE_BODY"
    bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh POST /api/personas/<persona_id>/niches @"$NICHE_BODY"; rm -f "$NICHE_BODY" 2>/dev/null || : > "$NICHE_BODY"
    ```
    Existing (shared) niche — attach-existing (NO topic derivation; the shared niche keeps its config):
    ```
    bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh POST /api/personas/<persona_id>/niches '{"niche_id":"<existing niche_id>"}'
    ```
    Interpret 200 (linked; returns the niche with its scrape config) / **409** — two causes on create-and-attach: already-linked (tell the user it's linked) OR the derived niche slug already exists (re-slug the `display_name`, e.g. prefix differently, and retry, like the brand/persona 409 handling) / 404 foreign persona-or-niche / 422 malformed-or-both/neither-keys. **Read the response back and confirm the hashtags landed non-empty** (honesty rule). Always carry forward the returned `niche_id`. Repeat per niche.
- [ ] **Step 7: Re-derive path for an EXISTING niche** (entry: option 3 in Step 3, or "Themen neu ableiten"). Pick a niche from `GET /api/niches/config`; the derivation lens is the niche's linked avatar's DNA (from the niche's `personas[]`; if several, ask which, or use the niche theme; if avatar-less, offer to link one first). Derive topics (Step 6 ruleset + self-check). **Show a current-vs-proposed diff** (the niche's current `tiktok_hashtags`/etc. vs the derived) → confirm/nudge — **the same "self-check every re-shown list + push back on a blocklisted/wrong-language nudge" rule from Step 6 applies here too**. Then:
  ```
  bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh PUT /api/niches/config/<niche_id> '{"tiktok_hashtags":["..."],"instagram_hashtags":["..."],"youtube_search_queries":["..."]}'
  ```
  Read back (`GET /api/niches/config/<niche_id>` or the PUT response) to confirm. State honestly: the config update does NOT scrape; the old scraped videos remain; offer a fresh scrape so the better tags take effect.
- [ ] **Step 8: Cockpit + first scrape (close).** Regenerate the Cockpit (keep the existing bun/node cockpit.ts invocation), say honestly if a fresh niche has no trends yet, then offer the first scrape (→ `scrape-now`). Keep the "24/7-Automatik (optional, später)" note at the end (unchanged — backend token + scheduler skill).
- [ ] **Step 9: Niche rename/detach path + next-steps block.** Preserve the niche-management the old onboarding had (the naked-*create* path is removed, but rename/detach stay — reachable from the detect-first menu's ✏️ or on request):
  - **Rename a niche** (display name only; the `niche_id` slug is immutable): `bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh PUT /api/niches/config/<niche_id> '{"display_name":"<neuer Name>"}'`.
  - **Detach a niche from an avatar** (the sub-project-1 endpoint, gives it its plugin caller): `bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh DELETE /api/personas/<persona_id>/niches/<niche_id>` → `204` if the niche still has other avatars (link removed, data kept). If it is the niche's LAST avatar, the API returns `409 last_avatar`; only on explicit user confirmation re-call with `?confirm_delete=true` (which deletes the niche + its trends/videos/schedules/jobs; may itself `409` if a scrape is active — tell the user to wait).
  - Keep the final **single** interactive next-step block from `reference/next-steps.md` (one ⭐ recommendation, contextual — freshly created + no scrape → usually 🔥 "Jetzt scrapen"). **Remove the old standalone "add a niche directly (naked)" create branch entirely** — niches are only born via avatars now.
- [ ] **Step 10: Update "Done means".** A run counts as done when: config present + `/health` 200 (first-run branch); at least one avatar (brand+persona, read back) created OR an existing one extended; each niche created via the attach endpoint with non-empty derived+confirmed topics (read back); DNA embed result reported honestly; Cockpit regenerated; first scrape offered. No hand-typed hashtags anywhere. No naked-niche path used.
- [ ] **Step 11: Self-consistency verification.** Run:
  ```bash
  cd ~/cowork-marketplace && f=plugins/trendfinder/skills/onboarding/SKILL.md
  grep -q "personas/<persona_id>/niches\|personas/{persona_id}/niches" "$f" \
    && ! grep -q "POST /api/niches/config" "$f" \
    && ! grep -qi "comma-separated\|hashtags/queries per platform\|Hashtags/Queries pro Plattform" "$f" \
    && grep -qi "niche-hashtags.md" "$f" \
    && grep -qi "Avatar anlegen\|Avatar erstellen" "$f" \
    && grep -qi "Themen neu ableiten\|neu ableiten" "$f" \
    && grep -qi "self-check\|Selbst-Check\|bestätig" "$f" \
    && echo "OK: attach-endpoint used, no naked-niche POST, OLD hand-typed-hashtag UX gone, ruleset referenced, creation+re-derive triggers, confirm present"
  ```
  Expected: `OK: …`. (Pins: uses the attach endpoint, never posts a naked niche, references the ruleset, triggers on creation + re-derive, keeps the confirm step.)
- [ ] **Step 12: Commit**
  ```bash
  cd ~/cowork-marketplace && git add plugins/trendfinder/skills/onboarding/SKILL.md
  git commit -m "feat(trendfinder): avatar-first unified onboarding — AI-derived topics, no hand-typed hashtags, re-derive path"
  ```

---

## Task 3: `avatar-studio/SKILL.md` → editing/listing only

**Files:**
- Modify (reduce): `plugins/trendfinder/skills/avatar-studio/SKILL.md`

**Interfaces:**
- Consumes: `scripts/tf.sh`, brand/persona endpoints, `reference/next-steps.md`.
- Produces: the edit/list surface. Routes creation intents to `onboarding` (Task 2).

- [ ] **Step 1: Retarget the frontmatter `description` to editing/listing** — trigger on "Avatar bearbeiten", "DNA ändern", "Avatar löschen", "meine Avatare zeigen", "Marke bearbeiten"; and **remove EVERY creation trigger currently in the description.** The live `avatar-studio/SKILL.md:3` description contains "Avatar anlegen", "Avatar erstellen", "create an avatar", "neue Persona", "Marke anlegen", **and also** "lege einen Avatar an" and "DNA für meinen Avatar" — remove ALL of these (not just the first five) so nothing creation-flavored remains to collide with `onboarding`'s triggers. State it edits/lists existing avatars and never creates them.
- [ ] **Step 2: Keep Step 0 (config self-check)** — if not set up, route to `onboarding`.
- [ ] **Step 3: Keep Step 1 (detect existing avatars/brands)** via `GET /api/brands` + `GET /api/brands/{brand_id}/personas`. Change the action menu: (1) Avatar bearbeiten (DNA/Marke), (2) Avatar löschen, ✏️ etwas anderes. **Add: if the user wants to CREATE a new avatar, tell them and route to `onboarding`** ("Neue Avatare legst du im Onboarding-Flow an — soll ich dorthin wechseln?"). **If the tenant has ZERO avatars** (nothing to edit/list), don't dead-end: say so and route to `onboarding` to create the first one.
- [ ] **Step 4: Keep the editing operations** — `PUT /api/brands/{brand_id}`, `PUT /api/personas/{persona_id}` (re-embeds on DNA change), read-back + Cockpit regen, `DELETE /api/brands/{brand_id}` / `DELETE /api/personas/{persona_id}` (confirm first; note deletion is irreversible AND — per sub-project 1 — deleting an avatar cascade-deletes any niche it solely owns while shared niches keep the link; surface this in the delete confirm).
- [ ] **Step 5: Remove the DNA-creation interview (old Steps 2–4 "create brand / synthesise DNA / create persona") and the create-flow "Done means"** — creation lives in `onboarding` now. Keep DNA *editing* guidance. Keep the honesty rules (never claim created/embedded without read-back) and the credits-free note. Keep the final next-steps block.
- [ ] **Step 6: Self-consistency verification.** Run:
  ```bash
  cd ~/cowork-marketplace && f=plugins/trendfinder/skills/avatar-studio/SKILL.md
  grep -qi "bearbeit\|edit" "$f" \
    && grep -qi "onboarding" "$f" \
    && ! grep -qi "Avatar anlegen\|Avatar erstellen\|create an avatar\|lege einen Avatar an\|DNA für meinen Avatar\|neue Persona\|Marke anlegen" "$f" \
    && grep -q "PUT /api/personas\|PUT /api/brands" "$f" \
    && echo "OK: edit-focused, routes creation to onboarding, ALL create triggers gone, edit endpoints present"
  ```
  Expected: `OK: …`.
- [ ] **Step 7: Commit**
  ```bash
  cd ~/cowork-marketplace && git add plugins/trendfinder/skills/avatar-studio/SKILL.md
  git commit -m "refactor(trendfinder): avatar-studio to edit/list only; creation moves to avatar-first onboarding"
  ```

---

## Task 4: api-contract + manifests + README (endpoints, version, description)

**Files:**
- Modify: `plugins/trendfinder/reference/api-contract.md`
- Modify: `plugins/trendfinder/.claude-plugin/plugin.json`
- Modify: `plugins/trendfinder/.claude-plugin/marketplace.json`
- Modify: `plugins/trendfinder/README.md`

**Interfaces:**
- Consumes: nothing new. Produces: the endpoint reference Task 2/3 rely on + the bumped manifests.

- [ ] **Step 1: Add the sub-project-1 niche-attach endpoints to `api-contract.md`** (in the niches/personas table area, near lines 33–54). Add rows, exact shapes:
  - `POST /api/personas/{persona_id}/niches` — body **either** `{niche_id}` (attach existing) **or** `{display_name, tiktok_hashtags?, instagram_hashtags?, youtube_search_queries?, <enabled flags>?}` (create-and-attach). Returns the linked niche with its scrape config. `200` linked / `409` already-linked or create-slug-exists / `404` foreign persona-or-niche / `422` malformed **or both/neither of niche_id/display_name**. **This is the ONLY plugin path to create a niche.**
  - `GET /api/personas/{persona_id}/niches` — the avatar's niches (each with full scrape config). `404` foreign persona.
  - `DELETE /api/personas/{persona_id}/niches/{niche_id}` — detach; `204` if ≥1 other avatar remains (link only). **Last** avatar → `409 {"error":"last_avatar",...}` unless `?confirm_delete=true`. Even with `?confirm_delete=true` it FIRST returns `409 "Cannot delete niche with active scrape job"` if a `job_queue` row is running/pending; otherwise it cascade-deletes the niche + its trends/videos/schedules/jobs and returns **`200 {"status":"deleted","niche_id":...,"deleted":<per-table counts>}`** (not 204). `404` foreign persona, or the niche not linked to this persona.
  - `GET /api/niches/config/{niche_id}/personas` — the niche's linked avatars `[{persona_id, display_name}]`. `404` foreign niche.
  - Note on the existing `GET /api/niches/config` row: it now additionally returns `personas: [{persona_id, display_name}]` per niche.
- [ ] **Step 2: Mark `POST /api/niches/config` plugin-deprecated** — edit its row (line ~34) to add: "**Plugin-deprecated: do NOT create niches here. Niches are created only via `POST /api/personas/{persona_id}/niches` (avatar-first). Endpoint retained for ops/internal only.**" Also, on the persona-create row (`POST /api/brands/{brand_id}/personas`, line ~50) drop the stale `tiktok_hashtags`/`instagram_hashtags`/`*_enabled` **persona** fields from the documented body — topics now live on the niche, not the persona (leftover from before the n:m split; these persona scraper columns are dormant per sub-project 1).
- [ ] **Step 3: Bump `plugins/trendfinder/.claude-plugin/plugin.json`** — `"version": "0.9.3"` → `"0.10.0"`; update the `description` so the onboarding clause reads avatar-first (the user describes an avatar; niches are derived with AI-derived scrape topics; no hand-typed hashtags). Keep it one sentence, keep the "AI synthesis native, backend only stores/scrapes" axiom.
- [ ] **Step 4: Bump the trendfinder entry in the repo-root `.claude-plugin/marketplace.json`** (shared 3-plugin manifest). Select the entry by `name == "trendfinder"` (do NOT hardcode `plugins[0]` — it is `plugins[2]`), set its `"version"` `"0.9.0"` → `"0.10.0"`, and mirror the description change onto that entry. Leave the other two plugins untouched.
- [ ] **Step 5: Update `README.md`** — the components table row for `skills/onboarding` → "avatar-first setup + creation: access → connector → avatar (brand+persona+DNA) → niche(s) with AI-derived scrape topics → Cockpit; also re-derives topics for existing niches"; `skills/avatar-studio` → "edit/list existing avatars"; `reference/niche-hashtags.md` → "the AI topic-derivation ruleset (+ read-skill relevance check)". Update the one-line setup blurb to say the user describes an avatar and never types hashtags.
- [ ] **Step 6: Verification — versions consistent + valid JSON + endpoint documented.** Run (note the two manifests live at DIFFERENT paths; select the trendfinder entry by name):
  ```bash
  cd ~/cowork-marketplace
  python3 -c "import json; a=json.load(open('plugins/trendfinder/.claude-plugin/plugin.json'))['version']; m=json.load(open('.claude-plugin/marketplace.json')); b=next(p['version'] for p in m['plugins'] if p['name']=='trendfinder'); assert a==b=='0.10.0', (a,b); print('versions OK', a)"
  grep -q "personas/{persona_id}/niches" plugins/trendfinder/reference/api-contract.md && grep -qi "plugin-deprecated" plugins/trendfinder/reference/api-contract.md && echo "contract OK"
  ```
  Expected: `versions OK 0.10.0` and `contract OK`.
- [ ] **Step 7: Commit**
  ```bash
  cd ~/cowork-marketplace && git add plugins/trendfinder/reference/api-contract.md plugins/trendfinder/.claude-plugin/plugin.json .claude-plugin/marketplace.json plugins/trendfinder/README.md
  git commit -m "docs(trendfinder): document niche-attach endpoints, deprecate naked-niche POST, bump to 0.10.0"
  ```

---

## Final Verification (after all tasks)

- [ ] **Plugin validity** — dispatch the `plugin-dev:plugin-validator` agent on `plugins/trendfinder` (structure + manifest + frontmatter). Expected: valid, versions 0.10.0.
- [ ] **Skill quality** — dispatch the `plugin-dev:skill-reviewer` agent on the rewritten `onboarding` and `avatar-studio` SKILL.md against the spec's §3–§7 (triggering description, single clear flow, honesty rules, no naked-niche path, confirm step present).
- [ ] **Cross-file consistency** — confirm no skill still tells the user to type hashtags or calls `POST /api/niches/config` to create a niche:
  ```bash
  cd ~/cowork-marketplace && ! grep -rn "POST /api/niches/config" plugins/trendfinder/skills/ && echo "OK: no skill creates naked niches"
  ```
- [ ] **§8 cross-check** — re-read the three read/scrape skills that reference `niche-hashtags.md` (`skills/scrape-now/SKILL.md`, `skills/trend-radar/SKILL.md`, `skills/trend-briefing/SKILL.md`) and confirm their pointers still read correctly after Task 1's reframe (they should — each already has Claude *propose* hashtags, which fits the new "Claude derives" framing). Fix any pointer whose surrounding sentence now contradicts the reframed file. Find them:
  ```bash
  cd ~/cowork-marketplace && grep -rn "niche-hashtags.md" plugins/trendfinder/skills/
  ```
- [ ] **Requirements checklist vs spec** — §3 topology (Task 2/3), §4 flow A–E (Task 2 Steps 4–8), §5 derivation (Task 1 + Task 2 Step 6), §6 re-derive (Task 2 Step 7), §7 edge cases/honesty (Task 2/3), §8 file surface (all tasks).

## Rollout / Verification note

No automated test suite (Markdown skills). **End-to-end verification is a manual walkthrough in Cowork** against the live backend (sub-project 1 is deployed + migrated). The owner runs "richte Trendfinder ein" / "Avatar anlegen" / "Themen neu ableiten" and confirms: no hashtag typing, topics shown for confirm, niche attached to avatar, Dore's niche re-derivable. The in-flow read-backs are the guardrails.

---

## Self-Review Notes (writing-plans)

- **Spec coverage:** §2 decisions → Global Constraints; §3 topology → Task 2 (self-check branch + triggers) + Task 3 (avatar-studio reduce); §4 flow A–E → Task 2 Steps 4–8; §5 derivation → Task 1 + Task 2 Step 6; §6 re-derive → Task 2 Step 7; §7 edge/honesty → Task 2 Steps 6/8/10 + Task 3 Step 4; §8 file surface → Tasks 1–4. All covered.
- **No placeholders:** every step names the exact file, the exact API-call shapes (tf.sh commands verbatim), and a concrete grep/JSON verification. No "add appropriate steps."
- **Consistency:** the attach endpoint `POST /api/personas/{persona_id}/niches` is used identically in Task 2 (Step 6) and documented in Task 4 (Step 1); `PUT /api/niches/config/{niche_id}` for re-derive (Task 2 Step 7) matches the contract; version `0.10.0` used in Task 4 Steps 3–4 + final verification.
- **Markdown-authoring adaptation:** no pytest; each task's "verification" is a self-consistency grep + a skill-reviewer/plugin-validator pass, and the true end-to-end check is the manual Cowork walkthrough (noted). This is honest — the plugin has no test harness.
