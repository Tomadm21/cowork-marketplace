# Invoicing — compute rules

The deterministic rules the invoice math follows. **These are implemented in `scripts/compute.ts`; the skill must not re-derive them inline.** All values are config-driven (`config/invoicing.json`) — nothing is hardcoded to any firm.

## Inputs

- **config** (`_firma/config/invoicing.json`): VAT rate, rate tiers (weekday/weekend per tier), people→tier mapping, statutory break, daily cap, spesen (per-diem) amounts, hotel cost, KFZ rate, weekend days, output paths.
- **run input**: KW, year, site, and per-person per-day rows: `arbeit_h`, `reisezeit_h`, `pause_h`, `hotel`, `km`. (These come from reading the timesheet photo/PDF with Cowork vision, or from a manual form.)

## Per-day math (per person, per date)

1. **Statutory break** = `max(config.pflicht_pause_h, pause_h)`.
2. **Daily cap** = `arbeit_h + reisezeit_h`, capped at `daily_cap_total_h` (default 17). Capped days raise a "prüfen" warning.
3. **Netto hours** = `max(0, capped_total − statutory_break)`.
4. **Rate** = tier's `weekend` rate if the date is a weekend day, else `weekday`.
5. **Day amount** = `netto_hours × rate`.

## Per-person aggregation

- **Hours total / hours amount** = sum of the per-day netto / amounts.
- **Spesen (per-diem)**: across the person's *active* days (any arbeit/reise > 0), sorted by date: first and last active day = **Halbtag (8h)** rate (Anreise/Abreise); days in between = **Volltag (24h)** rate; a single active day = Halbtag. This is a reviewable heuristic — every run flags it for the operator to confirm.
- **KFZ** = `km × kfz_rate_per_km`, only if the person has `kfz: true`. km logged for a non-KFZ person raises a warning.
- **Hotel** = nights with `hotel: true` × `hotel_cost`.
- **Zwischensumme** = hours amount + spesen + KFZ + hotel.

## Totals

- **Summe netto** = sum of all persons' Zwischensummen.
- **MwSt** = `summe_netto × vat_rate`.
- **Summe brutto** = netto + MwSt.

## Unknowns & warnings

- A person not in `config.people` → `default_tier` assumed + warning.
- Capped days, spesen heuristic, and unbilled km all emit warnings so the operator reviews before the invoice is finalized (honest-status discipline).

## Output

`compute.ts` prints one JSON block: per-person day breakdown, spesen days, the four subtotal lines per person, and the netto/MwSt/brutto totals, plus `warnings[]`. The skill reproduces this block verbatim and uses it to fill the invoice — it never recomputes the numbers.
