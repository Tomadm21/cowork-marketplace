/**
 * Pipeline — the orchestration glue. PORTABLE: no Cowork/Anthropic import.
 *   runPlan  : ingest -> categorize -> plan writes -> ChangeSet (STOPS, no write).
 *   runCommit: approval gate -> snapshot -> values-only write -> structure assert -> GoBD archive.
 */
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { rename, rm } from "node:fs/promises";
import type {
  AccountConfig,
  ApprovalDecision,
  ArchiveRecord,
  CategorizedTxn,
  ChangeSet,
  DbaMapping,
  ExcelMap,
  RawArtifact,
  RunContext,
} from "./types";
import { loadAccount, loadCsvProfile, loadExcelMap } from "./config";
import { loadDbaMapping } from "./categorize/rules";
import { categorize } from "./categorize/Categorizer";
import { makeSource } from "./ingest/TransactionSource";
import { buildChangeSet } from "./diff/ChangeOverview";
import { planVektonceWrites, applyVektonceWrites } from "./excel/VektonceWriter";
import { planLiquiditaetWrites, applyLiquiditaetWrites } from "./excel/LiquiditaetWriter";
import { WorkbookWriter } from "./excel/WorkbookWriter";
import { structureFingerprint, assertUnchanged } from "./excel/safeguards";
import { ApprovalGate } from "./approval";
import { GobdArchiver } from "./archive/GobdArchiver";
import { resolvePath } from "./util/paths";

export interface PlanResult {
  changeSet: ChangeSet;
  rawArtifact: RawArtifact;
  account: AccountConfig;
  vektonceMap: ExcelMap;
  liquiditaetMap: ExcelMap;
  mapping: DbaMapping;
  categorized: CategorizedTxn[];
}

export interface CommitResult {
  record: ArchiveRecord;
  vektonceOut: string;
  liquiditaetOut: string;
}

function makeRunId(ctx: RunContext, accountId: string): string {
  const stamp = ctx.now.utc.replace(/[:.]/g, "-");
  return `${accountId}-${stamp}-${randomBytes(3).toString("hex")}`;
}

/** Plan a run against a Commerzbank CSV. Produces the ChangeSet for review — writes NOTHING. */
export async function runPlan(ctx: RunContext, csvPath: string): Promise<PlanResult> {
  const account = await loadAccount(ctx.pluginRoot);
  const profile = await loadCsvProfile(ctx.pluginRoot, account.csvProfile);
  const vektonceMap = await loadExcelMap(ctx.pluginRoot, account.vektonceMap);
  const liquiditaetMap = await loadExcelMap(ctx.pluginRoot, account.liquiditaetMap);
  const mapping = await loadDbaMapping(ctx.pluginRoot, account.dbaMapping);

  const source = makeSource(profile, resolvePath(ctx.pluginRoot, csvPath));
  const rawArtifact = await source.fetch();
  const txns = source.parse(rawArtifact);
  const categorized = categorize(mapping, txns);

  // The Kapitalflusstabelle takes EVERY movement: each credit → Einnahmen, each debit → Ausgaben.
  // With the sign-based split nothing falls to review in normal operation; the review path stays
  // as a safety net (e.g. a stray zero-amount row that escaped the CSV info-row filter).
  const reviewItems = categorized.filter((txn) => txn.needsReview);
  const writes = [
    ...planVektonceWrites(categorized, vektonceMap),
    ...planLiquiditaetWrites(categorized, liquiditaetMap),
  ];

  const changeSet = buildChangeSet(makeRunId(ctx, account.id), ctx.now.utc, writes, reviewItems);
  return { changeSet, rawArtifact, account, vektonceMap, liquiditaetMap, mapping, categorized };
}

/**
 * Commit a planned run. Refuses without a matching, approved ApprovalDecision.
 * Writes values only into copies under workRoot/out/<runId>/, asserts the Vektonce
 * structure (sheet names + formula cells) is unchanged, then writes the GoBD record.
 */
export async function runCommit(ctx: RunContext, plan: PlanResult, decision: ApprovalDecision): Promise<CommitResult> {
  const workRoot = ctx.workRoot ?? ctx.pluginRoot;
  const { changeSet, account, vektonceMap, rawArtifact, mapping } = plan;
  const vektonceIn = resolvePath(ctx.pluginRoot, account.vektonceWorkbook);
  const liquiditaetIn = resolvePath(ctx.pluginRoot, account.liquiditaetWorkbook);
  const outDir = join(workRoot, "out", changeSet.runId);
  const vektonceOut = join(outDir, `${account.id}-vektonce.xlsx`);
  const liquiditaetOut = join(outDir, `${account.id}-liquiditaet.xlsx`);

  // Snapshot + fingerprint the existing Vektonce file BEFORE any write (the no-alter guard).
  const beforeFp = await structureFingerprint(vektonceIn);
  const beforeSnap = await WorkbookWriter.loadSnapshot(vektonceIn);

  const record = await ApprovalGate.commit(changeSet, decision, async (filtered) => {
    // Vektonce: open the existing workbook, append values only, save to a TEMP copy first.
    const vw = new WorkbookWriter();
    await vw.open(vektonceIn);
    applyVektonceWrites(vw, filtered, vektonceMap);
    const vektonceTmp = `${vektonceOut}.tmp`;
    await vw.save(vektonceTmp);

    // The no-alter assertion runs on the temp BEFORE it becomes the accepted output. If the
    // structure (sheet names / formula text / numFmt) changed, this throws — and the temp is
    // discarded, so a corrupted file never lands as the result.
    const afterFp = await structureFingerprint(vektonceTmp);
    try {
      assertUnchanged(beforeFp, afterFp);
    } catch (error) {
      await rm(vektonceTmp, { force: true });
      throw error;
    }
    await rename(vektonceTmp, vektonceOut); // promote only after validation passes
    const afterSnap = await WorkbookWriter.loadSnapshot(vektonceOut);

    // Liquiditaetsplanung: set the mapped P&L cells (a fresh copy in out/).
    const lw = new WorkbookWriter();
    await lw.open(liquiditaetIn);
    applyLiquiditaetWrites(lw, filtered);
    await lw.save(liquiditaetOut);

    return GobdArchiver.archiveRun({
      root: workRoot,
      changeSet,
      rawArtifact,
      mapping,
      decision,
      snapshotBeforeHash: beforeSnap.sha256,
      snapshotAfterHash: afterSnap.sha256,
      timestampUtc: ctx.now.utc,
      timestampBerlin: ctx.now.berlin,
    });
  });

  return { record, vektonceOut, liquiditaetOut };
}
