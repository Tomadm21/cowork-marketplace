# Review Queue contract — how processes hand work to review

A **review queue** is the handoff layer between a prepared workflow run and the workspace.
When a process finishes its analysis it writes one JSON file; nothing is copied or moved until
a human explicitly approves. The dashboard (Live Artifact) **displays** the open queues read-only;
the actual review — approve, edit, re-run, reject — happens in **chat** (see `reference/chat-review.md`).
Only the apply engine ever touches workspace files — skills write (and patch) queues, the engine
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
| `process` | string | yes | Process key: `receipt-filing`, `invoicing`, `daily-report`, `photo-sorting` |
| `created` | string | yes | ISO 8601 timestamp; offset allowed (e.g. `+00:00`) |
| `rechecked` | string | no | ISO 8601 timestamp; updated when a process re-analyses an existing queue |
| `origin` | string | yes | `hintergrund` (background skill), `interaktiv`, or similar free-form tag |
| `headline` | string | yes | One-sentence human summary. **Display counts are derived from `len(actions)`** by the engine/board — a stale stored counter is never trusted. |
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
dashboard displays *.json (read-only) → review happens in chat
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

### Collision-safe copy + content idempotency

When copying `filename` into a target directory the engine first compares **content (md5)**:
- target with the same name exists **and is byte-identical** to the source → **skip**, journal
  `status: "skipped-identical"`, **no** `_2` clone (this is what keeps a re-run from littering
  `_ausgang`/N: with duplicates);
- name exists but content differs → append `_2`, `_3`, … until free;
- otherwise copy.
The engine is also **journal-guarded** (a `(runid,id,target)` already applied is skipped) and
removes the action from the queue **atomically**, so an interrupted run is safe to repeat.
Applied output hashes are recorded in `_firma/_state/filed-md5.json` so intake can skip sources
whose identical output was already filed on an earlier day.

### Journal record format

One JSON line per applied action appended to `_firma/_journal/<YYYY-MM>.jsonl`:

```json
{ "ts": "2026-06-08T16:21:07.123456", "runid": "R-2026-06-08-belege", "id": 1, "verb": "kopieren", "source": "_eingang/receipt-filing/… .pdf", "target": "001 Galant Bau GmbH/001. Buchhaltung/2026/05-26/Ausgaben/… .pdf", "md5": "96fc5a7c…", "status": "copied", "reversible": true }
```
`status` is `"copied"` or `"skipped-identical"`. `runid`+`id`+`md5` make the journal the
idempotency source of truth.

All paths in the journal are workspace-relative (relative to workspace root).

---

## Engine interface

```
# kanonisch (reines Python3, vom Onboarding nach _firma/apply.py geschrieben):
python3 <workspace_root>/_firma/apply.py <workspace_root> \
    list | approve <runid> <action_id> | reject <runid> <action_id> | approve-safe \
    [--dry]
# optional, identischer Vertrag (bun oder Node ≥ 22.6):
bun ${CLAUDE_PLUGIN_ROOT}/skills/dashboard/scripts/apply.ts <workspace_root> …
```

| Command | Effect |
|---|---|
| `list` | Returns JSON: `{ ok, stand, total, ns, np, nf, groups[] }` — open queue summary grouped by process |
| `approve <runid> <id>` | Applies one action; copies file, writes journal, removes action from queue |
| `reject <runid> <id>` | Removes one action from queue; does not copy |
| `approve-safe` | Applies all `sicher`-tier actions across all open queues in one pass |
| `--dry` | Dry-run flag for any command; reports what would happen without touching files |

`<workspace_root>` is the absolute path to the workspace directory (parent of `_firma/`).

> **Engine note:** the **canonical** engine is `_firma/apply.py` (pure Python 3), written into the
> workspace by `firm-onboarding` Step 2b — it runs everywhere without `bun`. The bundled
> `skills/dashboard/scripts/apply.ts` implements the identical contract and is optional. Queues are
> interchangeable between both engines; do not write engine-specific fields.

---

## Role boundary

| Actor | Permitted |
|---|---|
| Process / skill | Write queue files to `_firma/_review/`; **patch actions on edit / re-run**; update `rechecked`; append signals |
| Apply engine | Read queues; copy files; append journal; move empty queues to `_erledigt/` |
| Dashboard | **Read-only** — display open queues; trigger nothing |
| Chat (on the user's word) | Trigger engine commands (`approve` / `reject` / `approve-safe`) and queue patches as an explicit human action — never automatic |

**Applying is always a deliberate human action.** No skill, hook, dashboard, or background cron may call
`approve` or `approve-safe` without a user-initiated trigger in chat. The queue is the firewall
between analysis and workspace mutation. Editing or re-running only changes the proposal in the
queue — it never moves files; the move happens only on `approve`.
