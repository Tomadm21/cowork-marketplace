/**
 * Local MCP server — the THIN Cowork adapter. The portable engine stays Cowork-free; this is the
 * only Cowork-facing surface. It runs locally with full-OS permissions (there is NO native
 * Commerzbank/PSD2 connector in Cowork) and exposes the engine as MCP tools. It ENFORCES the
 * approval gate: commit_writes is impossible without an ApprovalDecision whose changeset-hash
 * matches the planned run. No auto-booking, no auto-send, ever.
 *
 * Transport is a real MCP stdio server (registered tools below). Validating it inside Jan's actual
 * Cowork workspace — plugin self-install + live-artifact round-trip — stays workshop-gated (ISC-55/56).
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { runPlan, runCommit, type PlanResult } from "../engine/pipeline";
import type { ApprovalDecision, RunContext } from "../engine/types";
import { resolveRoot } from "../engine/util/paths";

interface Session {
  plan: PlanResult;
  ctx: RunContext;
  committed: boolean;
}

const sessions = new Map<string, Session>();

function berlinIso(date: Date): string {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string): string => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}+02:00`;
}

function makeCtx(): RunContext {
  const now = new Date();
  return {
    pluginRoot: resolveRoot(),
    approver: process.env.COWORK_APPROVER ?? "operator",
    now: { utc: now.toISOString(), berlin: berlinIso(now) },
  };
}

export const TOOLS = [
  {
    name: "plan_run",
    input: "{ csvPath }",
    description:
      "Ingest a Commerzbank CSV for the account, sort every movement into the Kapitalflusstabelle (credit → Einnahmen, debit → Ausgaben), and PLAN the writes. Writes NOTHING. Returns the change-overview: runId, changesetHash, summary, the planned writes, and any needs-review items.",
  },
  {
    name: "render_change_overview",
    input: "{ runId }",
    description: "Return the change-overview payload for a planned runId — the data the live-artifact approval UI renders.",
  },
  {
    name: "commit_writes",
    input: "{ runId, changesetHash, approver, excludedRowKeys }",
    description:
      "GATED. Apply the planned writes ONLY with an ApprovalDecision whose changesetHash matches the planned run. Writes values into copies of the Excel files, asserts the Vektonce structure is unchanged, and writes the GoBD archive record. No auto-booking, no auto-send.",
  },
  {
    name: "get_run_status",
    input: "{ runId }",
    description: "Return whether a run was committed and, if so, its GoBD archive record id.",
  },
] as const;

export async function dispatch(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "plan_run": {
      const csvPath = String(args.csvPath);
      const ctx = makeCtx();
      const plan = await runPlan(ctx, csvPath);
      sessions.set(plan.changeSet.runId, { plan, ctx, committed: false });
      return changeOverviewPayload(plan);
    }
    case "render_change_overview": {
      const session = requireSession(String(args.runId));
      return changeOverviewPayload(session.plan);
    }
    case "commit_writes": {
      const session = requireSession(String(args.runId));
      if (session.committed) {
        throw new Error(`Run ${session.plan.changeSet.runId} was already committed`);
      }
      const decision: ApprovalDecision = {
        runId: session.plan.changeSet.runId,
        changesetHash: String(args.changesetHash),
        approver: String(args.approver ?? session.ctx.approver),
        decision: "approved",
        approvedAtUtc: new Date().toISOString(),
        excludedRowKeys: Array.isArray(args.excludedRowKeys) ? args.excludedRowKeys.map(String) : [],
      };
      const result = await runCommit(session.ctx, session.plan, decision);
      session.committed = true;
      return { runId: session.plan.changeSet.runId, archived: result.record.recordHash, vektonceOut: result.vektonceOut };
    }
    case "get_run_status": {
      const session = requireSession(String(args.runId));
      return { runId: session.plan.changeSet.runId, committed: session.committed };
    }
    default:
      throw new Error(`Unknown tool "${name}"`);
  }
}

function requireSession(runId: string): Session {
  const session = sessions.get(runId);
  if (!session) {
    throw new Error(`Unknown runId "${runId}" — call plan_run first`);
  }
  return session;
}

function changeOverviewPayload(plan: PlanResult): Record<string, unknown> {
  return {
    runId: plan.changeSet.runId,
    changesetHash: plan.changeSet.changesetHash,
    account: plan.account.name,
    summary: plan.changeSet.summary,
    writes: plan.changeSet.writes.map((w) => ({
      workbook: w.workbook,
      sheet: w.sheet,
      cell: w.cell,
      old: w.oldValue,
      new: w.newValue,
      bucket: w.bucket,
      memo: w.sourceMemo,
      ruleId: w.ruleId,
      rowKey: w.rowKey,
      isNew: w.isNew,
    })),
    reviewItems: plan.changeSet.reviewItems.map((t) => ({
      rowKey: t.rowKey,
      date: t.bookingDate,
      amount: t.amountCents / 100,
      memo: t.purpose,
    })),
    notice: "Es wird NICHTS gebucht und NICHTS versendet. Geschrieben wird nur nach deiner Freigabe.",
  };
}

/** Build the real MCP server with the 4 tools wired to the engine via dispatch(). */
export function buildServer(): McpServer {
  const server = new McpServer({ name: "kapitalfluss", version: "0.1.0" });

  const wrap = (name: string) => async (args: Record<string, unknown>) => {
    try {
      const result = await dispatch(name, args);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { content: [{ type: "text" as const, text: message }], isError: true };
    }
  };

  server.registerTool(
    "plan_run",
    { description: TOOLS[0].description, inputSchema: { csvPath: z.string() } },
    wrap("plan_run"),
  );
  server.registerTool(
    "render_change_overview",
    { description: TOOLS[1].description, inputSchema: { runId: z.string() } },
    wrap("render_change_overview"),
  );
  server.registerTool(
    "commit_writes",
    {
      description: TOOLS[2].description,
      inputSchema: {
        runId: z.string(),
        changesetHash: z.string(),
        approver: z.string().optional(),
        excludedRowKeys: z.array(z.string()).optional(),
      },
    },
    wrap("commit_writes"),
  );
  server.registerTool(
    "get_run_status",
    { description: TOOLS[3].description, inputSchema: { runId: z.string() } },
    wrap("get_run_status"),
  );

  return server;
}

if (import.meta.main) {
  if (process.argv.includes("--manifest")) {
    console.log("Kapitalfluss MCP server — tool surface:");
    for (const tool of TOOLS) console.log(`  • ${tool.name} ${tool.input}\n      ${tool.description}`);
  } else {
    await buildServer().connect(new StdioServerTransport());
  }
}
