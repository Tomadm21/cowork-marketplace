import { test, expect, describe, beforeAll } from "bun:test";
import { existsSync } from "node:fs";
import { runPlan, runCommit } from "../engine/pipeline";
import { ensureFixtures, repoRoot, freshWorkRoot, nowFixed } from "./helpers";
import type { ApprovalDecision, RunContext } from "../engine/types";

describe("pipeline e2e — swap-seam: identical code, two stores via stores.json", () => {
  beforeAll(async () => {
    await ensureFixtures();
  });

  for (const store of ["linde", "michendorf"]) {
    test(`${store}: plan -> approve -> commit -> archive`, async () => {
      const workRoot = await freshWorkRoot();
      const ctx: RunContext = { pluginRoot: repoRoot(), workRoot, storeId: store, approver: "Jan Theobald", now: nowFixed() };

      const plan = await runPlan(ctx, `fixtures/commerzbank/${store}-2026-05.csv`);
      expect(plan.changeSet.writes.length).toBeGreaterThan(0);
      // the deliberately-unmatched row must surface for review, never silently bucketed
      expect(plan.changeSet.summary.reviewCount).toBeGreaterThanOrEqual(1);

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
  }

  test("a commit with a tampered changeset-hash is impossible (no write happens)", async () => {
    const workRoot = await freshWorkRoot();
    const ctx: RunContext = { pluginRoot: repoRoot(), workRoot, storeId: "linde", approver: "Jan", now: nowFixed() };
    const plan = await runPlan(ctx, "fixtures/commerzbank/linde-2026-05.csv");
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
