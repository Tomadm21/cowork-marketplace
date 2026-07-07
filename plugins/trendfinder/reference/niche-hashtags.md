# Hashtag-Ableitung — die wichtigste Stellschraube für brauchbare Trends

**Diese Datei ist das Ableitungs-Regelwerk, das Claude auf sich selbst anwendet** — keine Tipp-Hilfe für einen Nutzer, der Hashtags einträgt. Claude leitet die Scrape-Themen einer Niche selbst ab, aus **Nischen-Thema, Avatar-DNA und Sprache/Region**, und **prüft die abgeleitete Liste gegen die Regeln unten selbst, bevor sie dem Nutzer gezeigt wird** (siehe „Selbst-Check vor dem Zeigen" unten).

Warum das die wichtigste Stellschraube ist: Der Scraper holt genau die Videos, die die Plattform unter den **Hashtags der Nische** ausspielt. Zu breite, zu generische oder fremdsprachige Tags ziehen **globalen viralen Content aus fremden Nischen** (Tech, Gaming, Gym, Hustle) — dann bestehen die „Trends" aus Themen, die nichts mit dem Kunden zu tun haben. Das ist der häufigste Grund für unbrauchbare Trends und schlechte Skripte — **nicht** ein kaputter Avatar.

## Die 5 Regeln

Diese Regeln gelten für **jede Ableitung** — beim ersten Anlegen einer Niche genauso wie beim Neu-Ableiten einer bestehenden.

1. **Spezifisch ableiten, nicht breit.** Mega-Tags wie `#mindset`, `#motivation`, `#transformation`, `#success`, `#highperformer`, `#viral`, `#fyp` sind global von Tech-/Gym-/Hustle-/Gaming-Content belegt — sie dürfen nie das Ergebnis einer Ableitung sein. Leite stattdessen enge, themen-definierende Tags ab: `#nervensystemregulieren` statt `#mindset`, `#journalingprompts` statt `#innerwork`.
2. **Sprache + Region aus dem Zielpublikum ableiten.** Publikum in DACH → leite **deutsche** Hashtags ab (`#persönlichkeitsentwicklung`, `#selbstfürsorge`, `#achtsamkeit`). Englische Tags liefern überwiegend US-Content, der am DACH-Publikum vorbeigeht.
3. **Konkrete Themen/Formate ableiten, keine abstrakten Werte.** Enthält die Avatar-DNA abstrakte Markenwerte (z. B. „Lebendigkeit", „Fülle", „Identität", „Selfmastery"), dürfen die nicht 1:1 zu Tags werden — leite daraus konkrete Themen/Formate ab: `#achtsamkeitsübung`, `#atemübung`, `#grwm`, `#morgenroutine` matchen echte Video-Tags; `#lebendigkeit`, `#fülle`, `#identität`, `#selfmastery` matchen fast nichts (oder das Falsche).
4. **5–10 präzise Tags ableiten, nicht 15 breite.** Leite lieber wenige treffsichere Tags ab als viele, die die Ergebnismenge mit Fremd-Content fluten.
5. **Nach dem ersten Scrape gegenprüfen.** Auch eine sorgfältige Ableitung kann danebenliegen: Passen die Trends zum Thema? Taucht Fremd-Content auf (Gaming, Tech, Random) → die abgeleiteten Tags waren zu breit; neu ableiten und neu scrapen. Lieber wenige, aber themen-echte Trends als viele falsche.

## Selbst-Check vor dem Zeigen

Bevor Claude eine abgeleitete Tag-Liste dem Nutzer zeigt, läuft dieser Check auf der **eigenen** Ableitung — das ist die erste Verteidigungslinie gegen Dore-artige Fehltreffer (siehe Negativbeispiel unten), lange bevor überhaupt gescrapt wird:

- [ ] **Mega-Tags raus?** Keiner der generischen Mega-Tags (`#mindset`, `#motivation`, `#transformation`, `#success`, `#highperformer`, `#viral`, `#fyp`, …) ist in der Liste (Regel 1).
- [ ] **Sprache/Region korrekt?** Alle Tags passen zur Sprache/Region des Zielpublikums — bei DACH durchgängig deutsch, keine einzelnen englischen Ausreißer (Regel 2).
- [ ] **Konkret statt abstrakt?** Keine abstrakten Markenwerte 1:1 als Tag übernommen (`#lebendigkeit`, `#fülle`, `#identität`, `#selfmastery`); stattdessen konkrete Themen/Formate (Regel 3).
- [ ] **5–10 Tags, nicht mehr/weniger?** Die Liste ist auf 5–10 präzise Tags eingedampft (Regel 4).

Schlägt einer dieser Punkte fehl: **vor dem Zeigen** verwerfen und ersetzen — nicht die fehlerhafte Liste zeigen und auf ein „passt schon" hoffen. Der Check gilt auch für **jede erneut gezeigte** Liste, nicht nur die erste: Schlägt ein Nutzer-Nudge selbst einen geblockten Tag vor (z. B. „nimm stattdessen #mindset"), übernimm ihn nicht ungeprüft — kurz erklären, warum (Regel 1/2/3), und eine konkrete, on-topic Alternative vorschlagen.

## Echtes Negativbeispiel (aus einem realen Launch)

Eine Coaching-Nische (Persönlichkeitsentwicklung / Nervensystem, DACH, weiblich) wurde mit den Tags `mindset`, `highperformer`, `transformation`, `highenergy`, `selfmastery` eingerichtet — alle **englisch und generisch**. Ergebnis nach dem Scrape:

- Häufigster Hashtag in den gescrapten Videos war **`techtok` (28×)** — noch vor `mindset`.
- **61 % der Videos trugen keinen einzigen der konfigurierten Tags** — die Plattform lieferte für `#mindset`/`#highperformer` das „Aesthetic-Desk-Setup + Motivations-Caption"-Genre, co-getaggt mit `#techtok #gaming #setup`.
- Die Top-Cluster hießen dann **„Minimalist Gaming Setup Showcase"**, „Smartphone Feature Comparison" — dominante Hashtags `techtok`, `gamingsetup`, `tech`. Null Bezug zur Nische.

**Fix:** deutsche, spezifische Tags — z. B. `#nervensystem`, `#nervensystemregulieren`, `#selbstregulation`, `#achtsamkeit`, `#persönlichkeitsentwicklung`, `#stressbewältigung`, `#selbstfürsorge`, `#emotionaleregulation` — und neu scrapen. On-topic bei kleinerer Menge schlägt viral bei falschem Thema.

Genau dieser Fall — Mega-Tags, englisch, ungeprüft übernommen — ist der Grund für den Selbst-Check oben: eine Ableitung, die durch dessen vier Punkte läuft, hätte `mindset`/`highperformer`/`transformation`/`highenergy`/`selfmastery` nie an den Nutzer ausgegeben.

## Relevanz-Check (für die Read-Skills: trend-radar, trend-briefing, cockpit)

**Ergänzt den Selbst-Check oben:** davor gut ableiten (Regeln 1–4 + Selbst-Check), danach gegenprüfen (Regel 5) — dieser Abschnitt bleibt unverändert der post-Scrape-Check für die Read-Skills.

Bevor du Trends präsentierst: Vergleiche die `dominant_hashtags` der Top-Cluster mit den **konfigurierten Nischen-Hashtags** (`GET /api/niches/config`) und dem Nischen-Thema.

- **Klarer Themen-Bruch** (z. B. Top-Cluster dominiert von `techtok`/`gaming`/`setup`, aber die Nische ist „Persönlichkeitsentwicklung") → **offen ansagen**, nicht als „deine Trends" verkaufen:
  > „⚠️ Die aktuell gefundenen Trends passen nicht zu deiner Nische — die dominanten Hashtags (`techtok`, `gaming`, …) kommen aus einer fremden Ecke. Ursache ist fast immer: die Nischen-Hashtags sind zu breit oder englisch und haben globalen Fremd-Content gezogen. Empfehlung: Hashtags verfeinern (deutsch, spezifisch) und neu scrapen."
- Dann konkret 5–8 bessere Tags vorschlagen (aus dem Nischen-Namen / der Avatar-DNA abgeleitet) und anbieten, sie zu setzen (`PUT /api/niches/config/{niche_id}`) + neu zu scrapen.
- **Heuristik für „Bruch":** Wenn **keiner** der Top-3-Cluster in seinen `dominant_hashtags` einen der Nischen-Tags (oder ein klar themenverwandtes Wort) trägt, ist es mit hoher Wahrscheinlichkeit Fremd-Content.

Das ist native Claude-Einschätzung — kein Backend-Feature. Ehrlich sein schlägt „irgendwas Buntes zeigen".
