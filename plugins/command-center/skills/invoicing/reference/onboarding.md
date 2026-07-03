# Invoicing — onboarding (run once per firm)

Collects the firm's invoicing settings into `<workspace>/_firma/config/invoicing.json`. **Ask per `${CLAUDE_PLUGIN_ROOT}/reference/onboarding-ux.md`** — detect-first, numbered options + ✏️ free-text + ⏭️ skip, and the path-picker for folders. Copy `scripts/config.example.json` as the shape. Write **only** invoicing settings here — firm-level facts stay in `company-context.md` (inheritance rule).

Confirm in bulk where you can; ask one-at-a-time only for the numbers you can't detect (rates, thresholds). Present each as options with a sensible default. The keys the math script consumes are marked **[math]** — get those right; the rest are used by the skill for the document, the email, and filing.

0. **[math] Abrechnungs-Modus** — „Einfacher Stundenzettel" (ein Satz pro Tier, ein Wochenend-Satz) · **„Montagebau/Service-Report"** (Montage- und Fahrtzeit getrennt bepreist, Sa/So unabhängig bezuschlagt, Fahrzeugkosten als eigene Geräte-Position — siehe `reference/montagebau-preset.md`) · ✏️. Diese Wahl bestimmt die Form der folgenden Fragen und setzt `pause_pre_applied` (Montagebau-Preset: `true`).
1. **[math] Accounting client / Mandant** 🔍 — the exact client/Mandant name in the accounting software. A frequent, costly mix-up is a "Montage" entity vs. the main GmbH — if the scan found several entities, propose them; ✏️.
2. **[math] VAT rate** — `19%` (default) · `7%` · ✏️. Default from `cc:business` if set.
3. **[math] Rate tiers** — Default three tiers `top / mid / std`. Offer „3 Stufen übernehmen und Sätze eingeben" · „andere Anzahl" · ✏️.
   - *Einfacher Modus:* ein **€/h pro Tier**, weekday **und** ein separater Wochenend-Satz.
   - *Montagebau-Preset:* **zwei Sätze pro Tier** — Montage-€/h **und** Fahrt-€/h (typischerweise niedriger). Dazu **Samstags-/Sonntags-Zuschlag als eigenständige Prozentsätze** (Default `+25 % / +50 %`, auf Montage- und Fahrt-Satz gleichermaßen angewandt) statt eines fixen Wochenend-Satzes.
4. **[math] People** — for each person on timesheets: match keyword, tier (pick from the tiers above). Montagebau-Preset zusätzlich: zugeordnetes Fahrzeug (optional, für die Geräte-Abrechnung). Reuse `stammdaten/personen.json` if present (propose those names to confirm).
4b. **[math] Vehicles** (nur Montagebau-Preset) — benannte Firmenfahrzeuge, die km-basiert separat abgerechnet werden (z. B. Kennzeichen-Kurzform). Optional — ohne Eintrag laufen km-Angaben als Warnung "Fahrzeug nicht zugeordnet" statt in eine Geräte-Position.
5. **[math] Statutory break** per worked day — default `0,5h`. *Einfacher Modus:* wird vom Skript automatisch abgezogen; die größere von Report-Pause und diesem Wert gilt. *Montagebau-Preset:* dient nur als Referenzwert für die Erfassung (Pause fließt bereits in `arbeit_h`/`fahrt_h` ein, siehe Preset-Doku) — das Skript zieht hier nichts mehr ab. Options: `0,5h` · `0,75h` · ✏️. *(ArbZG-Kontext: > 6–9h → 30 min, > 9h → 45 min.)*
6. **[math] Spesen / per-diem** — `Halbtag (≤8h)` and `Volltag (>8h)` amounts. Default `15 € / 30 €`. Options: `Standard übernehmen` · ✏️.
7. **[math] Daily cap** on arbeit+fahrt per day — default `17h` · ✏️. *Montagebau-Preset:* wird nicht automatisch gekürzt, nur als „prüfen"-Warnung gemeldet.
8. **[math] Hotel / night** — default `85 €` · ✏️.
9. **[math] KFZ rate / km** — default `0,75 €` · ✏️.
10. **[math] Weekend days** — default `Sa+So` · ✏️.
11. **Per-site overrides** ◦ — some sites pay no hotel (client covers it) or have a fixed invoice recipient. For each such site: `match` keyword, `hotel: ja/nein`, recipient name + email. Skippable — otherwise ask per case at run time.
12. **Invoice filename schema** — default `{jahr} KW{kw} {baustelle} {monteure}` · ✏️.
13. **Output paths** 🔍 — where finished invoices + mirrored timesheets go. Use the **path-picker**; propose a detected `Rechnungsausgang`/`Ausgangsrechnung` folder; capture as a **pattern** if it nests by KW (`…/Ausgangsrechnung/KW‹x› bis ‹y›/`). Mirror path for the source timesheets too (often `…/Baustellen/‹KW›_‹Baustelle›/Montageberichte/`). Default `_ausgang/rechnungen`.

Write to `_firma/config/invoicing.json` (keyed JSON → idempotent on re-run). Then set the `invoicing` line under `cc:processes` in `company-context.md` to `onboarded`.

**Confirm the captured tiers + people + Mandant back before finishing — wrong rates and the wrong Mandant are the costliest drift.**
