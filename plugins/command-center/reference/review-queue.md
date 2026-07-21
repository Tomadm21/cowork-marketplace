# Review Queue contract — how processes hand work to review

A **review queue** is the handoff layer between a prepared workflow run and the workspace.
When a process finishes its analysis it writes one JSON file; nothing is copied or moved until
a human explicitly approves — with **one declared exception**: `receipt-filing` runs in
**Direktablage** mode (v0.15, default) execute their own queue immediately via `approve-run`;
the queue is then the audit record + engine input, not a waiting state, and control happens in
the flat Ablage folder (see `skills/receipt-filing/reference/rules.md` §Direktablage).
The dashboard (Live Artifact) shows only the **count** of open items
(since v0.9.2 it never lists them); the actual review — approve, edit, re-run, reject — happens
in **chat** (review-board skill / `reference/chat-review.md`).
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
The **filename** always follows `R-<YYYY-MM-DD>-<slug>.json`; the **`runid` field inside** is the
stable identifier the engine keys on (it must match the activity-log `run_id`, e.g.
`invoicing-2026-KW21`). They may coincide (intake writes runid = filename stem) but don't have to —
never rename a queue file or change its `runid` after creation.

---

## Queue schema (top-level fields)

| Field | Type | Required | Notes |
|---|---|---|---|
| `runid` | string | yes | Stable identifier the engine keys on; matches `activity-log` `run_id` (may, but need not, equal the filename stem) |
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
| `source_md5` | string | no (strongly recommended) | md5 of the source file **at queue-build time**. The engine refuses to apply the action if the source content no longer matches — this binds the card to file *content*, not a path, and hard-blocks look-alike-filename mix-ups (two similar PDFs swapped during queue build). Queue builders should always set it. |
| `verify` | string | no | `"md5"` = after a fresh copy the engine re-hashes the target and removes the copy on mismatch (belt-and-braces for money-critical processes). Default: byte-size verification only (always on). |
| `bestaetigen` | array | no | **Pflicht-Bestätigungen** — questions the reviewer MUST answer before the engine will apply the action (see section below). Each entry: `{feld, frage, wert, quelle_auszug?, bestaetigt?}`. |

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

### Pflicht-Bestätigungen (`bestaetigen`)

A "prüfen" note in `reason` is easy to wave through; a value the process **could not derive**
must instead be an explicit, machine-enforced question. Real failure modes this covers: a hotel
amount that the timesheet can never show (only Übernachtung ja/nein — silently billed as 0 EUR),
a Montage/Fahrt split on days whose travel and work windows overlap (setting Fahrt=0 "to avoid
guessing" is itself a silent guess), and a hard-to-read handwritten number (860 vs. 920 km).

```json
"bestaetigen": [
  { "feld": "hotel_betrag",
    "frage": "Tatsächliche Hotelkosten laut Beleg (2 Übernachtungen, spitz abgerechnet)?",
    "wert": null,
    "quelle_auszug": "Übernachtung: ☑ ja (Mo, Di) — kein Betrag im Report" }
]
```

- `feld` — machine key the answer belongs to (also mirrored into `values.<feld>` on confirm).
- `frage` — the question shown on the review card, full sentence, with context.
- `wert` — `null`/missing = **unanswered**; the reviewer's answer once confirmed. A queue
  builder may pre-fill a *proposal* only via `frage`/`quelle_auszug` text — never via `wert`.
- `quelle_auszug` — optional short excerpt of what was actually read in the source (shows the
  reviewer the evidence, not just the derived value).
- `bestaetigt` — set to `true` by the confirm intent; `true` (or a non-empty `wert`) resolves
  the entry.

**Engine behaviour (hard gate):** an action with any unresolved entry
(1) is treated as `prüfen` for display/bulk purposes even if its tier says `sicher` — it can
never ride along in `approve-safe`; (2) is refused by `approve`, `approve-run` and
`manual-confirm` with status `needs-confirmation` and stays in the queue. Confirming happens
in chat (`bestätige <runid> <id>: <feld>=<wert>` — the skill patches the entry, mirrors the
value into `values`, re-runs any deterministic computation, sets `rechecked`); only then does
the engine apply. Numeric-money confirmations (invoicing) additionally mean: re-run
`compute.ts` with the confirmed value and refresh the card/preview — never hand-patch totals.

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
dashboard counts open items (read-only) → review happens in chat/review-board
         ↓
reviewer takes action per action id
         ↓
  approve (individual)   → collision-safe copy to every target dir
                         → journal record appended
                         → action removed from queue
  ─────────────────────────────────────────────────────────────
  approve-run (batch)    → same as approve, for all (or the listed)
                           actions of ONE run — one engine start,
                           one journal read; the board's
                           "Freigeben (Prozess)" uses this
  ─────────────────────────────────────────────────────────────
  approve-safe (bulk)    → same as approve, for ALL sicher-tier
                           actions across ALL open queue files
  ─────────────────────────────────────────────────────────────
  manual-confirm         → user copied the file HIMSELF (slow
                           drive, blocked write); engine verifies
                           size+md5 at the target, journals
                           status "copied-manually", clears card
  ─────────────────────────────────────────────────────────────
  reject                 → action removed from queue, nothing copied
         ↓
queue with zero remaining actions
  → file moved to _erledigt/          → run considered done
```

### Verified writes (`.part` + size check)

Fresh copies never go directly to the final name. The engine writes chunks to `<name>.part`,
fsyncs, verifies the **byte size** against the source and only then renames atomically
(`os.replace`). A run that dies mid-copy (slow SMB share, execution window exceeded) leaves at
most a `.part` fragment — unmistakably unfinished — instead of a plausible-looking corrupt file
under the final name. On retry the engine **resumes**: a `.part` that already matches the source
in size AND md5 (the common "copy finished in the background, only the rename was killed" case)
is simply renamed instead of re-copied; anything else is discarded and re-written. With
`verify:"md5"` on the action the engine additionally re-hashes the finished target and removes
it on mismatch.

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
`status` is `"copied"`, `"skipped-identical"` or `"copied-manually"` (manual-confirm intent).
`runid`+`id`+`md5` make the journal the idempotency source of truth.

All paths in the journal are workspace-relative (relative to workspace root).

---

## Engine interface

```
# kanonisch (reines Python3, vom Onboarding nach _firma/apply.py geschrieben):
python3 <workspace_root>/_firma/apply.py <workspace_root> \
    list | approve <runid> <action_id> | approve-run <runid> [id …] \
    | reject <runid> <action_id> | approve-safe | manual-confirm <runid> <action_id> \
    [--dry]
# optionaler READ-ONLY-Lister (bun oder Node ≥ 22.6) — kann NICHT freigeben:
bun ${CLAUDE_PLUGIN_ROOT}/skills/dashboard/scripts/apply.ts <workspace_root> list
```

| Command | Effect |
|---|---|
| `list` | Returns JSON: `{ ok, stand, total, ns, np, nf, groups[] }` — open queue summary grouped by process |
| `approve <runid> <id>` | Applies one action; copies file, writes journal, removes action from queue |
| `approve-run <runid> [id …]` | Applies all (or only the listed) actions of one run in a **single engine start** — one journal read, one config parse. The board's per-process approval MUST use this instead of N× `approve` (each spawn re-scans journal + configs over the network drive) |
| `reject <runid> <id>` | Removes one action from queue; does not copy |
| `approve-safe` | Applies all `sicher`-tier actions across all open queues in one pass |
| `manual-confirm <runid> <id>` | The user copied the file himself: engine verifies size+md5 at the target, journals `copied-manually`, removes the action. No `--dry` needed — it never writes target files |
| `--dry` | Dry-run flag for any command; reports what would happen without touching files |

`<workspace_root>` is the absolute path to the workspace directory (parent of `_firma/`).

> **Engine note:** the **one and only** engine that applies approvals is `_firma/apply.py`
> (pure Python 3), written into the workspace by `firm-onboarding` Step 2b — it runs everywhere
> without `bun`. Since v0.10.2 it enforces **containment**: sources, relative targets and
> filenames must stay inside the workspace; absolute targets are honoured only if configured in
> `_firma/config/*.json` (`output_paths`), otherwise they fall back to `_ausgang/<process>`.
> The bundled `skills/dashboard/scripts/apply.ts` is a **read-only lister** (`list` only) — its
> apply commands were removed in v0.10.2. Do not write engine-specific fields into queues.

---

## Role boundary

| Actor | Permitted |
|---|---|
| Process / skill | Write queue files to `_firma/_review/`; **patch actions on edit / re-run**; update `rechecked`; append signals |
| Apply engine | Read queues; copy files; append journal; move empty queues to `_erledigt/` |
| Dashboard | **Read-only** — count open queues (statistics artifact); trigger nothing |
| Chat (on the user's word) | Trigger engine commands (`approve` / `approve-run` / `reject` / `approve-safe` / `manual-confirm`) and queue patches as an explicit human action |
| receipt-filing (Direktablage) | The **only** process allowed to call `approve-run` on its **own, just-written** queue without a chat trigger — copy-only parking, flat into the single `ablage_ordner` (`prüfen` items get a `PRÜFEN - ` name prefix; never creates subfolders); disabled via `"ablage": "review"` |

**Applying is a deliberate human action — except receipt-filing Direktablage.** No other skill, hook,
dashboard, or background cron may call `approve` or `approve-safe` without a user-initiated trigger
in chat; and no process may auto-apply a queue it did not itself write in the same run. The queue is
the firewall between analysis and workspace mutation. Editing or re-running only changes the proposal
in the queue — it never moves files; the move happens only on `approve`.
