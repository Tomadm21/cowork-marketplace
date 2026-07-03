# Invoicing — compute rules

The deterministic rules the invoice math follows. **These are implemented in `scripts/compute.ts`; the skill must not re-derive them inline.** All values are config-driven (`config/invoicing.json`) — nothing is hardcoded to any firm.

## Inputs

- **config** (`_firma/config/invoicing.json`): VAT rate, rate tiers (**separate Montage-/Fahrt-Satz** per tier), Sa-/So-Zuschlag (independent percentages), people→tier(+vehicle) mapping, named vehicles, statutory break, daily cap, `pause_pre_applied` flag, spesen (per-diem) amounts, hotel cost, KFZ rate, weekend days, output paths.
- **run input**: KW, year, site, and per-person per-day rows: `arbeit_h`, `fahrt_h`, `pause_h`, `hotel`, `km`, optional `vehicle`. (These come from reading the timesheet photo/PDF with Cowork vision, or from a manual form.) See `reference/montagebau-preset.md` for how to derive `fahrt_h` (Pendelanteil, not full travel window) and Anreise-/Heimfahrt-`km` (always Firmensitz→Baustelle from `sites.<baustelle>.anreise_km`, never the reported odometer value) when that preset is active — both are extraction-time rules; `compute.ts` computes the rows it receives.

## Per-day math (per person, per date)

1. **Pause handling** depends on `config.pause_pre_applied`:
   - `false` (default/simple mode): statutory break = `max(config.pflicht_pause_h, pause_h)`; total = `arbeit_h + fahrt_h`, capped at `daily_cap_total_h` (capped days raise a "prüfen" warning); the capped-and-break-adjusted total is split back across `arbeit_h`/`fahrt_h` proportionally.
   - `true` (Montagebau-Preset): `arbeit_h`/`fahrt_h` are assumed already pause-adjusted at extraction time. No further deduction is made; if `arbeit_h + fahrt_h` exceeds `daily_cap_total_h` the script only **warns** — it never silently truncates, since it cannot know whether to shorten the Montage or Fahrt portion.
2. **Day kind** = `werktag` / `samstag` / `sonntag`, derived from the date and `config.weekend_days`.
3. **Rate** = tier's `montage`/`fahrt` base rate × zuschlag factor for the day kind (`1 + zuschlag_samstag` / `1 + zuschlag_sonntag` / `1` for werktag).
4. **Day amounts** = `arbeit_h × montage_rate` and `fahrt_h × fahrt_rate`, tracked separately and also rolled into per-day-kind subtotals (`montage_werktag_h/betrag`, `montage_samstag_h/betrag`, … same for `fahrt_*`) so the invoice can show one sub-position per bucket.

## Per-person aggregation

- **Montage-/Fahrt-Summe** = sum of the per-day Montage / Fahrt amounts (kept separate — never merged into one "hours amount").
- **Spesen (per-diem)**: across the person's *active* days (any arbeit/fahrt > 0), sorted by date: first and last active day = **Halbtag (8h)** rate (Anreise/Abreise); days in between = **Volltag (24h)** rate; a single active day = Halbtag. Reviewable heuristic. The script also cross-checks the `hotel` flag against the expected pattern and warns on mismatch (e.g. last active day still has `hotel: true` → possible multi-week continuation where the following Monday would wrongly be scored as a fresh Anreise) — a known edge case that still needs manual review, now surfaced explicitly instead of silently miscomputed.
- **Hotel** = nights with `hotel: true` × `hotel_cost`.
- **Zwischensumme** = Montage-Betrag + Fahrt-Betrag + Spesen + Hotel (vehicle/KFZ costs are **not** included here — see Geräte below).

## Geräte / Fahrzeugkosten

- Every row with `km > 0` resolves a vehicle: `row.vehicle` if set, else `config.people[person].vehicle`. Unresolvable → the km land in a visible **`(kein Fahrzeug)`** pseudo position inside `vehicles[]` (counted into `geraete_betrag`) plus a warning — the reviewer reassigns or removes them deliberately; nothing is silently dropped.
- km are summed **per vehicle** (not per person) across all rows; `betrag = km_total × kfz_rate_per_km`.
- Output as a separate top-level `vehicles[]` array + `geraete_betrag` — this is its own invoice block ("Geräte [KW]"), not folded into any person's Zwischensumme.

## Totals

- **Summe netto** = sum of all persons' Zwischensummen + `geraete_betrag`.
- **MwSt** = `summe_netto × vat_rate`.
- **Summe brutto** = netto + MwSt.

## Unknowns & warnings

- A person not in `config.people` → `default_tier` assumed + warning.
- A vehicle not in `config.vehicles` (if that map is set) → warning, amount still computed.
- Capped/over-cap days, the spesen heuristic, the hotel-flag consistency check, and unresolvable vehicles all emit warnings so the operator reviews before the invoice is finalized (honest-status discipline).

## Output

`compute.ts` prints one JSON block: per-person day breakdown (with `montage_betrag`/`fahrt_betrag` per day), spesen days, the per-day-kind `subtotals` block per person (feeds the up-to-9 invoice sub-positions), the `vehicles[]`/`geraete_betrag` block, and the netto/MwSt/brutto totals, plus `warnings[]`. The skill reproduces this block verbatim and uses it to fill the invoice — it never recomputes the numbers. See `reference/montagebau-preset.md` for how the sub-positions map to a Höcker-Service-Report-style invoice layout.

## Input validation (v0.10.2 — fail loud, never compute on garbage)

- **Config:** every tier must be `{montage, fahrt}` (finite numbers) — legacy shapes (single
  number, `weekday`/`weekend`) abort with a migration message; `weekend_days` may only contain
  `6` (Sa) and/or `0` (So); all money/threshold keys must be numbers ≥ 0.
- **Rows:** `person` and `date` (`YYYY-MM-DD`) required; `arbeit_h` required (explicit `0` on pure
  travel days); all hour/km fields must be finite numbers ≥ 0 — a vision-extracted string `"8"`
  aborts instead of string-concatenating; the legacy field `reisezeit_h` aborts with a pointer
  to `fahrt_h`.
- **Warnings (computed, but loud):** duplicate `(person, date)` rows; hotel night with zero hours
  (Schlechtwetter-Standtag — hotel billed, no spesen day); Volltag-spesen day without a hotel
  night; a single active day flagged `hotel` (multi-week continuation?); row year ≠ `input.jahr`.

## Confidence-Kalibrierung (v0.7.0)
- **`sicher`** nur, wenn alle Stunden vollständig/lesbar sind, Sätze/Stufen/Spesen/MwSt deterministisch über das Pflicht-Skript berechnet wurden und keine Position geschätzt ist.
- **`prüfen`** bei unleserlichen Stunden, fehlenden Tagen, unklarer Stufe/Spesen/Fahrzeug oder geschätzten Beträgen.
- Geld/Recht bleibt deterministisch (Skript-Pflicht) — Confidence betrifft nur Lesbarkeit/Vollständigkeit des Inputs, nie die Arithmetik.
