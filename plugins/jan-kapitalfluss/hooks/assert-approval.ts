#!/usr/bin/env bun
export {}; // make this file a module so top-level await is allowed
/**
 * PreToolUse guard for mcp__kapitalfluss__commit_writes.
 * Blocks any commit that does not carry both a runId and a changesetHash — the two fields that
 * bind a write to a specific, human-approved plan. The engine still does the authoritative check
 * (the changesetHash must match the planned run); this hook just makes a bare/forged commit
 * impossible at the tool boundary. Exit 2 = block (Claude Code PreToolUse convention).
 */
const raw = await Bun.stdin.text();

let toolInput: Record<string, unknown> = {};
try {
  const parsed = JSON.parse(raw) as { tool_input?: Record<string, unknown> };
  toolInput = parsed.tool_input ?? {};
} catch {
  console.error("pre-write hook: could not parse hook input — blocking commit_writes for safety.");
  process.exit(2);
}

const runId = toolInput.runId;
const changesetHash = toolInput.changesetHash;

if (typeof runId !== "string" || runId.length === 0 || typeof changesetHash !== "string" || changesetHash.length === 0) {
  console.error(
    "pre-write hook: commit_writes is missing runId/changesetHash — no approval is bound to this write. Blocked. " +
      "Nothing is booked, nothing is sent. Plan the run and let the user approve in the change-overview first.",
  );
  process.exit(2);
}

process.exit(0);
