# Signal contract — how processes feed the self-improvement loop

Every Command Center process appends **friction signals** to
`<workspace>/_firma/_state/signals.jsonl` — one JSON object per line, best-effort,
**never blocking a run** (same discipline as `activity-log.md`). The operator report
(`/command-center:review`) reads this file.

## Schema (one line per signal)

```json
{ "ts": "2026-06-10T08:12:00Z", "process": "receipt-filing", "type": "correction", "key": "receipt:unknown-vendor", "detail": "Vendor 'Müller GmbH' nicht erkannt, manuell zugeordnet" }
```

- `ts` — ISO 8601 timestamp, **UTC with `Z` suffix** (these compare correctly as strings; offsets like `+02:00` would break watermark windowing).
- `process` — process key (`invoicing`, `receipt-filing`, …).
- `type` — one of: `correction`, `recurring_check`, `observation`, `fact`, `tech_change`.
- `key` — **stable cluster key**, lowercase, `process:slug` form. NO free text in the key —
  it is what recurrences aggregate on. Keep the key type-stable (one key → one type).
- `detail` — short human-readable note for the report (may name the concrete example).

## Types

| type | append when… |
|---|---|
| `correction` | the user changed a value the process proposed |
| `recurring_check` | a "prüfen" flag of a known class fired again |
| `observation` | the user/Tom said "wäre gut wenn…" / "merk dir…" / "notiz…" |
| `fact` | a firm fact was learned and is waiting for confirmation |
| `tech_change` | a changed folder, template format, or tool was detected |

## How to append (inside a skill, after the run's review step)

Append a line with the workspace's own tools — e.g. write/append to
`<workspace>/_firma/_state/signals.jsonl`. Create the file/dir if missing. If anything
fails, **silently skip** — logging must never block the user's task.

## Stable key registry (extend as processes grow)

- invoicing: `invoicing:unknown-person`, `invoicing:spesen-heuristik`, `invoicing:capped-day`
- daily-report: `daily-report:capped-day`, `daily-report:missing-day`
- photo-sorting: `photo:unknown-site`, `photo:low-confidence-date`
- receipt-filing: `receipt:unknown-vendor`, `receipt:ambiguous-routing`
- lead-gen: `lead-gen:low-quality-source`
- any process: `observation:<slug>`, `fact:<slug>`, `tech:<slug>`
