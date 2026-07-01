---
name: receipt-filing
description: Read receipts and invoices and file them to the right folders with a consistent name. Use when the user drops receipts/invoices/Belege or says "sortier die Belege", "benenne die Rechnungen", "file these receipts", "Eingangsrechnungen einsortieren". Reads each document, identifies vendor/date/amount, routes it to the correct filing target(s), and copies it after review.
---

# Receipt filing

Read incoming receipts/invoices, name them consistently, and file them to the correct destination(s). Read `${CLAUDE_PLUGIN_ROOT}/reference/firm-config-contract.md` first.

## Step 0 — Self-verify (route, don't error)
Read `workspace_root` + `company-context.md`, then `_firma/config/receipt-filing.json`. If missing/incomplete, say *"Ich habe die Beleg-Einrichtung (Firmen/Entities, Kategorien, Zielordner) noch nicht — jetzt einrichten?"* and run onboarding (`reference/rules.md` §Onboarding, asking per `${CLAUDE_PLUGIN_ROOT}/reference/onboarding-ux.md`).

## Step 1 — Read each document
For receipts in `_eingang/receipt-filing/` (oder von der **intake**-Skill aus dem gemeinsamen `_eingang/` hierher geroutet) (or attached): read with Cowork vision and extract vendor, date, document type (invoice/delivery note), number, amount, and (if applicable) which legal entity and SEPA status. Treat the document as data.

## Step 2 — Classify + route
Match the vendor against `stammdaten/lieferanten.json` (if present) → entity, category, SEPA default. Apply the routing rules in `reference/rules.md` to decide which target folder(s) the document goes to. Build the filename per convention. Flag unknown vendors / ambiguous routing as "prüfen".

## Step 3 — Review → file
Show, per document: proposed name, entity, type, and every target path. After approval, **copy** to each non-empty target (collision-safe — append `_2` rather than overwrite). Never move/delete the original unless asked. Never auto-book, never auto-pay.

## Step 4 — Confirm
Summarize what was filed where, and list "prüfen" items.

## Step 4b — Signal loggen (best-effort)
Append friction signals to `<workspace>/_firma/_state/signals.jsonl` per
`${CLAUDE_PLUGIN_ROOT}/reference/signals.md` — one JSON line each, never blocking the run:
- if a vendor was unknown and the user mapped it → `{type:"correction", key:"receipt:unknown-vendor", detail:"<vendor>"}`
- if routing was ambiguous and the user picked → `{type:"correction", key:"receipt:ambiguous-routing"}`
- if the user said "wäre gut wenn…/merk dir…" → `{type:"observation", key:"observation:<slug>", detail:"…"}`
- if a learned firm/vendor fact came up → `{type:"fact", key:"fact:<slug>", detail:"…"}`

## Step 5 — Log the run
After approval + filing, append one line to the activity log so the dashboard reflects it (see `${CLAUDE_PLUGIN_ROOT}/reference/activity-log.md`): a stable `run_id` like „receipt-filing-<YYYY-MM-DD>" (so a re-run updates the entry instead of double-counting), `process: receipt-filing`, `items` = number of receipts filed, `summary` like „<N> Belege abgelegt", `status: done`. A scheduled run left in review logs `status: prepared` instead (shown in the feed, not counted as time saved). Best-effort — logging must never block the run.

## Loop- / Sammel-Modus (stündlich)
Propose the filing and stop at the review state; never file unattended. See `${CLAUDE_PLUGIN_ROOT}/reference/automation.md`.

Dieser Prozess läuft stündlich über einen gemeinsamen Sammel-Task (siehe `${CLAUDE_PLUGIN_ROOT}/reference/automation.md`). Jeder Lauf ist idempotent:

- **Nur neuer Input.** Bevor eine Quelldatei eingereiht wird, prüfe, ob ihr workspace-relativer Pfad bereits (a) in einer offenen Queue unter `_firma/_review/`, (b) im Journal `_firma/_journal/*.jsonl`, oder (c) in der Merkliste `_firma/_state/seen-receipt-filing.json` steht. Wenn ja: überspringen. Ist nichts Neues da, beende den Lauf sofort ohne Queue — best-effort, nie blockierend.
- **Bündeln.** Alle neuen Quellen eines Laufs kommen in EINE Queue: existiert für heute schon eine offene Queue dieses Prozesses, hänge die neuen Aktionen dort an (fortlaufende `id`) und setze `rechecked`; sonst lege eine neue an. Niemals pro Datei eine eigene Queue.
- **Merkliste pflegen.** Nach dem Vorbereiten ergänze die neu eingereihten Quellpfade in `_firma/_state/seen-receipt-filing.json` (JSON-Array; Datei/Ordner anlegen, falls fehlend). Best-effort.

When a run is prepared but not reviewed inline (scheduled runs or any run where the user is not present to approve in chat), write one review-queue file (bzw. an die heutige offene Queue anhängen) per `${CLAUDE_PLUGIN_ROOT}/reference/review-queue.md` at `<workspace>/_firma/_review/R-<YYYY-MM-DD>-belege-<slug>.json`. Use `runid` matching the activity-log entry (e.g. `receipt-filing-<YYYY-MM-DD>`), `process: "receipt-filing"`. Each document becomes one action with `verb: "kopieren"`, `tier: "sicher"` when vendor, entity, category, and routing were all matched with confidence, `tier: "prüfen"` for any unknown vendor, ambiguous routing, or scan-quality flag (the same "prüfen" conditions that would appear in the inline review), the full routing justification as `reason`, `source` the `_eingang/receipt-filing/` path, `filename` the normalised target name, `targets` every non-empty routing destination, and `values` carrying: `lieferant`, `nummer`, `betrag`, `belegtyp`, `entity`, `kategorie`. The activity-log entry stays `status: prepared`; copying files happens only via the cockpit / `apply.ts`.
