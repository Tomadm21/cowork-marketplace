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
