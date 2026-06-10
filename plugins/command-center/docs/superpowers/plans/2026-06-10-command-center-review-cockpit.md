# Command Center — Review Cockpit (Freigabe-Board) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the dashboard live artifact with a unified cockpit in the look of `~/galant-command-center.pdf`: workflow tabs paging through open review items (VORSCHLAG fields + BEGRÜNDUNG + Freigeben/Ablehnen via sendPrompt), plus an "Überblick" tab carrying the old status content. Ship the review-apply engine in the plugin (TS port of the proven workspace `apply.py`) and teach processes to write review queues.

**Architecture:** The review contract already exists in the Galant workspace (`_firma/_review/*.json` queues + `apply.py` + `_firma/_journal/`). We adopt it as the plugin-wide contract: document it, port `apply.py` → `skills/dashboard/scripts/apply.ts` (same verbs/semantics, bun), rewrite `skills/dashboard/scripts/dashboard.ts` to emit the cockpit (data inlined, never-crash), and add a queue-writing step to each process skill's scheduled/prepared mode. Approve/Reject buttons call `sendPrompt("Freigeben: <runid> Aktion <id> (<label>)")` — Claude in chat then runs `apply.ts`; manual fallback text if sendPrompt is unavailable.

**Reference material (read, don't guess):**
- Visual target: `/Users/tomadomeit/galant-command-center.pdf` (rendered prototype)
- Working prototype HTML (CSS/JS to port): `/Users/tomadomeit/Documents/Claude/Artifacts/galant-command-center/index.html`
- Proven engine to port: `/Users/tomadomeit/Galant/06-Server-Mirror/Volumes/Public/_firma/apply.py`
- Sample queue JSON: `/Users/tomadomeit/Galant/06-Server-Mirror/Volumes/Public/_firma/_review/_erledigt/R-2026-06-08-belege-a.json`

**Tech Stack:** TypeScript via bun, `bun test`. No deps. German UI, consistent **du**.

---

### Task 1: Review-queue contract doc

**Files:** Create `reference/review-queue.md`

- [ ] Document the queue schema exactly as the sample JSON + apply.py implement it: file location `_firma/_review/R-<YYYY-MM-DD>-<slug>.json`; top-level `{runid, process, created, origin, headline, actions[]}`; action `{id, verb, tier: sicher|prüfen|folgenreich, confidence, reason, source, filename, targets[], values{}}`; lifecycle (process writes queue → cockpit shows → approve copies collision-safe to targets + journals to `_firma/_journal/<YYYY-MM>.jsonl` + removes action; empty queue archived to `_review/_erledigt/`); tier semantics (sicher = bulk-approvable, prüfen = needs a look, folgenreich = always individually); the role boundary (queues are workspace data; only the apply engine moves files; nothing auto-applies).
- [ ] Cross-link from `reference/signals.md`-style: mention in `reference/architecture.md` is Task 6, not here.
- [ ] Commit: `feat(command-center): review-queue contract doc`

### Task 2: apply.ts — TS port of apply.py (TDD)

**Files:** Create `skills/dashboard/scripts/apply.ts`, `skills/dashboard/scripts/apply.test.ts`

- [ ] Port semantics 1:1 from the reference apply.py (read it): commands `list`, `approve <runid> <id>`, `reject <runid> <id>`, `approve-safe`, flag `--dry`; collision-safe naming (`_2`, `_3`…); journal record `{ts, verb, source, target, reversible:true}`; rewrite-or-archive queue files; `usage: bun apply.ts <workspace_root> <cmd> [...]` (workspace passed explicitly — the TS script is not workspace-resident like apply.py was).
- [ ] TDD pure parts: collisionSafe, tierOf, titleOf, list-grouping; integration test with a tmp workspace fixture (queue JSON + source file → approve → file copied collision-safe, journal line written, queue archived when empty; reject → action removed, nothing copied).
- [ ] Never-crash discipline; JSON output on stdout like apply.py.
- [ ] Commit: `feat(command-center): apply.ts review engine (port of proven apply.py)`

### Task 3: Cockpit generator (rewrite dashboard.ts)

**Files:** Modify `skills/dashboard/scripts/dashboard.ts` (+ create `skills/dashboard/scripts/dashboard.test.ts` for new pure functions)

- [ ] Read the prototype `index.html` and port its layout/CSS/JS: header (firm · "Command Center", "Freigaben & Kontrolle", Stand), tab bar = `Überblick` + one tab per process **with open-count chips** (counts from `_firma/_review/*.json`), item view = title + pager (‹ n/m ›, dots) + preview box ("Keine Vorschau" fallback; if `values.thumb`/image source exists under workspace, inline as data-URI capped ~150KB each) + VORSCHLAG key-value table from `values` + Ziel from `targets` + BEGRÜNDUNG card from `reason` + green **Freigeben** / red **Ablehnen**.
- [ ] Buttons: `sendPrompt('Freigeben: <runid> Aktion <id> (<label>)')` with the prototype's try/fallback chain (global sendPrompt → window.cowork.sendPrompt → manual instruction div naming the chat phrase and `bun apply.ts` command). Keyboard: ←/→ blättern, F freigeben, R ablehnen. Footer hint line as in the PDF.
- [ ] `Überblick` tab = the existing dashboard content (hero/time-saved/cards/feed) condensed — keep existing helpers; all stats logic stays.
- [ ] Data inlined at generation (no fetch). Never-crash: no `_review` dir → cockpit renders with all-zero chips and the Überblick tab active; empty queue per process → friendly "Nichts offen — alles freigegeben."
- [ ] Pure helpers TDD: `loadQueues(dir)` (garbled-file skip), `groupByProcess`, count logic. Visual check: generate on a demo workspace seeded from the sample queue JSON, screenshot via headless Chrome, compare layout against the PDF (tabs, VORSCHLAG table, BEGRÜNDUNG, buttons present).
- [ ] Consistent du-voice everywhere.
- [ ] Commit: `feat(command-center): dashboard artifact → review cockpit (PDF look)`

### Task 4: Skill + command texts

**Files:** Modify `skills/dashboard/SKILL.md`, `commands/dashboard.md`

- [ ] SKILL.md: artifact is now the cockpit ("Freigaben & Kontrolle" + Überblick). New section **Handling approvals**: when the user message matches `Freigeben: <runid> Aktion <id>` / `Ablehnen: …` (typically sent by the artifact button), run `bun ${CLAUDE_PLUGIN_ROOT}/skills/dashboard/scripts/apply.ts <workspace_root> approve|reject <runid> <id>`, report the JSON result in plain German, then regenerate the cockpit. Mention `approve-safe` for "alle sicheren freigeben". Triggers gain "freigaben", "was liegt zur freigabe", "review board".
- [ ] commands/dashboard.md: description/text updated to cockpit framing.
- [ ] Commit: `feat(command-center): dashboard skill drives the review cockpit + approvals`

### Task 5: Processes write review queues (5 edits)

**Files:** Modify the 5 process SKILL.md files

- [ ] In each process's **Scheduled mode** section (and as an offer in interactive mode when the user is not present to review inline): instead of parking only in chat, write the prepared actions as a review-queue file per `reference/review-queue.md` (one file per run, `runid` = the process's stable run id; actions with verb/tier/reason/values/targets mirroring what the chat review would show). State explicitly: writing the queue is the "prepared" state; the activity log entry stays `status: prepared`; applying happens only via the cockpit/apply engine.
- [ ] Keep it small per file (one short paragraph referencing the contract doc).
- [ ] Commit: `feat(command-center): prepared runs write review queues`

### Task 6: Architecture + version 0.4.0

**Files:** Modify `reference/architecture.md`, `.claude-plugin/plugin.json`, `skills/firm-onboarding/templates/company-context.template.md`, `docs/end-to-end-dry-run.md`

- [ ] architecture.md: new section "Review cockpit (v0.4.0)" — queue contract, apply engine, sendPrompt loop, role boundary unchanged (approve is always explicit human action).
- [ ] Version bump 0.3.0 → 0.4.0 in the three known places.
- [ ] Full test suite + cockpit smoke (empty + seeded workspace). 
- [ ] Commit: `docs(command-center): review cockpit architecture + bump to v0.4.0`

### Task 7: End-to-end visual verification

- [ ] Build demo workspace: seed `_firma/_review/` with the sample queue (adapted paths) + a second process queue; generate cockpit; headless-Chrome screenshot (desktop 1100px); visually compare against `galant-command-center.pdf` (tab bar with counts, item header with pager, Keine-Vorschau box, VORSCHLAG table incl. Ziel row, BEGRÜNDUNG card, green/red buttons, footer hint).
- [ ] Round-trip: `apply.ts approve` on the demo item → file lands collision-safe, journal line exists, queue archived; regenerate cockpit → chip count drops, "Nichts offen" state. 
- [ ] No commit needed unless fixes emerge.

## Self-Review notes
- apply.ts replaces nothing in the Galant workspace — Galant's own `apply.py` keeps working; the plugin engine is for every firm (incl. Galant via the skill). Same dirs, same schema → compatible.
- The cockpit reads queues regardless of who wrote them (plugin skills or external scripts) — that's what makes it work for Galant on day one.
