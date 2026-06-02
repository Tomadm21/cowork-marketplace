# Invoicing — onboarding (run once per firm)

Collects the firm's invoicing settings into `<workspace>/_firma/config/invoicing.json`. Ask in chat; copy `scripts/config.example.json` as the shape. Write **only** invoicing settings here — firm-level facts (name, addresses, VAT-ID) stay in `company-context.md` (inheritance rule).

Ask for:

1. **VAT rate** (default from `company-context` `cc:business` if set, else ask; e.g. 0.19).
2. **Rate tiers** — how many pay tiers, and the weekday + weekend €/hour for each. Default three: top / mid / std.
3. **People** — for each person who appears on timesheets: a match keyword (how their name shows up), their tier, and whether they have a company vehicle (`kfz`). (May reuse `stammdaten/personen.json` if it exists.)
4. **Statutory break** per worked day (default 0.5h).
5. **Daily cap** on arbeit+reise per day (default 17h).
6. **Spesen** — Volltag (24h) and Halbtag (8h) per-diem amounts.
7. **Hotel cost** per night.
8. **KFZ rate** per km.
9. **Weekend days** (default Sat+Sun).
10. **Output paths** — where finished invoices + mirrored timesheets go (default `_ausgang/rechnungen`, or the firm's real folders).

Write the result to `_firma/config/invoicing.json` (keyed JSON → idempotent on re-run). Then add/update the `invoicing` line under `cc:processes` in `company-context.md` with status `onboarded`.

Confirm the captured tiers + people back to the user before finishing — wrong rates are the costliest drift.
