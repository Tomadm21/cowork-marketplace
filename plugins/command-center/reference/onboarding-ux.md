# Onboarding UX — how every Command Center skill asks

The single, shared way to collect setup info: **simple, precise, tap-don't-type.** Read this whenever you run `firm-onboarding` or any process's onboarding sub-flow. Everything here applies to both.

Three rules carry the whole experience:

1. **Propose, don't interrogate** — detect first, ask only to confirm.
2. **Always selectable** — every question is a short numbered list the user answers with one number.
3. **Always escapable** — every question also offers free-text; optional ones also offer skip.

The user never edits a file, never opens a terminal, never types a path they could pick.

---

## 1. Golden rule — detect first, ask second

Before asking **any** path / entity / list question, **look at the workspace** (`workspace_root` from `company-context.md`). List the top folders and the relevant subfolders, then infer candidates from their names:

| If a folder name contains… | …propose it as |
|---|---|
| `Buchhaltung`, `Buchführung`, `Accounting` | the accounting / Buchhaltung target |
| `Rechnungsausgang`, `Ausgangsrechnung`, `Invoices out` | invoice output |
| `Bauvorhaben`, `Baustellen`, `Projekte`, `Projects`, `Kunden` | the projects/sites register + per-project paths |
| `Lieferschein`, `Lager`, `Warehouse` | delivery-note / warehouse filing |
| `Personal`, `Stundenzettel`, `Mitarbeiter`, `Staff` | the people / timesheet source |
| two or more top-level company folders (e.g. `001 … GmbH`, `002 … GmbH`) | multiple legal entities |

**Present what you found as the options.** Ask the user to confirm or correct — never to type from scratch what you can already see. If the workspace is empty or unclear, fall back to asking — but still as options wherever the answer space is knowable (legal form, VAT rate, yes/no).

This is what makes onboarding *both* simpler (fewer things to type) *and* more precise (real folders, not guessed paths).

**A detection is a guess — label it as one.** A confidently-asserted *wrong* default is worse than a blank prompt, because the user rubber-stamps it and corrupts every later run. So never state a detected value as fact. State it as a hypothesis with its reason, and make confirming explicit:
> *„Ich vermute, **`001. Buchhaltung/Rechnungsausgang`** ist dein Rechnungsausgang — weil der Ordner so heißt. Stimmt das?"*
Low-confidence guesses say so („unsicher — bitte prüfen"). This is the same honest-status discipline the processes use at run time, pushed into detection.

**Bounded scan.** A real firm folder has thousands of files. Scan **top-level first**, expand only the branches you need, cap depth (~3 levels), and **ignore** image/scan dumps, archives, and `node_modules`-style folders. Show the **top candidates**, then „… oder mehr anzeigen". Never read file *contents* during a scan — folder names only.

**Empty / greenfield branch.** If there's little or nothing to detect (a fresh firm), don't hit a dead prompt — switch to: *„Ich habe noch keine Struktur gefunden. Ich kann dir eine saubere Ordnerstruktur vorschlagen und anlegen — möchtest du das?"* and offer the standard `_firma/_eingang/_ausgang` scaffold (firm-config-contract §1) as the starting point.

---

## 2. The selectable-answer convention (every question)

Render each question as a short numbered list. The user replies with a single number (or letter). Always this shape:

> **‹Question›?**
> 1. ‹most-likely option›  — *„in deinem Ordner gefunden"* (mark detected ones)
> 2. ‹next option›
> 3. ‹…›
> ✏️ **Selbst eingeben** — *schreib einfach deine Antwort*
> ⏭️ **Überspringen / weiß nicht** *(only on optional questions)*
>
> *Vorschlag: 1*

Hard rules:

- **The ✏️ free-text choice is mandatory on every question.** The user must always be able to write instead of pick. Never present a question without it.
- Show **⏭️ Überspringen** only when the field is optional — and the firm must be able to **finish** even if they skip every optional one.
- Always offer a **sensible default** and name it (`Vorschlag: 1`) so the user can just confirm.
- Keep it to ~3–6 options. More than that → group, or end with „… oder mehr anzeigen".
- **Multi-select** questions say so explicitly: *„mehrere möglich, z.B. `1,3,5`"*.
- **Plain labels, never keys.** What the user reads is plain language; a `config_key` is only the storage target — never show backticked key names or implementation words (script names, file formats) as the question itself.
- **Some answers are inherently open** — a person's name, an hourly rate, ICP keywords. There's nothing to enumerate, so the ✏️ free-text field *is* the answer (still offer ⏭️ if optional). That's expected, not a failure of the convention — don't fake numbered options for genuinely open values. Detect-first still helps: propose names/rates found in the workspace as the starting text to confirm.
- Mirror the firm's language (German default; switch if they answer in another).
- Cowork has **no clickable-button primitive** — this is plain numbered text and must read perfectly as text. If a richer chooser is ever available it's used automatically, because the instruction is simply "offer selectable options".

---

## 3. Confirm in bulk, edit by exception — the simpler lever

Forty tappable questions is still exhausting. The thing that makes onboarding actually *feel* simple: **when you've detected a lot, show it all at once and confirm in one move.** Don't walk the user through every field one prompt at a time when you already have good guesses.

> 🔍 Das habe ich in deinem Ordner gefunden:
> 1. Firma: **001 Muster Bau GmbH** *(GmbH)*
> 2. Rechnungsausgang: `001. Buchhaltung/Rechnungsausgang` — *vermutet*
> 3. Baustellen-Register: `002.1. Bauvorhaben 2026/` (12 Kunden) — *vermutet*
> 4. Buchhaltung: `001. Buchhaltung/Buchhaltung 2026`
>
> **Alles übernehmen?**
> ✅ **Ja, passt** · ✏️ **Ändern** — Nummer nennen, dann auswählen *oder* einfach den richtigen Wert schreiben · ➕ **etwas fehlt**

The user accepts everything with one tap, or names just the numbers that are wrong. Only the corrections become a back-and-forth. Reserve **one-question-at-a-time** for the things you genuinely *couldn't* detect (rates, a legal threshold, a yes/no rule).

Still: **batch by topic, show progress** (`Schritt 2 von 6`), never dump raw walls of questions, and echo what was captured after each batch. **Each per-process onboarding shows its own progress too** (`Schritt 2 von 5`), and at the very start name the shape — *erst die Firma einrichten, dann ein kurzes Setup pro Prozess, den du wählst* — so the two-phase flow is no surprise. If little was detectable (messy or greenfield folders), say so honestly — there'll be a few more questions because there was less to confirm.

---

## 4. The path-picker (use for every folder/path question)

Paths are **browsed, not typed.** Whenever a path is needed:

1. **Propose the detected default first** — e.g. *„Vorschlag (gefunden): `001 … GmbH/001. Buchhaltung/Buchhaltung 2026`"*.
2. Offer these actions as numbered options:
   1. ✅ **Diesen Ordner nehmen** (the proposed / currently-open one)
   2. 📂 **Unterordner öffnen** → list children, drill in (repeat from step 2)
   3. ⬆️ **Eine Ebene hoch**
   4. ➕ **Neuen Unterordner anlegen** (ask the name; create it on confirm)
   5. ✏️ **Pfad eingeben** (free-text)
   6. 🏠 **Workspace-Standard** (`_ausgang/‹…›`)
3. **Multi-target:** when one document can go to several folders (e.g. a Rechnung → Buchhaltung **and** Baustelle **and** „Offene Rechnungen"), let the user pick **several** targets — repeat the picker, collect a list, show the list back.
4. **Pattern paths (placeholders):** when the target depends on per-run values (Kunde, Baustelle, KW, Jahr, Monat), capture the path as a **pattern** with `‹placeholders›` — e.g. `Bauvorhaben ‹Jahr›/‹Kunde›/‹Baustelle›/8.Bautagesberichte`. Pick the fixed part; mark the variable parts. Store the pattern; fill placeholders at run time. Explain placeholders to the user in plain words once (*„den Kunden- und Baustellen-Ordner fülle ich pro Auftrag automatisch"*) — never show raw `‹angle-brackets›` without a word of explanation.
5. **Run-time resolution — match or create, never duplicate.** When a pattern variable resolves to a folder that doesn't exist yet (a new or mistyped Kunde/Baustelle), **first list the existing siblings** and offer to match one — *„Meintest du `Meier`? Oder neuen Ordner `Maier` anlegen?"* — then create only on explicit confirm. **Never silently `mkdir` a near-duplicate** next to the real folder, and never write to an unconfirmed or invented path. (This is the highest-consequence runtime path — a typo here splits a project across two folders.)
6. **Path fidelity.** Round-trip folder names **verbatim** — leading numbers, dots, spaces, umlauts (`001. Buchhaltung`, `002.1. Bauvorhaben 2026`) must be preserved exactly. A **typed** path is accepted only after validating it (it exists, or its parent does, and it is **inside the workspace**).
7. Always **confirm the final path(s)** back before storing them in config.

---

## 5. Confirm & store

After each batch, echo what you captured (*„Gefunden / gewählt: …"*) and write it to the right file (firm-level → `company-context.md` anchors; process-level → `config/‹process›.json` keys). Re-runs **overwrite the same keys** (idempotent — see `firm-config-contract.md` §2/§6). Note each value's provenance lightly — **detected · bestätigt · eingegeben** — so a later run can re-offer the detected guesses for a quick re-confirm. **Provenance is a separate marker, never mixed into the value itself** — the config stores `"Müller"`, not `"Müller (detected)"`; a confidence/guess label lives in chat (or an optional sidecar key), never inline, so downstream skills always read a clean value.

**Only confirmed values are stored.** A detected-but-not-yet-confirmed guess is never written to config — so on resume you simply re-scan (it's bounded and cheap) rather than persisting half-trusted candidates. A resumed run re-confirms only what's marked *detected*, and never re-asks values already marked *bestätigt* / *eingegeben*.

---

## 6. Tone

Warm, plain, non-technical. One screenful at a time. Always a way forward: pick a number, type your own, or skip.

---

## 7. One worked example — mirror this shape

> 🔍 Ich habe deinen Ordner angeschaut und **zwei Gesellschaften** gefunden.
>
> **Für welche Firma richten wir die Belegablage ein?**
> 1. **001 Muster Bau GmbH** — gefunden
> 2. **002 Muster Montage GmbH** — gefunden
> 3. Beide
> ✏️ Selbst eingeben
>
> *Vorschlag: 3 (beide).*
>
> → *User:* `1`
>
> **Wohin sollen Rechnungen abgelegt werden?**  *(Pfad-Auswahl)*
> Vorschlag (gefunden): `001 Muster Bau GmbH/001. Buchhaltung/Buchhaltung 2026/‹Monat›/Ausgaben`
> 1. ✅ Diesen Pfad nehmen
> 2. 📂 Unterordner öffnen
> 3. ➕ Neuen Unterordner anlegen
> 4. ✏️ Pfad eingeben
> 5. 🏠 Workspace-Standard (`_ausgang/belege`)
>
> *`‹Monat›` wird pro Beleg automatisch gefüllt (z.B. `04-26`).*

Two questions, barely a keystroke, a free-text escape on every one, a real detected path, and a placeholder resolved per run. That is the whole experience.
