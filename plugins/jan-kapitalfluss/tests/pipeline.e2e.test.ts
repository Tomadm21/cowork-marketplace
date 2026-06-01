import { test, expect, describe, beforeAll } from "bun:test";
import { existsSync } from "node:fs";
import { runPlan, runCommit } from "../engine/pipeline";
import { loadAccount } from "../engine/config";
import { ensureFixtures, repoRoot, freshWorkRoot, nowFixed } from "./helpers";
import type { ApprovalDecision, RunContext } from "../engine/types";

describe("pipeline e2e — one Commerzbank account → one Kapitalflusstabelle", () => {
  beforeAll(async () => {
    await ensureFixtures();
  });

  test("plan -> approve -> commit -> archive: every movement lands, nothing falls to review", async () => {
    const workRoot = await freshWorkRoot();
    const ctx: RunContext = { pluginRoot: repoRoot(), workRoot, approver: "Jan Theobald", now: nowFixed() };

    const plan = await runPlan(ctx, "fixtures/commerzbank/commerzbank-2026-05.csv");

    // The defining property of the corrected model: every income and expense is sorted into the
    // table by sign — so the categorizer leaves NOTHING in the needs-review bucket.
    expect(plan.changeSet.summary.reviewCount).toBe(0);

    // Every Vektonce write is an appended row tagged Einnahmen or Ausgaben (the only two buckets).
    const vektonceRows = plan.changeSet.writes.filter((w) => w.workbook === "vektonce");
    expect(vektonceRows.length).toBeGreaterThan(0);
    expect(vektonceRows.every((w) => w.bucket === "Einnahmen" || w.bucket === "Ausgaben")).toBe(true);
    // Both income and expense are represented.
    expect(vektonceRows.some((w) => w.bucket === "Einnahmen")).toBe(true);
    expect(vektonceRows.some((w) => w.bucket === "Ausgaben")).toBe(true);

    const decision: ApprovalDecision = {
      runId: plan.changeSet.runId,
      changesetHash: plan.changeSet.changesetHash,
      approver: "Jan Theobald",
      decision: "approved",
      approvedAtUtc: ctx.now.utc,
      excludedRowKeys: [],
    };

    const result = await runCommit(ctx, plan, decision);
    expect(existsSync(result.vektonceOut)).toBe(true);
    expect(existsSync(result.liquiditaetOut)).toBe(true);
    expect(result.record.decision).toBe("approved");
    expect(result.record.source.sha256).toBe(plan.rawArtifact.sha256);
  });

  test("swap-seam: the run is driven entirely by config/account.json (data, not code)", async () => {
    // Repointing account.json's workbook paths at the workshop needs zero code change — the run
    // reads everything (CSV profile, excel-maps, mapping, file paths) off this single data object.
    const account = await loadAccount(repoRoot());
    expect(account.id).toBe("commerzbank");
    expect(account.vektonceMap).toBe("vektonce");
    expect(account.dbaMapping).toBe("mapping.v1");
  });

  test("a commit with a tampered changeset-hash is impossible (no write happens)", async () => {
    const workRoot = await freshWorkRoot();
    const ctx: RunContext = { pluginRoot: repoRoot(), workRoot, approver: "Jan", now: nowFixed() };
    const plan = await runPlan(ctx, "fixtures/commerzbank/commerzbank-2026-05.csv");
    const bad: ApprovalDecision = {
      runId: plan.changeSet.runId,
      changesetHash: "tampered",
      approver: "Jan",
      decision: "approved",
      approvedAtUtc: "",
      excludedRowKeys: [],
    };
    await expect(runCommit(ctx, plan, bad)).rejects.toThrow();
  });
});
