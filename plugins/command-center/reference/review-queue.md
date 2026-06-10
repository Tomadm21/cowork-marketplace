# Review Queue contract — how processes hand work to the cockpit

A **review queue** is the handoff layer between a prepared workflow run and the workspace.
When a process finishes its analysis it writes one JSON file; nothing is copied or moved until
a human explicitly approves. The cockpit (Live Artifact dashboard) reads the open queues,
groups actions by tier, and lets the reviewer approve them individually, in bulk, or reject
them. Only the apply engine ever touches workspace files — skills write queues, the engine
applies them.

---

## File location & naming

| Path | Purpose |
|---|---|
| `<workspace>/_firma/_review/R-<YYYY-MM-DD>-<slug>.json` | one file per prepared run (open) |
| `<workspace>/_firma/_review/_erledigt/` | archive — empty queues are moved here |
| `<workspace>/_firma/_journal/<YYYY-MM>.jsonl` | journal — one line per applied action |

`slug` should match the process + a short differentiator, e.g. `belege-a`, `tagesbericht-2026-06-10`.
The filename becomes the `runid` (without the `.json` extension) and must be stable after creation.

---

## Queue schema (top-level fields)

| Field | Type | Required | Notes |
|---|---|---|---|
| `runid` | string | yes | Stable identifier; matches `activity-log` `run_id`; equals the filename without `.json` |
| `process` | string | yes | Process key: `receipt-filing`, `invoicing`, `daily-report`, `photo-sorting`, `lead-gen` |
| `created` | string | yes | ISO 8601 timestamp; offset allowed (e.g. `+00:00`) |
| `rechecked` | string | no | ISO 8601 timestamp; updated when a process re-analyses an existing queue |
| `origin` | string | yes | `hintergrund` (background skill), `interaktiv`, or similar free-form tag |
| `headline` | string | yes | One-sentence human summary shown in the cockpit header |
| `actions` | array | yes | Ordered list of action objects — see below |

Example top-level object (actions omitted):

```json
{
  "runid": "R-2026-06-08-belege-a",
  "process": "receipt-filing",
  "created": "2026-06-08T15:24:04+00:00",
  "rechecked": "2026-06-08T16:16:21+00:00",
  "origin": "hintergrund",
  "headline": "3 Belege — alle zur Prüfung (2 Scans unklar, 1 Kategorie korrigieren)",
  "actions": [...]
}
```

---

## Action schema

Each element of `actions` is one discrete file-copy proposal.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | number | yes | Unique within this queue file; used to target `approve`/`reject` commands |
| `verb` | string | yes | Human-readable operation label, e.g. `"kopieren"` |
| `tier` | string | yes | `sicher` \| `prüfen` \| `folgenreich` — see Tier semantics |
| `confidence` | string | no | `"prüfen"` overrides a `sicher` tier for display purposes (see note below) |
| `reason` | string | yes | The **Begründung** shown in the cockpit — full sentences; cite what was verified, what is uncertain, what the reviewer should check |
| `source` | string | yes | Workspace-relative path to the source file (relative to workspace root) |
| `filename` | string | yes | Target filename (may differ from source basename after normalisation) |
| `targets` | array of strings | yes | Workspace-relative destination directories; engine copies `filename` into each |
| `values` | object | yes | Key-value fields shown as **Vorschlag** in the cockpit — see conventional keys below |

### `values` conventional keys

| Key | Example | Notes |
|---|---|---|
| `lieferant` | `"Heinz Wilmers GmbH"` | Vendor or counterparty name |
| `nummer` | `"2605176"` | Invoice or delivery-note number |
| `betrag` | `"476,00 EUR"` | Amount with currency |
| `belegtyp` | `"RG"` / `"LF"` | Document type: `RG` = Rechnung, `LF` = Lieferschein |
| `entity` | `"GB"` | Short entity code (e.g. `GB` for Galant Bau) |
| `kategorie` | `"Kfz/Fahrzeug (Abschleppen)"` | Booking category for the reviewer |
| `datum` | `"2026-05-11"` | Document date (conventional, not enforced by engine) |
| `verifiziert` | `true` | Set when the process has positively verified the reading |

Only keys relevant to the document type need to be present. The engine does not validate or use `values` — they are display-only metadata for the cockpit.

> **Engine display note:** `title_of()` in the engine derives the cockpit row title from
> `values.lieferant`, `values.nummer`, and `values.betrag` (or `belegtyp=="LF"` fallback).
> Populating these fields makes the review list more readable.

---

## Tier semantics

| Tier | Display shorthand | Meaning | Bulk approval |
|---|---|---|---|
| `sicher` | `s` | Engine is confident; standard copy to a well-known target | Approved with `approve-safe` — all `sicher` actions across all open queues in one call |
| `prüfen` | `p` | Human should verify before approving (category mismatch, scan quality, etc.) | Individual only |
| `folgenreich` | `f` | Consequential action; always approved one-by-one | Never bulk |

> **Confidence override:** if an action has `"tier": "sicher"` but `"confidence": "prüfen"`,
> the engine treats it as `prüfen` for display and bulk-approval purposes. This allows a process
> to flag a technically valid copy that still warrants a second look without changing the structural
> tier. See the real sample above for an example.

---

## Lifecycle

```
process writes queue file            → status: prepared  (activity log)
         ↓
cockpit reads all *.json in _review/  → grouped by process, sorted by tier
         ↓
reviewer takes action per action id
         ↓
  approve (individual)   → collision-safe copy to every target dir
                         → journal record appended
                         → action removed from queue
  ─────────────────────────────────────────────────────────────
  approve-safe (bulk)    → same as approve, for ALL sicher-tier
                           actions across ALL open queue files
  ─────────────────────────────────────────────────────────────
  reject                 → action removed from queue, nothing copied
         ↓
queue with zero remaining actions
  → file moved to _erledigt/          → run considered done
```

### Collision-safe copy

When copying `filename` into a target directory, the engine checks for an existing file with
the same name. If one exists it appends `_2`, `_3`, … until the path is free. The chosen
destination path (not the input) is what appears in the journal.

### Journal record format

One JSON line per applied action appended to `_firma/_journal/<YYYY-MM>.jsonl`:

```json
{ "ts": "2026-06-08T16:21:07.123456", "verb": "kopieren", "source": "_eingang/receipt-filing/Heinz Wilmers GmbH RG 2605176 von 11.05.2026 - 476 EUR.pdf", "target": "001 Galant Bau GmbH/001. Buchhaltung/Buchhaltung 2026/05-26/Ausgaben/Heinz Wilmers GmbH RG 2605176 von 11.05.2026 - 476,00 EUR.pdf", "reversible": true }
```

All paths in the journal are workspace-relative (relative to workspace root).

---

## Engine interface

```
bun ${CLAUDE_PLUGIN_ROOT}/skills/dashboard/scripts/apply.ts <workspace_root> \
    list | approve <runid> <action_id> | reject <runid> <action_id> | approve-safe \
    [--dry]
```

| Command | Effect |
|---|---|
| `list` | Returns JSON: `{ ok, stand, total, ns, np, nf, groups[] }` — open queue summary grouped by process |
| `approve <runid> <id>` | Applies one action; copies file, writes journal, removes action from queue |
| `reject <runid> <id>` | Removes one action from queue; does not copy |
| `approve-safe` | Applies all `sicher`-tier actions across all open queues in one pass |
| `--dry` | Dry-run flag for any command; reports what would happen without touching files |

`<workspace_root>` is the absolute path to the workspace directory (parent of `_firma/`).

> **Compatibility note:** a workspace-resident `_firma/apply.py` (as deployed on Galant) implements
> the identical contract. Queues written by any process — plugin skill or external script — are
> interchangeable between the Python and TypeScript engines. Do not write engine-specific fields.

---

## Role boundary

| Actor | Permitted |
|---|---|
| Process / skill | Write queue files to `_firma/_review/`; update `rechecked`; append signals |
| Apply engine | Read queues; copy files; append journal; move empty queues to `_erledigt/` |
| Cockpit / chat | Trigger engine commands as an explicit human action — never automatic |

**Applying is always a deliberate human action.** No skill, hook, or background cron may call
`approve` or `approve-safe` without a user-initiated trigger from the cockpit or chat interface.
The queue is the firewall between analysis and workspace mutation.
