import { test, expect, describe, beforeAll } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { join } from "node:path";
import { ensureFixtures, repoRoot } from "./helpers";

describe("MCP server over the real stdio transport", () => {
  beforeAll(async () => {
    await ensureFixtures();
  });

  test("lists the 4 tools and plan_run returns a change-overview through the protocol", async () => {
    const root = repoRoot();
    const transport = new StdioClientTransport({
      command: process.execPath, // the bun binary running this test
      args: [join(root, "mcp", "server.ts")],
      env: { ...process.env, PLUGIN_ROOT: root } as Record<string, string>,
      cwd: root,
    });
    const client = new Client({ name: "mcp-smoke", version: "0.0.1" });
    await client.connect(transport);
    try {
      const tools = await client.listTools();
      expect(tools.tools.map((t) => t.name).sort()).toEqual([
        "commit_writes",
        "get_run_status",
        "plan_run",
        "render_change_overview",
      ]);

      const res = await client.callTool({
        name: "plan_run",
        arguments: { storeId: "linde", csvPath: "fixtures/commerzbank/linde-2026-05.csv" },
      });
      const text = (res.content as Array<{ type: string; text: string }>)[0]!.text;
      const payload = JSON.parse(text) as { runId: string; summary: { reviewCount: number }; notice: string };
      expect(payload.runId.startsWith("linde-")).toBe(true);
      expect(payload.summary.reviewCount).toBeGreaterThanOrEqual(1);
      expect(payload.notice).toContain("NICHTS gebucht");
    } finally {
      await client.close();
    }
  }, 20000);
});
