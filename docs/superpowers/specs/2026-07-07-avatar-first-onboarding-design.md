# Design Spec — Avatar-First Onboarding + KI-abgeleitete Scrape-Themen

**Date:** 2026-07-07
**Status:** Approved in brainstorming (5 sections), pending user review → implementation plan
**Repo:** `~/cowork-marketplace` (Cowork-Plugin `trendfinder`, reines Markdown/Skill-Repo)
**Sub-project:** 2 of 3 of the "avatar-first, on-topic scraping" redesign.
Order: (1) Backend data model [done, PR #2] → **(2) Avatar-first onboarding + AI-derived scrape inputs [this spec]** → (3) Relevance filter.

---

## 1. Context & Problem

Today the user **types scrape hashtags by hand** during onboarding (`onboarding` Step 3, per-platform). That is the exact failure that produced the Dore bug: generic English mega-tags (`#mindset`, `#highperformer`) pulled global tech/gym/hustle content and made her trends unusable. Heavy AI *guidance* was bolted on after the fact, but the user still enters the tags.

Separately, avatar creation (`avatar-studio`) is an optional, separate flow — niche and avatar are independent in the old model.

Sub-project 1 (backend, PR #2) already inverted the data model: niches are created via `POST /api/personas/{id}/niches` (avatar-first), the niche owns the shared scrape config, and avatar↔niche is n:m.

**This sub-project makes the plugin avatar-first and removes hand-typed hashtags:** the user describes their avatar via a short questionnaire; Claude **derives** the scrape topics (hashtags + keywords) natively, self-checks them against the quality rules, shows them for a light confirm, and attaches the niche to the avatar. Plus a **re-derive** path fixes existing niches (Dore) going forward. Pure plugin work — no backend change.

## 2. Locked Decisions (from brainstorming)

1. **Derivation UX = show + light confirm.** Claude derives the topics, shows the list ("ich scrape zu diesen Themen: … — passt das?"), the user can nudge. Same idiom as avatar-studio's DNA-confirm. NOT fully autonomous, NOT silent.
2. **Input scope = topics only (hashtags + keywords), plugin-only.** Claude derives TikTok/IG hashtags + YouTube search queries — exactly what the niche config already supports. **Seed-accounts are out of scope** (would need a backend field + scraper wiring). No backend change.
3. **Covers existing avatars too.** New avatar-first creation **plus** a "re-derive topics" path for existing niches (derive from the linked avatar's DNA → confirm → `PUT` the niche config). Fixes Dore's existing setup going forward.
4. **Structure = one unified onboarding skill (owner choice, option ②).** The `onboarding` skill becomes the avatar-first *creation* flow, gated by its Step-0 self-check to serve both first-run setup and "add an avatar later." `avatar-studio` is reduced to editing/listing existing avatars.
5. **Flow order = A avatar/DNA → B niche(s) from avatar → C derive topics → D attach → E cockpit** (§4).

## 3. Skill Topology & Routing

**`onboarding` becomes the avatar-first creation flow** (built out in the existing skill — no new skill name, less churn). It is no longer "first-run only"; it is avatar+niche *creation* itself.

- **Step-0 self-check branches:**
  - No `{workspace}/.trendfinder/config.json` → run access + Apify-connector steps first (as today), then enter the avatar flow.
  - Config already present → jump straight into the avatar flow (skip connection steps). The **same** skill thus serves "richte Trendfinder ein" (first run) and "leg noch einen Avatar an" (later) — the dual role option ② requires.
- **Trigger reassignment:**
  - `onboarding` (the unified flow) now triggers on: "richte Trendfinder ein", **"Avatar anlegen/erstellen", "neue Persona/Marke"** — anything that *creates* an avatar.
  - `avatar-studio` shrinks to **editing/listing**: "Avatar bearbeiten", "DNA ändern", "Avatar löschen", "meine Avatare zeigen". It no longer creates avatars; it keeps its credits-free property.
- **Detect-first stays:** with existing avatars/niches (e.g. Dore post-migration), the flow shows them first and offers: new avatar, extend existing, or re-derive topics.

**Why:** a single avatar+niche creation path, gated by the self-check — no duplication between "first-run" and "later." `avatar-studio` remains for pure editing (a different job than creating).

## 4. Avatar-First Creation Flow

After the self-check (connection established), the flow is linear:

**A — Avatar (questionnaire → DNA).** Short questionnaire (4–6 questions, not an interrogation): name/personality, niche/topics, tone & language, platform focus, focused-vs-broad. Claude **synthesises the DNA natively** (persona_profile, tone_of_voice, content_pillars, system_prompt, interests, origin_story) — exactly as avatar-studio does today. **Brand step is select-or-create** (mirroring avatar-studio Step 2): if the tenant already has a brand and this avatar belongs under it, select it; otherwise create a new brand (`POST /api/brands`). Then **show DNA → confirm → create persona** under that brand (`POST /api/brands/{brand_id}/personas`). No hashtags in sight.

**B — Derive niche(s) from the avatar.** From `content_pillars` Claude determines which **niche(s)** the avatar covers:
- Mono-avatar → 1 niche. Broad avatar → several (e.g. "Skincare" + "Longevity").
- **Detect-first / n:m payoff:** before creating a new niche, the flow checks the tenant's existing niches (`GET /api/niches/config`); if the theme overlaps, it offers to **attach to an existing niche** (shared, via attach-existing) instead of creating a duplicate. This is the point of sub-project 1's n:m.
- The user confirms the niche split ("one niche, or split into these two?").

**C — Derive topics per niche (the novelty).** For each *new* niche, Claude derives the scrape topics — TikTok/IG hashtags + YouTube queries — from niche theme + avatar DNA + **language/region** (DACH → German tags). Detail in §5. **Show list → light confirm/nudge** (locked decision 1).

**D — Attach (sub-project-1 endpoint).**
- New niche: `POST /api/personas/{persona_id}/niches` with `display_name` + derived `tiktok_hashtags`/`instagram_hashtags`/`youtube_search_queries` (create-and-attach shape).
- Existing (shared) niche: same endpoint with `{"niche_id": …}` (attach-existing).
- **Read back** and confirm the hashtags actually landed in the fields (not empty) — the existing honesty rule.

**E — Cockpit + first scrape.** Regenerate the Cockpit, offer the first scrape (→ `scrape-now`). This flow does not scrape itself; it offers it (credits-free principle preserved).

**Net for the user:** they describe their avatar and get avatar + on-topic-scraped niche(s) without ever typing a hashtag; they see the topics once, to check.

## 5. AI Topic-Derivation (the core novelty)

Replaces "user types hashtags" with "AI derives + self-checks + shows for confirm."

**Derivation inputs:** niche theme (from `content_pillars`) · avatar DNA (tone, `interests`, `origin_story` → angle signals) · **language/region** (inferred from DNA or asked once).

**Derivation:** Claude generates 5–10 precise, theme-defining tags/queries per platform:
- TikTok/IG: concrete topic/format hashtags in the **correct language** (DACH → German).
- YouTube: natural-language search queries.

**Self-check BEFORE showing (first line of defence).** Before presenting, Claude checks the list against the quality rules in `reference/niche-hashtags.md` and drops anything that violates them:
- no generic mega-tags (`#mindset`, `#highperformer`, `#viral`, `#fyp`) — these pulled Dore's off-topic content;
- no wrong language (English tags for a DACH audience → US content);
- no abstract brand values (`#lebendigkeit`) instead of concrete topics (`#atemübung`);
- 5–10 precise, not 15 broad.

This is the key change from today: the niche-hashtags.md rules are no longer *hints for the typing user* but the **derivation ruleset Claude applies to itself**. The file is rewritten accordingly (rules unchanged; framing shifts from "guide the user" to "derive per these rules").

**Show + nudge loop:** list grouped by platform, with a one-line rationale ("deutsche, themen-spezifische Tags für [Niche], keine breiten Mega-Tags"). The user can nudge ("mehr zu X", "das Tag raus", "eher englisch") → Claude adjusts → re-show → until confirmed. On an uncertain niche, Claude asks **one** clarifying question rather than guessing badly.

**Only after confirmation** → Attach (§4 D).

## 6. Re-Derive for Existing Niches (Dore's fix, going forward)

Pure reuse of the §5 logic, with three differences:

**Entry:** "Themen neu ableiten" / "Hashtags meiner Niche verbessern" — plus as an option in the detect-first list (§3) when existing niches are shown.

**Flow:**
1. **Pick a niche** (from `GET /api/niches/config`).
2. **Derivation lens = the linked avatar.** Post-migration the niche hangs off ≥1 avatar; its DNA is the derivation lens (multiple linked avatars: ask which, or use the niche theme itself). If a niche is exceptionally avatar-less → offer to link an avatar first.
3. **Derive topics** (identical to §5: generate → self-check against niche-hashtags.md → …).
4. **Show a current-vs-proposed diff** — the Dore moment: "Currently you scrape with `#mindset #highperformer #techtok`… → proposed: `#persönlichkeitsentwicklung #achtsamkeit …`". The user sees the improvement directly. Confirm/nudge.
5. **`PUT /api/niches/config/{niche_id}`** with the new hashtags/queries → **read back**, confirm they landed.
6. **No auto-scrape** — a config update does not scrape. Then offer a fresh scrape (→ `scrape-now`) so the better tags take effect. Honest note: the *old* already-scraped videos remain; only the new scrape pulls the better ones.

**Concretely for Dore:** her niche `dore-rewiring--highenergy` hangs off her avatar after the migration → re-derive takes that DNA, shows the diff against her current broad tags, she confirms, `PUT`, re-scrape. Her original problem is solved going forward — user-side, without anyone hand-setting tags.

## 7. Edge Cases & Honesty

**Edge cases:**
- **Connector not connected** → avatar + niche are still created (pure backend writes); only the scrape waits until connected. Never gate (as today).
- **Broad avatar → multiple niches**: create-and-attach each.
- **Second avatar onto an existing (shared) niche** → attach-existing only, **no** topic re-derivation: the shared niche keeps its one scrape config (sub-project-1 decision: shared = one pool). Derivation only happens for *new* niches.
- **No more naked niches**: the plugin path `POST /api/niches/config` is dropped — every niche is born via an avatar (sub-project-1 lock "no path to naked niches"). The old "add a niche directly" branch is removed from onboarding.
- **Slug collision** (globally unique) → prefix with tenant/avatar, retry (existing pattern). **Attach 409** (already linked) → handle gracefully.
- **embed-dna 503** → avatar exists & is usable, only vector-matching is missing; report honestly (existing rule).

**Honesty (carried over):** never claim "created" without a read-back; never claim "embedded" without a 200; always show derived topics + confirm before writing; report the scrape separately and honestly.

## 8. File Change Surface (plugin-only, no backend)

- `skills/onboarding/SKILL.md` — **core rewrite**: unified avatar-first flow (self-check branching, A–E, re-derive path, trigger expansion).
- `skills/avatar-studio/SKILL.md` — reduced to **editing/listing** (creation removed, triggers/description adjusted).
- `reference/niche-hashtags.md` — rewritten into the **derivation ruleset**.
- `reference/api-contract.md` — document niche creation = `POST /api/personas/{id}/niches`; mark `POST /api/niches/config` as plugin-deprecated.
- `.claude-plugin/plugin.json` + `.claude-plugin/marketplace.json` + `README.md` — version bump + "avatar-first onboarding" description.
- Cross-check `scrape-now` / `trend-radar` / `trend-briefing` references to niche-hashtags.md still align after its reframe.

## 9. Verification

No test suite (Markdown skills). **Verification = manual walkthrough** of the flow + the in-flow read-backs (the honesty checks are the guardrails). Because it is Markdown-only with no code deps, the build can proceed now; **end-to-end live testing requires sub-project 1 live** (PR #2 merged + deployed + migration run) so the attach endpoints exist.

## 10. Dependency

Sub-project 2 is plugin markdown that **calls sub-project-1's endpoints** (`POST /api/personas/{id}/niches`, `GET /api/niches/config`, `PUT /api/niches/config/{id}`). It functions live only once PR #2 is merged, deployed, and its migration has run. Building the skill text now is safe and independent; shipping/using it depends on sub-project 1.

## 11. Out of Scope (later)

- **Seed-account scrape inputs** → needs a backend niche-config field + scraper wiring; deferred (decision 2).
- **Relevance filter — Stufe A (plugin post-scrape) + Stufe B (backend semantic gate)** → sub-project 3.
- **Backend changes of any kind** → none in this sub-project.

## 12. Open Questions

None. All design decisions resolved in brainstorming.
