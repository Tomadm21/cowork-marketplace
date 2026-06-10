---
name: process-catalog
description: Show the available Command Center processes in plain language and help the user choose which to activate, then run each chosen process's onboarding. Use after firm onboarding, or when the user asks "welche Prozesse gibt es", "what can the command center do", "aktiviere einen Prozess", "add a process", "womit soll ich anfangen".
---

# Process catalog

Help the firm pick which processes to activate, then onboard each one. Requires firm onboarding to have run (read `_firma/company-context.md`); if it hasn't, run the `firm-onboarding` skill first.

Present every choice per `${CLAUDE_PLUGIN_ROOT}/reference/onboarding-ux.md` — numbered options, a ✏️ free-text escape, multi-select. Speak to someone using AI for the first time: no jargon, one screen at a time.

## Show the catalog in plain language

Read `${CLAUDE_PLUGIN_ROOT}/reference/workflows.json` and present each process from its plain fields — **title**, **what** (the one-liner), the **trigger** phrase to start it, and the **setup effort**. Don't show raw keys or file names. Keep it to one tappable line each, e.g.:

> **Was soll dein Command Center für dich übernehmen?** *(mehrere möglich, z.B. `1,3`)*
> 1. 🗂️ **Belege ablegen** — Belege/Rechnungen lesen und richtig ablegen · *schnell eingerichtet*
> 2. 📷 **Fotos sortieren** — Baustellen-Fotos benennen und einsortieren · *schnell eingerichtet*
> 3. 📋 **Tagesbericht** — euren Tagesbericht automatisch ausfüllen
> 4. 🧾 **Rechnungen** — aus Stundenzetteln eine fertige Rechnung machen
> 5. 🎯 **Kunden finden** — Kontakte suchen und nach Eignung bewerten
> ✏️ Etwas anderes · ❓ „wie funktioniert Nummer X?"

If they ask **"wie funktioniert X"**, explain that one from its `how` steps + needs/gives in `workflows.json` before they choose. Mark any process already `onboarded` in `cc:processes` as ✅ and offer it for re-config rather than re-listing as new.

## For a firm with no plan: recommend a starter

If the user is unsure where to begin, recommend a process where `starter: true` in the catalog (lowest setup, fast first win) — e.g. *„Die meisten fangen mit 🗂️ Belege ablegen oder 📷 Fotos sortieren an — wenig Einrichtung, sofort ein Ergebnis."* Suggest **one**, don't push.

## Flow

1. Present the catalog as a numbered **multi-select**. 
2. For each newly chosen process: invoke that process's skill — it self-verifies, finds no config, and runs its own onboarding (writes `_firma/config/<process>.json` and the `_eingang/<process>/` drop folder).
3. After each is onboarded, update its line under `cc:processes` in `company-context.md` (status `onboarded`).
4. Offer to set up automation for any onboarded process (point to `${CLAUDE_PLUGIN_ROOT}/reference/automation.md`); be honest about the app-open caveat.
5. **Finish by showing the dashboard** — run the `dashboard` skill so the firm immediately sees their live overview and the recommended next step.

Activating one process never requires another — each is independent (config contract §5).
