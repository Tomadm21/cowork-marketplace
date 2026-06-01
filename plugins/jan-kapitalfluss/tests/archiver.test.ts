import { test, expect, describe } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { GobdArchiver, type ArchiveRunInput } from "../engine/archive/GobdArchiver";
import { sha256Hex } from "../engine/util/hash";
import { freshWorkRoot } from "./helpers";
import type { PlannedWrite } from "../engine/types";

const RAW = new Uint8Array([1, 2, 3, 4]);

function input(root: string, runId: string): ArchiveRunInput {
  return {
    root,
    changeSet: {
      runId,
      changesetHash: "h",
      generatedAtUtc: "",
      writes: [],
      reviewItems: [],
      summary: { txnCount: 0, changedCount: 0, newRowCount: 0, reviewCount: 0 },
    },
    rawArtifact: { bytes: RAW, filename: "umsaetze.csv", sha256: sha256Hex(RAW), fetchedAtUtc: "", fetchedAtBerlin: "" },
    mapping: { version: "1.0.0", gitHash: null, reviewBucket: "NEEDS_REVIEW", rules: [] },
    decision: { runId, changesetHash: "h", approver: "Jan", decision: "approved", approvedAtUtc: "", excludedRowKeys: [] },
    snapshotBeforeHash: "before",
    snapshotAfterHash: "after",
    timestampUtc: "2026-06-01T10:00:00Z",
    timestampBerlin: "2026-06-01T12:00:00+02:00",
  };
}

describe("GobdArchiver", () => {
  test("record carries source sha256; hash-chains; persists raw bytes; append-only", async () => {
    const root = await freshWorkRoot();
    const r1 = await GobdArchiver.archiveRun(input(root, "run1"));
    expect(r1.source.sha256).toBe(sha256Hex(RAW));
    expect(r1.prevHash).toBeNull();
    expect(r1.noAutoBooking).toBe(true);
    expect(r1.noAutoSend).toBe(true);

    const r2 = await GobdArchiver.archiveRun(input(root, "run2"));
    expect(r2.prevHash).toBe(r1.recordHash);

    // raw artifact persisted byte-for-byte
    const persisted = await readFile(join(root, "archive", "raw", "run1.csv"));
    expect(new Uint8Array(persisted)).toEqual(RAW);

    // append-only: re-archiving an existing runId is rejected
    await expect(GobdArchiver.archiveRun(input(root, "run1"))).rejects.toThrow();
  });

  test("legitimate German memo with 'tan'/'pin' substrings is NOT flagged as secret", async () => {
    const root = await freshWorkRoot();
    const inp = input(root, "memo-run");
    const w: PlannedWrite = {
      store: "linde",
      workbook: "vektonce",
      sheet: "Ausgaben",
      cell: "B5",
      kind: "append",
      oldValue: null,
      newValue: -10,
      bucket: "Raumkosten",
      sourceMemo: "Miete Konstanz Pinneberg Santander Tante Emma",
      ruleId: null,
      rowKey: "k",
      isNew: true,
    };
    inp.changeSet.writes = [w];
    const rec = await GobdArchiver.archiveRun(inp);
    expect(rec.diff[0]!.sourceMemo).toContain("Konstanz");
  });

  test("an actual credential assignment IS rejected", async () => {
    const root = await freshWorkRoot();
    const inp = input(root, "leak-run");
    inp.changeSet.writes = [
      {
        store: "linde",
        workbook: "vektonce",
        sheet: "Ausgaben",
        cell: "B5",
        kind: "append",
        oldValue: null,
        newValue: -1,
        bucket: "password=hunter2",
        sourceMemo: "x",
        ruleId: null,
        rowKey: "k",
        isNew: true,
      },
    ];
    await expect(GobdArchiver.archiveRun(inp)).rejects.toThrow();
  });

  test("an 'api_key:' assignment in a memo IS rejected", async () => {
    const root = await freshWorkRoot();
    const inp = input(root, "leak-apikey");
    inp.changeSet.writes = [
      {
        store: "linde",
        workbook: "vektonce",
        sheet: "Ausgaben",
        cell: "B5",
        kind: "append",
        oldValue: null,
        newValue: -1,
        bucket: "Raumkosten",
        sourceMemo: "api_key: sk-live-abc123",
        ruleId: null,
        rowKey: "k",
        isNew: true,
      },
    ];
    await expect(GobdArchiver.archiveRun(inp)).rejects.toThrow();
  });
});
