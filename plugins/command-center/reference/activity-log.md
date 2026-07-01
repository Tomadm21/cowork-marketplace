# Activity log — the record of work done

Every process records each successful run as one line in **`<workspace>/_firma/_state/activity.jsonl`**. This file is the honest source of "getane Arbeit" that the dashboard reads. Read this once; every process appends to it the same way.

## The line shape (one JSON object per line)

```json
{ "ts": "2026-06-03T14:32:00Z", "version": 1, "run_id": "invoicing-2026-KW21-1717423920", "process": "invoicing", "items": 3, "summary": "Rechnung KW 21 · Musterstraße 5 · 3 Personen", "status": "done" }
```

| field | meaning |
|---|---|
| `ts` | ISO-8601 timestamp of the run |
| `version` | schema version (currently `1`) — present from line one |
| `run_id` | stable id for **this** piece of work, so a re-run/retry never double-counts. Build it from process + the work's natural key (e.g. `invoicing-<jahr>-KW<kw>`), optionally + a suffix. The dashboard keeps the **last** line per `run_id`. |
| `process` | the process key (`invoicing`, `daily-report`, `photo-sorting`, `receipt-filing`) |
| `items` | how many units this run handled (Rechnungen, Belege, Fotos, Berichte) — drives the time-saved estimate |
| `summary` | one short human line of what happened (shown in the feed) |
| `status` | `done` (work finished + approved) · `prepared` (a scheduled/review run that's waiting for the operator's approval — shown in the feed but **not** counted toward time saved) |

`minutes_saved` is **optional** — normally omit it and let the dashboard compute `items × minutes_per_item` from `reference/workflows.json` (the single home for the time model). Only set `minutes_saved` explicitly if a run's saving genuinely differs.

## Rules

1. **Append only.** Add one line; never rewrite or reorder the file. (Atomic single-line append.)
2. **Log after success.** Write the line only once the run actually finished — `done` after approval, `prepared` for a scheduled run left in review.
3. **Best-effort — never block the run.** If the line can't be written (folder missing, etc.), create `_firma/_state/` and retry once; if it still fails, carry on. A logging failure must **never** abort or undo the real work.
4. **One run, one `run_id`.** If the same work is produced again (correction, re-run), reuse the same `run_id` so the dashboard updates that entry instead of counting it twice.

## How a process logs (the one step every SKILL adds)

After a successful run, append the line — e.g. in the firm's workspace:

```bash
mkdir -p <workspace>/_firma/_state
echo '{"ts":"<ISO>","version":1,"run_id":"<process>-<key>","process":"<process>","items":<n>,"summary":"<short>","status":"done"}' >> <workspace>/_firma/_state/activity.jsonl
```

Then the next time the firm asks for the dashboard, the work shows up — with the time it saved.
