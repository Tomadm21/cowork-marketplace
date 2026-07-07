# Hashtag-Qualität — die wichtigste Stellschraube für brauchbare Trends

Der Scraper holt genau die Videos, die die Plattform unter den **Hashtags der Nische** ausspielt. Zu breite, zu generische oder fremdsprachige Tags ziehen **globalen viralen Content aus fremden Nischen** (Tech, Gaming, Gym, Hustle) — dann bestehen die „Trends" aus Themen, die nichts mit dem Kunden zu tun haben. Das ist der häufigste Grund für unbrauchbare Trends und schlechte Skripte — **nicht** ein kaputter Avatar.

## Die 5 Regeln

1. **Spezifisch statt breit.** Mega-Tags wie `#mindset`, `#motivation`, `#transformation`, `#success`, `#highperformer`, `#viral`, `#fyp` sind global von Tech-/Gym-/Hustle-/Gaming-Content belegt. Nimm enge, themen-definierende Tags: `#nervensystemregulieren` statt `#mindset`, `#journalingprompts` statt `#innerwork`.
2. **Sprache + Region matchen.** Publikum in DACH → **deutsche** Hashtags (`#persönlichkeitsentwicklung`, `#selbstfürsorge`, `#achtsamkeit`). Englische Tags liefern überwiegend US-Content, der am DACH-Publikum vorbeigeht.
3. **Konkrete Themen/Formate statt abstrakter Werte.** `#achtsamkeitsübung`, `#atemübung`, `#grwm`, `#morgenroutine` matchen echte Video-Tags; abstrakte Marken-Werte wie `#lebendigkeit`, `#fülle`, `#identität`, `#selfmastery` matchen fast nichts (oder das Falsche).
4. **5–10 präzise Tags schlagen 15 breite.** Lieber wenige treffsichere als viele, die die Ergebnismenge mit Fremd-Content fluten.
5. **Nach dem ersten Scrape gegenprüfen.** Passen die Trends zum Thema? Taucht Fremd-Content auf (Gaming, Tech, Random) → die Tags waren zu breit; verfeinern und neu scrapen. Lieber wenige, aber themen-echte Trends als viele falsche.

## Echtes Negativbeispiel (aus einem realen Launch)

Eine Coaching-Nische (Persönlichkeitsentwicklung / Nervensystem, DACH, weiblich) wurde mit den Tags `mindset`, `highperformer`, `transformation`, `highenergy`, `selfmastery` eingerichtet — alle **englisch und generisch**. Ergebnis nach dem Scrape:

- Häufigster Hashtag in den gescrapten Videos war **`techtok` (28×)** — noch vor `mindset`.
- **61 % der Videos trugen keinen einzigen der konfigurierten Tags** — die Plattform lieferte für `#mindset`/`#highperformer` das „Aesthetic-Desk-Setup + Motivations-Caption"-Genre, co-getaggt mit `#techtok #gaming #setup`.
- Die Top-Cluster hießen dann **„Minimalist Gaming Setup Showcase"**, „Smartphone Feature Comparison" — dominante Hashtags `techtok`, `gamingsetup`, `tech`. Null Bezug zur Nische.

**Fix:** deutsche, spezifische Tags — z. B. `#nervensystem`, `#nervensystemregulieren`, `#selbstregulation`, `#achtsamkeit`, `#persönlichkeitsentwicklung`, `#stressbewältigung`, `#selbstfürsorge`, `#emotionaleregulation` — und neu scrapen. On-topic bei kleinerer Menge schlägt viral bei falschem Thema.

## Relevanz-Check (für die Read-Skills: trend-radar, trend-briefing, cockpit)

Bevor du Trends präsentierst: Vergleiche die `dominant_hashtags` der Top-Cluster mit den **konfigurierten Nischen-Hashtags** (`GET /api/niches/config`) und dem Nischen-Thema.

- **Klarer Themen-Bruch** (z. B. Top-Cluster dominiert von `techtok`/`gaming`/`setup`, aber die Nische ist „Persönlichkeitsentwicklung") → **offen ansagen**, nicht als „deine Trends" verkaufen:
  > „⚠️ Die aktuell gefundenen Trends passen nicht zu deiner Nische — die dominanten Hashtags (`techtok`, `gaming`, …) kommen aus einer fremden Ecke. Ursache ist fast immer: die Nischen-Hashtags sind zu breit oder englisch und haben globalen Fremd-Content gezogen. Empfehlung: Hashtags verfeinern (deutsch, spezifisch) und neu scrapen."
- Dann konkret 5–8 bessere Tags vorschlagen (aus dem Nischen-Namen / der Avatar-DNA abgeleitet) und anbieten, sie zu setzen (`PUT /api/niches/config/{niche_id}`) + neu zu scrapen.
- **Heuristik für „Bruch":** Wenn **keiner** der Top-3-Cluster in seinen `dominant_hashtags` einen der Nischen-Tags (oder ein klar themenverwandtes Wort) trägt, ist es mit hoher Wahrscheinlichkeit Fremd-Content.

Das ist native Claude-Einschätzung — kein Backend-Feature. Ehrlich sein schlägt „irgendwas Buntes zeigen".
