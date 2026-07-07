---
name: avatar-studio
description: Edit, list, and delete existing Trendfinder avatars (brand + persona + DNA) inside Cowork. Use when the user says "Avatar bearbeiten", "DNA ändern", "Avatar löschen", "meine Avatare zeigen", "Marke bearbeiten", or otherwise wants to view, change, or remove an avatar that already exists. This skill only edits and lists — it never originates a Brand, Persona, or avatar; new ones are set up via the `onboarding` skill. NEVER scrapes, NEVER spends Apify credits.
---

# Trendfinder — Avatar Studio

Goal: edit, list, or delete existing Trendfinder **avatars** for this tenant and reflect the change in the Cockpit. An avatar = a **Brand** (the Marke) plus one or more **Personas** (the avatar that carries DNA). This skill never originates a Brand or Persona — the first avatar (or any additional one) is created in the `onboarding` skill. Here, DNA changes are synthesised by Claude in this session and PUT as structured JSON — the backend only stores + re-embeds (this is the plugin's core axiom).

All API calls use `bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh ...`. Never call tf.sh or curl with an inline key. Read `${CLAUDE_PLUGIN_ROOT}/reference/api-contract.md` (§ "Avatars — Brands, Personas & DNA") before editing — it is the single source of truth for endpoints, ID rules, and the DNA body shape.

**This skill costs nothing.** It never calls an Apify actor and never triggers a scrape. It only reads and updates the backend's brand/persona tables.

---

## Step 0 — Self-check (config required)

Before anything else:

1. Check whether `{workspace}/.trendfinder/config.json` exists.
2. If it exists, call `bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /health`.

If **either** fails → do NOT proceed. Tell the user:

> "Trendfinder ist noch nicht eingerichtet. Starte bitte zuerst das Onboarding."

Then route to the `onboarding` skill. If both pass → continue.

---

## Step 1 — Detect existing avatars, then choose an action

Fetch the tenant's brands (tenant-scoped — only this tenant's data is returned):

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/brands
```

For each brand, fetch its personas:

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/brands/<brand_id>/personas
```

**If there are no personas anywhere** (no brands yet, or brands that have no personas under them), there is nothing to edit or list yet — don't dead-end. Say so and offer the switch:

> "Du hast noch keinen Avatar. Den ersten richtest du im Onboarding-Flow ein — soll ich dorthin wechseln?"

Then route to the `onboarding` skill.

Otherwise, present what already exists, then offer the action as a numbered list (Cowork has no buttons — always give numbered options + a free-text escape):

```
Du hast aktuell diese Avatare:
  • Tom Beauty (Marke) → Anna, Lena

Was möchtest du tun?

1) Avatar bearbeiten (DNA/Marke)
2) Avatar löschen
✏️  Etwas anderes (frei eingeben)
```

**If the free-text answer shows the user actually wants a new avatar** (not an edit), don't try to synthesise DNA here — tell them and offer the switch:

> "Neue Avatare legst du im Onboarding-Flow an — soll ich dorthin wechseln?"

Then route to the `onboarding` skill.

---

## Step 2 — Edit the Brand or the Persona DNA

### Editing the Brand (Marke)

Ask which fields change (`display_name`, `mission`, `target_audience`), show the proposed values, get confirmation, then:

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh PUT /api/brands/<brand_id> @"$BODY"
```

### Editing the Persona DNA

DNA fields are the same shape documented in the contract — `persona_profile`, `tone_of_voice`, `content_pillars`, `system_prompt`, `interests`, `origin_story` — all optional, so a partial edit is fine. Ask the user what should change (a single field, a tone shift, a pillar added or removed, a broader identity revision), synthesise only the delta, and **show the proposed new DNA and get a quick confirm before writing it** — this is their avatar's identity.

Write the confirmed body to a gitignored temp file and PUT it:

```
BODY=$(mktemp)   # real temp dir, NOT the synced workspace
echo '{"tone_of_voice":"...", "content_pillars":[...]}' > "$BODY"
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh PUT /api/personas/<persona_id> @"$BODY"
rm -f "$BODY" 2>/dev/null || : > "$BODY"   # truncate fallback if the mount denies unlink
```

Interpret:
- **200** → updated. If a DNA field changed, the backend re-embeds best-effort — report the embed status honestly (see Honesty rules below).
- **404** → the `brand_id`/`persona_id` isn't this tenant's → re-resolve from Step 1.
- **422** → a field is malformed → fix and retry.

(The block above cleans up the temp body.)

### Confirm by reading back, then refresh the Cockpit

Never claim an edit landed on assertion. Read it back:

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh GET /api/personas/<persona_id>
```

Only if the changed fields are actually present in the response → regenerate the Cockpit so the Avatare tab reflects the change:

```
if command -v bun >/dev/null 2>&1; then bun ${CLAUDE_PLUGIN_ROOT}/skills/cockpit/scripts/cockpit.ts <workspace_root>; else node --experimental-strip-types ${CLAUDE_PLUGIN_ROOT}/skills/cockpit/scripts/cockpit.ts <workspace_root>; fi
```

Present the regenerated Cockpit as the Live Artifact.

---

## Step 3 — Delete a Brand or Persona

Deletion is **irreversible** — always confirm with the user first, and always surface the cascade before they confirm:

> "Wenn du diesen Avatar/diese Marke löschst, werden auch alle Nischen gelöscht, die ausschließlich diesem Avatar gehören. Nischen, die sich mehrere Avatare teilen, bleiben erhalten — nur die Verknüpfung zu diesem Avatar verschwindet. Fortfahren?"

Only after explicit confirmation:

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh DELETE /api/personas/<persona_id>
```

or

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/tf.sh DELETE /api/brands/<brand_id>
```

Both return **204** on success. Read back with `GET /api/brands` (or `.../personas`) to confirm the entry is actually gone before telling the user it's deleted, then regenerate the Cockpit so the Avatare tab (and any niche list) reflects the removal.

---

## Honesty & safety rules

- **Never claim an edit landed until `GET /api/personas/{id}` (or `/api/brands/{id}`) returns it (200) AND the fields you changed are present in the response.** A 200 that silently dropped a field is not a successfully stored edit — re-check the body and retry.
- **Never claim DNA is (re-)embedded unless the backend confirms it.** `PUT /api/personas/{id}` re-embeds best-effort when a DNA field changes; if no embedder is configured on the backend this silently stays unvectorised — the persona is still fully usable, just not yet searchable for trend-matching. To confirm or retry, call `POST /api/personas/{id}/embed-dna` and interpret honestly: `200` embedded, `503` no embedder configured, `400` no DNA text yet.
- **Never claim a delete succeeded until a read-back confirms the record is gone** (404 on re-fetch, or absent from the `GET /api/brands` / `.../personas` listing).
- DNA edits are synthesised by Claude in-session, never by the backend. Always show the synthesised DNA and get confirmation before writing it.
- This skill never calls an Apify actor and never spends credits. If the user wants new trend data, route to `scrape-now`.
- Tenant isolation is automatic server-side, but only ever pass `brand_id`/`persona_id` values obtained from `GET /api/brands` in this tenant context — never a guessed slug for an existing resource.
- Never print or commit the API key. Write request bodies via `mktemp` — a real temp dir OUTSIDE the synced workspace, never into `{workspace}/.trendfinder/` next to `config.json`. Clean up after success with `rm`, falling back to truncate (`: > "$f"`) because the Cowork workspace mount can deny `unlink`. On failure, report the temp path.

---

## Abschluss (PFLICHT) — Next-Steps-Auswahlblock

Beende deine Antwort IMMER mit dem interaktiven **Auswahlblock** (die selektierbaren Options-UI-Blöcke, die Cowork rendert) — Spezifikation: `${CLAUDE_PLUGIN_ROOT}/reference/next-steps.md`. Zeige alle im aktuellen Zustand sinnvollen Optionen und markiere **genau eine** als ⭐ Empfehlung, passend zu dem, was du gerade getan hast. Nutze die ⭐-Kontext-Tabelle und die Zustands-Regeln aus dieser Datei.
