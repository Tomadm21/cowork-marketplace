import { test, expect } from "bun:test";
import { parsePatterns, loadSignals, windowSignals, gate } from "./review.ts";

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

test("parsePatterns: empty keys value does not swallow the next line", () => {
  const ps = parsePatterns("## X\n- keys:\n- impact: hoch\n");
  expect(ps.length).toBe(0); // empty keys → not a pattern
});

test("loadSignals: skips blank and garbled lines, keeps valid", () => {
  const raw = [
    '{"ts":"2026-06-01T08:00:00Z","process":"receipt-filing","type":"correction","key":"receipt:unknown-vendor","detail":"x"}',
    "",
    "{garbled",
    '{"ts":"2026-06-02T08:00:00Z","process":"invoicing","type":"fact","key":"fact:neuer-kunde"}',
    '{"process":"x","type":"correction"}',
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

const PATTERNS = parsePatterns(`## Reg\n- keys: receipt:unknown-vendor\n- impact: hoch\n## Auto\n- keys: observation:neuer-ablauf\n- impact: hoch\n`);

function sig(type: string, key: string, ts: string) {
  return `{"ts":"${ts}","process":"p","type":"${type}","key":"${key}"}`;
}

test("gate: passive friction needs recurrence ≥3 AND evidence → stapel", () => {
  const raw = [
    sig("correction", "receipt:unknown-vendor", "2026-06-01T00:00:00Z"),
    sig("correction", "receipt:unknown-vendor", "2026-06-02T00:00:00Z"),
    sig("correction", "receipt:unknown-vendor", "2026-06-03T00:00:00Z"),
  ].join("\n");
  const r = gate(loadSignals(raw), PATTERNS, 3);
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
  const r = gate(loadSignals(raw), PATTERNS, 3);
  expect(r.stapel.length).toBe(0);
  expect(r.geparkt.length).toBe(0);
});

test("gate: recurring friction with no evidence → geparkt", () => {
  const raw = [0, 1, 2].map((i) => sig("correction", "receipt:unbekannt", `2026-06-0${i + 1}T00:00:00Z`)).join("\n");
  const r = gate(loadSignals(raw), PATTERNS, 3);
  expect(r.stapel.length).toBe(0);
  expect(r.geparkt.length).toBe(1);
});

test("gate: observation skips recurrence; evidence → candidate, none → geparkt", () => {
  const r1 = gate(loadSignals(sig("observation", "observation:neuer-ablauf", "2026-06-01T00:00:00Z")), PATTERNS, 3);
  expect(r1.candidates.length).toBe(1);
  const r2 = gate(loadSignals(sig("observation", "observation:sonstwas", "2026-06-01T00:00:00Z")), PATTERNS, 3);
  expect(r2.geparkt.length).toBe(1);
});

test("gate: facts listed individually, tech clustered by key", () => {
  const raw = [
    sig("fact", "fact:neuer-kunde", "2026-06-01T00:00:00Z"),
    sig("fact", "fact:neuer-kunde", "2026-06-02T00:00:00Z"),
    sig("tech_change", "tech:vorlage-geaendert", "2026-06-03T00:00:00Z"),
    sig("tech_change", "tech:vorlage-geaendert", "2026-06-04T00:00:00Z"),
  ].join("\n");
  const r = gate(loadSignals(raw), PATTERNS, 3);
  expect(r.facts.length).toBe(2);   // each fact listed
  expect(r.tech.length).toBe(1);    // clustered by key
  expect(r.tech[0].count).toBe(2);
});
