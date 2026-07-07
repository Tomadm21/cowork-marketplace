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
- **Version bump:** `0.9.3` → `0.10.0` in `plugin.json` + `marketplace.json`.

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `plugins/trendfinder/reference/niche-hashtags.md` (rewrite) | The AI **derivation ruleset** (rules Claude applies when generating tags) + the read-skill relevance-check (kept) | 1 |
| `plugins/trendfinder/skills/onboarding/SKILL.md` (core rewrite) | Unified avatar-first creation flow: self-check branch → avatar/DNA → niche(s) → derive topics → attach → cockpit; + re-derive path | 2 |
| `plugins/trendfinder/skills/avatar-studio/SKILL.md` (reduce) | Editing/listing existing avatars only (creation removed; triggers/description adjusted) | 3 |
| `plugins/trendfinder/reference/api-contract.md` (edit) | Document the sub-project-1 niche-attach endpoints; mark `POST /api/niches/config` plugin-deprecated | 4 |
| `plugins/trendfinder/.claude-plugin/plugin.json` (edit) | Version `0.10.0` + description mentions avatar-first onboarding | 4 |
| `plugins/trendfinder/.claude-plugin/marketplace.json` (edit) | Version `0.10.0` + description | 4 |
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

- [ ] **Step 1: Preamble + Step 0 self-check with branch.** Keep the "read api-contract.md first; all calls via tf.sh; never inline key" preamble. Rewrite Step 0:
  - If `{workspace}/.trendfinder/config.json` missing → this is first-run: do access (Step 1) + Apify connector (Step 2), then enter the avatar flow (Step 3).
  - If config present AND `tf.sh GET /health` 200 → **skip access/connector**; go straight to the avatar flow (Step 3) — this branch is how "Avatar anlegen"/"noch einen Avatar" re-enters. Do NOT tell the user to re-onboard; detect existing state and offer: new avatar / extend existing / re-derive topics.
- [ ] **Step 2: Keep Step 1 (Zugang einfügen) and Step 2 (Apify-Connector) essentially as today** — parse `base_url`+`api_key` from the pasted "Dein Zugang" block, write `config.json`, prove with `GET /health` + `GET /api/niches/config`, handle 401 (delete config, re-ask) / non-2xx (report, ask). Connector step unchanged (OAuth in Cowork, on-demand only, not a gate). These run ONLY on the first-run branch.
- [ ] **Step 3: Detect-first state.** After connection, fetch existing avatars and niches to present current state:
  ```
  bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/brands
  bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/niches/config
  ```
  `GET /api/niches/config` now returns each niche with a `personas: [{persona_id, display_name}]` array (sub-project 1 enrichment). Present existing avatars/niches, then offer numbered: (1) neuen Avatar anlegen, (2) bestehenden Avatar um eine Niche erweitern, (3) Themen einer bestehenden Niche neu ableiten (→ Step 7), ✏️ etwas anderes. If the tenant has zero brands, go straight to avatar creation (Step 4).
- [ ] **Step 4: Avatar — questionnaire → DNA → brand+persona.** Absorb avatar-studio's interview:
  - Ask 4–6 focused questions (name/personality, niche/topics, tone & language, platform focus, focused-vs-broad). Explicitly ask focused-vs-broad — it sets DNA depth (broad → 4–6 rich `content_pillars`).
  - **Brand select-or-create:** if a suitable existing brand exists, select it; else create: slugify display name → `brand_id` (lowercase, spaces→`-`, strip non-`[a-z0-9-]`, prefix to keep globally unique), then
    ```
    BRAND_BODY=$(mktemp); echo '{"brand_id":"<slug>","display_name":"<Name>","mission":"...","target_audience":"..."}' > "$BRAND_BODY"
    bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh POST /api/brands @"$BRAND_BODY"; rm -f "$BRAND_BODY" 2>/dev/null || : > "$BRAND_BODY"
    ```
    Interpret 201 / 409 slug-taken (re-slug) / 422 malformed / 401-400 tenant→route to access.
  - **Claude synthesises the DNA natively** (persona_profile, tone_of_voice, content_pillars, system_prompt, interests, origin_story). **Show the DNA → confirm before writing.** Then create the persona (`persona_id` = slugified name prefixed with brand):
    ```
    PERSONA_BODY=$(mktemp); echo '{ ...confirmed DNA... }' > "$PERSONA_BODY"
    bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh POST /api/brands/<brand_id>/personas @"$PERSONA_BODY"; rm -f "$PERSONA_BODY" 2>/dev/null || : > "$PERSONA_BODY"
    ```
    Interpret 201 / 409 persona-id-taken / 404 brand-not-tenant / 422. **Read back** `GET /api/personas/<persona_id>` and confirm the DNA fields are present before proceeding (honesty rule). Then `POST /api/personas/<persona_id>/embed-dna` and report the result honestly (200 embedded / 503 not-configured-still-usable / 400 no-DNA).
- [ ] **Step 5: Derive the niche(s) from the avatar.** From the avatar's `content_pillars`, Claude determines the niche(s) it covers (mono → 1; broad → several). **Before creating a new niche, check the existing `GET /api/niches/config` list**: if a theme overlaps an existing niche, offer to **attach to it** (shared) instead of duplicating. Confirm the niche split with the user ("eine Niche, oder in diese zwei splitten?").
- [ ] **Step 6: Derive topics per NEW niche + attach.** For each new niche, apply the `reference/niche-hashtags.md` derivation ruleset:
  - Derive 5–10 precise TikTok/IG hashtags + YouTube queries from niche theme + avatar DNA + language/region (DACH→German).
  - **Self-check the derived list against niche-hashtags.md BEFORE showing** (drop mega-tags/wrong-language/abstract).
  - **Show grouped by platform + one-line rationale → light confirm/nudge loop.** On an uncertain niche, ask ONE clarifying question rather than guess.
  - Attach on confirm — new niche (create-and-attach):
    ```
    NICHE_BODY=$(mktemp); echo '{"display_name":"<prefixed niche name>","tiktok_hashtags":["..."],"instagram_hashtags":["..."],"youtube_search_queries":["..."],"instagram_enabled":true,"youtube_enabled":true}' > "$NICHE_BODY"
    bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh POST /api/personas/<persona_id>/niches @"$NICHE_BODY"; rm -f "$NICHE_BODY" 2>/dev/null || : > "$NICHE_BODY"
    ```
    Existing (shared) niche — attach-existing (NO topic derivation; the shared niche keeps its config):
    ```
    bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh POST /api/personas/<persona_id>/niches '{"niche_id":"<existing niche_id>"}'
    ```
    Interpret 200 (linked; returns the niche with its scrape config) / 409 already-linked / 404 foreign persona-or-niche / 422 malformed-or-both-keys. **Read the response back and confirm the hashtags landed non-empty** (honesty rule). Always carry forward the returned `niche_id`. Repeat per niche.
- [ ] **Step 7: Re-derive path for an EXISTING niche** (entry: option 3 in Step 3, or "Themen neu ableiten"). Pick a niche from `GET /api/niches/config`; the derivation lens is the niche's linked avatar's DNA (from the niche's `personas[]`; if several, ask which, or use the niche theme; if avatar-less, offer to link one first). Derive topics (Step 6 ruleset + self-check). **Show a current-vs-proposed diff** (the niche's current `tiktok_hashtags`/etc. vs the derived) → confirm/nudge. Then:
  ```
  bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh PUT /api/niches/config/<niche_id> '{"tiktok_hashtags":["..."],"instagram_hashtags":["..."],"youtube_search_queries":["..."]}'
  ```
  Read back (`GET /api/niches/config/<niche_id>` or the PUT response) to confirm. State honestly: the config update does NOT scrape; the old scraped videos remain; offer a fresh scrape so the better tags take effect.
- [ ] **Step 8: Cockpit + first scrape (close).** Regenerate the Cockpit (keep the existing bun/node cockpit.ts invocation), say honestly if a fresh niche has no trends yet, then offer the first scrape (→ `scrape-now`). Keep the "24/7-Automatik (optional, später)" note at the end (unchanged — backend token + scheduler skill).
- [ ] **Step 9: Optional avatar-image / next steps.** Keep the final **single** interactive next-step block from `reference/next-steps.md` (one ⭐ recommendation, contextual — freshly created + no scrape → usually 🔥 "Jetzt scrapen"). Remove the old standalone "add a niche directly (naked)" branch entirely — niches are only born via avatars now.
- [ ] **Step 10: Update "Done means".** A run counts as done when: config present + `/health` 200 (first-run branch); at least one avatar (brand+persona, read back) created OR an existing one extended; each niche created via the attach endpoint with non-empty derived+confirmed topics (read back); DNA embed result reported honestly; Cockpit regenerated; first scrape offered. No hand-typed hashtags anywhere. No naked-niche path used.
- [ ] **Step 11: Self-consistency verification.** Run:
  ```bash
  cd ~/cowork-marketplace && f=plugins/trendfinder/skills/onboarding/SKILL.md
  grep -q "personas/<persona_id>/niches\|personas/{persona_id}/niches" "$f" \
    && ! grep -q "POST /api/niches/config" "$f" \
    && grep -qi "niche-hashtags.md" "$f" \
    && grep -qi "Avatar anlegen\|Avatar erstellen" "$f" \
    && grep -qi "Themen neu ableiten\|neu ableiten" "$f" \
    && grep -qi "self-check\|Selbst-Check\|bestätig" "$f" \
    && echo "OK: attach-endpoint used, no naked-niche POST, ruleset referenced, creation+re-derive triggers, confirm present"
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

- [ ] **Step 1: Retarget the frontmatter `description` to editing/listing** — trigger on "Avatar bearbeiten", "DNA ändern", "Avatar löschen", "meine Avatare zeigen", "Marke bearbeiten"; and **remove the creation triggers** ("Avatar anlegen/erstellen", "neue Persona/Marke") — those now route to `onboarding`. State it edits/lists existing avatars and never creates them.
- [ ] **Step 2: Keep Step 0 (config self-check)** — if not set up, route to `onboarding`.
- [ ] **Step 3: Keep Step 1 (detect existing avatars/brands)** via `GET /api/brands` + `GET /api/brands/{brand_id}/personas`. Change the action menu: (1) Avatar bearbeiten (DNA/Marke), (2) Avatar löschen, ✏️ etwas anderes. **Add: if the user wants to CREATE a new avatar, tell them and route to `onboarding`** ("Neue Avatare legst du im Onboarding-Flow an — soll ich dorthin wechseln?").
- [ ] **Step 4: Keep the editing operations** — `PUT /api/brands/{brand_id}`, `PUT /api/personas/{persona_id}` (re-embeds on DNA change), read-back + Cockpit regen, `DELETE /api/brands/{brand_id}` / `DELETE /api/personas/{persona_id}` (confirm first; note deletion is irreversible AND — per sub-project 1 — deleting an avatar cascade-deletes any niche it solely owns while shared niches keep the link; surface this in the delete confirm).
- [ ] **Step 5: Remove the DNA-creation interview (old Steps 2–4 "create brand / synthesise DNA / create persona") and the create-flow "Done means"** — creation lives in `onboarding` now. Keep DNA *editing* guidance. Keep the honesty rules (never claim created/embedded without read-back) and the credits-free note. Keep the final next-steps block.
- [ ] **Step 6: Self-consistency verification.** Run:
  ```bash
  cd ~/cowork-marketplace && f=plugins/trendfinder/skills/avatar-studio/SKILL.md
  grep -qi "bearbeit\|edit" "$f" \
    && grep -qi "onboarding" "$f" \
    && ! grep -qi "Avatar anlegen\|Avatar erstellen\|create an avatar" "$f" \
    && grep -q "PUT /api/personas\|PUT /api/brands" "$f" \
    && echo "OK: edit-focused, routes creation to onboarding, no create triggers, edit endpoints present"
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
  - `DELETE /api/personas/{persona_id}/niches/{niche_id}` — detach; `204` if ≥1 other avatar remains (link only). **Last** avatar → `409 {"error":"last_avatar",...}` unless `?confirm_delete=true`, which cascade-deletes the niche + its trends/videos/schedules/jobs. `404` foreign.
  - `GET /api/niches/config/{niche_id}/personas` — the niche's linked avatars `[{persona_id, display_name}]`.
  - Note on the existing `GET /api/niches/config` row: it now additionally returns `personas: [{persona_id, display_name}]` per niche.
- [ ] **Step 2: Mark `POST /api/niches/config` plugin-deprecated** — edit its row (line ~34) to add: "**Plugin-deprecated: do NOT create niches here. Niches are created only via `POST /api/personas/{persona_id}/niches` (avatar-first). Endpoint retained for ops/internal only.**"
- [ ] **Step 3: Bump `plugin.json`** — `"version": "0.9.3"` → `"0.10.0"`; update the `description` so the onboarding clause reads avatar-first (the user describes an avatar; niches are derived with AI-derived scrape topics; no hand-typed hashtags). Keep it one sentence, keep the "AI synthesis native, backend only stores/scrapes" axiom.
- [ ] **Step 4: Bump `marketplace.json`** — `"version": "0.9.3"` → `"0.10.0"`; mirror the description change (the plugins[0].description).
- [ ] **Step 5: Update `README.md`** — the components table row for `skills/onboarding` → "avatar-first setup + creation: access → connector → avatar (brand+persona+DNA) → niche(s) with AI-derived scrape topics → Cockpit; also re-derives topics for existing niches"; `skills/avatar-studio` → "edit/list existing avatars"; `reference/niche-hashtags.md` → "the AI topic-derivation ruleset (+ read-skill relevance check)". Update the one-line setup blurb to say the user describes an avatar and never types hashtags.
- [ ] **Step 6: Verification — versions consistent + valid JSON + endpoint documented.** Run:
  ```bash
  cd ~/cowork-marketplace/plugins/trendfinder
  python3 -c "import json; a=json.load(open('.claude-plugin/plugin.json'))['version']; b=json.load(open('.claude-plugin/marketplace.json'))['plugins'][0]['version']; assert a==b=='0.10.0', (a,b); print('versions OK', a)"
  grep -q "personas/{persona_id}/niches" reference/api-contract.md && grep -qi "plugin-deprecated" reference/api-contract.md && echo "contract OK"
  ```
  Expected: `versions OK 0.10.0` and `contract OK`.
- [ ] **Step 7: Commit**
  ```bash
  cd ~/cowork-marketplace && git add plugins/trendfinder/reference/api-contract.md plugins/trendfinder/.claude-plugin/plugin.json plugins/trendfinder/.claude-plugin/marketplace.json plugins/trendfinder/README.md
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
- [ ] **Requirements checklist vs spec** — §3 topology (Task 2/3), §4 flow A–E (Task 2 Steps 4–8), §5 derivation (Task 1 + Task 2 Step 6), §6 re-derive (Task 2 Step 7), §7 edge cases/honesty (Task 2/3), §8 file surface (all tasks).

## Rollout / Verification note

No automated test suite (Markdown skills). **End-to-end verification is a manual walkthrough in Cowork** against the live backend (sub-project 1 is deployed + migrated). The owner runs "richte Trendfinder ein" / "Avatar anlegen" / "Themen neu ableiten" and confirms: no hashtag typing, topics shown for confirm, niche attached to avatar, Dore's niche re-derivable. The in-flow read-backs are the guardrails.

---

## Self-Review Notes (writing-plans)

- **Spec coverage:** §2 decisions → Global Constraints; §3 topology → Task 2 (self-check branch + triggers) + Task 3 (avatar-studio reduce); §4 flow A–E → Task 2 Steps 4–8; §5 derivation → Task 1 + Task 2 Step 6; §6 re-derive → Task 2 Step 7; §7 edge/honesty → Task 2 Steps 6/8/10 + Task 3 Step 4; §8 file surface → Tasks 1–4. All covered.
- **No placeholders:** every step names the exact file, the exact API-call shapes (tf.sh commands verbatim), and a concrete grep/JSON verification. No "add appropriate steps."
- **Consistency:** the attach endpoint `POST /api/personas/{persona_id}/niches` is used identically in Task 2 (Step 6) and documented in Task 4 (Step 1); `PUT /api/niches/config/{niche_id}` for re-derive (Task 2 Step 7) matches the contract; version `0.10.0` used in Task 4 Steps 3–4 + final verification.
- **Markdown-authoring adaptation:** no pytest; each task's "verification" is a self-consistency grep + a skill-reviewer/plugin-validator pass, and the true end-to-end check is the manual Cowork walkthrough (noted). This is honest — the plugin has no test harness.
