#!/usr/bin/env node
// mcp-server.mjs — Trendfinder MCP server (stdio, zero dependencies).
//
// Hosts the plugin's HTTP transport OUTSIDE the Cowork bash sandbox: Cowork
// starts plugin stdio MCP servers host-side (measured 2026-07-10 — Phase-0
// spike: platform darwin, direct egress, no proxy env), so requests made here
// are not subject to the sandbox egress allowlist that blocks curl/fetch in
// sandboxed bash. Claude Code CLI runs this server host-side anyway.
//
// Deliberately dependency-free: the plugin is synced into Cowork as plain
// files, no `npm install` ever runs there, so this file must run with nothing
// but Node (>= 18, global fetch). MCP stdio framing is newline-delimited
// JSON-RPC 2.0. Cowork's bundled runtime is Node 20 (measured).
//
// Config {base_url, api_key} resolution, lazy on EVERY request (onboarding
// writes the config mid-session — never cache at boot):
//   1. $TRENDFINDER_CONFIG (explicit path)
//   2. ./.trendfinder/config.json walking up from cwd (tf.sh parity; in
//      Cowork the server's cwd IS the session workspace/outputs dir)
//   3. ~/.trendfinder/config.json — host-user fallback written by
//      tf_configure, survives across Cowork sessions whose per-session
//      workspace starts empty
//
// SECURITY:
// - The api key must never appear in tool output, stderr, or error messages.
//   Never log the parsed config object. tf_configure never echoes the key.
// - tf_request refuses absolute URLs (endpoint is hard-prefixed with the
//   configured base_url — SSRF guard), admin routes (/api/admin/*), and the
//   ops-only generation routes that spend backend LLM budget (see
//   reference/api-contract.md): …/content-pieces/generate,
//   …/generate-script, …/regenerate-section, …/translate.

import { createInterface } from "node:readline";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import os from "node:os";

const SERVER_INFO = { name: "trendfinder", version: "0.12.0" };
const REQUEST_TIMEOUT_MS = 120_000; // tf.sh parity: --max-time 120 (Node fetch has no separate connect timeout)
const HEALTH_TIMEOUT_MS = 30_000;

const ALLOWED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

const TOOLS = [
  {
    name: "tf_request",
    description:
      "Call the Trendfinder backend API. endpoint must be a path starting with '/' (e.g. /api/niches/config) — it is prefixed with the configured base_url; absolute URLs are rejected. Sends X-API-Key from .trendfinder/config.json. Returns {ok, status, body} for EVERY HTTP status — 4xx/5xx are data, not errors (skills branch on 201/409/422/503 etc.). Admin (/api/admin/*) and ops-only generation routes are refused. See reference/api-contract.md for endpoints.",
    inputSchema: {
      type: "object",
      properties: {
        method: { type: "string", enum: ALLOWED_METHODS },
        endpoint: {
          type: "string",
          description: "API path starting with '/', optionally with query string. No scheme/host.",
        },
        body: {
          type: "object",
          description: "Optional JSON body, sent as application/json.",
        },
      },
      required: ["method", "endpoint"],
      additionalProperties: false,
    },
  },
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
  {
    name: "tf_configure",
    description:
      "Onboarding only: persist {base_url, api_key} to ~/.trendfinder/config.json (0600) on the host so every future session finds the config even when the session workspace starts empty. The key is stored, never echoed back. Workspace-level .trendfinder/config.json (written by onboarding) takes precedence over this fallback.",
    inputSchema: {
      type: "object",
      properties: {
        base_url: { type: "string", description: "Backend base URL, https://…" },
        api_key: { type: "string", description: "Tenant API key to store. Never echoed back." },
      },
      required: ["base_url", "api_key"],
      additionalProperties: false,
    },
  },
];

// --- config resolution -------------------------------------------------------

function homeConfigPath() {
  return join(os.homedir(), ".trendfinder", "config.json");
}

function findConfigPath() {
  const fromEnv = process.env.TRENDFINDER_CONFIG;
  if (fromEnv) return fromEnv;
  let dir = process.cwd();
  for (;;) {
    const candidate = join(dir, ".trendfinder", "config.json");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  const home = homeConfigPath();
  if (existsSync(home)) return home;
  return null;
}

function loadConfig({ requireKey }) {
  const path = findConfigPath();
  if (!path) {
    throw new Error(
      "no .trendfinder/config.json found (set TRENDFINDER_CONFIG, run inside the workspace, or run the onboarding skill — it stores a host fallback via tf_configure)"
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new Error(`config ${path} is not readable/valid JSON`);
  }
  const baseUrl = typeof parsed.base_url === "string" ? parsed.base_url.trim() : "";
  const apiKey = typeof parsed.api_key === "string" ? parsed.api_key.trim() : "";
  if (!baseUrl || (requireKey && !apiKey)) {
    throw new Error(`config ${path} is missing base_url or api_key`);
  }
  return { baseUrl, apiKey };
}

// --- helpers ------------------------------------------------------------------

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

function joinUrl(baseUrl, endpoint) {
  return baseUrl.replace(/\/+$/, "") + endpoint;
}

// Guards operate on the path only (query string stripped).
const OPS_ONLY_PATTERNS = [
  /^\/api\/personas\/[^/]+\/content-pieces\/generate\/?$/,
  /^\/api\/content-pieces\/[^/]+\/generate-script\/?$/,
  /^\/api\/content-pieces\/[^/]+\/regenerate-section\/?$/,
  /^\/api\/content-pieces\/[^/]+\/translate\/?$/,
];

function validateEndpoint(endpoint) {
  if (typeof endpoint !== "string" || endpoint.length === 0) {
    return "endpoint is required";
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(endpoint) || endpoint.includes("://")) {
    return "endpoint must be a path like /api/…, not an absolute URL (it is prefixed with the configured base_url)";
  }
  if (!endpoint.startsWith("/") || endpoint.startsWith("//")) {
    return "endpoint must start with a single '/'";
  }
  if (/\s/.test(endpoint)) {
    return "endpoint must not contain whitespace";
  }
  const path = endpoint.split("?")[0];
  if (path === "/api/admin" || path.startsWith("/api/admin/")) {
    return "refused: /api/admin/* routes are operator-only — the plugin never calls them (see api-contract.md)";
  }
  if (OPS_ONLY_PATTERNS.some((re) => re.test(path))) {
    return "refused: ops-only generation route — it spends backend LLM budget and returns 403 for tenant keys anyway; synthesis happens natively in Claude (see api-contract.md)";
  }
  return null;
}

// --- tool handlers --------------------------------------------------------------

async function tfRequest(args) {
  const method = args?.method;
  if (!ALLOWED_METHODS.includes(method)) {
    return { ok: false, status: null, error: `method must be one of ${ALLOWED_METHODS.join("/")}` };
  }
  const endpointError = validateEndpoint(args?.endpoint);
  if (endpointError) {
    return { ok: false, status: null, blocked: true, error: endpointError };
  }
  if (args?.body !== undefined && (typeof args.body !== "object" || args.body === null || Array.isArray(args.body))) {
    return { ok: false, status: null, error: "body must be a JSON object" };
  }

  let config;
  try {
    config = loadConfig({ requireKey: true });
  } catch (err) {
    return { ok: false, status: null, error: `config: ${err.message}` };
  }

  const url = joinUrl(config.baseUrl, args.endpoint);
  const init = {
    method,
    headers: { "X-API-Key": config.apiKey, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  };
  if (args.body !== undefined) init.body = JSON.stringify(args.body);

  try {
    const res = await fetch(url, init);
    const raw = await res.text();
    let body = null;
    if (raw.length > 0) {
      try {
        body = JSON.parse(raw);
      } catch {
        body = raw;
      }
    }
    return { ok: res.status >= 200 && res.status < 300, status: res.status, body };
  } catch (err) {
    return {
      ok: false,
      status: null,
      error: `${err?.name ?? "Error"}: ${err?.message ?? "fetch failed"}`,
      cause: err?.cause?.code ?? null,
    };
  }
}

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
      baseUrl = loadConfig({ requireKey: false }).baseUrl;
    }
  } catch (err) {
    return { ok: false, error: `config: ${err.message}`, runtime };
  }

  const url = joinUrl(baseUrl, "/health");
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

function tfConfigure(args) {
  const baseUrl = typeof args?.base_url === "string" ? args.base_url.trim() : "";
  const apiKey = typeof args?.api_key === "string" ? args.api_key.trim() : "";
  if (!/^https?:\/\//.test(baseUrl)) {
    return { ok: false, error: "base_url must start with http(s)://" };
  }
  if (!apiKey) {
    return { ok: false, error: "api_key must be a non-empty string" };
  }
  const path = homeConfigPath();
  try {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    writeFileSync(path, JSON.stringify({ base_url: baseUrl, api_key: apiKey }, null, 2) + "\n", {
      mode: 0o600,
    });
  } catch (err) {
    return { ok: false, error: `could not write ${path}: ${err?.code ?? err?.message ?? "unknown"}` };
  }
  return { ok: true, path, base_url: baseUrl, note: "api_key stored, not echoed" };
}

// --- JSON-RPC over stdio ---------------------------------------------------------

function send(message) {
  process.stdout.write(JSON.stringify(message) + "\n");
}

function sendResult(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

function sendError(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

async function callTool(name, args) {
  switch (name) {
    case "tf_request":
      return tfRequest(args);
    case "tf_health":
      return tfHealth(args);
    case "tf_configure":
      return tfConfigure(args);
    default:
      return null;
  }
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
      const result = await callTool(params?.name, params?.arguments ?? {});
      if (result === null) {
        sendError(id, -32602, `Unknown tool: ${params?.name}`);
        return;
      }
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
