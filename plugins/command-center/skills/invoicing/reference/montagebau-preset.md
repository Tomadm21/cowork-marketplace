# Montagebau-Preset — Service-Report-basierte Abrechnung mit getrenntem Montage-/Fahrt-Satz

Ein optionaler, ausführlicherer Abrechnungs-Modus für Firmen, die Monteure per Handwerker-Service-Report
(Tag/Datum/Reisezeit/Arbeitszeit/Pause/Km/Übernachtung) abrechnen und dabei Montage- und Fahrtzeit **getrennt**
bepreisen, Sa/So **getrennt** bezuschlagen und Fahrzeugkosten als eigene Geräte-Position ausweisen. Aktivieren,
wenn die Firma beim Onboarding „Service-Report / Handwerker-Montage" statt „einfacher Stundenzettel" wählt.

## Wann dieses Preset statt der einfachen Variante

| Merkmal | Einfache Variante | Montagebau-Preset |
|---|---|---|
| Satz pro Tier | ein Satz (Werktag/Wochenende) | **getrennt** Montage-Satz + Fahrt-Satz |
| Sa/So-Zuschlag | ein Wochenend-Satz | **getrennt** Sa (+25 % Default) / So (+50 % Default) |
| Fahrtzeit | volle Reisezeit | **Pendelanteil** (Fahrt-h = Reisezeit − Arbeit-h − Pause, siehe unten) |
| Fahrzeugkosten | pauschal pro Person (`kfz: true`) | **pro benanntem Fahrzeug** als eigene Rechnungsposition (`vehicles` + `km`) |
| Rechnungslayout | eine Zeile Stunden+Spesen+KFZ+Hotel pro Person | **bis zu 9 Sub-Positionen** pro Monteur (siehe Rechnungslayout unten) |

## Fahrt-h = Pendelanteil, nicht volle Reisezeit

Der Report zeigt eine Reisezeit-Spanne (z. B. Start 08:00 / Stop 18:45). Das ist **nicht** die abzurechnende
Fahrt-Zeit — davon muss die Arbeitszeit (inkl. Pause) abgezogen werden:

```
Fahrt-h = Reisezeit_gesamt − Arbeit-h(netto) − Pause
```

An reinen Reisetagen (Anreise/Heimfahrt ohne Arbeit) ist die volle Reisezeit die Fahrt-h.

| Tag | Reise | Arbeit + Pause | Fahrt-h |
|---|---|---|---|
| Anreise Mo (12:00–16:00) | 4,0 | 0 | **4,00** |
| Werktag mit Arbeit | 10,75 | 9,5 + 0,75 | **0,50** |
| Schlechtwetter-Hotel-Tag | 0 | 0 | **0** |
| Heimfahrt So (7:00–11:00) | 4,0 | 0 | **4,00** |

**Diese Umrechnung passiert bei der Erfassung (Step 1 der Skill, beim Lesen des Reports), nicht in `compute.ts`.**
Die Rows, die an `compute.ts` gehen, tragen bereits das fertige `arbeit_h` und `fahrt_h` — deshalb setzt dieses
Preset `pause_pre_applied: true` in der Config (siehe unten): das Skript zieht dann keine weitere Pause ab,
sondern warnt nur noch, wenn Arbeit+Fahrt die Tagesobergrenze übersteigt (kein stilles Kürzen — die Frage,
ob man die Kürzung von Montage- oder Fahrt-Anteil nimmt, kann das Skript nicht beantworten).

**Doppelfahrt-Tage** (Regen-Unterbrechung, Schichtwechsel): jede zusätzliche Pendel-Fahrt (Hotel↔Baustelle)
zählt als weitere Fahrt-h — z. B. 2× hin+zurück wegen Regen = 4 Pendel-Fahrten × 0,5 h = 2,0 h Fahrt-h (statt
sonst 0,5 h), und die km entsprechend verdoppelt. Wird beim Lesen des Reports erfasst, nicht vom Skript erkannt.

## Fahrzeug-/km-Erfassung

- **Nur der Fahrer** trägt km für den Tag ein (Konvention); Beifahrer bekommen `km: 0` bzw. das Feld leer.
- Report-Notation: `2 × 30` = 2 Fahrten à 30 km = 60 km (typisch Hotel-Hin+Zurück); `4 × 30` = 120 km
  (Regen-Doppelfahrt); eine reine Zahl (`300`) = Anreise/Heimfahrt.
- **Fahrzeug-Zuordnung über die letzten 4 Ziffern des Kennzeichens/der Fahrzeug-Nr.** auf normalisierte Namen
  mappen, falls der Report abweichend schreibt (Tippfehler wie „TE GA 1002" für Fahrzeug 1002 → korrekt
  `ST GA 1002`, wenn das die hinterlegte Bezeichnung für …1002 ist).
- `vehicle` je Row optional überschreibbar; sonst greift `people[person].vehicle` als Default.

## Anreise-/Heimfahrt-km: immer ab Firmensitz

Bei Montagebau-Baustellen (Höcker-Konvention) werden **An- und Heimreise immer als Strecke
Firmensitz → Baustelle** abgerechnet — unabhängig davon, von wo der Fahrer tatsächlich losgefahren
ist und was der Report/Tacho für den Tag notiert. Die Firmensitz-Adresse steht in
`company-context.md` (`cc:identity`); sie wird hier nie neu erfragt.

- Die Strecke pro Baustelle lebt in `config/invoicing.json` unter `sites.<baustelle>.anreise_km`
  (einfache Strecke in km). Fehlt sie beim ersten Auftauchen einer Baustelle: **einmal** ermitteln
  (Route Firmensitz→Baustellen-Adresse), vom Nutzer bestätigen lassen und dort nachtragen — danach
  läuft es automatisch.
- Beim Erfassen (Step 1 der Skill) bekommt jeder reine An-/Heimreisetag `km = anreise_km` auf der
  Fahrer-Row (eine Fahrt = einfache Strecke). Weicht der im Report notierte Wert ab, gilt trotzdem
  die Firmensitz-Strecke — die Abweichung wird als „prüfen"-Hinweis im Review genannt, nie still
  überschrieben ohne Sichtbarkeit.
- **Pendel-km Hotel↔Baustelle** (`2 × 30`-Notation, Regen-Doppelfahrten) bleiben davon unberührt —
  die Regel betrifft nur Anreise und Heimfahrt.
- Schalter: `anreise_km_ab_firmensitz` in der Config (im Montagebau-Preset Default `true`). Wird
  von der Skill beim Erfassen angewandt, nicht von `compute.ts` — das Skript rechnet die Rows, die
  es bekommt.

## Spesen (§ 9 EStG, Variante "b" — im Skript bereits Standard)

Erster aktiver Tag mit Hotel = Anreise (Halbtag 8/H), letzter aktiver Tag ohne Hotel = Abreise (Halbtag 8/H),
dazwischen Volltag (24/H). **Bekannte Inkonsistenz bei mehrwöchigen Touren:** bleibt ein Monteur übers
Wochenende durchgehend im Hotel (keine echte Heimfahrt), wertet die Heuristik den Montag der Folgewoche wieder
als „Anreise" (8/H statt korrekt 24/H) — `compute.ts` gibt dafür jetzt automatisch eine Warnung aus
(„letzter aktiver Tag hat Hotel=ja …" bzw. „erster aktiver Tag ohne Hotel-Flag …"), muss aber weiterhin manuell
pro Fall korrigiert werden (Zeile im Ergebnis austauschen, `compute.ts` erneut laufen lassen).

## Rechnungslayout (Höcker-Service-Report-Stil)

Pro Monteur ein Haupt-Positions-Block mit bis zu 9 Sub-Positionen (Positionen mit Menge 0 weglassen):

1. `Montagekosten [Name]` — `subtotals.montage_werktag_h` × `subtotals.montage_werktag_betrag`
2. `Montagekosten Samstag [Zuschlag]% [Name]` — `subtotals.montage_samstag_*`
3. `Montagekosten Sonntag [Zuschlag]% [Name]` — `subtotals.montage_sonntag_*`
4. `Montage-Fahrt [Name]` — `subtotals.fahrt_werktag_*`
5. `Montage-Fahrt Samstag [Zuschlag]% [Name]` — `subtotals.fahrt_samstag_*`
6. `Montage-Fahrt Sonntag [Zuschlag]% [Name]` — `subtotals.fahrt_sonntag_*`
7. `Spesen 8/H` — Summe der `spesen_days` mit `kind: halbtag`
8. `Spesen 24/H` — Summe der `spesen_days` mit `kind: volltag`
9. `Hotelkosten p.P.` — `hotel_naechte` × `hotel_betrag`

**Nach den Monteur-Blöcken (falls `vehicles[]` nicht leer):** ein zusätzlicher Haupt-Positions-Block
`Geräte [KW]`, darunter eine Sub-Position je Eintrag in `vehicles[]` (Label + `km_total` × `betrag`).

Am Ende: Zusammenstellung pro Monteur + Geräte, `summe_netto`, `mwst_betrag`, `summe_brutto` — alle Werte
**wörtlich aus dem `compute.ts`-Output**, niemals nachgerechnet.

## Preset-Config (Startpunkt beim Onboarding)

```json
{
  "vat_rate": 0.19,
  "tiers": {
    "top": { "montage": 40, "fahrt": 33 },
    "mid": { "montage": 38, "fahrt": 31 },
    "std": { "montage": 35, "fahrt": 30 }
  },
  "default_tier": "std",
  "zuschlag_samstag": 0.25,
  "zuschlag_sonntag": 0.50,
  "weekend_days": [6, 0],
  "pflicht_pause_h": 0.5,
  "daily_cap_total_h": 17,
  "pause_pre_applied": true,
  "anreise_km_ab_firmensitz": true,
  "spesen": { "volltag_24h": 30, "halbtag_8h": 15 },
  "hotel_cost": 85,
  "kfz_rate_per_km": 0.75,
  "vehicles": {},
  "people": {}
}
```

`people` und `vehicles` werden im Onboarding aus der Preisliste/den Fahrzeugen der Firma befüllt (Frage 4 in
`reference/onboarding.md`, dort Option „Montagebau-Preset (Montage-/Fahrt-Satz getrennt, Sa/So getrennt,
Geräte-Position)" statt der einfachen Ein-Satz-Variante).
