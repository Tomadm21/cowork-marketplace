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

test("parsePatterns: empty keys value does not swallow the next line", () => {
  const ps = parsePatterns("## X\n- keys:\n- impact: hoch\n");
  expect(ps.length).toBe(0); // empty keys → not a pattern
});

import { loadSignals, windowSignals } from "./review.ts";

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
