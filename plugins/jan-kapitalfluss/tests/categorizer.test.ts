import { test, expect, describe } from "bun:test";
import { loadDbaMapping } from "../engine/categorize/rules";
import { categorize } from "../engine/categorize/Categorizer";
import { repoRoot } from "./helpers";
import type { DbaMapping, NormalizedTxn } from "../engine/types";

function txn(p: Partial<NormalizedTxn>): NormalizedTxn {
  return {
    bookingDate: "2026-05-01",
    valueDate: "2026-05-01",
    amountCents: -100,
    currency: "EUR",
    type: "Lastschrift",
    counterparty: "",
    purpose: "",
    raw: {},
    sourceLine: 1,
    ...p,
  };
}

// The production mapping is the simple sign split. The rule ENGINE, however, still supports finer
// counterparty/purpose rules (so the workshop can add categories config-only) — those engine
// behaviors are tested below against INLINE mappings, decoupled from the shipped config.

describe("categorize — production mapping (the Einnahme/Ausgabe split)", () => {
  test("every credit -> Einnahmen, every debit -> Ausgaben, NOTHING to review", async () => {
    const mapping = await loadDbaMapping(repoRoot(), "mapping.v1");
    const out = categorize(mapping, [
      txn({ purpose: "McDonalds Tagesumsatz-Sammelgutschrift", amountCents: 894512 }),
      txn({ purpose: "HAVI Logistics Warenlieferung", amountCents: -1248055 }),
      txn({ purpose: "Lohn und Gehalt Personal", amountCents: -987030 }),
      txn({ purpose: "Irgendein beliebiger Posten", amountCents: -1990 }),
    ]);
    expect(out[0]!.bucket).toBe("Einnahmen");
    expect(out[0]!.ruleId).toBe("einnahme");
    expect(out.slice(1).every((t) => t.bucket === "Ausgaben")).toBe(true);
    expect(out.every((t) => t.needsReview === false)).toBe(true);
  });
});

describe("rule engine (inline mappings)", () => {
  const fineMapping: DbaMapping = {
    version: "test",
    gitHash: null,
    reviewBucket: "NEEDS_REVIEW",
    rules: [
      { id: "havi", bucket: "Wareneinkauf", matchAny: [{ field: "purpose", regex: "HAVI|Warenlieferung" }], amountSign: "debit", priority: 10 },
      { id: "umsatz", bucket: "Umsatzerloese", matchAny: [{ field: "purpose", regex: "McDonalds|Tagesumsatz" }], amountSign: "credit", priority: 10 },
    ],
  };

  test("matches rules; unmatched -> needs-review (never silently bucketed)", () => {
    const out = categorize(fineMapping, [
      txn({ purpose: "HAVI Logistics Warenlieferung", amountCents: -1000 }),
      txn({ purpose: "McDonalds Tagesumsatz-Sammelgutschrift", amountCents: 5000 }),
      txn({ purpose: "Voellig unbekannter Sonderposten", amountCents: -50 }),
    ]);
    expect(out[0]!.bucket).toBe("Wareneinkauf");
    expect(out[0]!.ruleId).toBe("havi");
    expect(out[1]!.bucket).toBe("Umsatzerloese");
    expect(out[2]!.bucket).toBe("NEEDS_REVIEW");
    expect(out[2]!.ruleId).toBeNull();
    expect(out[2]!.needsReview).toBe(true);
  });

  test("amount-sign guard: a credit does not match a debit-only rule", () => {
    const out = categorize(fineMapping, [txn({ purpose: "HAVI Gutschrift Rueckerstattung", amountCents: 1000 })]);
    expect(out[0]!.bucket).toBe("NEEDS_REVIEW");
  });

  test("deterministic: same input -> identical output", () => {
    const input = [txn({ purpose: "HAVI Warenlieferung", amountCents: -1 }), txn({ purpose: "McDonalds", amountCents: 2 })];
    expect(JSON.stringify(categorize(fineMapping, input))).toBe(JSON.stringify(categorize(fineMapping, input)));
  });

  test("rowKey is stable for identical txn content", () => {
    const a = categorize(fineMapping, [txn({ purpose: "X", amountCents: -1, sourceLine: 7 })]);
    const b = categorize(fineMapping, [txn({ purpose: "X", amountCents: -1, sourceLine: 7 })]);
    expect(a[0]!.rowKey).toBe(b[0]!.rowKey);
  });
});
