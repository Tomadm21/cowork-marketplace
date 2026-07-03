---
name: guided-setup
description: Geführter Willkommens-Rundgang für Erstnutzer — erklärt Cowork und das Command Center und führt EINMAL durch einen kompletten Zyklus (Datei reinlegen → verarbeiten → im Chat freigeben → Dashboard), sodass der Nutzer am Ende alle Funktionen einmal selbst gesehen hat. Use when the user says "erklär mir das", "wie fange ich an", "zeig mir wie das geht", "ich bin neu", "richte alles ein und erklär es mir", "onboarding mit Erklärung", "guided tour", "walk me through it", "erste Schritte", "los geht's" — oder bei der allerersten Einrichtung, wenn der Nutzer KI/Cowork noch nicht kennt. Für die reine Einrichtung ohne Erklärung: firm-onboarding / process-catalog.
---

# Geführter Rundgang — einmal alles zusammen machen

Ziel: Ein **KI-Erstnutzer** (Bauleiter, Büro) versteht am Ende, was Cowork und das Command Center können —
**weil er es einmal selbst gemacht hat**, nicht weil er ein Handbuch gelesen hat. Ein einziger, warmer
Durchlauf: kurz erklären, sofort ausprobieren, an jeder Station ein sichtbares Ergebnis.

> **Grundhaltung: zeigen statt dozieren.** Jede Station ist **ein Häppchen + eine Handlung**. Nie mehr als
> ein Bildschirm Text am Stück. Immer eine tappbare Wahl (weiter · überspringen · direkt einrichten).
> Sprache = die des Nutzers (Deutsch als Default). Folge `${CLAUDE_PLUGIN_ROOT}/reference/onboarding-ux.md`
> für jede Frage (nummerierte Optionen + ✏️ + ⏭️).

**Jederzeit überspringbar.** Wer schon weiß, was er will, sagt „überspring die Erklärung" → direkt zu
`/command-center:setup`. Der Rundgang ist ein Angebot, keine Pflicht — sag das gleich zu Beginn.

## Station 0 — Willkommen (30 Sekunden)

Begrüße warm und sag in **drei Sätzen**: (1) was das Command Center dir abnimmt — „Belege ablegen, Fotos
sortieren, Tagesberichte und Rechnungen — du wirfst rein, ich mache die Arbeit, du gibst frei", (2) dass
ihr das **jetzt einmal zusammen durchspielt**, damit er es danach allein kann (~10 Minuten), (3) dass er
**nichts kaputt machen** kann — nichts wird abgelegt, gesendet oder gelöscht ohne sein OK.

Dann die Wahl:
> 1. ▶️ **Los, zeig mir alles** *(empfohlen beim ersten Mal)*
> 2. 🏃 **Nur einrichten, ohne Erklärung** → `/command-center:setup`
> 3. ❓ **Erst kurz: was ist Cowork überhaupt?** → Station 1

## Station 1 — Cowork in 5 Punkten (je ein Satz)

Zeig die 5 Grundlagen aus `${CLAUDE_PLUGIN_ROOT}/reference/cowork-basics.md` — **einen nach dem anderen**,
je ein Satz mit Alltagsbild (Chat = Bedienung · Ordner = Aktenschrank · Eingang = reinwerfen · Freigabe
im Chat · Dashboard rechts). Nach Punkt 5 kurz prüfen: „Ergibt das Sinn? Dann richten wir jetzt deine
Firma ein." Keine Rückfrage-Schleife — das echte Verständnis kommt im Probelauf (Station 4).

## Station 2 — Firma einrichten

Sag, was jetzt kommt („einmal ein paar Fragen zu deiner Firma — ich schaue zuerst selbst in deinen Ordner
und schlage vor, du musst nur bestätigen"). Dann invoke **firm-onboarding**. Wenn `_firma/company-context.md`
schon existiert: nicht neu aufsetzen — sag „deine Firma ist schon eingerichtet ✅" und geh zu Station 3.

Nach dem Onboarding **einen Satz Rückmeldung**, was angelegt wurde (Ordnerstruktur + Kontext), damit der
Nutzer den „Aktenschrank" jetzt konkret vor sich hat.

## Station 3 — Einen ersten Prozess wählen (nur EINEN für den Rundgang)

Nicht den ganzen Katalog auf einmal — für den Rundgang **einer reicht**. Zeig die Prozesse aus
`${CLAUDE_PLUGIN_ROOT}/reference/workflows.json` kompakt (Titel + Einzeiler) und empfiehl den einfachsten
Starter (`starter: true`, i. d. R. **Belege ablegen** oder **Fotos sortieren** — wenig Einrichtung, sofort
ein Ergebnis, ideal zum Üben):
> **Womit üben wir? Einer reicht fürs Erste — die anderen kannst du später jederzeit dazunehmen.**
> 1. 🗂️ **Belege ablegen** *(empfohlen zum Üben — schnell)*
> 2. 📷 **Fotos sortieren**
> 3. 📋 Tagesbericht · 4. 🧾 Rechnungen
> ✏️ … · ⏭️ **Alle später einrichten, jetzt nur den Rundgang**

Invoke die Onboarding-Sub-Flow des gewählten Prozesses (über die jeweilige Skill; sie schreibt
`_firma/config/<prozess>.json`). Halte es **kurz** — beim Üben nur das Nötigste, Feineinstellungen später.

## Station 4 — Der Probelauf: einmal echt durch den Zyklus ⭐

Das Herz des Rundgangs. Hier lernt der Nutzer alles, indem er es **einmal tut**.

1. **Etwas in den Eingang legen.** Biete an:
   > 1. 📎 **Ich lege dir ein Beispiel rein** *(zum gefahrlosen Üben)*
   > 2. 📄 **Ich häng gleich eine echte Datei an** *(z. B. einen Beleg)*
   - Bei **Beispiel**: kopiere `${CLAUDE_PLUGIN_ROOT}/skills/guided-setup/assets/beispiel-beleg.txt` nach
     `<workspace>/_eingang/beispiel-beleg.txt`. Sag klar, dass das eine **erfundene Beispiel-Rechnung** ist.
   - Bei **echt**: bitte den Nutzer, die Datei in den Ordner `_eingang/` zu ziehen oder hier anzuhängen —
     und erkläre **beim Tun** Punkt 3 der Cowork-Basics („genau das ist ‚reinwerfen'").
2. **Verarbeiten.** Sag „jetzt sag mir einfach: **verarbeite alles**" (oder tu es auf sein OK selbst) →
   invoke **intake**. Erklär in einem Satz mit, was gerade passiert („ich schaue rein, erkenne, dass das
   ein Beleg ist, und lese Lieferant/Nummer/Betrag/Datum aus").
3. **Freigeben — hier sieht er das Wichtigste.** Wenn die Review-Queue steht, invoke **review-board**:
   zeig die **editierbare Karte** mit den Knöpfen und **erkläre die Knöpfe beim Zeigen** — „**Übernehmen**
   = so ablegen · in ein Feld tippen = korrigieren · **Ablehnen** = verwerfen · **Freigeben (Prozess)** =
   alles auf einmal speichern". Lass den Nutzer **selbst** freigeben (der Lerneffekt steckt im eigenen
   Klick). Nichts wird vorher bewegt.
4. **Ergebnis zeigen.** Nach der Freigabe: sag **wohin** die Datei gelegt wurde (Pfad) und dass der
   Eingang unverändert blieb (Original bleibt). „Das war ein kompletter Durchlauf — genau so läuft ab
   jetzt jeder."

Wenn der Probelauf hakt (kein `present_files`, kein Widget): auf die getippte Chat-Review ausweichen
(`${CLAUDE_PLUGIN_ROOT}/reference/chat-review.md`) — gleiche Engine, gleiches Ergebnis.

## Station 5 — Das Dashboard (der Rückspiegel)

Invoke **dashboard**. Wenn es rechts im Live-Artifacts-Tab aufgeht, erklär in zwei Sätzen, was er sieht
(Stunden gespart, Verlauf, „Zuletzt abgelegt") und dass es **nur zum Anschauen** ist — gearbeitet wird
im Chat. „Sag jederzeit ‚zeig das Dashboard', dann ist es wieder aktuell."

## Station 6 — Abschluss: so nutzt du es ab jetzt

Fass in **einem kurzen Block** zusammen und gib die **drei Zauberformeln** mit
(`reference/cowork-basics.md` unten): „verarbeite alles" · „zeig offene Freigaben" · „zeig das Dashboard".
Dann konkret die nächsten zwei Schritte anbieten:
> Du hast jetzt alles einmal gesehen 🎉 Wie weiter?
> 1. ➕ **Weitere Prozesse einrichten** (Fotos, Tagesbericht, Rechnungen) → process-catalog
> 2. ⏰ **Automatik einschalten** (stündlich Eingang prüfen) → `reference/automation.md`, mit ehrlichem App-offen-Hinweis
> 3. ✅ **Erstmal so lassen** — „wirf einfach was in den Eingang und sag ‚verarbeite alles'"

Biete das Beispiel-Aufräumen an, falls eins angelegt wurde: „Soll ich die Beispiel-Datei wieder entfernen?"
(nur die Beispiel-Datei, nie echte Daten).

## Done means

- Der Nutzer hat Cowork-Basics gehört **und** einen echten End-to-End-Zyklus selbst durchlaufen
  (reinlegen → verarbeiten → im Chat freigeben → Ergebnis → Dashboard).
- Firma ist eingerichtet, mindestens ein Prozess ist onboardet, das Dashboard wurde einmal gezeigt.
- Der Nutzer kennt die drei Zauberformeln und weiß, wie es weitergeht.
- Nichts wurde ohne ausdrückliche Freigabe abgelegt/gesendet/gelöscht; ein etwaiges Beispiel ist als
  solches markiert und wird auf Wunsch entfernt.
