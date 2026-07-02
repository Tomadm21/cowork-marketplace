# Review-Board — UI-Spezifikation (sequenziell pro Prozess)

Drei Bausteine je AKTUELLEM Prozess: (1) pro Posten eine **volle, editierbare Karte** (`show_widget`), (2) **direkt darunter** native **Vorschau-Boxen** (`present_files`, öffnen rechts in der Sidebar), (3) am Ende **ein** „Freigeben (Prozess)"-Widget. Nach dem Freigeben sofort der nächste Prozess. Sprache Deutsch. `runid`/`id` nur intern (Datenattribute).

## Ablauf-Prinzip
- Intake bereitet **alle** Prozesse vor (Queues). Das Board reviewt **nur einen Prozess** zur Zeit (erster offener Queue laut `reference/workflows.json` `order`).
- Reihenfolge im Chat je Posten: **Karte (Infos+Edit) → darunter native Boxen**. So liegen die klickbaren Ressourcen-Boxen unter jeder Freigabe-Box.
- „Freigeben (Prozess)" speichert alle verbliebenen Posten des Prozesses und rendert sofort den nächsten.

## (1) Volle editierbare Karte je Posten (`show_widget`)
Zeigt ALLES und macht es bearbeitbar:
- Kopf: Stufen-Badge (`sicher`/`prüfen`/`folgenreich`) + Titel (`values.lieferant`+`nummer`+`betrag`, sonst `filename`).
- **Editierbare Felder** (Inputs, vorbefüllt):
  - `Dateiname` = `filename`
  - `Speicherort` = `targets` (wohin gespeichert wird; mehrzeilig möglich)
  - typrelevante `values` (Belege: `lieferant, nummer, datum, betrag, belegtyp, kategorie, entity`; Fotos: `standort, datum, taetigkeit`; Bericht-Scans: `jahr, kw, bv, monteure, suffix`; Bericht: `projekt, kw`)
- **Begründung** (`reason`) als Text.
- Buttons: **„Übernehmen"** (sammelt die geänderten Felder, `sendPrompt`), **„Ablehnen"** (`sendPrompt`).

JS-Gerüst:
```html
<script>
function uebernehmen(key, el){
  const c = el.closest('.karte'); const ch=[];
  c.querySelectorAll('[data-feld]').forEach(i=>{ if(i.value!==i.defaultValue) ch.push(i.dataset.feld+'='+i.value); });
  if(ch.length) sendPrompt('bearbeite '+key.replace(':',' ')+': '+ch.join('; '));
}
function ablehnen(key){ sendPrompt('lehne ab: '+key.replace(':',' ')); }
function freigebenProzess(proc){ sendPrompt('freigeben prozess '+proc); }
</script>
```
Eingaben mit `data-feld="filename|targets|betrag|…"`; `defaultValue` = Originalwert, damit nur Änderungen gesendet werden.

## (2) Native Vorschau-Boxen je Posten (`present_files`)
**Unmittelbar nach der Karte** ein `present_files`-Aufruf für diesen Posten:
`present_files([ <_firma/_review/_preview/ Ergebnis-Datei>, <source Quelle-Datei> ])`
→ 1–2 längliche, klickbare Datei-Boxen; Klick öffnet die Datei **nativ rechts in der Sidebar** (kein Chat-Prompt). Reihenfolge: 📄 Ergebnis zuerst, dann 📎 Quelle. Nur **eine** Box, wenn kein eigenständiges Ergebnis existiert.

## (3) „Freigeben (Prozess)"-Widget (nach allen Posten)
Ein kleines `show_widget`: Überschrift „<Emoji> <Prozess> — <N> Posten" und Button **„Freigeben — <Prozess> speichern (<N>)"** → `sendPrompt('freigeben prozess <process>')`. Hinweis: „Einzelne oben mit *Ablehnen* rausnehmen; *Übernehmen* korrigiert Felder."

## sendPrompt-Nachrichtenformate
| Aktion | Nachricht |
|---|---|
| Felder übernehmen | `bearbeite <runid> <id>: <feld>=<wert>; <feld>=<wert>` |
| Ablehnen | `lehne ab: <runid> <id>` |
| Prozess freigeben | `freigeben prozess <process>` |

Beispiele:
- `bearbeite R-2026-06-24-receipt-filing 2: kategorie=Kfz/Fahrzeug; targets=001 Galant Bau GmbH/001. Buchhaltung/2026/05-26/Ausgaben`
- `lehne ab: R-2026-06-24-photo-sorting 2`
- `freigeben prozess receipt-filing`

## Speicherziel-Auflösung (SKILL Step 6)
Beim „freigeben prozess": je Posten Ziel real bestimmen → N:/S: verbunden? direkt dorthin (kollisionssicher, Journal); sonst `_ausgang/<prozess>/` + vorgesehenen N:-Pfad. Workspace-intern über `apply.ts approve`; verbundene Fremdlaufwerke direkt + gleiche Journal-Zeile. Danach nächsten offenen Prozess rendern; keiner offen → Abschluss-Zusammenfassung.

## Robustheit
- `present_files` nicht möglich → Pfad als Klartext.
- `show_widget` nicht renderbar → getippte Chat-Review (`reference/chat-review.md`), gleiche Engine.
- Großer Foto-Stapel: Karte ggf. kompakt; trotzdem je Foto Karte + Quelle-Box; bei sehr vielen in Tranchen.
- Editieren/Ablehnen ändert nur die Queue; nur „Freigeben (Prozess)" schreibt.
