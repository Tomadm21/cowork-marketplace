import { test, expect, describe } from "bun:test";
import { loadDbaMapping } from "../engine/categorize/rules";
import { categorize } from "../engine/categorize/Categorizer";
import { repoRoot } from "./helpers";
import type { NormalizedTxn } from "../engine/types";

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

describe("categorize (fixture DBA mapping)", () => {
  test("matches rules; unmatched -> needs-review (never silently bucketed)", async () => {
    const mapping = await loadDbaMapping(repoRoot(), "mapping.v1");
    const out = categorize(mapping, [
      txn({ purpose: "HAVI Logistics Warenlieferung", amountCents: -1000 }),
      txn({ purpose: "McDonalds Tagesumsatz-Sammelgutschrift", amountCents: 5000 }),
      txn({ purpose: "Voellig unbekannter Sonderposten", amountCents: -50 }),
    ]);
    expect(out[0]!.bucket).toBe("Wareneinkauf");
    expect(out[0]!.ruleId).toBe("wareneinkauf-havi");
    expect(out[1]!.bucket).toBe("Umsatzerloese");
    expect(out[1]!.ruleId).toBe("umsatz-mcd");
    expect(out[2]!.bucket).toBe("NEEDS_REVIEW");
    expect(out[2]!.ruleId).toBeNull();
    expect(out[2]!.needsReview).toBe(true);
  });

  test("amount-sign guard: a credit does not match a debit-only rule", async () => {
    const mapping = await loadDbaMapping(repoRoot(), "mapping.v1");
    // 'HAVI' matches wareneinkauf-havi (debit) — but a positive amount must NOT match it
    const out = categorize(mapping, [txn({ purpose: "HAVI Gutschrift Rueckerstattung", amountCents: 1000 })]);
    expect(out[0]!.bucket).toBe("NEEDS_REVIEW");
  });

  test("deterministic: same input -> identical output", async () => {
    const mapping = await loadDbaMapping(repoRoot(), "mapping.v1");
    const input = [txn({ purpose: "HAVI Warenlieferung", amountCents: -1 }), txn({ purpose: "Strom Stadtwerke", amountCents: -2 })];
    expect(JSON.stringify(categorize(mapping, input))).toBe(JSON.stringify(categorize(mapping, input)));
  });

  test("rowKey is stable for identical txn content", async () => {
    const mapping = await loadDbaMapping(repoRoot(), "mapping.v1");
    const a = categorize(mapping, [txn({ purpose: "X", amountCents: -1, sourceLine: 7 })]);
    const b = categorize(mapping, [txn({ purpose: "X", amountCents: -1, sourceLine: 7 })]);
    expect(a[0]!.rowKey).toBe(b[0]!.rowKey);
  });
});
