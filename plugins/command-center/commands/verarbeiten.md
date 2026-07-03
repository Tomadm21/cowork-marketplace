---
description: Alles aus dem Eingang verarbeiten — erkennt Belege, Fotos und Tagesberichte automatisch, fragt nur das Nötige und legt ein Review-Board vor.
---

# /command-center:verarbeiten

Der Alltagsweg: der Nutzer hat (gemischte) Dateien in den gemeinsamen Eingang `_eingang/` gelegt — oder gerade reingedroppt — und will, dass alles bearbeitet wird.

Invoke the **`intake`** skill. Sie:
1. scannt `_eingang/` (rekursiv), erkennt neue Dateien und Dubletten,
2. klassifiziert jede Datei **nach Inhalt** (Beleg, Foto, Tagesbericht, Stundenzettel) und routet sie an den richtigen Prozess,
3. stellt **sofort und gebündelt** nur die nötigen Rückfragen (Fotos: welche Baustelle/Datum, einmal pro Stapel; Belege & Tagesbericht: keine),
4. bereitet pro Prozess die Arbeit vor (Review-Queues, nichts wird bewegt),
5. öffnet **ein** interaktives Review-Board (`review-board` skill) zum Sammeln der Freigaben und gebündelten Speichern.

Nichts wird gespeichert, bis der Nutzer im Board auf **„Freigeben (Prozess)"** klickt (bzw. im Chat freigibt).
