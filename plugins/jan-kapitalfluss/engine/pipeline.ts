/**
 * Pipeline — the orchestration glue. PORTABLE: no Cowork/Anthropic import.
 *   runPlan  : ingest -> categorize -> plan writes -> ChangeSet (STOPS, no write).
 *   runCommit: approval gate -> snapshot -> values-only write -> structure assert -> GoBD archive.
 */
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { rename, rm } from "node:fs/promises";
import type {
  ApprovalDecision,
  ArchiveRecord,
  CategorizedTxn,
  ChangeSet,
  DbaMapping,
  ExcelMap,
  RawArtifact,
  RunContext,
  StoreConfig,
} from "./types";
import { getStore, loadCsvProfile, loadExcelMap } from "./config";
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
  store: StoreConfig;
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

function makeRunId(ctx: RunContext): string {
  const stamp = ctx.now.utc.replace(/[:.]/g, "-");
  return `${ctx.storeId}-${stamp}-${randomBytes(3).toString("hex")}`;
}

/** Plan a run against a Commerzbank CSV. Produces the ChangeSet for review — writes NOTHING. */
export async function runPlan(ctx: RunContext, csvPath: string): Promise<PlanResult> {
  const store = await getStore(ctx.pluginRoot, ctx.storeId);
  const profile = await loadCsvProfile(ctx.pluginRoot, store.csvProfile);
  const vektonceMap = await loadExcelMap(ctx.pluginRoot, store.vektonceMap);
  const liquiditaetMap = await loadExcelMap(ctx.pluginRoot, store.liquiditaetMap);
  const mapping = await loadDbaMapping(ctx.pluginRoot, store.dbaMapping);

  const source = makeSource(profile, resolvePath(ctx.pluginRoot, csvPath));
  const rawArtifact = await source.fetch();
  const txns = source.parse(rawArtifact);
  const categorized = categorize(mapping, txns);

  const reviewItems = categorized.filter((txn) => txn.needsReview);
  const writes = [
    ...planVektonceWrites(store, categorized, vektonceMap),
    ...planLiquiditaetWrites(store, categorized, liquiditaetMap),
  ];

  const changeSet = buildChangeSet(makeRunId(ctx), ctx.now.utc, writes, reviewItems);
  return { changeSet, rawArtifact, store, vektonceMap, liquiditaetMap, mapping, categorized };
}

/**
 * Commit a planned run. Refuses without a matching, approved ApprovalDecision.
 * Writes values only into copies under workRoot/out/<runId>/, asserts the Vektonce
 * structure (sheet names + formula cells) is unchanged, then writes the GoBD record.
 */
export async function runCommit(ctx: RunContext, plan: PlanResult, decision: ApprovalDecision): Promise<CommitResult> {
  const workRoot = ctx.workRoot ?? ctx.pluginRoot;
  const { changeSet, store, vektonceMap, rawArtifact, mapping } = plan;
  const vektonceIn = resolvePath(ctx.pluginRoot, store.vektonceWorkbook);
  const liquiditaetIn = resolvePath(ctx.pluginRoot, store.liquiditaetWorkbook);
  const outDir = join(workRoot, "out", changeSet.runId);
  const vektonceOut = join(outDir, `${store.id}-vektonce.xlsx`);
  const liquiditaetOut = join(outDir, `${store.id}-liquiditaet.xlsx`);

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
