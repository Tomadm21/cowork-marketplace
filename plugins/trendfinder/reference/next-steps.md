# Next-Steps-Auswahlblock (Pflicht am Ende jeder Antwort)

Jede Trendfinder-Skill-Antwort endet mit einem **interaktiven Auswahlblock**. Der Nutzer kommt mit *einem Klick* weiter, ohne zu tippen.

## Auswahl-Mechanik (gilt für ALLE Auswahlen in Trendfinder-Skills)

Der Auswahlblock ist ein Aufruf des interaktiven Frage-Tools (**`AskUserQuestion`**), das Cowork als klickbare Options-UI rendert — **NICHT** eine nummerierte Textliste im Chat. Eine Textliste zwingt den Nutzer zu tippen und ist ein Fehler, außer das Tool existiert im Environment nicht (nur dann: nummerierte Liste als Fallback).

Das gilt nicht nur für den Next-Steps-Block, sondern für **jede** Nutzer-Auswahl in jedem Trendfinder-Skill: Avatar-Wahl, Nischen-Wahl, Trend-Wahl, Ziel-Wahl, Limit-Wahl, Freigeben/Zurück/Verwerfen.

Regeln für den Tool-Aufruf:

- **Maximal 4 Optionen pro Frage** (Tool-Limit; ein Freitext-„Other" ergänzt Cowork automatisch — es ersetzt die ✏️-Escape-Option). Bei mehr Kandidaten: die 4 sinnvollsten zeigen, der Rest ist über Freitext erreichbar — das sagst du im Fragetext dazu.
- Die ⭐-Empfehlung ist **Option 1** und ihr Label endet mit „(Empfohlen)".
- Jede Option bekommt eine 1-zeilige `description` (was passiert bei Klick / warum sinnvoll).
- Zusammengehörige Fragen (z. B. Trend + Ziel in script-studio) in **einen** Tool-Aufruf mit mehreren Fragen packen — kein Hin und Her.
- Die nummerierten Beispiel-Blöcke in den Skill-Dateien zeigen den **Inhalt** der Optionen — gerendert werden sie IMMER über das Tool, nicht als Text abgetippt.

## So generierst du den Next-Steps-Block

Präsentiere am Ende deiner Antwort die im aktuellen Zustand sinnvollsten nächsten Aktionen (Liste unten, max. 4) als `AskUserQuestion`-Aufruf und markiere **genau EINE** als ⭐ Empfehlung — passend zu dem, was du gerade getan hast. Der Nutzer wählt eine Option aus; danach führst du diese Aktion (bzw. den zugehörigen Skill) aus.

## Die Optionen (alles, was man mit Trendfinder machen kann)

- 📈 **Trends ansehen** — Cockpit mit Top-Trends & Signalen
- 🔥 **Jetzt scrapen** — frische Trends holen (kostet Apify-Credits, fragt vorher)
- ✍️ **Skript schreiben** — Hooks + Kurzvideo-Skript zu einem Trend in Avatar-Stimme
- 🗂️ **Content-Plan** — Ideen aus Avatar-DNA + Trends vorschlagen und als Ideen speichern
- ✅ **Freigeben / Review** — geschriebene Skripte durchsehen und freigeben (Stage → done)
- 🎭 **Avatar anlegen / bearbeiten** — Marke + Persona + DNA
- ⏰ **Zeitplan verwalten** — automatische 24/7-Scrapes ein-/ausschalten (braucht einen einmalig im Backend hinterlegten Apify-Token; der `scheduler`-Skill prüft das, bevor er aktiviert)
- ⚙️ **Einrichtung / Verbindung** — Setup prüfen oder neu verbinden

## ⭐-Empfehlung nach Kontext (markiere genau eine)

| Gerade getan | ⭐ Empfehlung |
|---|---|
| Onboarding fertig, noch kein Scrape | 🔥 Jetzt scrapen |
| Scrape fertig | 📈 Trends ansehen |
| Trends angesehen, Avatar existiert | ✍️ Skript schreiben |
| Trends da, noch keine Ideen | 🗂️ Content-Plan |
| Ideen da, noch kein Skript | ✍️ Skript schreiben |
| Skript geschrieben, nicht freigegeben | ✅ Freigeben / Review |
| Trends angesehen, KEIN Avatar | 🎭 Avatar anlegen |
| Avatar angelegt | ✍️ Skript schreiben (oder 🔥 scrapen, falls noch keine Trends) |
| Skript fertig | ✍️ Nächstes Skript / 📈 Trends ansehen |
| Sonst / unklar | 📈 Trends ansehen |

## Zustands-Regeln (nur sinnvolle Optionen zeigen)

- **Kein Avatar angelegt** → „Skript schreiben" NICHT als ⭐; stattdessen 🎭 „Avatar anlegen".
- **Keine Trends vorhanden** → ⭐ = 🔥 „Jetzt scrapen".
- **Setup unvollständig / nicht verbunden** → ⭐ = ⚙️ „Einrichtung".

## Onboarding-Sonderregel

Im `onboarding`-Skill erscheint dieser Auswahlblock **NICHT nach jedem Schritt** — nur **einmal am Ende** (nach dem Cockpit-Hand-off). Während des Onboardings führen die einzelnen Schritt-Auswahlen (die einzelnen Schritte) durch; der große Next-Steps-Block kommt erst zum Abschluss.
