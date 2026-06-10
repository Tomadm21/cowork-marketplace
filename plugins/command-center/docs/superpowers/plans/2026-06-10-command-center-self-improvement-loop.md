# Command Center — Self-Improvement Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic self-improvement loop to the `command-center` plugin: daily processes append friction signals to the workspace, and Tom pulls an operator report (`/command-center:review`) every 2–4 weeks that gates candidates by recurrence (≥3) AND evidence (a curated pattern library).

**Architecture:** Approach A (deterministic). A signal log (`_firma/_state/signals.jsonl`) accumulates daily; an evidence library (`reference/patterns.md`) encodes proven patterns; a dependency-free generator (`review.ts`, mirror of the existing `dashboard.ts`) windows signals by a watermark, clusters them, applies the two gates, and writes a Markdown report. Nothing auto-applies; only Tom changes plugin capabilities.

**Tech Stack:** TypeScript run via `bun`; `bun test` for unit tests; Markdown for docs/skills/report. No external dependencies.

---

## Spec

`docs/superpowers/specs/2026-06-10-command-center-self-improvement-loop-design.md` (approved, decisions locked: threshold 3, Markdown-only report, 4 seed patterns).

## File Structure

**Create**
- `reference/signals.md` — signal schema + logging contract (doc, sibling of `reference/activity-log.md`).
- `reference/patterns.md` — evidence library, machine-parseable + human-readable, seeded with 4 patterns.
- `skills/improvement-review/scripts/review.ts` — deterministic report generator (pure functions + `main()`).
- `skills/improvement-review/scripts/review.test.ts` — `bun test` unit tests for the pure functions.
- `skills/improvement-review/SKILL.md` — the review skill (operator-facing).
- `commands/review.md` — `/command-center:review`.

**Modify**
- `skills/invoicing/SKILL.md`, `skills/daily-report/SKILL.md`, `skills/photo-sorting/SKILL.md`,
  `skills/receipt-filing/SKILL.md`, `skills/lead-gen/SKILL.md` — add a "Signal loggen" step.
- `reference/architecture.md` — document the loop + role boundary.
- `.claude-plugin/plugin.json`, `skills/firm-onboarding/templates/company-context.template.md`,
  `docs/end-to-end-dry-run.md` — version bump 0.2.0 → 0.3.0.

**Untouched:** the Galant daily dashboard (`skills/dashboard/`) stays clean and stable.

## Data types (used across tasks — names are load-bearing)

```ts
export type SignalType = "correction" | "recurring_check" | "observation" | "fact" | "tech_change";

export interface Signal { ts: string; process: string; type: SignalType; key: string; detail?: string; }

export interface Pattern {
  name: string; keys: string[]; beleg: string;
  impact: "hoch" | "mittel" | "niedrig"; aufwand?: string; empfehlung?: string;
}

export interface Cluster {
  key: string; count: number; type: SignalType; details: string[];
  pattern?: Pattern; rank: number;
}

export interface GateResult {
  stapel: Cluster[];      // correction/recurring_check · count≥threshold · evidence matched
  geparkt: Cluster[];     // count≥threshold (or observation) · no evidence match
  candidates: Cluster[];  // observation · evidence matched
  facts: Signal[];        // type "fact" (unconfirmed firm facts)
  tech: Cluster[];        // type "tech_change" (clustered by key)
}
```

**Gating rules (final):**
- Passive friction (`correction`, `recurring_check`): needs **recurrence ≥ threshold (3)**. Then: evidence → `stapel`; no evidence → `geparkt`. Below threshold → dropped.
- Deliberate input (`observation`): **skips recurrence** (a human asked on purpose). Then: evidence → `candidates`; no evidence → `geparkt`.
- `fact`: listed individually for confirmation (no gate).
- `tech_change`: clustered by key, listed as notices (no gate).
- `rank = count × impactWeight` (hoch=3, mittel=2, niedrig=1; no pattern → 1). Sections sorted by rank desc.

---

## Task 1: Signal contract + evidence library (docs)

**Files:**
- Create: `reference/signals.md`
- Create: `reference/patterns.md`

- [ ] **Step 1: Write `reference/signals.md`**

````markdown
# Signal contract — how processes feed the self-improvement loop

Every Command Center process appends **friction signals** to
`<workspace>/_firma/_state/signals.jsonl` — one JSON object per line, best-effort,
**never blocking a run** (same discipline as `activity-log.md`). The operator report
(`/command-center:review`) reads this file.

## Schema (one line per signal)

```json
{ "ts": "2026-06-10T08:12:00Z", "process": "receipt-filing", "type": "correction", "key": "receipt:unknown-vendor", "detail": "Vendor 'Müller GmbH' nicht erkannt, manuell zugeordnet" }
```

- `ts` — ISO 8601 timestamp.
- `process` — process key (`invoicing`, `receipt-filing`, …).
- `type` — one of: `correction`, `recurring_check`, `observation`, `fact`, `tech_change`.
- `key` — **stable cluster key**, lowercase, `process:slug` form. NO free text in the key —
  it is what recurrences aggregate on. Keep the key type-stable (one key → one type).
- `detail` — short human-readable note for the report (may name the concrete example).

## Types

| type | append when… |
|---|---|
| `correction` | the user changed a value the process proposed |
| `recurring_check` | a "prüfen" flag of a known class fired again |
| `observation` | the user/Tom said "wäre gut wenn…" / "merk dir…" / "notiz…" |
| `fact` | a firm fact was learned and is waiting for confirmation |
| `tech_change` | a changed folder, template format, or tool was detected |

## How to append (inside a skill, after the run's review step)

Append a line with the workspace's own tools — e.g. write/append to
`<workspace>/_firma/_state/signals.jsonl`. Create the file/dir if missing. If anything
fails, **silently skip** — logging must never block the user's task.

## Stable key registry (extend as processes grow)

- invoicing: `invoicing:unknown-person`, `invoicing:spesen-heuristik`, `invoicing:capped-day`
- daily-report: `daily-report:capped-day`, `daily-report:missing-day`
- photo-sorting: `photo:unknown-site`, `photo:low-confidence-date`
- receipt-filing: `receipt:unknown-vendor`, `receipt:ambiguous-routing`
- lead-gen: `lead-gen:low-quality-source`
- any process: `observation:<slug>`, `fact:<slug>`, `tech:<slug>`
````

- [ ] **Step 2: Write `reference/patterns.md`** (machine-parseable: each pattern is a `## ` block with a `- keys:` line)

````markdown
# Evidence library — proven patterns the review maps against

Tom-curated. The operator report (`review.ts`) maps each recurring signal cluster against
the `keys:` of these patterns. **A cluster with no match here is NOT recommended** — it is
parked quietly so nothing is lost. This file is the "evidence" half of the gate: only
patterns backed by an established practice/study live here.

**Format (parsed):** each pattern is a `## ` heading followed by `- field: value` lines.
A block is only treated as a pattern if it has a `- keys:` line. `impact` ∈ hoch|mittel|niedrig.

## Stammdaten-Register statt Wiederholungs-Eingabe
- keys: receipt:unknown-vendor, invoicing:unknown-person, photo:unknown-site
- beleg: Master-Data-Management / Single-Source-of-Truth-Register senken nachweislich wiederholte manuelle Dateneingabe und Fehlerquote (etablierte Datenmanagement-Praxis).
- impact: hoch
- aufwand: niedrig
- empfehlung: Ein `stammdaten/*.json`-Register anlegen oder erweitern, damit der Prozess den Treffer automatisch zuordnet statt jedes Mal nachzufragen.

## Heuristik → explizite Regel
- keys: invoicing:spesen-heuristik, photo:low-confidence-date
- beleg: Sobald eine wiederholt korrigierte Heuristik eine bekannte Regel hat, ersetzt eine explizite Config-Regel die Schätzung (etablierte Praxis: deterministische Regel schlägt wiederholtes Raten).
- impact: mittel
- aufwand: niedrig
- empfehlung: Die Regel in der `reference/rules.md` des Prozesses bzw. in `config/<process>.json` explizit machen.

## Wiederkehrender manueller Schritt → eigener Prozess
- keys: observation:neuer-ablauf, observation:wiederkehrende-handarbeit
- beleg: Automations-ROI-Filter — automatisieren, was häufig UND regelhaft ist (Toms ≥75%-deterministisch-Filter). Häufige, regelbasierte Handarbeit hat den höchsten Automatisierungs-Hebel.
- impact: hoch
- aufwand: mittel
- empfehlung: Kandidat für eine neue Automatisierung — baut nur Tom (neuer Prozess-Skill im Plugin).

## Vorlagen-/Pfad-Drift → Re-Detect statt Neu-Onboarding
- keys: tech:vorlage-geaendert, tech:pfad-geaendert
- beleg: Detect-First-Onboarding (eigenes onboarding-ux-Prinzip): geänderte technische Gegebenheiten werden erkannt und die Config angepasst, statt die Firma neu aufzusetzen.
- impact: mittel
- aufwand: niedrig
- empfehlung: Den betroffenen Prozess re-onboarden (nur die geänderten Felder), nicht das ganze Setup.
````

- [ ] **Step 3: Commit**

```bash
cd ~/cowork-marketplace
git add plugins/command-center/reference/signals.md plugins/command-center/reference/patterns.md
git diff --staged --name-only   # verify exactly these two files
git commit -m "feat(command-center): signal contract + evidence library docs"
```

---

## Task 2: `review.ts` — pattern parser (TDD)

**Files:**
- Create: `skills/improvement-review/scripts/review.ts`
- Create: `skills/improvement-review/scripts/review.test.ts`

- [ ] **Step 1: Write the failing test**

Create `skills/improvement-review/scripts/review.test.ts`:

```ts
import { test, expect } from "bun:test";
import { parsePatterns } from "./review.ts";

const MD = `# header
## Stammdaten-Register statt Wiederholungs-Eingabe
- keys: receipt:unknown-vendor, invoicing:unknown-person
- beleg: Master-Data senkt Eingabe.
- impact: hoch
- aufwand: niedrig
- empfehlung: Register anlegen.

## Prosa ohne keys (kein Pattern)
- beleg: nur Text

## Heuristik → explizite Regel
- keys: invoicing:spesen-heuristik
- impact: mittel
`;

test("parsePatterns: only blocks with keys become patterns", () => {
  const ps = parsePatterns(MD);
  expect(ps.length).toBe(2);
  expect(ps[0].name).toBe("Stammdaten-Register statt Wiederholungs-Eingabe");
  expect(ps[0].keys).toEqual(["receipt:unknown-vendor", "invoicing:unknown-person"]);
  expect(ps[0].impact).toBe("hoch");
  expect(ps[1].keys).toEqual(["invoicing:spesen-heuristik"]);
});

test("parsePatterns: bad impact falls back to mittel", () => {
  const ps = parsePatterns("## X\n- keys: a:b\n- impact: bogus\n");
  expect(ps[0].impact).toBe("mittel");
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/cowork-marketplace/plugins/command-center
bun test skills/improvement-review/scripts/review.test.ts
```
Expected: FAIL — cannot resolve `./review.ts` / `parsePatterns` is not exported.

- [ ] **Step 3: Write minimal implementation**

Create `skills/improvement-review/scripts/review.ts`:

```ts
#!/usr/bin/env bun
/**
 * Command Center — operator review report generator (deterministic, dependency-free).
 * Mirrors dashboard.ts: best-effort, never crashes on missing/partial state.
 *   bun review.ts <workspace_root> [output.md]
 */

export type SignalType = "correction" | "recurring_check" | "observation" | "fact" | "tech_change";
export interface Signal { ts: string; process: string; type: SignalType; key: string; detail?: string; }
export interface Pattern {
  name: string; keys: string[]; beleg: string;
  impact: "hoch" | "mittel" | "niedrig"; aufwand?: string; empfehlung?: string;
}

export function parsePatterns(md: string): Pattern[] {
  const out: Pattern[] = [];
  const blocks = md.split(/^##\s+/m).slice(1); // each block starts right after "## "
  for (const b of blocks) {
    const name = (b.split("\n", 1)[0] || "").trim();
    const field = (n: string): string => {
      const m = b.match(new RegExp(`^[-*]\\s*${n}\\s*:\\s*(.+)$`, "im"));
      return m ? m[1].trim() : "";
    };
    const keysRaw = field("keys");
    if (!keysRaw) continue; // not a machine pattern
    const keys = keysRaw.split(",").map((s) => s.trim()).filter(Boolean);
    const impactRaw = field("impact").toLowerCase();
    const impact = (["hoch", "mittel", "niedrig"].includes(impactRaw) ? impactRaw : "mittel") as Pattern["impact"];
    out.push({ name, keys, beleg: field("beleg"), impact, aufwand: field("aufwand"), empfehlung: field("empfehlung") });
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test skills/improvement-review/scripts/review.test.ts
```
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd ~/cowork-marketplace
git add plugins/command-center/skills/improvement-review/scripts/review.ts plugins/command-center/skills/improvement-review/scripts/review.test.ts
git commit -m "feat(command-center): review.ts pattern parser + tests"
```

---

## Task 3: `review.ts` — signal loader + watermark windowing (TDD)

**Files:**
- Modify: `skills/improvement-review/scripts/review.ts`
- Modify: `skills/improvement-review/scripts/review.test.ts`

- [ ] **Step 1: Write the failing test** (append to `review.test.ts`)

```ts
import { loadSignals, windowSignals } from "./review.ts";

test("loadSignals: skips blank and garbled lines, keeps valid", () => {
  const raw = [
    '{"ts":"2026-06-01T08:00:00Z","process":"receipt-filing","type":"correction","key":"receipt:unknown-vendor","detail":"x"}',
    "",
    "{garbled",
    '{"ts":"2026-06-02T08:00:00Z","process":"invoicing","type":"fact","key":"fact:neuer-kunde"}',
    '{"process":"x","type":"correction"}', // no key → dropped
  ].join("\n");
  const sigs = loadSignals(raw);
  expect(sigs.length).toBe(2);
  expect(sigs[0].key).toBe("receipt:unknown-vendor");
  expect(sigs[1].detail).toBeUndefined();
});

test("windowSignals: keeps only ts strictly after the watermark", () => {
  const sigs = loadSignals(
    [
      '{"ts":"2026-06-01T00:00:00Z","process":"p","type":"correction","key":"a:b"}',
      '{"ts":"2026-06-05T00:00:00Z","process":"p","type":"correction","key":"a:b"}',
    ].join("\n"),
  );
  expect(windowSignals(sigs, "2026-06-03T00:00:00Z").length).toBe(1);
  expect(windowSignals(sigs, "").length).toBe(2); // empty watermark → all
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test skills/improvement-review/scripts/review.test.ts
```
Expected: FAIL — `loadSignals` / `windowSignals` not exported.

- [ ] **Step 3: Write minimal implementation** (append to `review.ts`)

```ts
export function loadSignals(raw: string): Signal[] {
  const out: Signal[] = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    let e: any;
    try { e = JSON.parse(t); } catch { continue; }
    if (!e || typeof e !== "object") continue;
    if (typeof e.key !== "string" || typeof e.type !== "string") continue;
    out.push({
      ts: String(e.ts ?? ""), process: String(e.process ?? ""),
      type: e.type as SignalType, key: e.key,
      detail: e.detail != null ? String(e.detail) : undefined,
    });
  }
  return out;
}

// ISO 8601 strings compare correctly lexically.
export function windowSignals(signals: Signal[], watermarkTs: string): Signal[] {
  if (!watermarkTs) return signals;
  return signals.filter((s) => s.ts > watermarkTs);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test skills/improvement-review/scripts/review.test.ts
```
Expected: PASS (4 tests total).

- [ ] **Step 5: Commit**

```bash
cd ~/cowork-marketplace
git add plugins/command-center/skills/improvement-review/scripts/review.ts plugins/command-center/skills/improvement-review/scripts/review.test.ts
git commit -m "feat(command-center): review.ts signal loader + watermark windowing"
```

---

## Task 4: `review.ts` — cluster + two-gate logic (TDD, the heart)

**Files:**
- Modify: `skills/improvement-review/scripts/review.ts`
- Modify: `skills/improvement-review/scripts/review.test.ts`

- [ ] **Step 1: Write the failing test** (append to `review.test.ts`)

```ts
import { gate, parsePatterns as pp } from "./review.ts";
import { loadSignals as ls } from "./review.ts";

const PATTERNS = pp(`## Reg\n- keys: receipt:unknown-vendor\n- impact: hoch\n## Auto\n- keys: observation:neuer-ablauf\n- impact: hoch\n`);

function sig(type: string, key: string, ts: string) {
  return `{"ts":"${ts}","process":"p","type":"${type}","key":"${key}"}`;
}

test("gate: passive friction needs recurrence ≥3 AND evidence → stapel", () => {
  const raw = [
    sig("correction", "receipt:unknown-vendor", "2026-06-01T00:00:00Z"),
    sig("correction", "receipt:unknown-vendor", "2026-06-02T00:00:00Z"),
    sig("correction", "receipt:unknown-vendor", "2026-06-03T00:00:00Z"),
  ].join("\n");
  const r = gate(ls(raw), PATTERNS, 3);
  expect(r.stapel.length).toBe(1);
  expect(r.stapel[0].count).toBe(3);
  expect(r.stapel[0].rank).toBe(9); // 3 × impact hoch(3)
  expect(r.geparkt.length).toBe(0);
});

test("gate: recurring friction below threshold is dropped", () => {
  const raw = [
    sig("correction", "receipt:unknown-vendor", "2026-06-01T00:00:00Z"),
    sig("correction", "receipt:unknown-vendor", "2026-06-02T00:00:00Z"),
  ].join("\n");
  const r = gate(ls(raw), PATTERNS, 3);
  expect(r.stapel.length).toBe(0);
  expect(r.geparkt.length).toBe(0);
});

test("gate: recurring friction with no evidence → geparkt", () => {
  const raw = [0, 1, 2].map((i) => sig("correction", "receipt:unbekannt", `2026-06-0${i + 1}T00:00:00Z`)).join("\n");
  const r = gate(ls(raw), PATTERNS, 3);
  expect(r.stapel.length).toBe(0);
  expect(r.geparkt.length).toBe(1);
});

test("gate: observation skips recurrence; evidence → candidate, none → geparkt", () => {
  const r1 = gate(ls(sig("observation", "observation:neuer-ablauf", "2026-06-01T00:00:00Z")), PATTERNS, 3);
  expect(r1.candidates.length).toBe(1);
  const r2 = gate(ls(sig("observation", "observation:sonstwas", "2026-06-01T00:00:00Z")), PATTERNS, 3);
  expect(r2.geparkt.length).toBe(1);
});

test("gate: facts listed individually, tech clustered by key", () => {
  const raw = [
    sig("fact", "fact:neuer-kunde", "2026-06-01T00:00:00Z"),
    sig("fact", "fact:neuer-kunde", "2026-06-02T00:00:00Z"),
    sig("tech_change", "tech:vorlage-geaendert", "2026-06-03T00:00:00Z"),
    sig("tech_change", "tech:vorlage-geaendert", "2026-06-04T00:00:00Z"),
  ].join("\n");
  const r = gate(ls(raw), PATTERNS, 3);
  expect(r.facts.length).toBe(2);   // each fact listed
  expect(r.tech.length).toBe(1);    // clustered by key
  expect(r.tech[0].count).toBe(2);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test skills/improvement-review/scripts/review.test.ts
```
Expected: FAIL — `gate` not exported.

- [ ] **Step 3: Write minimal implementation** (append to `review.ts`)

```ts
export interface Cluster {
  key: string; count: number; type: SignalType; details: string[];
  pattern?: Pattern; rank: number;
}
export interface GateResult {
  stapel: Cluster[]; geparkt: Cluster[]; candidates: Cluster[];
  facts: Signal[]; tech: Cluster[];
}

const IMPACT_WEIGHT: Record<Pattern["impact"], number> = { hoch: 3, mittel: 2, niedrig: 1 };

export function gate(signals: Signal[], patterns: Pattern[], threshold = 3): GateResult {
  const patternForKey = (key: string): Pattern | undefined =>
    patterns.find((p) => p.keys.includes(key));

  const facts = signals.filter((s) => s.type === "fact");

  const techMap = new Map<string, Cluster>();
  for (const s of signals.filter((s) => s.type === "tech_change")) {
    const c = techMap.get(s.key) ?? { key: s.key, count: 0, type: "tech_change" as SignalType, details: [], rank: 0 };
    c.count++; if (s.detail) c.details.push(s.detail);
    techMap.set(s.key, c);
  }
  const tech = [...techMap.values()];

  const clusterMap = new Map<string, Cluster>();
  for (const s of signals) {
    if (!(s.type === "correction" || s.type === "recurring_check" || s.type === "observation")) continue;
    const c = clusterMap.get(s.key) ?? { key: s.key, count: 0, type: s.type, details: [], rank: 0 };
    c.count++; if (s.detail) c.details.push(s.detail);
    clusterMap.set(s.key, c);
  }

  const stapel: Cluster[] = [], geparkt: Cluster[] = [], candidates: Cluster[] = [];
  for (const c of clusterMap.values()) {
    const p = patternForKey(c.key);
    c.pattern = p;
    c.rank = c.count * (p ? IMPACT_WEIGHT[p.impact] : 1);
    const isObservation = c.type === "observation";
    if (!isObservation && c.count < threshold) continue; // below recurrence → dropped
    if (!p) { geparkt.push(c); continue; }                // no evidence → parked
    if (isObservation) candidates.push(c); else stapel.push(c);
  }
  const byRank = (a: Cluster, b: Cluster) => b.rank - a.rank;
  stapel.sort(byRank); candidates.sort(byRank); geparkt.sort(byRank);
  return { stapel, geparkt, candidates, facts, tech };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test skills/improvement-review/scripts/review.test.ts
```
Expected: PASS (9 tests total).

- [ ] **Step 5: Commit**

```bash
cd ~/cowork-marketplace
git add plugins/command-center/skills/improvement-review/scripts/review.ts plugins/command-center/skills/improvement-review/scripts/review.test.ts
git commit -m "feat(command-center): review.ts cluster + recurrence/evidence gates"
```

---

## Task 5: `review.ts` — report renderer + main + watermark (TDD + integration)

**Files:**
- Modify: `skills/improvement-review/scripts/review.ts`
- Modify: `skills/improvement-review/scripts/review.test.ts`

- [ ] **Step 1: Write the failing test** (append to `review.test.ts`)

```ts
import { renderReport, maxTs } from "./review.ts";

test("maxTs returns the latest ts or empty", () => {
  expect(maxTs(ls(sig("fact", "fact:a", "2026-06-01T00:00:00Z") + "\n" + sig("fact", "fact:a", "2026-06-09T00:00:00Z")))).toBe("2026-06-09T00:00:00Z");
  expect(maxTs([])).toBe("");
});

test("renderReport: stapel item shows pattern + count; empty sections show a friendly line", () => {
  const PATTERNS2 = pp("## Reg\n- keys: receipt:unknown-vendor\n- impact: hoch\n- empfehlung: Register anlegen.\n");
  const raw = [0, 1, 2].map((i) => sig("correction", "receipt:unknown-vendor", `2026-06-0${i + 1}T00:00:00Z`)).join("\n");
  const r = gate(ls(raw), PATTERNS2, 3);
  const md = renderReport("Galant Bau GmbH", "2026-06-01T00:00:00Z", r);
  expect(md).toContain("Galant Bau GmbH");
  expect(md).toContain("receipt:unknown-vendor");
  expect(md).toContain("Reg");           // pattern name
  expect(md).toContain("Register anlegen."); // empfehlung
  expect(md).toContain("3×");            // recurrence count rendered
  expect(md).toContain("Keine offenen Fakten"); // empty facts section friendly line
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test skills/improvement-review/scripts/review.test.ts
```
Expected: FAIL — `renderReport` / `maxTs` not exported.

- [ ] **Step 3: Write minimal implementation** (append to `review.ts`)

```ts
export function maxTs(signals: Signal[]): string {
  return signals.reduce((m, s) => (s.ts > m ? s.ts : m), "");
}

function clusterLines(cs: Cluster[]): string {
  return cs.map((c) => {
    const head = `- **${c.key}** — ${c.count}×` + (c.pattern ? ` · Muster: *${c.pattern.name}* (Impact ${c.pattern.impact})` : "");
    const emp = c.pattern?.empfehlung ? `\n  - Empfehlung: ${c.pattern.empfehlung}` : "";
    const ex = c.details[0] ? `\n  - Beispiel: ${c.details[0]}` : "";
    return head + emp + ex;
  }).join("\n");
}

export function renderReport(firm: string, sinceTs: string, r: GateResult): string {
  const since = sinceTs ? `seit ${sinceTs}` : "seit Beginn (erster Review)";
  const sec = (title: string, body: string, empty: string) =>
    `\n## ${title}\n\n${body.trim() ? body : `_${empty}_`}\n`;

  const facts = r.facts.length
    ? r.facts.map((f) => `- ${f.key}${f.detail ? ` — ${f.detail}` : ""}`).join("\n")
    : "";

  return `# Optimierungs-Bericht — ${firm}

Fenster: ${since}.
` +
    sec("Getorter Stapel (Wiederholung + Beleg)", clusterLines(r.stapel),
        "Nichts hat in diesem Fenster Wiederholung ≥3 und einen Beleg erreicht.") +
    sec("Kontext-Vertiefung — Fakten bestätigen", facts,
        "Keine offenen Fakten.") +
    sec("Neue-Automatisierung-Kandidaten (baut nur Tom)", clusterLines(r.candidates),
        "Keine belegten Automatisierungs-Kandidaten.") +
    sec("Technik-Hinweise", clusterLines(r.tech),
        "Keine technischen Änderungen erkannt.") +
    sec("Geparkt (wiederkehrend, aber unbelegt)", clusterLines(r.geparkt),
        "Nichts geparkt.") +
    `\n---\n_Bericht ist eine Empfehlung. Jede Plugin-Änderung ist ein bewusster Schritt von Tom — nichts wendet sich selbst an._\n`;
}
```

- [ ] **Step 4: Add `main()` to `review.ts`** (file-IO glue; append at end)

```ts
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

function readSafe(p: string): string | null { try { return fs.readFileSync(p, "utf8"); } catch { return null; } }

function firmName(ws: string): string {
  const md = readSafe(path.join(ws, "_firma", "company-context.md"));
  const h = md?.match(/^#\s*Firmenkontext\s*[—–-]\s*(.+)\s*$/m);
  if (h && h[1] && !h[1].includes("{{")) return h[1].trim();
  return "Dein Betrieb";
}

function main() {
  const ws = process.argv[2];
  if (!ws) { console.error("usage: review.ts <workspace_root> [output.md]"); process.exit(1); }
  const out = process.argv[3] || path.join(ws, "_firma", "optimierung-bericht.md");
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));

  const patternsMd = readSafe(process.env.CC_PATTERNS_MD || path.join(scriptDir, "../../../reference/patterns.md")) || "";
  const patterns = parsePatterns(patternsMd);

  const signals = loadSignals(readSafe(path.join(ws, "_firma", "_state", "signals.jsonl")) || "");
  const wmRaw = readSafe(path.join(ws, "_firma", "_state", "review-watermark.json"));
  let watermark = "";
  try { watermark = wmRaw ? String(JSON.parse(wmRaw).last_review_ts ?? "") : ""; } catch { watermark = ""; }

  const windowed = windowSignals(signals, watermark);
  const result = gate(windowed, patterns, 3);
  const md = renderReport(firmName(ws), watermark, result);

  try {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, md, "utf8");
    const newWm = maxTs(windowed) || watermark;
    if (newWm) {
      const wmPath = path.join(ws, "_firma", "_state", "review-watermark.json");
      fs.mkdirSync(path.dirname(wmPath), { recursive: true });
      fs.writeFileSync(wmPath, JSON.stringify({ last_review_ts: newWm }, null, 2), "utf8");
    }
  } catch (e) {
    console.error(`review.ts: could not write ${out}: ${(e as Error).message}`);
    process.exit(1);
  }
  console.log(path.resolve(out));
}

if (import.meta.main) main();
```

> Note: `import.meta.main` (bun) guards `main()` so importing the module in tests does not run it.

- [ ] **Step 5: Run unit tests**

```bash
bun test skills/improvement-review/scripts/review.test.ts
```
Expected: PASS (11 tests total).

- [ ] **Step 6: Integration run on a crafted workspace**

```bash
cd ~/cowork-marketplace/plugins/command-center
WS=/tmp/cc-review-int && rm -rf "$WS" && mkdir -p "$WS/_firma/_state"
printf '# Firmenkontext — Galant Bau GmbH\n' > "$WS/_firma/company-context.md"
printf '%s\n' \
 '{"ts":"2026-06-01T08:00:00Z","process":"receipt-filing","type":"correction","key":"receipt:unknown-vendor","detail":"Müller GmbH"}' \
 '{"ts":"2026-06-02T08:00:00Z","process":"receipt-filing","type":"correction","key":"receipt:unknown-vendor","detail":"Müller GmbH"}' \
 '{"ts":"2026-06-03T08:00:00Z","process":"receipt-filing","type":"correction","key":"receipt:unknown-vendor","detail":"Müller GmbH"}' \
 '{"ts":"2026-06-04T08:00:00Z","process":"invoicing","type":"fact","key":"fact:neuer-kunde","detail":"Bauträger XY"}' \
 '{"ts":"2026-06-05T08:00:00Z","process":"x","type":"observation","key":"observation:neuer-ablauf","detail":"Wochenbericht ans Büro mailen"}' \
 > "$WS/_firma/_state/signals.jsonl"
bun skills/improvement-review/scripts/review.ts "$WS"
echo "--- report ---"; cat "$WS/_firma/optimierung-bericht.md"
echo "--- watermark (should be the last ts) ---"; cat "$WS/_firma/_state/review-watermark.json"
echo "--- second run windows to empty (no new signals) ---"; bun skills/improvement-review/scripts/review.ts "$WS" >/dev/null && grep -c "Nichts hat in diesem Fenster" "$WS/_firma/optimierung-bericht.md"
```
Expected: report shows `receipt:unknown-vendor — 3×` under the gated stapel, the fact under context-deepening, the observation as a candidate; watermark = `2026-06-05T08:00:00Z`; the second run's stapel section shows the empty friendly line (grep prints `1`).

- [ ] **Step 7: Commit**

```bash
cd ~/cowork-marketplace
git add plugins/command-center/skills/improvement-review/scripts/review.ts plugins/command-center/skills/improvement-review/scripts/review.test.ts
git commit -m "feat(command-center): review.ts report renderer + main + watermark"
```

---

## Task 6: improvement-review skill + slash command (docs)

**Files:**
- Create: `skills/improvement-review/SKILL.md`
- Create: `commands/review.md`

- [ ] **Step 1: Write `skills/improvement-review/SKILL.md`**

```markdown
---
name: improvement-review
description: Operator-only — generate the Command Center improvement report (the "what can we optimize" stack). Use when Tom says "optimierungs-bericht", "command center review", "was kann ich optimieren", "review ziehen", "improvement report". Reads the workspace signal log, gates candidates by recurrence (≥3) AND the evidence library, and writes a Markdown report. Does NOT change the plugin.
---

# Improvement review (operator)

Generate the operator report that surfaces what is worth improving — gated by **recurrence
(≥3)** and **evidence** (`${CLAUDE_PLUGIN_ROOT}/reference/patterns.md`). This is an operator
tool (Tom). It is read-only with respect to the plugin: it only reads the workspace and writes
one Markdown report. Nothing here changes the Command Center's capabilities.

## Step 0 — Locate the workspace
Find `workspace_root` and confirm `_firma/company-context.md` exists. If the firm isn't set up,
there is nothing to review — say so and point to `/command-center:setup`.

## Step 1 — Generate
Run the generator (deterministic, dependency-free; never crashes on missing/partial state):

```
bun ${CLAUDE_PLUGIN_ROOT}/skills/improvement-review/scripts/review.ts <workspace_root>
```

It prints the path to the written report (default `<workspace_root>/_firma/optimierung-bericht.md`)
and advances the review watermark so the next report covers only new signals.

## Step 2 — Present
Show Tom the report (Markdown) and a 3–4 line summary in German: how many gated items, how many
facts to confirm, how many new-automation candidates. For each candidate, remember: **only Tom
builds new automations** — the report is a decision aid, not an action.

## Step 3 — Act (Tom's call, outside this skill)
If Tom decides to act, that happens as a normal plugin edit in Claude Code (sharpen a process
rule, add a `stammdaten` register, build a new process). This skill does not perform those edits.

## Note
The gates and signal schema live in `${CLAUDE_PLUGIN_ROOT}/reference/patterns.md` and
`${CLAUDE_PLUGIN_ROOT}/reference/signals.md`. Curating `patterns.md` over time is how the
review gets sharper — that is also an operator (Tom) task.
```

- [ ] **Step 2: Write `commands/review.md`**

```markdown
---
description: Operator-only — generate the Command Center improvement report (recurrence + evidence gated). Reads the workspace signal log; never changes the plugin.
---

# /command-center:review

Generate the operator improvement report for the firm in this workspace.

Invoke the **`improvement-review`** skill. It runs the deterministic generator over the
workspace signal log, gates candidates by recurrence (≥3) and the evidence library, writes
`_firma/optimierung-bericht.md`, and advances the review watermark. Present the report plus a
short German summary. New automations are built by Tom as a separate, deliberate step — this
command only produces the report.
```

- [ ] **Step 3: Commit**

```bash
cd ~/cowork-marketplace
git add plugins/command-center/skills/improvement-review/SKILL.md plugins/command-center/commands/review.md
git commit -m "feat(command-center): improvement-review skill + /command-center:review"
```

---

## Task 7: Wire "Signal loggen" into the 5 process skills

Each process gets one new step before its existing "Log the run" step. The step is best-effort
and references `reference/signals.md`. Insert the process-specific block verbatim.

**Files:** `skills/invoicing/SKILL.md`, `skills/daily-report/SKILL.md`, `skills/photo-sorting/SKILL.md`, `skills/receipt-filing/SKILL.md`, `skills/lead-gen/SKILL.md`

- [ ] **Step 1: invoicing** — in `skills/invoicing/SKILL.md`, immediately before `## Step 6 — Log the run`, insert:

```markdown
## Step 5b — Signal loggen (best-effort)
Append friction signals to `<workspace>/_firma/_state/signals.jsonl` per
`${CLAUDE_PLUGIN_ROOT}/reference/signals.md` — one JSON line each, never blocking the run:
- if a person was unknown and the user mapped it → `{type:"correction", key:"invoicing:unknown-person"}`
- if the spesen heuristic was corrected → `{type:"correction", key:"invoicing:spesen-heuristik"}`
- if a capped-day "prüfen" fired → `{type:"recurring_check", key:"invoicing:capped-day"}`
- if the user said "wäre gut wenn…/merk dir…" → `{type:"observation", key:"observation:<slug>", detail:"…"}`
- if a learned firm fact came up → `{type:"fact", key:"fact:<slug>", detail:"…"}`
```

- [ ] **Step 2: daily-report** — before `## Step 6 — Log the run`, insert:

```markdown
## Step 5b — Signal loggen (best-effort)
Append friction signals to `<workspace>/_firma/_state/signals.jsonl` per
`${CLAUDE_PLUGIN_ROOT}/reference/signals.md` — one JSON line each, never blocking the run:
- if a capped-day "prüfen" fired → `{type:"recurring_check", key:"daily-report:capped-day"}`
- if a missing day had to be asked → `{type:"recurring_check", key:"daily-report:missing-day"}`
- if the user said "wäre gut wenn…/merk dir…" → `{type:"observation", key:"observation:<slug>", detail:"…"}`
- if a learned firm fact came up → `{type:"fact", key:"fact:<slug>", detail:"…"}`
- if the template/path had changed → `{type:"tech_change", key:"tech:vorlage-geaendert", detail:"…"}`
```

- [ ] **Step 3: photo-sorting** — before `## Step 5 — Log the run`, insert:

```markdown
## Step 4b — Signal loggen (best-effort)
Append friction signals to `<workspace>/_firma/_state/signals.jsonl` per
`${CLAUDE_PLUGIN_ROOT}/reference/signals.md` — one JSON line each, never blocking the run:
- if the site was unknown and the user named it → `{type:"correction", key:"photo:unknown-site"}`
- if a low-confidence date had to be corrected → `{type:"correction", key:"photo:low-confidence-date"}`
- if the user said "wäre gut wenn…/merk dir…" → `{type:"observation", key:"observation:<slug>", detail:"…"}`
- if a project folder/structure had changed → `{type:"tech_change", key:"tech:pfad-geaendert", detail:"…"}`
```

- [ ] **Step 4: receipt-filing** — before `## Step 5 — Log the run`, insert:

```markdown
## Step 4b — Signal loggen (best-effort)
Append friction signals to `<workspace>/_firma/_state/signals.jsonl` per
`${CLAUDE_PLUGIN_ROOT}/reference/signals.md` — one JSON line each, never blocking the run:
- if a vendor was unknown and the user mapped it → `{type:"correction", key:"receipt:unknown-vendor", detail:"<vendor>"}`
- if routing was ambiguous and the user picked → `{type:"correction", key:"receipt:ambiguous-routing"}`
- if the user said "wäre gut wenn…/merk dir…" → `{type:"observation", key:"observation:<slug>", detail:"…"}`
- if a learned firm/vendor fact came up → `{type:"fact", key:"fact:<slug>", detail:"…"}`
```

- [ ] **Step 5: lead-gen** — before `## Step 5 — Log the run`, insert:

```markdown
## Step 4b — Signal loggen (best-effort)
Append friction signals to `<workspace>/_firma/_state/signals.jsonl` per
`${CLAUDE_PLUGIN_ROOT}/reference/signals.md` — one JSON line each, never blocking the run:
- if a source was repeatedly low quality → `{type:"recurring_check", key:"lead-gen:low-quality-source"}`
- if the user said "wäre gut wenn…/merk dir…" → `{type:"observation", key:"observation:<slug>", detail:"…"}`
- if the ICP definition shifted (a learned fact) → `{type:"fact", key:"fact:<slug>", detail:"…"}`
```

- [ ] **Step 6: Verify each insertion landed before the run-log step**

```bash
cd ~/cowork-marketplace/plugins/command-center
for f in invoicing daily-report photo-sorting receipt-filing lead-gen; do
  echo "== $f =="; grep -n "Signal loggen\|Log the run" skills/$f/SKILL.md
done
```
Expected: in every file, the "Signal loggen" line appears **above** the "Log the run" line.

- [ ] **Step 7: Commit**

```bash
cd ~/cowork-marketplace
git add plugins/command-center/skills/invoicing/SKILL.md plugins/command-center/skills/daily-report/SKILL.md plugins/command-center/skills/photo-sorting/SKILL.md plugins/command-center/skills/receipt-filing/SKILL.md plugins/command-center/skills/lead-gen/SKILL.md
git commit -m "feat(command-center): processes append friction signals"
```

---

## Task 8: Architecture doc + version bump 0.3.0

**Files:**
- Modify: `reference/architecture.md`
- Modify: `.claude-plugin/plugin.json`, `skills/firm-onboarding/templates/company-context.template.md`, `docs/end-to-end-dry-run.md`

- [ ] **Step 1: Append a section to `reference/architecture.md`**

```markdown
## Self-improvement loop (v0.3.0)

The plugin improves over time without ever self-modifying. Two roles, hard boundary:

- **Daily users** use processes and write only to the workspace. Each process appends
  best-effort friction signals to `_firma/_state/signals.jsonl` (schema: `reference/signals.md`).
- **Operator (Tom)** pulls `/command-center:review` every 2–4 weeks. `review.ts` windows
  signals by a watermark, clusters them, and gates candidates by **recurrence (≥3)** AND
  **evidence** (`reference/patterns.md`), writing a Markdown report. Nothing auto-applies —
  acting on a recommendation is a deliberate plugin edit by Tom.

`patterns.md` is the operator-curated evidence library; curating it is how the review sharpens.
The daily dashboard (`skills/dashboard/`) is deliberately unchanged — it stays the firm's clean,
stable home screen.
```

- [ ] **Step 2: Bump version in all three places**

```bash
cd ~/cowork-marketplace/plugins/command-center
sed -i '' 's/"version": "0.2.0"/"version": "0.3.0"/' .claude-plugin/plugin.json
sed -i '' 's/command-center v0.2.0/command-center v0.3.0/' skills/firm-onboarding/templates/company-context.template.md docs/end-to-end-dry-run.md
grep -rn '0\.3\.0\|0\.2\.0' .claude-plugin/plugin.json skills/firm-onboarding/templates/company-context.template.md docs/end-to-end-dry-run.md
```
Expected: all three now read `0.3.0`; no `0.2.0` remains.

- [ ] **Step 3: Full test + integration smoke**

```bash
cd ~/cowork-marketplace/plugins/command-center
bun test skills/improvement-review/scripts/review.test.ts
bun skills/improvement-review/scripts/review.ts /tmp/cc-review-int >/dev/null && echo "generator OK"
```
Expected: all unit tests PASS; generator prints OK.

- [ ] **Step 4: Commit**

```bash
cd ~/cowork-marketplace
git add plugins/command-center/reference/architecture.md plugins/command-center/.claude-plugin/plugin.json plugins/command-center/skills/firm-onboarding/templates/company-context.template.md plugins/command-center/docs/end-to-end-dry-run.md
git commit -m "docs(command-center): document self-improvement loop + bump to v0.3.0"
```

---

## Self-Review (author checklist — completed)

**Spec coverage:** signal log → Task 1+7; evidence library → Task 1; operator report `review.ts` → Tasks 2–5; `/command-center:review` + skill → Task 6; living context (facts) → Task 4 (gate) + Task 5 (render) + Task 7 (fact signals); role boundary → Task 6 skill text + Task 8 architecture; watermark → Task 5; testing → Tasks 2–5; version bump → Task 8. No gaps.

**Placeholder scan:** every code/test step shows complete code; `<slug>` in process steps is an intentional runtime value the skill fills, documented in `signals.md`. No TBD/TODO.

**Type consistency:** `Signal`, `Pattern`, `Cluster`, `GateResult` defined once (Tasks 2–4) and reused; functions `parsePatterns`/`loadSignals`/`windowSignals`/`gate`/`maxTs`/`renderReport` referenced with consistent signatures across tasks and tests.
