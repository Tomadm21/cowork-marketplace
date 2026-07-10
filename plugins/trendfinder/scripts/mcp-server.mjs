#!/usr/bin/env node
// mcp-server.mjs — Trendfinder MCP server (stdio, zero dependencies).
//
// PHASE-0 SPIKE: exposes a single tool `tf_health` that GETs <base_url>/health
// and reports the HTTP status plus runtime diagnostics (platform, cwd, proxy
// env markers). Its purpose is to measure WHERE Cowork runs plugin stdio MCP
// servers (host vs. sandbox VM) and whether that process has direct egress to
// the Trendfinder backend. Do not extend before the spike is green — see
// reference/api-contract.md and the migration plan.
//
// Deliberately dependency-free: the plugin is synced into the Cowork VM as
// plain files, no `npm install` ever runs there, so this file must run with
// nothing but Node (>= 18, global fetch). MCP stdio framing is newline-
// delimited JSON-RPC 2.0.
//
// Config {base_url, api_key} resolution mirrors scripts/tf.sh: $TRENDFINDER_CONFIG,
// else ./.trendfinder/config.json walking up parent directories. It is read
// lazily on every request — never cached at boot — because onboarding writes
// the config file mid-session. The spike only ever reads base_url; /health
// needs no auth, so api_key is never even loaded into a variable here.
//
// SECURITY: the api key must never appear in tool output, stderr, or error
// messages. Never log the parsed config object.

import { createInterface } from "node:readline";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import os from "node:os";

const SERVER_INFO = { name: "trendfinder", version: "0.12.0-spike0" };
const HEALTH_TIMEOUT_MS = 30_000; // fail fast: a firewalled VM often blackholes instead of 403ing

const TOOLS = [
  {
    name: "tf_health",
    description:
      "Connectivity probe: GET <base_url>/health on the Trendfinder backend (no auth) and report HTTP status plus runtime diagnostics (platform, cwd, proxy env). base_url comes from .trendfinder/config.json unless overridden.",
    inputSchema: {
      type: "object",
      properties: {
        base_url: {
          type: "string",
          description:
            "Optional override for the backend base URL (https://…). Defaults to base_url from .trendfinder/config.json.",
        },
      },
      additionalProperties: false,
    },
  },
];

// --- config resolution (parity with scripts/tf.sh find_config) -------------

function findConfigPath() {
  const fromEnv = process.env.TRENDFINDER_CONFIG;
  if (fromEnv) return fromEnv;
  let dir = process.cwd();
  for (;;) {
    const candidate = join(dir, ".trendfinder", "config.json");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function resolveBaseUrl() {
  const path = findConfigPath();
  if (!path) {
    throw new Error(
      "no .trendfinder/config.json found (set TRENDFINDER_CONFIG or run inside the workspace)"
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new Error(`config ${path} is not readable/valid JSON`);
  }
  const baseUrl = typeof parsed.base_url === "string" ? parsed.base_url : "";
  if (!baseUrl) throw new Error(`config ${path} is missing base_url`);
  return baseUrl;
}

// --- diagnostics ------------------------------------------------------------

function runtimeDiagnostics() {
  const proxyVars = ["https_proxy", "HTTPS_PROXY", "http_proxy", "HTTP_PROXY", "all_proxy", "ALL_PROXY"];
  return {
    platform: `${os.platform()}-${process.arch}`,
    node: process.version,
    cwd: process.cwd(),
    // names only — values never leave the process
    proxy_env_present: proxyVars.filter((v) => Boolean(process.env[v])),
    sandbox_marker_host_proxy_port: Boolean(process.env.CLAUDE_CODE_HOST_HTTP_PROXY_PORT),
  };
}

// --- tool handler -----------------------------------------------------------

async function tfHealth(args) {
  const runtime = runtimeDiagnostics();
  let baseUrl;
  try {
    const override = args?.base_url;
    if (override !== undefined) {
      if (typeof override !== "string" || !/^https?:\/\//.test(override)) {
        return { ok: false, error: "base_url override must start with http(s)://", runtime };
      }
      baseUrl = override;
    } else {
      baseUrl = resolveBaseUrl();
    }
  } catch (err) {
    return { ok: false, error: `config: ${err.message}`, runtime };
  }

  const url = baseUrl.replace(/\/+$/, "") + "/health";
  const startedAt = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
    const bodyText = (await res.text()).slice(0, 300);
    return {
      ok: res.status >= 200 && res.status < 300,
      status: res.status,
      body_snippet: bodyText,
      elapsed_ms: Date.now() - startedAt,
      runtime,
    };
  } catch (err) {
    return {
      ok: false,
      error: `${err?.name ?? "Error"}: ${err?.message ?? "fetch failed"}`,
      cause: err?.cause?.code ?? null,
      elapsed_ms: Date.now() - startedAt,
      runtime,
    };
  }
}

// --- JSON-RPC over stdio ----------------------------------------------------

function send(message) {
  process.stdout.write(JSON.stringify(message) + "\n");
}

function sendResult(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

function sendError(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

async function handle(msg) {
  const { id, method, params } = msg;
  const isNotification = id === undefined || id === null;

  switch (method) {
    case "initialize":
      sendResult(id, {
        protocolVersion: params?.protocolVersion ?? "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });
      return;
    case "ping":
      sendResult(id, {});
      return;
    case "tools/list":
      sendResult(id, { tools: TOOLS });
      return;
    case "tools/call": {
      if (params?.name !== "tf_health") {
        sendError(id, -32602, `Unknown tool: ${params?.name}`);
        return;
      }
      const result = await tfHealth(params?.arguments ?? {});
      sendResult(id, { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
      return;
    }
    default:
      if (!isNotification) sendError(id, -32601, `Method not found: ${method}`);
  }
}

const rl = createInterface({ input: process.stdin, terminal: false });
rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let msg;
  try {
    msg = JSON.parse(trimmed);
  } catch {
    process.stderr.write("mcp-server: skipping non-JSON input line\n");
    return;
  }
  handle(msg).catch((err) => {
    if (msg.id !== undefined && msg.id !== null) {
      sendError(msg.id, -32603, `Internal error: ${err?.message ?? "unknown"}`);
    }
  });
});
rl.on("close", () => process.exit(0));
