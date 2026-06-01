---
project: jan-kapitalfluss-cowork-plugin
task: Build a Claude Cowork plugin that turns Jan Theobald's monthly Commerzbank→Vektonce-Excel + McDonald's-Liquiditätsplanung transfer into an approval-gated, GoBD-archived automation
effort: E4
phase: verify
progress: 64/66
mode: algorithm
started: 2026-06-01
updated: 2026-06-01
iteration: account-model-correction
reward: "TBD — Tom names it (E4 ≈ €100–500, real artifact/experience)"
---

# ISA — Jan Theobald Kapitalfluss Cowork Plugin

## Problem

Jan Theobald (McDonald's franchise operator) spends ~2h every month — Sunday evenings — manually transferring his **one Commerzbank business account's** movements into (a) a self-built Excel **Kapitalflusstabelle** (Vektonce template) and (b) a McDonald's-provided **Liquiditätsplanung** template (P&L-based, currently unused). The Kapitalflusstabelle's actual logic is simple: **every income and every expense from the account is sorted into the table by sign** — credit → Einnahmen, debit → Ausgaben — it is **not per-store** and not per-location. He types each value into the right place by hand. It costs him weekend family time and a slip under Sunday-night time pressure produces a wrong cash-flow forecast he may act on. Jan said: *"Da seh ich keine Lösung, die ich schaffen kann. Das wäre tatsächlich eine schöne Sache."* He signed/targets **Tier 3 — a Claude Cowork plugin** he owns (~€4.500 fixed). *(Corrected 2026-06-01: the first build over-modeled this as a per-store registry with bucket categorization — see Changelog.)*

## Vision

Jan opens Cowork on his Mac, triggers one skill, and within a minute sees a clean **change-overview**: "47 Buchungen verarbeitet · alle einsortiert · 0 brauchen Review." He scans the grouped table (sheet, cell, old→new, Einnahme/Ausgabe, source memo), confirms it matches his account, clicks **Freigeben & schreiben** — and the numbers land in his real Vektonce + Liquiditätsplanung files, untouched in structure, with a tamper-proof archive record written. ~2h of typing becomes a 10–20 min review-and-click. The euphoric surprise: *the whole month's account flows into the table in one deterministic pass — every movement placed, nothing dropped, nothing to second-guess — and he realizes he's confirming a complete picture instead of re-typing it row by row.*

## Out of Scope

- **BWA-PDF parsing** from the tax advisor (Dennis-Hoheit; separate lever if ever wanted).
- **DATEV sync** / Belegweiterleitung (Steuerberater-Hoheit).
- **Auto-booking / auto-sending** anything, ever — the system proposes; Jan disposes.
- **Native bank API inside Cowork** — there is no Commerzbank/PSD2 connector; the bank reach lives in a local MCP server outside Cowork's connector model.
- **Unattended cloud cron** — Cowork is desktop-only; scheduled tasks fire only while Jan's Mac is awake with the Desktop app open. True hands-off automation is Tier-2 (Command Center), not this.
- **FinTS/HBCI direct pull as the first build** — requires Deutsche-Kreditwirtschaft product registration + ~90-day TAN re-auth; deferred to Adapter v3.
- **Web-Cockpit / M365 / Portale / Papier-Scanner / KPI-aggregation** — Jan's own scope.
- **Per-store / per-location split of the Kapitalflusstabelle** — the table is account-wide. One account → one list of every income and expense. No store registry, no per-store sheets, no per-store categorization rules. (Finer categories than income/expense are an *optional* config add-on, not the default and not store-scoped.)
- **Editing values in the approval UI** — Jan approves or rejects the proposed set; edits mean re-run (clean audit trail).

## Principles

- **Propose, never dispose.** No write is possible without a recorded ApprovalDecision matching the exact run-id + changeset-hash. The gate is a structural invariant, not a prompt instruction.
- **Never alter Jan's file.** Values-only writes; never touch numFmt, formulas, charts, named ranges, or structure. A structure-fingerprint assert guards every write.
- **Reality is the only judge.** "Green on fixtures" ≠ "works for Jan." The no-alter guarantee, the parser, and the categorizer are unproven until they pass against Jan's real file/export/rules. The word "100%" never describes the deliverable before that.
- **Config is the seam, not code.** The synthetic→real flip happens entirely in `config/` JSON (store registry, CSV profile, Excel cell-maps, DBA rules). The workshop is a 1h data-mapping session, not a dev session.
- **Portability is insurance.** The engine is Cowork-free bun+TS; the same code ships as Tier-3 (Cowork MCP), Tier-2 (Command Center cron), or Tier-1 (CLI). If Cowork or the no-alter round-trip fails at kickoff, the client value still ships.
- **Never silently mis-book.** Any transaction the categorizer can't confidently map goes to an explicit needs-review bucket surfaced in the artifact — never guessed into a number.
- **Tom never touches Jan's real data** (preserves the no-AVV Tier-3 position). Dev is synthetic-only; real data lives only in Jan's workspace.

## Constraints

- **bun + TypeScript only.** Never npm/npx/Python. (Open collision: if xlsx-populate fails the real-file round-trip, the natural fallback is Python/openpyxl — a convention-exception policy must be agreed *before* kickoff. See Decisions.)
- **No hardcoded paths.** All paths resolve from `${PLUGIN_ROOT}` / `${CLAUDE_PLUGIN_ROOT}` / CLI arg.
- **Excel engine = xlsx-populate@1.19.1**, pinned + vendored — the only JS lib surviving load→edit-few-cells→save with formulas/charts/styles/validations/named-ranges intact. (Unmaintained since 2019 → fixture-gated every release.)
- **Ingestion v1 = Commerzbank CSV** behind a `TransactionSource` interface; CAMT.053 = v2 forward target; FinTS = v3 (only if ever justified).
- **GoBD:** revisionssichere, append-only, hash-chained per-run archive (10y) + a 4-part Verfahrensdokumentation as a contracted deliverable.
- **DSGVO Tier-3:** no Tom↔Jan AVV needed *iff* Tom never accesses real personal data; the Jan↔Anthropic DPA is the instrument. Tier-2 flips this (AVV mandatory).

## Goal

Ship a Cowork plugin = a portable bun+TS engine (Commerzbank-CSV ingest → deterministic DBA categorization → xlsx-populate values-only writes into the existing Vektonce + Liquiditätsplanung files → before/after change-overview → non-bypassable approval gate → append-only GoBD archive) wrapped in a thin Cowork shell (local MCP server + Skills + live-artifact approval UI + pre-write hook), proven end-to-end green on synthetic fixtures via `bun test`, with every synthetic→real dependency externalized to `config/` so the workshop flip is config-only. **Done = `bun test` green on fixtures incl. the no-alter round-trip and the approval-gate block; real-data correctness is a separate, workshop-gated milestone, never claimed before it passes on Jan's real files.**

## Criteria

### Scaffold & project
- [ ] ISC-1: `cowork-plugin/package.json` exists, `"type":"module"`, declares bun scripts (`test`, `run`, `make-fixtures`).
- [ ] ISC-2: `xlsx-populate@1.19.1` pinned in `package.json` and present in committed bun lockfile.
- [ ] ISC-3: `tsconfig.json` present, strict mode on; `bun build`/typecheck clean (0 errors).
- [ ] ISC-4: `util/paths.ts` resolves root from env/CLI arg; `grep` finds no hardcoded `/Users/` path in `engine/`, `cli/`, `mcp/`.
- [ ] ISC-5: `.gitignore` ignores `out/`, `archive/`, `*.real.*`, secrets.

### CSV ingestion (CommerzbankCsvSource)
- [ ] ISC-6: `TransactionSource` interface defined; `CommerzbankCsvSource` implements it; `CamtSource`/`FinTsSource` exist as typed stubs.
- [ ] ISC-7: parser detects UTF-8 BOM and falls back to Windows-1252 (test asserts both encodings parse correctly).
- [ ] ISC-8: parser splits on semicolon honoring quoted fields (test: a memo containing `;` stays intact).
- [ ] ISC-9: DD.MM.YYYY dates parse to correct ISO dates (test).
- [ ] ISC-10: German comma-decimals (`-12.480,55`) parse to exact integer cents `-1248055` (test).
- [ ] ISC-11: sign read from the `Betrag` column; debit negative, credit positive (test).
- [ ] ISC-12: zero-amount info/ToS rows are filtered out (test asserts count).
- [ ] ISC-13: both header variants A and B are accepted via the CSV profile config (test runs each).
- [ ] ISC-14: multi-line/collapsed `Buchungstext` preserved as a single normalized memo field (test).

### Classification (the Einnahme/Ausgabe split)
- [ ] ISC-15: the production mapping sorts every credit → `Einnahmen` and every debit → `Ausgaben` by sign, so ALL movements land and `reviewCount === 0` (test: e2e + categorizer prod-mapping test).
- [ ] ISC-16: each tagged txn carries a rule-id; ruleset carries a semver + git-hash (test/Read).
- [ ] ISC-17: the rule ENGINE still supports finer counterparty/purpose rules (workshop add-on) and routes an unmatched txn to an explicit `needs-review` bucket, never a guessed one (test against an inline fine-grained mapping).
- [ ] ISC-18: same input → same output (determinism test: two runs byte-identical classification).

### Excel writer (the critical no-alter bet)
- [ ] ISC-19: `WorkbookWriter` writes a raw JS number to a mapped cell (never a German-formatted string) (test reads back numeric type).
- [ ] ISC-20: writer never touches `numFmt` of any cell (round-trip test asserts numFmt unchanged).
- [ ] ISC-21: after load→write-few-cells→save, ALL pre-existing formulas are byte-identical (round-trip test).
- [DEFERRED-VERIFY] ISC-22: chart preservation on the round-trip — validated against Jan's REAL Vektonce chart at kickoff. exceljs cannot author a synthetic chart to test against; xlsx-populate's preserve-untouched-XML mechanism is proven for formulas/numFmt/merges (scripts/_smoke.ts → PASS). Follow-up: kickoff workshop.
- [ ] ISC-23: named ranges + merged cells survive the round-trip (test).
- [ ] ISC-24: only the targeted cells changed; every other cell identical (diff test).
- [ ] ISC-25: `safeguards.ts` structure-fingerprint (sheet names + formula-cell set) asserts unchanged; a tampering attempt throws (test).
- [ ] ISC-26: append-anchor logic appends a row at the configured anchor without shifting/overwriting existing rows (test).
- [ ] ISC-27: `LiquiditaetWriter` fills the P&L template from the same categorized run, config-driven (test).
- [ ] ISC-28: writer targets are 100% config-driven from `excel-maps/*.json` (no sheet name or cell hardcoded; grep).

### Change-overview (diff)
- [ ] ISC-29: diff lists exactly the cells the engine writes — old→new (test).
- [ ] ISC-30: diff excludes formula-derived cells (which xlsx-populate doesn't recompute) (test).
- [ ] ISC-31: NEU (appended) rows flagged distinctly from changed cells (test).
- [ ] ISC-32: needs-review items surfaced in a separate section of the change-overview payload (test).

### GoBD archiver
- [ ] ISC-33: per-run record contains raw source artifact + its SHA-256 (test asserts hash matches bytes).
- [ ] ISC-34: record is hash-chained to the prior record (test asserts link).
- [ ] ISC-35: archive is append-only — a rewrite attempt fails (test).
- [ ] ISC-36: record contains run-id, UTC+Europe/Berlin timestamps, ruleset semver+git-hash, full before/after diff, approver, pre+post snapshot, `no_auto_booking`/`no_auto_send` flags (Read/test).
- [ ] ISC-37: no credentials/secrets appear anywhere in the archive (test greps record for secret patterns → none).

### Approval gate (the hard constraint)
- [ ] ISC-38: `commit_writes` is BLOCKED (throws/returns blocked) when no ApprovalDecision exists (test).
- [ ] ISC-39: `commit_writes` succeeds only with an ApprovalDecision matching run-id + changeset-hash (test).
- [ ] ISC-40: a stale/tampered changeset-hash is rejected (test).
- [ ] ISC-41: per-row `ignorieren` exclusions in the decision are honored (excluded rows not written) (test).

### CLI & e2e
- [ ] ISC-42: `bun cli/run.ts --csv <fixture>` runs the full engine with zero Cowork import (test/grep: no Cowork dependency in `engine/`).
- [ ] ISC-43: `pipeline.e2e.test.ts` drives the one account CSV fixture → classify → plan → render change-overview → simulated approve → commit → asserts written workbooks + archive record, and that every movement landed with `reviewCount === 0`.
- [ ] ISC-44: `bun test` exits 0 with all suites green (the Phase-1 exit gate).

### Fixtures (synthetic, format-realistic)
- [ ] ISC-45: `scripts/make-fixtures.ts` generates ONE synthetic Vektonce .xlsx (Einnahmen + Ausgaben + Saldo sheets, cross-sheet SUM formula, numFmt `#,##0.00 €`, a named range, a merged header). Chart omitted — exceljs can't author one; chart-preservation is real-file-only (ISC-22).
- [ ] ISC-46: ONE synthetic Commerzbank CSV exists for the account (UTF-8 BOM, `;`-delim, German decimals, sign-in-Betrag, a mix of credits + debits, ≥1 info-row to filter, a quoted multi-line memo).
- [ ] ISC-47: synthetic Liquiditätsplanung .xlsx exists (Summe Einnahmen / Summe Ausgaben lines).
- [ ] ISC-48: synthetic classification JSON is the two-rule sign split (credit→Einnahmen, debit→Ausgaben); rule-engine fixtures for finer mappings live inline in the categorizer test.

### Cowork shell (authorable now; validation DEFERRED to workspace access)
- [ ] ISC-49: `mcp/server.ts` exposes `ingest_csv`, `categorize`, `plan_writes`, `render_change_overview`, `commit_writes` (gated), `archive_run` as MCP tools (Read/local harness test).
- [ ] ISC-50: `skills/liquiditaet-run/SKILL.md` orchestrates the tools in order and STOPS at approval (Read).
- [ ] ISC-51: `skills/liquiditaet-setup/SKILL.md` covers one-time workshop activation + first Liquiditätsplanung fill (Read).
- [ ] ISC-52: `artifacts/change-overview.template.html` renders the change table + Approve/Reject + per-row ignore, posts ApprovalDecision via MCP (local-harness test).
- [ ] ISC-53: `hooks/pre-write.hook.json` blocks any `commit_writes` lacking a recorded ApprovalDecision (Read/test).
- [ ] ISC-54: `plugin.json` bundles skills + MCP server + hook per the documented Cowork/Claude-Code plugin primitive (Read).
- [DEFERRED-VERIFY] ISC-55: plugin self-installs in Jan's Cowork via the Customize menu — [needs Cowork workspace; follow-up at kickoff].
- [DEFERRED-VERIFY] ISC-56: live-artifact↔MCP round-trip (Approve unblocks commit for that run only) verified in Jan's workspace — [needs Cowork workspace].

### GoBD doc & swap seam
- [ ] ISC-57: `docs/Verfahrensdokumentation.md` skeleton has all 4 mandatory parts (allgemeine Beschreibung, Anwender-, technische-, Betriebsdokumentation incl. Berechtigungskonzept).
- [ ] ISC-58: `config/account.json` (the single account) drives all file paths + the CSV profile / excel-map / mapping keys (test loads it).
- [ ] ISC-59: swap-seam proof — the run reads everything off `account.json` (data, not code), so repointing it at Jan's real files is config-only (test asserts the run is fully account.json-driven).

### Anti-criteria (must NOT happen)
- [ ] ISC-60: Anti: no write path exists that bypasses the approval gate (grep + test: every write goes through the gated `commit_writes`).
- [ ] ISC-61: Anti: no run ever auto-sends or auto-books (grep: no send/email/post-to-bank call anywhere).
- [ ] ISC-62: Anti: the engine never writes a German-formatted *string* into a numeric cell (test: written cell types are numeric).
- [ ] ISC-63: Anti: no Cowork/Anthropic import appears in `engine/` (portability invariant; grep).
- [ ] ISC-64: Anti: no real Jan data (real .xlsx, real CSV, real mapping) is committed to the repo (grep `.gitignore` + tree).
- [ ] ISC-65: Anti: the strings "100%" / "fully automated" / "unattended" do not appear in any client-facing artifact produced here (grep).
- [ ] ISC-66: Antecedent: the change-overview shows rule-id + source memo per row so Jan reviews the *reasoning*, not just the number (test asserts fields present).

## Test Strategy

| ISC group | type | check | tool |
|---|---|---|---|
| CSV parser (6–14) | unit | encoding/delimiter/number/sign/info-row/variants | `bun test tests/csv-parser.test.ts` |
| Categorizer (15–18) | unit | rule→bucket, needs-review fallback, determinism | `bun test tests/categorizer.test.ts` |
| Excel writer (19–28) | round-trip | load→edit→save→reload; formulas/chart/numFmt/named-ranges intact, values-only | `bun test tests/excel-writer.test.ts` + manual open-in-Excel smoke |
| Diff (29–32) | unit | only-written-values, NEU flags, review section | `bun test tests/diff.test.ts` |
| Archiver (33–37) | unit | SHA-256, hash-chain, append-only, no secrets | `bun test tests/archiver.test.ts` |
| Approval gate (38–41) | invariant | blocked without decision; hash match required | `bun test tests/approval-gate.test.ts` |
| CLI/e2e (42–44) | e2e | full fixtures→approve→write→archive | `bun test tests/pipeline.e2e.test.ts` |
| Swap seam (58–59) | e2e | run is fully `account.json`-driven (config-only repoint) | `bun test tests/pipeline.e2e.test.ts` |
| Cowork shell (49–54) | local harness | MCP tool contracts + artifact payload | `bun test` local MCP harness |
| Cowork live (55–56) | DEFERRED | workspace round-trip | kickoff, in Jan's workspace |
| Real-data (Phase 2) | DEFERRED | parser+writer+categorizer on real files | kickoff workshop + open-in-Excel |

## Features

| name | satisfies | depends_on | parallelizable |
|---|---|---|---|
| Scaffold + types + config seams | ISC-1..5, 58 | — | no (foundation) |
| CommerzbankCsvSource + interface | ISC-6..14 | types | yes |
| Categorizer + rules | ISC-15..18 | types | yes |
| Excel writer + safeguards | ISC-19..28 | types, fixtures | yes |
| ChangeOverview diff | ISC-29..32 | excel, categorizer | yes |
| GoBD archiver | ISC-33..37 | types | yes |
| Approval gate | ISC-38..41, 60 | types, diff | no (cross-cutting) |
| Fixtures generator | ISC-45..48 | excel writer | no (precondition for tests) |
| CLI + e2e | ISC-42..44, 59 | all engine | no (integration) |
| Cowork shell (MCP/skills/artifact/hook/manifest) | ISC-49..54 | engine | partly |
| GoBD Verfahrensdokumentation | ISC-57 | — | yes |

## Decisions

- 2026-06-01 — **Research-first before ISA scaffold.** Cowork is post-cutoff; ran a 7-agent discovery (Gate D endorsed) before articulating, so the ISA is grounded not guessed.
- 2026-06-01 — **D1 Ingestion = Commerzbank CSV first** (behind `TransactionSource`). FinTS needs DK registration + ~90-day TAN re-auth; CAMT.053 is the stable v2 forward target (Commerzbank MT→CAMT migration completing Q2 2026). Source: discovery bank agent.
- 2026-06-01 — **D2 Portable Cowork-free engine + thin shell.** Highest-leverage de-risking decision: identical engine ships Tier-1/2/3. Insurance against MED-confidence Excel round-trip + research-only Cowork validation.
- 2026-06-01 — **D3 Excel = xlsx-populate@1.19.1** pinned+vendored. Only JS lib preserving formulas/charts/styles on round-trip; ExcelJS drops charts, SheetJS Community drops styles. Caveat: unmaintained since 2019 → fixture-gated.
- 2026-06-01 — **D4 Mock Cowork now.** Artifact + MCP contracts buildable/testable on a local harness; only the round-trip *validation* needs Jan's workspace, which collapses into kickoff.
- 2026-06-01 — **ISC soft-floor (E4 = 128) show-your-math:** buildable-now scope is ~12 components yielding 66 atomic ISCs; padding to 128 would be artificial. Real-data + Cowork-live ISCs are DEFERRED-VERIFY (gated on kickoff), not omitted.
- 2026-06-01 — **OPEN (pre-kickoff, Tom's call):** convention-exception policy if xlsx-populate fails the *real* Vektonce round-trip — pre-agree whether a Python/openpyxl helper isolated inside the MCP server is an acceptable exception to the bun+TS-only rule, or whether to fall back to Tier-1/2 delivery.
- 2026-06-01 — **verified (live probe):** `bun install` clean; xlsx-populate@1.19.1 round-trip preserves formula text + numFmt + merged cells under bun (`scripts/_smoke.ts` → SMOKE: PASS). The MED-confidence no-alter bet is now HIGH for formulas/numFmt/merges; chart-preservation stays real-file-gated (ISC-22). Note: xlsx-populate 1.21.0 exists (less abandoned than discovery assumed) — keeping the 1.19.1 pin for reproducibility.
- 2026-06-01 — **context-override:** classifier tagged the approval "los" as MINIMAL; thread context makes it the go-ahead for the E4 BUILD. Escalated per Algorithm conversation-context override.

## Changelog

- 2026-06-01 — conjectured: "Claude Cowork plugin" might be a naming mismatch / unsupported. refuted_by: HIGH-confidence discovery (Cowork is GA, plugins are first-class, primitive maps 1:1 to Claude Code). learned: the term is accurate; the real constraints are desktop-only scheduling + no native bank connector. criterion_now: ISC-49..56 + Out-of-Scope "unattended cloud cron".
- 2026-06-01 — conjectured: the structure-fingerprint (sheet names + formula-cell addresses) was enough to enforce the no-alter guarantee. refuted_by: codex cross-vendor audit — it compared addresses only (not formula text / numFmt) and the output was saved before the assertion ran. learned: the guarantee must be CHECK-enforced, not writer-discipline-enforced — capture formula text + numFmt and validate a temp before promoting it. criterion_now: ISC-20/21 strengthened; new tests assert a changed formula text and a changed numFmt both throw; pipeline does temp→assert→promote.
- 2026-06-01 — conjectured: the Kapitalflusstabelle is a per-store artifact (~3 sheets per store, internal "Sancho-Puncho" DBA-bucket categorization), so the engine needs a store registry (`stores.json`), per-store excel-maps, and a multi-category DBA mapping. refuted_by: Tom's direct correction — the table simply takes EVERY income and expense of the ONE Commerzbank account and sorts each into the table by sign; it is not per-store or per-anything. learned: the first build over-modeled the domain; the real mechanic is a two-bucket sign split (credit→Einnahmen, debit→Ausgaben) over a single account, and finer categories are an optional config add-on, never the default. criterion_now: `StoreConfig`/`stores.json` replaced by a single `AccountConfig`/`account.json`; `PlannedWrite.store` + `RunContext.storeId` + the MCP `storeId` arg + the CLI `--store` flag + the artifact "Store" column removed; mapping.v1 is the two-rule split; ISC-15/17/42/43/45/46/48/58/59 rewritten; the defining new ISC is "every movement lands, `reviewCount === 0`". The no-alter guard, approval gate, GoBD archive and portable-engine invariants were untouched.

## Verification

**Gate (account-model rework, 2026-06-01):** `bun test` → **35 pass / 0 fail**, 8 suites, 78 assertions · `tsc --noEmit` → clean · CLI live run: 10 entries, **0 review**, 2 Einnahmen + 6 Ausgaben + 2 Liquiditäts-Summen, zero-amount info row filtered.

**Prior gate (initial build):** `bun test` → **34 pass / 0 fail** · `tsc --noEmit` → clean. (2026-06-01)

- **No-alter (ISC-19..28):** `scripts/_smoke.ts` + a live round-trip probe + `tests/excel-writer.test.ts` — after load→append/set→save→reload, the Saldo formula text, `numFmt`, merged cell B1:D1 and named range `SaldoMonat` are all intact; `assertUnchanged(structureFingerprint)` holds; appended cell is numeric (8945.12); a non-finite write throws. CLI `--approve` wrote both workbooks to `out/`.
- **Approval gate (ISC-38..41, 60):** `tests/approval-gate.test.ts` — commit blocked with no decision / rejected / hash-mismatch / runId-mismatch; per-row exclusion honored. `hooks/assert-approval.ts`: bare commit → `exit 2`, bound commit → `exit 0`.
- **GoBD archive (ISC-33..37):** `tests/archiver.test.ts` — source sha256 matches raw bytes; `prevHash` chains run2→run1; re-archiving an existing runId throws; raw bytes persisted byte-for-byte; secret-guard rejects `password=…` but does NOT flag a memo "Konstanz Pinneberg Santander".
- **CSV + categorizer (ISC-6..18):** `tests/csv-parser.test.ts` (BOM/win-1252, German cents, sign, info-row filter, both header variants, quoted multiline, bad-header reject) + `tests/categorizer.test.ts` (rule→bucket, sign guard, needs-review fallback, determinism, stable rowKey).
- **Pipeline + swap-seam (ISC-42..44, 58, 59):** `tests/pipeline.e2e.test.ts` runs the one account via `account.json` plan→approve→commit→archive, asserting every movement landed with `reviewCount === 0` and both Einnahmen + Ausgaben present; a tampered hash rejects; a swap-seam test asserts the run is fully `account.json`-driven. CLI live run shown above.
- **Anti-criteria (ISC-60..66):** grep-verified — no hardcoded paths / no Cowork import in `engine/` (portable); no network/auto-send (only local file read + `noAutoBooking:true`); no "100%"/"unattended"/"fully automated" in client-facing artifacts (only CSS `width:100%`); `.gitignore` guards `*.real.*`, no real `.xlsx` outside `fixtures/`; change-overview carries rule-id + source memo per row.
- **Cowork shell (ISC-49..54):** `mcp/server.ts` prints its 4-tool surface; `plugin.json`, both `SKILL.md`, the XSS-escaped live-artifact, and the hook present and wired.
- **DEFERRED-VERIFY:** ISC-22 (chart preservation → real Vektonce at kickoff) · ISC-55/56 (plugin self-install + live-artifact↔MCP round-trip → Jan's Cowork workspace).
- **Cross-vendor:** Cato agent stalled before emitting a verdict; re-run as a direct read-only `codex exec` audit of the 3 invariants (gate / no-alter / archive) — verdict folded into the review loop.
- **Bugs fixed in the inherited engine:** archiver secret-scan false-positive on German memos (now key-based); top-level-await module error in the hook.
- **MCP real transport (ISC-49, upgraded):** `mcp/server.ts` now a real `@modelcontextprotocol/sdk` stdio server; `tests/mcp.smoke.test.ts` spawns it and drives `tools/list` (4 tools) + `plan_run` through actual JSON-RPC — protocol-tested, not just a manifest print.
- **Cross-vendor audit (codex/GPT-5.4, read-only):** verdict **concerns** → both findings fixed + regression-tested. (1) No-alter was address-only + save-before-assert → `structureFingerprint` now captures formula TEXT + numFmt; pipeline writes to a temp, asserts, then promotes (a failed assert never leaves an accepted file). (2) Archive raw-write now exclusive-create (`wx`) → same-runId overwrite impossible. Gate + secret-scan audited PASS. 34 tests green after fixes.
- **Artifact render (ISC-52):** `scripts/preview-artifact.ts` injects a real planned run into the live-artifact template; rendered + screenshotted at `out/preview/artifact-preview.png` — change table, NEU flags, review-bucket item, and the no-write notice all display correctly.
