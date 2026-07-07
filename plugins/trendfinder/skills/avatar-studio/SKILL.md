---
name: avatar-studio
description: Create and manage Trendfinder avatars (brand + persona + DNA) inside Cowork. Use when the user says "Avatar anlegen", "Avatar erstellen", "create an avatar", "neue Persona", "Marke anlegen", "lege einen Avatar an", "DNA für meinen Avatar", or wants to edit/list their avatars. Synthesises the avatar DNA natively in Claude, then stores it via the tenant-scoped backend. NEVER scrapes, NEVER spends Apify credits.
---

# Trendfinder — Avatar Studio

Goal: create a Trendfinder **avatar** for this tenant and store it on the backend, then show it in the Cockpit. An avatar = a **Brand** (the Marke) plus one or more **Personas** (the avatar that carries DNA). All DNA is synthesised by Claude in this session and POSTed as structured JSON — the backend only stores + embeds (this is the plugin's core axiom).

All API calls use `bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh ...`. Never call tf.sh or curl with an inline key. Read `${CLAUDE_PLUGIN_ROOT}/reference/api-contract.md` (§ "Avatars — Brands, Personas & DNA") before starting — it is the single source of truth for endpoints, ID rules, and the DNA body shape.

**This skill costs nothing.** It never calls an Apify actor and never triggers a scrape. It only writes to the backend's brand/persona tables.

---

## Step 0 — Self-check (config required)

Before anything else:

1. Check whether `{workspace}/.trendfinder/config.json` exists.
2. If it exists, call `bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /health`.

If **either** fails → do NOT proceed. Tell the user:

> "Trendfinder ist noch nicht eingerichtet. Starte bitte zuerst das Onboarding."

Then route to the `onboarding` skill. If both pass → continue.

---

## Step 1 — Detect existing avatars (detect-first)

Fetch the tenant's brands (tenant-scoped — only this tenant's data is returned):

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/brands
```

For each brand, optionally fetch its personas:

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/brands/<brand_id>/personas
```

Present what already exists, then offer the action as a numbered list (Cowork has no buttons — always give numbered options + a free-text escape):

```
Du hast aktuell diese Avatare:
  • Tom Beauty (Marke) → Anna, Lena

Was möchtest du tun?

1) Neuen Avatar (Persona) unter einer bestehenden Marke anlegen
2) Neue Marke + ersten Avatar anlegen
3) Einen bestehenden Avatar bearbeiten
✏️  Etwas anderes (frei eingeben)
```

If the tenant has **zero** brands, skip the menu and go straight to "create a new brand + first avatar" (Step 2 → Step 3).

---

## Step 2 — Create or select the Brand (Marke)

A persona always belongs to a brand. If creating a new brand, ask the user for the brand name and (briefly) its mission + target audience, then build the `brand_id`:

- **Slugify**: lowercase, spaces → hyphens, strip anything not `[a-z0-9-]`. Prefix to keep it unique, e.g. display "Tom Beauty" → `brand_id: "tom-beauty"`.

Write the body to a gitignored temp file and POST it:

```
BRAND_BODY=$(mktemp)   # real temp dir, NOT the synced workspace
echo '{"brand_id":"tom-beauty","display_name":"Tom Beauty","mission":"...","target_audience":"..."}' > "$BRAND_BODY"
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh POST /api/brands @"$BRAND_BODY"
rm -f "$BRAND_BODY" 2>/dev/null || : > "$BRAND_BODY"   # truncate fallback if the mount denies unlink
```

Interpret:
- **201** → brand created; note the returned `brand_id`.
- **409** `{"error":...}` / "already exists" → the slug is taken (globally unique). Pick a more specific slug (e.g. add the tenant name) and retry.
- **422** → a field is malformed (usually `brand_id` not matching `^[a-z0-9-]+$`) — fix the slug and retry.
- **401/400 tenant** → key invalid → route to onboarding.

(The block above cleans up the temp body.) If selecting an **existing** brand, just use its `brand_id`.

---

## Step 3 — Interview + synthesise the DNA (in Claude)

This is the heart of the skill and runs **natively in Claude** — the backend never authors DNA. Ask the user a short, focused set of questions (don't interrogate — 4–6 questions max), e.g.:

- Wie heißt der Avatar, wie alt/welche Persönlichkeit?
- Welche Nische / welche Themen (Content-Pillars)?
- Welcher Ton (locker/seriös, Sprache, Energie)? Was soll vermieden werden?
- Plattform-Fokus (TikTok/Instagram) + grobe Hashtags?

**Fokussiert vs. umfangreich — früh klären, es bestimmt die Tiefe der DNA.** Manche Avatare sind bewusst mono-thematisch (eine Nische, ein Winkel), andere sollen **breit und facettenreich** sein (mehrere Themenwelten, z. B. Business + Persönliches + Fach-Deep-Dives). Frag aktiv: „Soll [Name] ein klares Einzelthema haben oder ein breites Spektrum abdecken?" Bei **breit**:

- Synthetisiere **mehr und breitere `content_pillars`** (4–6 statt 1–2), die die volle Bandbreite abdecken — jede mit eigener `description` + eigenen `topics`. Erzwinge kein Mono-Thema.
- Mach `persona_profile`, `interests` und `origin_story` **reichhaltig** (mehrere Lebens-/Themenstränge, nicht ein einziger), damit das native Trend-Matching in `script-studio` breit greifen kann.
- Der `system_prompt` soll die verschiedenen Register/Themen benennen, in denen der Avatar spricht — nicht nur eins.
- Halte die Nischen-Hashtags trotzdem **spezifisch** (Breite ≠ generische Mega-Tags — siehe `${CLAUDE_PLUGIN_ROOT}/reference/niche-hashtags.md`): breit heißt mehrere präzise Themen-Cluster, nicht `#mindset`.

Then **you (Claude) synthesise** the DNA into the structured body from the contract — `persona_profile`, `tone_of_voice`, `content_pillars`, `system_prompt` (a first-person identity prompt for the avatar), `interests`, and `origin_story`. Fill what you can; every DNA field is optional, so partial DNA is fine for a first pass. Build the `persona_id` by slugifying the name and prefixing the brand, e.g. `tom-beauty-anna`. **Für einen umfangreichen Avatar: liefere echte Breite in den Pillars/Interests — ein Avatar, dessen ganze DNA um ein einziges Thema kreist, wirkt „zu mono-nischig".**

**Show the synthesised DNA to the user and get a quick confirm before writing it.** This is their avatar's identity — let them correct it.

---

## Step 4 — Create the Persona

Write the confirmed DNA body to a temp file and POST under the brand:

```
PERSONA_BODY=$(mktemp)   # real temp dir, NOT the synced workspace
echo '{ ...full DNA persona body... }' > "$PERSONA_BODY"
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh POST /api/brands/<brand_id>/personas @"$PERSONA_BODY"
rm -f "$PERSONA_BODY" 2>/dev/null || : > "$PERSONA_BODY"   # truncate fallback if unlink denied
```

Interpret:
- **201** → persona created (the backend auto-embeds DNA best-effort on save).
- **409** → `persona_id` taken → pick a more specific slug and retry.
- **404** "Brand not found" → the brand_id isn't this tenant's → re-resolve from Step 1.
- **422** → malformed field → fix and retry.

(The block above cleans up the temp body.)

---

## Step 5 — Embed the DNA (make it searchable)

Trigger the manual embed so the avatar's DNA is vectorised and can personalise trends:

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh POST /api/personas/<persona_id>/embed-dna
```

Interpret **honestly**:
- **200** `{"status":"embedded", "vector_dims":N}` → DNA is searchable. Say so.
- **503** → the backend has no Google embedder configured. The avatar **still exists and is fully usable**; only vector-matching to trends is unavailable until an embedder key is set on the backend. Tell the user exactly that — do NOT claim the DNA is embedded.
- **400** "no DNA text" → the persona was created without DNA fields; offer to add DNA via edit, then re-embed.

---

## Step 6 — Confirm by reading back, then refresh the Cockpit

Never claim the avatar exists on assertion. Read it back:

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/personas/<persona_id>
```

Only if this returns the persona (200) → regenerate the Cockpit so the Avatare tab shows it:

```
if command -v bun >/dev/null 2>&1; then bun ${CLAUDE_PLUGIN_ROOT}/skills/cockpit/scripts/cockpit.ts <workspace_root>; else node --experimental-strip-types ${CLAUDE_PLUGIN_ROOT}/skills/cockpit/scripts/cockpit.ts <workspace_root>; fi
```

Present the regenerated Cockpit as the Live Artifact and point the user to the new avatar in the Avatare tab. Report the embed status from Step 5 truthfully.

---

## Editing an existing avatar

- Update brand: `PUT /api/brands/<brand_id>` with the changed fields.
- Update persona DNA: `PUT /api/personas/<persona_id>` with the changed fields (backend re-embeds automatically if a DNA field changed). Then read back + regenerate the Cockpit.
- Delete: `DELETE /api/brands/<brand_id>` or `DELETE /api/personas/<persona_id>` (204). Confirm with the user first — deletion is irreversible.

---

## Honesty & safety rules

- **Never claim an avatar was created until `GET /api/personas/{id}` returns it (200) AND the DNA fields you sent are present in the response.** A 200 that silently dropped `persona_profile`/`tone_of_voice` is not a successfully stored avatar — re-check the body and retry.
- **Never claim DNA is embedded unless `embed-dna` returned 200.** A 503 means the avatar is *angelegt, aber noch nicht eingebettet*: it exists and is editable, but won't surface in trend-matching (its whole purpose) until an embedder key is configured on the backend. Say exactly that — don't present a 503 avatar as ready.
- DNA is synthesised by Claude in-session, never by the backend. Always show the synthesised DNA and get confirmation before writing it.
- This skill never calls an Apify actor and never spends credits. If the user wants new trend data, route to `scrape-now`.
- Tenant isolation is automatic server-side, but only ever pass `brand_id`/`persona_id` values obtained from `GET /api/brands` in this tenant context — never a guessed slug for an existing resource.
- Never print or commit the API key. Write request bodies via `mktemp` — a real temp dir OUTSIDE the synced workspace, never into `{workspace}/.trendfinder/` next to `config.json`. Clean up after success with `rm`, falling back to truncate (`: > "$f"`) because the Cowork workspace mount can deny `unlink`. On failure, report the temp path.

---

## Done means

- Config present and `/health` 200.
- Brand created (201) or an existing tenant brand selected.
- DNA synthesised in Claude, shown to the user, confirmed.
- Persona created (201) and read back via `GET /api/personas/{id}` (200).
- `embed-dna` result reported honestly (embedded / 503-not-configured / 400-no-DNA).
- Cockpit regenerated; the new avatar appears in the Avatare tab.
- No key printed, no `.trendfinder/` file committed, no Apify actor called.

---

## Abschluss (PFLICHT) — Next-Steps-Auswahlblock

Beende deine Antwort IMMER mit dem interaktiven **Auswahlblock** (die selektierbaren Options-UI-Blöcke, die Cowork rendert) — Spezifikation: `${CLAUDE_PLUGIN_ROOT}/reference/next-steps.md`. Zeige alle im aktuellen Zustand sinnvollen Optionen und markiere **genau eine** als ⭐ Empfehlung, passend zu dem, was du gerade getan hast. Nutze die ⭐-Kontext-Tabelle und die Zustands-Regeln aus dieser Datei.
