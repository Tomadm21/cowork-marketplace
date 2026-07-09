# Next-Steps-Auswahlblock (Pflicht am Ende jeder Antwort)

Jede Trendfinder-Skill-Antwort endet mit einem **interaktiven Auswahlblock** — den selektierbaren Options-UI-Blöcken, die Cowork rendert. Der Nutzer kommt mit *einer Auswahl* weiter, ohne zu tippen.

## So generierst du den Block

Präsentiere am Ende deiner Antwort eine **Auswahl** mit allen im aktuellen Zustand sinnvollen nächsten Aktionen (Liste unten) und markiere **genau EINE** als ⭐ Empfehlung — passend zu dem, was du gerade getan hast. Der Nutzer wählt eine Option aus; danach führst du diese Aktion (bzw. den zugehörigen Skill) aus.

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
