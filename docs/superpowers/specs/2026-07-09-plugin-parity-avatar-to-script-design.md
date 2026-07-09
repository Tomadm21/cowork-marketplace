# Plugin ↔ Frontend Parity — Avatar→Script Flow (SP-Plugin-Parity · Teil 1)

**Datum:** 2026-07-09
**Status:** Design (mit Tom gebrainstormt; wartet auf Spec-Review)
**Repos:** Plugin `~/cowork-marketplace/plugins/trendfinder` · Backend `~/upwork-showcase-clean`

---

## 1. Kontext & Problem

Das Trendfinder-Cowork-Plugin ist heute ein dünner Daten-Client; das React-**Frontend** ist die vollwertige Oberfläche. Ziel (Tom): das **Plugin wird das Haupt-Tool**, mit dem man das Backend steuert — es kann alles, was das Frontend kann, aber mit einer **geführten, interaktiven, Schritt-für-Schritt-Cowork-UX**, nur besser.

Diese Spec deckt zuerst den **Avatar→Script-Flow** ab (Toms genannte Priorität). Analytics, Video/Publishing und Chat sind spätere Sub-Projekte (§9).

**Heutiger Plugin-Flow:** onboarding (Avatar) → scrape-now → trend-radar → script-studio (nativ, **flüchtiges** Markdown).
**Frontend hat zusätzlich:** Content-Planung + persistiertes **Content-Board (Stages)** + **Review**.
**Technischer Blocker:** Die Content-Workflow-Endpoints des Backends (`content_pieces`, `content_plans`, `scripts`, `pipeline`, `review`) sind **ops-only** → ein Tenant-Key bekommt dort **403**. Das Plugin kann sie noch nicht nutzen.

## 2. Ziele (SP1)

- Geführte End-to-End-Journey in Cowork: **Avatar → Scrape → Trends → Content-Plan (Ideen) → Skript → Review/Freigabe** — die Schritte wie im echten System.
- Skripte/Ideen persistieren als **dieselben `content_pieces`** wie im Frontend (geteiltes Datenmodell, kein Parallel-Light-Modell).
- Synthese bleibt **nativ in Claude** (bessere Skripte); das Backend speichert nur.
- **Maximal interaktiv:** jede Entscheidung/Navigation ist ein Cowork-Auswahl-Block; Freitext nur bei echt kreativem Input.

## 3. Nicht-Ziele (spätere Sub-Projekte)

- Video-/Reel-Generierung + Publishing (Stages `rendering`/`done`-mit-Video, `/api/reels/*`).
- Analytics-Dashboard (insights/movements/sounds/posting-times/hashtag-perf/persona-gap).
- RAG-Chat.
- Der S1-Auth-Umbau (separat getrackt — aber siehe §7-Risiko).

## 4. Design-Entscheidungen (abgestimmt)

- **Weg 1 – Hybrid:** native Synthese + Backend-Persistenz.
- **Rückgrat:** *ein* geführter „Journey-Coach"-Skill; die Einzel-Skills bleiben darunter bestehen.
- **Interactive-first:** nummerierte Auswahl-Blöcke + `✏️`-Freitext (der bestehende Cowork-Mechanismus). „Null Tippen" wird **nicht** versprochen — kreativer Input (Avatar-DNA, eigene Idee) bleibt ein fokussierter Freitext-Fragebogen; alles andere ist klickbar.
- **Geteiltes Datenmodell:** `content_pieces` mit dem **bestehenden Stage-Vokabular** (`idea → script → review → rendering → done`). SP1 läuft `idea → script → review → done`, überspringt `rendering` (Video). **Keine neuen Stage-Strings** — hält Plugin- und Frontend-Daten konsistent.
- **Content-Plan-Schritt IN** (volle Schritt-Parität): Claude schlägt Ideen **nativ** vor → als `idea`-Pieces gespeichert. Der Server-LLM-Endpoint `content_plans/generate` wird **nicht** genutzt.
- **Stages schlank dargestellt** (💡 Idee → ✍️ Skript → ✅ Freigegeben), aber hinterlegt mit den echten Werten.

## 5. Architektur

### 5.1 Backend (`~/upwork-showcase-clean`) — Voraussetzungs-Arbeit
- Content-Routen sind ops-only (`main.py` registriert content_pieces/content_plans unter `require_ops`). SP1 braucht eine **tenant-scoped** Content-Fläche: `content_pieces` CRUD tenant-zugänglich, gescoped über `persona → brand → tenant_id` (ContentPiece hat kein `tenant_id`; Scoping über die Persona). Fremde Persona/Piece → 404.
- **Claude-geschriebenes Skript persistieren:** ein `idea`-Piece anlegen (title/pillar/format/hook_type/trend_cluster_id) und `script_data` aus vom Plugin geliefertem JSON setzen, dann `stage` patchen. In der Planung prüfen, ob POST-create + PATCH `script_data` direkt annehmen; falls nur ein Server-LLM-`generate-script` existiert → eine Tenant-Route ergänzen, die geliefertes `script_data` speichert (nativ, kein Backend-LLM-Spend).
- Additiv/nicht-destruktiv; die ops/internen Aufrufe des Frontends bleiben unberührt (Dual-Mode: ops sieht alles, Tenant sieht seins).

### 5.2 Plugin (`~/cowork-marketplace/plugins/trendfinder`)
- **Neuer `journey`-Coach-Skill** („Trendfinder starten"/„Los geht's"): Zustands-Erkennung (Avatar? Trends? offene Pieces? Review offen?) → schlägt nach jedem Schritt genau den nächsten als ⭐-Block vor; delegiert an die bestehenden Skills.
- **Neuer Content-Plan-Schritt/Skill:** Claude schlägt N Ideen aus DNA+Trends vor → User wählt per Block → je Idee ein `idea`-`content_piece`.
- **`script-studio` erweitert:** nach dem nativen Schreiben das Skript **persistieren** (`script_data`) und Stage `idea → script`. Matching + Stimme bleiben nativ.
- **Neuer `review`-Schritt/Skill:** `script`-Stage-Pieces listen → approve (→ done) / reject per Block.
- **Cockpit:** ein **„Content"-Tab** (Pieces nach Stage) als visueller Status.
- **`reference/api-contract.md` + `next-steps.md`:** die neuen content_pieces-Endpoints ergänzen; Next-Steps-Optionen um Content-Plan / Review erweitern.

### 5.3 Die geführte Journey (Schritte + Blöcke)
1. **Start** → Zustands-Erkennung → ⭐ nächster Schritt als Block.
2. **Avatar** (falls keiner): `onboarding`-Fragebogen (Freitext) → Brand+Persona+DNA. Sonst Avatar per Block wählen.
3. **Scrape** (falls keine/alte Trends): `scrape-now` (Kosten-Block bestätigen) → ingest → Auto-Cluster.
4. **Trends** ansehen (`trend-radar`/Cockpit).
5. **Content-Plan:** Claude schlägt Ideen vor → Mehrfach-/Einzelauswahl per Block → `idea`-Pieces.
6. **Skript:** Idee/Trend per Block wählen → `script-studio` (nativ, Ziel-gesteuert) → `script_data` gespeichert, Stage `script`.
7. **Review:** `script`-Pieces per Block approve/reject → Stage `done`.
   Nach **jedem** Schritt: Next-Steps-Block mit genau einer ⭐-Empfehlung.

## 6. Datenfluss

`scrape → (Backend embeddet+clustert automatisch) → trends → Claude schlägt Ideen vor → POST content_pieces (idea) → Claude schreibt Skript → PATCH script_data + stage=script → User approved → PATCH stage=done`. Cockpit liest Pieces nach Stage.

## 7. Fehlerbehandlung & Risiken

- **Backend down / 401 / leere Zustände:** die bestehenden ehrlichen Muster wiederverwenden (Config-Self-Check, Cold-Start → route zu `scrape-now`, nie Trends/Skripte erfinden).
- **S1-Wechselwirkung (Risiko):** Content-Routen tenant-scoped zu machen ist ohnehin richtig — aber das Scoping muss **im Code** durchgesetzt werden (Persona-Ownership-Filter), nicht auf das Peer-IP-Vertrauensmodell bauen. Mit der S1-Entscheidung koordinieren.
- **Ops-Gate:** das Frontend braucht diese Routen weiter → Tenant-Scoping darf den ops/internen Zugriff nicht brechen (Dual-Mode).

## 8. Tests

- **Backend:** Tenant-Scoping-Tests (Tenant sieht nur eigene Pieces; fremd → 404; ops weiter voll) — nach dem Muster von `test_launch_hardening.py`. Round-trip: natives `script_data` anlegen → lesen.
- **Plugin:** Skills sind Markdown → Validierung im Flow gegen das lokale/echte Backend (Test B).

## 9. Decomposition (das größere „Full-Parity"-Ziel)

- **SP1 (diese Spec):** Avatar→Script geführter Flow + Persistenz + Review.
- **SP2:** Analytics-Dashboard-Parität.
- **SP3:** Video-/Reel-Generierung + Publishing.
- **SP4:** RAG-Chat.

## 10. Offene Punkte (in der Planung klären)

- Exakte create/patch-Shape für `script_data` (durch Lesen von `content_pieces.py`).
- `review`: Stage `review` als eigener Schritt, oder für Script-only direkt `done`?
- Cockpit-Content-Tab: nur Status (read-only) oder aktionierbar?
