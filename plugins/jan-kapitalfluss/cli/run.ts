#!/usr/bin/env bun
/**
 * CLI driver — proves the engine is portable (zero Cowork dependency) and drives Tier-1/Tier-2 + dev.
 *   bun cli/run.ts --store linde --csv fixtures/commerzbank/linde-2026-05.csv            # PLAN only (no write)
 *   bun cli/run.ts --store linde --csv <path> --approve "Jan Theobald"                   # plan + commit
 *   bun cli/run.ts --store linde --csv <path> --root <pluginRoot> --work <outRoot>
 */
import { runPlan, runCommit } from "../engine/pipeline";
import { resolveRoot } from "../engine/util/paths";
import type { ApprovalDecision, RunContext } from "../engine/types";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function berlinIso(date: Date): string {
  const p = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(date);
  const g = (t: string): string => p.find((x) => x.type === t)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}:${g("second")}+02:00`;
}

const storeId = arg("store");
const csv = arg("csv");
if (!storeId || !csv) {
  console.error("usage: bun cli/run.ts --store <id> --csv <path> [--root <dir>] [--work <dir>] [--approve <approver>]");
  process.exit(1);
}

const approver = arg("approve");
const now = new Date();
const ctx: RunContext = {
  pluginRoot: resolveRoot(arg("root")),
  workRoot: arg("work"),
  storeId,
  approver: approver ?? "operator",
  now: { utc: now.toISOString(), berlin: berlinIso(now) },
};

const plan = await runPlan(ctx, csv);
const cs = plan.changeSet;
console.log(`\nLauf ${cs.runId} — ${plan.store.name}`);
console.log(`${cs.summary.txnCount} Posten · ${cs.summary.newRowCount} neue Zeilen · ${cs.summary.changedCount} gesetzte Werte · ${cs.summary.reviewCount} Review`);
for (const w of cs.writes) {
  console.log(`  ${w.workbook}/${w.sheet} ${w.cell.padEnd(5)} ${String(w.newValue).padStart(12)}  [${w.bucket}]  ${w.sourceMemo.slice(0, 48)}`);
}
if (cs.reviewItems.length) {
  console.log("  Review nötig (nicht verbucht):");
  for (const r of cs.reviewItems) console.log(`   ? ${r.bookingDate} ${(r.amountCents / 100).toFixed(2).padStart(10)}  ${r.purpose.slice(0, 48)}`);
}
console.log("\nEs wird NICHTS gebucht und NICHTS versendet, ohne Freigabe.");

if (!approver) {
  console.log("(Nur Plan — zum Schreiben mit --approve <Name> erneut ausführen.)");
  process.exit(0);
}

const decision: ApprovalDecision = {
  runId: cs.runId,
  changesetHash: cs.changesetHash,
  approver,
  decision: "approved",
  approvedAtUtc: ctx.now.utc,
  excludedRowKeys: [],
};
const result = await runCommit(ctx, plan, decision);
console.log(`\nFreigegeben von ${approver} — geschrieben:`);
console.log(`  ${result.vektonceOut}`);
console.log(`  ${result.liquiditaetOut}`);
console.log(`  Archiv-Record: ${result.record.recordHash}`);
